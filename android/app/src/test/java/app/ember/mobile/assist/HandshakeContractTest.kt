package app.ember.mobile.assist

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Verifies the Kotlin spelling of the web↔native handshake against the
 * cross-language contract in protocol/handshake.json. The web side checks the
 * same fixture in src/native/handshake.test.ts.
 */
class HandshakeContractTest {

    private val contract: JSONObject by lazy {
        val text = checkNotNull(javaClass.classLoader?.getResourceAsStream("handshake.json")) {
            "protocol/handshake.json not on the test classpath; see build.gradle sourceSets"
        }.bufferedReader().readText()
        JSONObject(text)
    }

    @Test
    fun `storage key names match the contract`() {
        val keys = contract.getJSONObject("keys")
        assertEquals(contract.getString("store"), EmberSettings.STORE)
        assertEquals(contract.getString("store"), AuthTokenStore.STORE)
        assertEquals(keys.getString("serverUrl"), EmberSettings.KEY_SERVER_URL)
        assertEquals(keys.getString("micLanguage"), EmberSettings.KEY_MIC_LANGUAGE)
        assertEquals(keys.getString("accessToken"), AuthTokenStore.KEY_ACCESS_TOKEN)
        assertEquals(keys.getString("refreshToken"), AuthTokenStore.KEY_REFRESH_TOKEN)
    }

    @Test
    fun `server URL normalization matches the web implementation case for case`() {
        val cases = contract.getJSONArray("serverUrlNormalization")
        for (i in 0 until cases.length()) {
            val case = cases.getJSONObject(i)
            val input = if (case.isNull("input")) null else case.getString("input")
            val actual = EmberSettings.normalizeServerUrl(input)
            if (case.isNull("normalized")) {
                assertNull("input: $input", actual)
            } else {
                assertEquals("input: $input", case.getString("normalized"), actual)
            }
        }
    }
}
