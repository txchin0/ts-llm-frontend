# Protocol contracts

The wire protocol and the web↔native handshake each used to be spelled
independently in TypeScript, Kotlin, and the mock server — and the spellings
drifted. These fixtures are the single spelling; every consumer is an adapter
verified against them.

| Contract | Covers | Verified by |
| --- | --- | --- |
| `respond.json` | `POST /v1/respond` SSE event vocabulary, endpoint paths, request/auth body shapes, one canonical turn in wire form | `src/api/respondProtocol.test.ts` (TS) · `android/app/src/test/java/app/ember/mobile/assist/RespondProtocolTest.kt` (Kotlin) · served by `mock-server.mjs` |
| `handshake.json` | Capacitor Preferences store + key names shared with the Kotlin assistant; server-URL normalization parity cases | `src/native/handshake.test.ts` (TS) · `android/app/src/test/java/app/ember/mobile/assist/HandshakeContractTest.kt` (Kotlin) |

To change the protocol: edit the fixture first, run `npm test` and
`android/gradlew -p android test` — the failing side tells you exactly what to
update. Never change one spelling without the fixture.
