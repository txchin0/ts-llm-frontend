package app.ember.mobile.assist

import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject

/**
 * Streams a chat turn from the ts-llm agent server: POST /v1/respond with an
 * SSE response. Mirrors the web client (src/api/client.ts + sse.ts): frames
 * are blank-line separated, payload JSON carries the event `type`. Only the
 * events the overlay renders are surfaced; thinking/usage/tool_result are
 * ignored. All callbacks are delivered on the main thread.
 *
 * Identity comes from the bearer token, never from the body. A 401 is
 * refreshed + retried once by [TokenAuthenticator]; if it still fails the
 * user is asked to sign in again in the web app.
 */
class RespondClient(private val baseUrl: String, private val tokens: AuthTokenStore) {

    interface Callbacks {
        fun onSessionStarted(sessionId: String)
        fun onDelta(text: String)
        fun onToolActivity(toolName: String)
        fun onFinal()
        fun onError(message: String)
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // streaming: no read timeout
        .authenticator(TokenAuthenticator(baseUrl, tokens))
        .build()
    private val mainHandler = Handler(Looper.getMainLooper())

    /** Returns the in-flight [Call]; cancel it when the overlay is dismissed. */
    fun send(message: String, sessionId: String?, callbacks: Callbacks): Call {
        val body = JSONObject().apply {
            put("message", message)
            if (sessionId != null) put("session_id", sessionId)
        }
        val request = Request.Builder()
            .url("$baseUrl/v1/respond")
            .header("accept", "text/event-stream")
            .apply {
                // May be absent/expired (assistant outlives the WebView); the
                // authenticator turns the resulting 401 into refresh + retry.
                tokens.accessToken?.let { header("Authorization", "Bearer $it") }
            }
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val call = client.newCall(request)
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "respond failed", e)
                if (call.isCanceled()) return
                post { callbacks.onError(e.message ?: "Could not reach the agent server") }
            }

            override fun onResponse(call: Call, response: Response) {
                Log.i(TAG, "respond response: ${response.code}")
                response.use { resp ->
                    if (!resp.isSuccessful) {
                        val message = if (resp.code == 401) {
                            "Signed out — open Ember and sign in again"
                        } else {
                            "Agent server error (${resp.code})"
                        }
                        post { callbacks.onError(message) }
                        return
                    }
                    val source = resp.body?.source()
                    if (source == null) {
                        post { callbacks.onError("The agent server returned an empty response") }
                        return
                    }

                    val dataLines = StringBuilder()
                    try {
                        while (true) {
                            val line = source.readUtf8Line() ?: break
                            when {
                                line.isEmpty() -> {
                                    dispatch(dataLines.toString(), callbacks)
                                    dataLines.setLength(0)
                                }
                                line.startsWith("data:") -> {
                                    if (dataLines.isNotEmpty()) dataLines.append('\n')
                                    dataLines.append(line.removePrefix("data:").removePrefix(" "))
                                }
                                // event:/id:/comment lines carry nothing we need.
                            }
                        }
                        dispatch(dataLines.toString(), callbacks)
                    } catch (e: IOException) {
                        if (!call.isCanceled()) {
                            post { callbacks.onError(e.message ?: "Stream interrupted") }
                        }
                    }
                }
            }
        })
        return call
    }

    private fun dispatch(payload: String, callbacks: Callbacks) {
        if (payload.isBlank()) return
        val json = try {
            JSONObject(payload)
        } catch (e: Exception) {
            Log.w(TAG, "unparseable SSE payload: ${payload.take(120)}", e)
            return
        }
        when (json.optString("type")) {
            "start" -> json.optString("session_id").takeIf { it.isNotEmpty() }
                ?.let { id -> post { callbacks.onSessionStarted(id) } }
            "delta" -> json.optString("text").takeIf { it.isNotEmpty() }
                ?.let { text -> post { callbacks.onDelta(text) } }
            "tool_call" -> json.optString("tool_name").takeIf { it.isNotEmpty() }
                ?.let { name -> post { callbacks.onToolActivity(name) } }
            "final" -> post { callbacks.onFinal() }
            "error" -> post { callbacks.onError(json.optString("message").ifEmpty { "Agent error" }) }
        }
    }

    private fun post(block: () -> Unit) {
        mainHandler.post(block)
    }

    private companion object {
        const val TAG = "EmberAssist"
    }
}
