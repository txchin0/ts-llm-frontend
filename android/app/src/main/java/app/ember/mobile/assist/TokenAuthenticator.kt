package app.ember.mobile.assist

import android.util.Log
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import org.json.JSONObject

/**
 * OkHttp [Authenticator] that turns a 401 into POST /v1/auth/refresh + retry.
 * The mirrored access token is usually stale by the time the assistant fires
 * (it outlives the WebView by design), so this is the normal path, not an
 * edge case.
 *
 * Refreshes are single-flight: concurrent 401s queue on the lock and reuse
 * the token the winning thread stored. The rotated pair is written back to
 * the shared [AuthTokenStore] so the web app picks it up; a definitive
 * 401/403 from the refresh endpoint re-reads the store first (the WebView
 * may have won a concurrent rotation) and only then clears on a true reject.
 * Transient failures leave the store untouched.
 */
class TokenAuthenticator(
    private val baseUrl: String,
    private val tokens: AuthTokenStore,
) : Authenticator {

    // Bare client: no authenticator, so a 401 from /refresh cannot recurse.
    private val refreshClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null // one refresh + retry per call
        synchronized(this) {
            val sent = response.request.header("Authorization")?.removePrefix("Bearer ")
            val current = tokens.accessToken
            // Another call refreshed while we waited on the lock; just retry with it.
            if (current != null && current != sent) return retryWith(response, current)
            val fresh = refresh() ?: return null
            return retryWith(response, fresh)
        }
    }

    private fun retryWith(response: Response, accessToken: String): Request =
        response.request.newBuilder()
            .header("Authorization", "Bearer $accessToken")
            .build()

    /** Exchanges the stored refresh token for a new pair. Null = give up (the 401 stands). */
    private fun refresh(): String? {
        val refreshToken = tokens.refreshToken ?: return null
        val body = JSONObject().put("refresh_token", refreshToken).toString()
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$baseUrl$REFRESH_PATH")
            .post(body)
            .build()
        return try {
            refreshClient.newCall(request).execute().use { resp ->
                when {
                    resp.isSuccessful -> {
                        val json = JSONObject(resp.body?.string() ?: return null)
                        val access = json.optString("access_token").ifEmpty { return null }
                        tokens.update(access, json.optString("refresh_token").ifEmpty { null })
                        Log.i(TAG, "access token refreshed")
                        access
                    }
                    resp.code == 401 || resp.code == 403 -> {
                        // The WebView may have won a concurrent rotation and
                        // already written a fresh pair to the shared store.
                        // Re-read before clearing so we do not sign out of a
                        // still-valid session.
                        val adopted = tokens.refreshToken
                        val access = tokens.accessToken
                        if (adopted != null && adopted != refreshToken && access != null) {
                            Log.i(TAG, "adopted refresh rotated by another process")
                            access
                        } else {
                            Log.w(TAG, "refresh token rejected (${resp.code}); clearing session")
                            tokens.clear()
                            null
                        }
                    }
                    else -> {
                        Log.w(TAG, "token refresh failed (${resp.code})")
                        null
                    }
                }
            }
        } catch (e: IOException) {
            Log.w(TAG, "token refresh failed", e)
            null
        } catch (e: Exception) {
            Log.w(TAG, "token refresh response unparseable", e)
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    companion object {
        /** Contract-tested against protocol/endpoints.json (authRefresh). */
        internal const val REFRESH_PATH = "/v1/auth/refresh"
        private const val TAG = "EmberAssist"
    }
}
