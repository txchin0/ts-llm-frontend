/**
 * The web↔native handshake: storage-key names shared with the Kotlin
 * assistant through the Capacitor Preferences backing store
 * (`CapacitorStorage` SharedPreferences). The Kotlin side (EmberSettings.kt,
 * AuthTokenStore.kt) re-spells these names in its own constants; both
 * spellings are verified against protocol/handshake.json — here by
 * handshake.test.ts, there by HandshakeContractTest.kt — so a rename breaks
 * a test instead of silently deafening the assistant.
 *
 * Settings flow web→native only (see settingsMirror.ts); the token pair flows
 * both ways (see authTokens.ts).
 */

export const SERVER_URL_KEY = 'ts-llm.server_url';
export const MIC_LANGUAGE_KEY = 'ts-llm.mic_language';
export const ACCESS_TOKEN_KEY = 'ts-llm.access_token';
export const REFRESH_TOKEN_KEY = 'ts-llm.refresh_token';
