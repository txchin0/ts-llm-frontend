package app.ember.mobile.assist

import android.content.Context
import java.util.Locale

/**
 * App settings the assistant needs, read from the Capacitor Preferences
 * backing store ("CapacitorStorage" SharedPreferences). The web app mirrors
 * localStorage writes there (src/native/settingsMirror.ts); this class only
 * reads. Auth tokens live in the same store but are read-write — see
 * [AuthTokenStore].
 */
data class EmberSettings(
    /** Normalized absolute base URL of the agent server, or null when unset. */
    val serverUrl: String?,
    /** Concrete BCP 47 tag ("system" is resolved to the device locale). */
    val micLanguage: String,
) {
    companion object {
        // Shared with the web app; contract-tested against protocol/handshake.json.
        internal const val STORE = "CapacitorStorage"
        internal const val KEY_SERVER_URL = "ts-llm.server_url"
        internal const val KEY_MIC_LANGUAGE = "ts-llm.mic_language"

        fun load(context: Context): EmberSettings {
            val prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
            return EmberSettings(
                serverUrl = normalizeServerUrl(prefs.getString(KEY_SERVER_URL, null)),
                micLanguage = resolveMicLanguage(prefs.getString(KEY_MIC_LANGUAGE, null)),
            )
        }

        /** Mirror of getApiBaseUrl() in src/api/config.ts: trim, strip trailing
         * slashes, assume http:// for a bare host:port. */
        fun normalizeServerUrl(raw: String?): String? {
            val trimmed = raw?.trim()?.trimEnd('/') ?: return null
            if (trimmed.isEmpty()) return null
            return if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)) {
                trimmed
            } else {
                "http://$trimmed"
            }
        }

        private fun resolveMicLanguage(stored: String?): String {
            val value = stored?.trim()
            if (value.isNullOrEmpty() || value == "system") {
                return Locale.getDefault().toLanguageTag()
            }
            return value
        }
    }
}
