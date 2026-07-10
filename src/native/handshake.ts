/**
 * The web↔native handshake: storage-key names shared with the Kotlin
 * assistant through the Capacitor Preferences backing store
 * (`CapacitorStorage` SharedPreferences). Imported from protocol/handshake.json
 * so web cannot drift; the Kotlin side (EmberSettings.kt, AuthTokenStore.kt)
 * re-spells these names in its own constants and HandshakeContractTest.kt
 * pins them against the same fixture.
 *
 * Settings flow web→native only (see settingsMirror.ts); the token pair flows
 * both ways (see authTokens.ts).
 */
import handshake from '../../protocol/handshake.json';

export const SERVER_URL_KEY = handshake.keys.serverUrl;
export const MIC_LANGUAGE_KEY = handshake.keys.micLanguage;
export const ACCESS_TOKEN_KEY = handshake.keys.accessToken;
export const REFRESH_TOKEN_KEY = handshake.keys.refreshToken;
