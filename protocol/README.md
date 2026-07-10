# Protocol contracts

The wire protocol and the web↔native handshake each used to be spelled
independently in TypeScript, Kotlin, and the mock server — and the spellings
drifted. These fixtures are the canonical spelling; every consumer is an
adapter verified against them.

| Contract | Covers | Verified by |
| --- | --- | --- |
| `endpoints.json` | API path strings, OAuth sample provider id, auth refresh request/response shapes | Imported at runtime by `src/api/endpoints.ts` (web) · pinned by `RespondProtocolTest.kt` (Kotlin constants) · loaded by `mock-server.mjs` for routing |
| `respond.json` | `POST /v1/respond` SSE event vocabulary, request sample, one canonical turn in wire form | `src/api/respondProtocol.test.ts` (TS) · `RespondProtocolTest.kt` (Kotlin) · served by `mock-server.mjs` |
| `handshake.json` | Capacitor Preferences store + key names shared with the Kotlin assistant; server-URL normalization parity cases | `src/native/handshake.test.ts` (TS) · `HandshakeContractTest.kt` (Kotlin) |

To change the protocol: edit the fixture first, run `npm test` and
`android/gradlew -p android test` — the failing side tells you exactly what to
update. Never change one spelling without the fixture.

Web path and handshake-key constants are not duplicated: they are
`export const … = endpoints.…` / `handshake.keys.…` from the JSON. Kotlin keeps
local constants (no JSON at runtime) and fails the unit test if they drift.
