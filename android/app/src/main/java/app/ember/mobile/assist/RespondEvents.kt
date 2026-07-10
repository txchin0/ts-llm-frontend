package app.ember.mobile.assist

import org.json.JSONObject

/**
 * The overlay's view of a Respond SSE payload, decoded off the wire. Mirrors
 * the event vocabulary in src/api/types.ts; the canonical samples live in
 * protocol/respond.json and RespondProtocolTest replays them through [parse].
 */
sealed interface RespondEvent {
    data class SessionStarted(val sessionId: String) : RespondEvent
    data class Delta(val text: String) : RespondEvent
    data class ToolActivity(val toolName: String) : RespondEvent
    object Final : RespondEvent
    data class Error(val message: String) : RespondEvent

    companion object {
        /**
         * Decode one SSE `data` payload.
         * - [RespondParseResult.Rendered]: overlay should surface it
         * - [RespondParseResult.Ignored]: blank, or a known type the overlay
         *   does not render (thinking_delta, usage, tool_result)
         * - [RespondParseResult.Malformed]: unparseable JSON, unknown type, or
         *   a known renderable type missing required fields
         */
        fun parse(payload: String): RespondParseResult {
            if (payload.isBlank()) return RespondParseResult.Ignored
            val json = try {
                JSONObject(payload)
            } catch (e: Exception) {
                return RespondParseResult.Malformed(
                    "unparseable JSON: ${e.message ?: "unknown"}",
                )
            }
            val type = json.optString("type")
            return when (type) {
                "start" -> json.optString("session_id").takeIf { it.isNotEmpty() }
                    ?.let { RespondParseResult.Rendered(SessionStarted(it)) }
                    ?: RespondParseResult.Malformed("incomplete start event")
                "delta" -> json.optString("text").takeIf { it.isNotEmpty() }
                    ?.let { RespondParseResult.Rendered(Delta(it)) }
                    ?: RespondParseResult.Malformed("incomplete delta event")
                "tool_call" -> json.optString("tool_name").takeIf { it.isNotEmpty() }
                    ?.let { RespondParseResult.Rendered(ToolActivity(it)) }
                    ?: RespondParseResult.Malformed("incomplete tool_call event")
                "final" -> RespondParseResult.Rendered(Final)
                "error" -> RespondParseResult.Rendered(
                    Error(json.optString("message").ifEmpty { "Agent error" }),
                )
                // Known types the overlay does not render.
                "thinking_delta", "usage", "tool_result" -> RespondParseResult.Ignored
                else -> RespondParseResult.Malformed(
                    "unknown event type: ${type.ifEmpty { "(missing)" }}",
                )
            }
        }
    }
}

/**
 * Outcome of [RespondEvent.parse]. Callers must not treat [Malformed] like an
 * intentional skip — that is wire corruption or an unknown vocabulary member.
 */
sealed interface RespondParseResult {
    data class Rendered(val event: RespondEvent) : RespondParseResult
    object Ignored : RespondParseResult
    data class Malformed(val detail: String) : RespondParseResult
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
