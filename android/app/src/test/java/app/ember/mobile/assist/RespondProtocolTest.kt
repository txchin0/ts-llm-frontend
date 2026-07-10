package app.ember.mobile.assist

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies the Kotlin spelling of the Respond protocol against
 * protocol/respond.json and protocol/endpoints.json (on the test classpath via
 * build.gradle). The web client checks the same fixtures in
 * src/api/respondProtocol.test.ts, so a protocol change that skips this side
 * fails here instead of silently deafening the assistant overlay.
 */
class RespondProtocolTest {

    private val respond: JSONObject by lazy {
        val text = checkNotNull(javaClass.classLoader?.getResourceAsStream("respond.json")) {
            "protocol/respond.json not on the test classpath; see build.gradle sourceSets"
        }.bufferedReader().readText()
        JSONObject(text)
    }

    private val endpoints: JSONObject by lazy {
        val text = checkNotNull(javaClass.classLoader?.getResourceAsStream("endpoints.json")) {
            "protocol/endpoints.json not on the test classpath; see build.gradle sourceSets"
        }.bufferedReader().readText()
        JSONObject(text)
    }

    private fun event(name: String): JSONObject = respond.getJSONObject("events").getJSONObject(name)

    @Test
    fun `endpoint paths match the contract`() {
        assertEquals(endpoints.getString("respond"), RespondClient.RESPOND_PATH)
        assertEquals(endpoints.getString("authRefresh"), TokenAuthenticator.REFRESH_PATH)
    }

    @Test
    fun `parses every event the overlay renders from the canonical samples`() {
        assertEquals(
            RespondParseResult.Rendered(
                RespondEvent.SessionStarted(event("start").getString("session_id")),
            ),
            RespondEvent.parse(event("start").toString()),
        )
        assertEquals(
            RespondParseResult.Rendered(RespondEvent.Delta(event("delta").getString("text"))),
            RespondEvent.parse(event("delta").toString()),
        )
        assertEquals(
            RespondParseResult.Rendered(
                RespondEvent.ToolActivity(event("tool_call").getString("tool_name")),
            ),
            RespondEvent.parse(event("tool_call").toString()),
        )
        assertEquals(
            RespondParseResult.Rendered(RespondEvent.Final),
            RespondEvent.parse(event("final").toString()),
        )
        assertEquals(
            RespondParseResult.Rendered(RespondEvent.Error(event("error").getString("message"))),
            RespondEvent.parse(event("error").toString()),
        )
    }

    @Test
    fun `ignores the events the overlay does not render`() {
        assertEquals(RespondParseResult.Ignored, RespondEvent.parse(event("thinking_delta").toString()))
        assertEquals(RespondParseResult.Ignored, RespondEvent.parse(event("usage").toString()))
        assertEquals(RespondParseResult.Ignored, RespondEvent.parse(event("tool_result").toString()))
        assertEquals(RespondParseResult.Ignored, RespondEvent.parse(""))
    }

    @Test
    fun `flags unknown types and non-JSON payloads as malformed`() {
        val unknown = RespondEvent.parse("""{"type":"audio","url":"x"}""")
        assertTrue(unknown is RespondParseResult.Malformed)

        val garbage = RespondEvent.parse("not-json")
        assertTrue(garbage is RespondParseResult.Malformed)
    }

    @Test
    fun `flags known types missing required fields as malformed`() {
        val incompleteStart = RespondEvent.parse("""{"type":"start"}""")
        assertTrue(incompleteStart is RespondParseResult.Malformed)
        assertEquals(
            "incomplete start event",
            (incompleteStart as RespondParseResult.Malformed).detail,
        )

        // Empty text is a valid no-op delta (aligned with isRespondSseEvent).
        val emptyDelta = RespondEvent.parse("""{"type":"delta","text":""}""")
        assertTrue(emptyDelta is RespondParseResult.Rendered)
        assertEquals(
            RespondEvent.Delta(""),
            (emptyDelta as RespondParseResult.Rendered).event,
        )

        val missingDeltaText = RespondEvent.parse("""{"type":"delta"}""")
        assertTrue(missingDeltaText is RespondParseResult.Malformed)

        val incompleteTool = RespondEvent.parse("""{"type":"tool_call"}""")
        assertTrue(incompleteTool is RespondParseResult.Malformed)
    }

    @Test
    fun `accumulates the canonical wire stream back to the canonical events`() {
        val rawLines = respond.getJSONArray("rawStreamLines")
        val accumulator = SseDataAccumulator()
        val payloads = mutableListOf<String>()
        for (i in 0 until rawLines.length()) {
            accumulator.feed(rawLines.getString(i))?.let { payloads.add(it) }
        }
        accumulator.flush()?.let { payloads.add(it) }

        val expectedNames = respond.getJSONArray("stream")
        assertEquals(expectedNames.length(), payloads.size)
        for (i in 0 until expectedNames.length()) {
            val expected = event(expectedNames.getString(i))
            val actual = JSONObject(payloads[i])
            assertTrue(
                "frame $i (${expectedNames.getString(i)}) drifted from the contract",
                jsonEquals(expected, actual),
            )
        }
    }

    /** Deep JSON equality (android.jar's org.json has no `similar`). */
    private fun jsonEquals(a: Any?, b: Any?): Boolean = when {
        a is JSONObject && b is JSONObject -> {
            val aKeys = a.keys().asSequence().toSet()
            val bKeys = b.keys().asSequence().toSet()
            aKeys == bKeys && aKeys.all { jsonEquals(a.get(it), b.get(it)) }
        }
        a is JSONArray && b is JSONArray ->
            a.length() == b.length() && (0 until a.length()).all { jsonEquals(a.get(it), b.get(it)) }
        else -> a == b
    }

    @Test
    fun `auth refresh exchange shapes match what TokenAuthenticator sends and reads`() {
        val refreshRequest = endpoints.getJSONObject("authRefreshRequest")
        assertEquals(setOf("refresh_token"), refreshRequest.keys().asSequence().toSet())
        assertTrue(refreshRequest.getString("refresh_token").isNotEmpty())

        val tokensResponse = endpoints.getJSONObject("authTokensResponse")
        assertEquals(
            setOf("user_id", "token_type", "access_token", "expires_in", "refresh_token"),
            tokensResponse.keys().asSequence().toSet(),
        )
        assertTrue(tokensResponse.getString("access_token").isNotEmpty())
        assertTrue(tokensResponse.getString("refresh_token").isNotEmpty())
        assertEquals("Bearer", tokensResponse.getString("token_type"))
        assertTrue(tokensResponse.getInt("expires_in") > 0)
    }
}
