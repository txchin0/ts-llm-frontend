package app.ember.mobile.assist

import org.json.JSONObject

/**
 * The overlay's view of a Respond SSE payload, decoded off the wire. Mirrors
 * the event vocabulary in src/api/types.ts; the canonical samples live in
 * protocol/respond.json and RespondProtocolTest replays them through [parse].
 * Events the overlay does not render (thinking_delta, usage, tool_result)
 * decode to null by design.
 */
sealed interface RespondEvent {
    data class SessionStarted(val sessionId: String) : RespondEvent
    data class Delta(val text: String) : RespondEvent
    data class ToolActivity(val toolName: String) : RespondEvent
    object Final : RespondEvent
    data class Error(val message: String) : RespondEvent

    companion object {
        /** Decode one SSE `data` payload; null = blank, unparseable, or not rendered. */
        fun parse(payload: String): RespondEvent? {
            if (payload.isBlank()) return null
            val json = try {
                JSONObject(payload)
            } catch (_: Exception) {
                return null
            }
            return when (json.optString("type")) {
                "start" -> json.optString("session_id").takeIf { it.isNotEmpty() }
                    ?.let { SessionStarted(it) }
                "delta" -> json.optString("text").takeIf { it.isNotEmpty() }
                    ?.let { Delta(it) }
                "tool_call" -> json.optString("tool_name").takeIf { it.isNotEmpty() }
                    ?.let { ToolActivity(it) }
                "final" -> Final
                "error" -> Error(json.optString("message").ifEmpty { "Agent error" })
                else -> null
            }
        }
    }
}

/**
 * Accumulates raw SSE lines into complete `data` payloads. Mirrors
 * src/api/sse.ts: a frame ends at a blank line, multiple `data:` lines join
 * with '\n', and `event:`/`id:`/comment lines carry nothing we need.
 */
class SseDataAccumulator {
    private val dataLines = StringBuilder()

    /** Feed one line; returns the completed payload when the frame ends. */
    fun feed(line: String): String? {
        when {
            line.isEmpty() -> return flush()
            line.startsWith("data:") -> {
                if (dataLines.isNotEmpty()) dataLines.append('\n')
                dataLines.append(line.removePrefix("data:").removePrefix(" "))
            }
        }
        return null
    }

    /** Drain any buffered payload (stream ended without a trailing blank line). */
    fun flush(): String? {
        if (dataLines.isEmpty()) return null
        val payload = dataLines.toString()
        dataLines.setLength(0)
        return payload
    }
}
