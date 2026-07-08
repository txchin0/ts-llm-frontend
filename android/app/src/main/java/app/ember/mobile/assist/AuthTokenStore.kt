package app.ember.mobile.assist

import android.content.Context

/**
 * Access/refresh tokens for the agent server, shared with the web app through
 * the Capacitor Preferences backing store ("CapacitorStorage"
 * SharedPreferences). The web app mirrors the pair here on login/refresh
 * (src/native/settingsMirror.ts); the native layer writes back the pair it
 * receives from POST /v1/auth/refresh so both layers converge on the newest
 * tokens.
 */
class AuthTokenStore(context: Context) {

    private val prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)

    val accessToken: String? get() = read(KEY_ACCESS_TOKEN)
    val refreshToken: String? get() = read(KEY_REFRESH_TOKEN)

    /** False means signed out (never logged in, or logged out in the web app). */
    val hasSession: Boolean get() = accessToken != null || refreshToken != null

    /** Persist a refreshed pair. A null [refreshToken] keeps the stored one. */
    fun update(accessToken: String, refreshToken: String?) {
        prefs.edit().apply {
            putString(KEY_ACCESS_TOKEN, accessToken)
            if (refreshToken != null) putString(KEY_REFRESH_TOKEN, refreshToken)
        }.apply()
    }

    /** For when the server rejects the refresh token: the session is dead everywhere. */
    fun clear() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .apply()
    }

    private fun read(key: String): String? =
        prefs.getString(key, null)?.trim()?.ifEmpty { null }

    private companion object {
        const val STORE = "CapacitorStorage"
        const val KEY_ACCESS_TOKEN = "ts-llm.access_token"
        const val KEY_REFRESH_TOKEN = "ts-llm.refresh_token"
    }
}
