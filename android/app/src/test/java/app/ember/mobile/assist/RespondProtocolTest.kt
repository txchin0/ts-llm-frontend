package app.ember.mobile.assist

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies the Kotlin spelling of the Respond protocol against the
 * cross-language contract in protocol/respond.json (on the test classpath via
 * build.gradle). The web client checks the same fixture in
 * src/api/respondProtocol.test.ts, so a protocol change that skips this side
 * fails here instead of silently deafening the assistant overlay.
 */
class RespondProtocolTest {

    private val contract: JSONObject by lazy {
        val text = checkNotNull(javaClass.classLoader?.getResourceAsStream("respond.json")) {
            "protocol/respond.json not on the test classpath; see build.gradle sourceSets"
        }.bufferedReader().readText()
        JSONObject(text)
    }

    private fun event(name: String): JSONObject = contract.getJSONObject("events").getJSONObject(name)

    @Test
    fun `endpoint paths match the contract`() {
        val endpoints = contract.getJSONObject("endpoints")
        assertEquals(endpoints.getString("respond"), RespondClient.RESPOND_PATH)
        assertEquals(endpoints.getString("authRefresh"), TokenAuthenticator.REFRESH_PATH)
    }

    @Test
    fun `parses every event the overlay renders from the canonical samples`() {
        assertEquals(
            RespondEvent.SessionStarted(event("start").getString("session_id")),
            RespondEvent.parse(event("start").toString()),
        )
        assertEquals(
            RespondEvent.Delta(event("delta").getString("text")),
            RespondEvent.parse(event("delta").toString()),
        )
        assertEquals(
            RespondEvent.ToolActivity(event("tool_call").getString("tool_name")),
            RespondEvent.parse(event("tool_call").toString()),
        )
        assertEquals(RespondEvent.Final, RespondEvent.parse(event("final").toString()))
        assertEquals(
            RespondEvent.Error(event("error").getString("message")),
            RespondEvent.parse(event("error").toString()),
        )
    }

    @Test
    fun `ignores the events the overlay does not render`() {
        assertNull(RespondEvent.parse(event("thinking_delta").toString()))
        assertNull(RespondEvent.parse(event("usage").toString()))
        assertNull(RespondEvent.parse(event("tool_result").toString()))
    }

    @Test
    fun `ignores unknown types, blanks, and non-JSON payloads`() {
        assertNull(RespondEvent.parse("""{"type":"audio","url":"x"}"""))
        assertNull(RespondEvent.parse(""))
        assertNull(RespondEvent.parse("not-json"))
    }

    @Test
    fun `accumulates the canonical wire stream back to the canonical events`() {
        val rawLines = contract.getJSONArray("rawStreamLines")
        val accumulator = SseDataAccumulator()
        val payloads = mutableListOf<String>()
        for (i in 0 until rawLines.length()) {
            accumulator.feed(rawLines.getString(i))?.let { payloads.add(it) }
        }
        accumulator.flush()?.let { payloads.add(it) }

        val expectedNames = contract.getJSONArray("stream")
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
        // TokenAuthenticator builds {refresh_token} and reads access_token/refresh_token.
        val refreshRequest = contract.getJSONObject("authRefreshRequest")
        assertTrue(refreshRequest.has("refresh_token"))

        val tokensResponse = contract.getJSONObject("authTokensResponse")
        assertTrue(tokensResponse.getString("access_token").isNotEmpty())
        assertTrue(tokensResponse.getString("refresh_token").isNotEmpty())
        assertEquals("Bearer", tokensResponse.getString("token_type"))
    }
}
