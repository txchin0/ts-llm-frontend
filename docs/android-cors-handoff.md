# Server handoff: CORS for the Android (Capacitor) app

Brief requirements for the agent server (pi-llm) so the ts-llm-frontend **Android app** can call `/v1/*` directly.

**Consumer:** [ts-llm-frontend](..) packaged as a native Android app via Capacitor.

**Reference implementation:** pi-llm (`e:\Projects\pi-llm`) — Fastify. One change: enable CORS on `/v1/*`.

> This supersedes the "CORS on the agent server — out of scope" line in
> [`server-oauth-handoff.md`](server-oauth-handoff.md#5-explicitly-out-of-scope-for-now) **for the native app only**. The web app is unchanged (see below).

---

## Why this is needed now

The **web** app never calls the agent cross-origin: the browser hits the same origin and a dev/prod proxy forwards `/v1`. No CORS required, and that stays true.

The **Android app** has no proxy. Capacitor serves the UI from the WebView origin **`http://localhost`** and the app calls the agent server directly at `http://<lan-ip>:3000/v1/*`. That is a cross-origin request, so the browser (WebView) enforces CORS. Without the headers below, every `/v1` call fails — including the streaming chat.

**No changes to request shapes, routes, or bodies** — the app sends exactly what it sends today on the web. The only ask is response headers.

---

## Summary

| Requirement | Value |
|---|---|
| Allowed origin | `http://localhost` (the Capacitor Android WebView origin) — or `*` |
| Allowed methods | `GET, POST, PUT, DELETE, OPTIONS` |
| Allowed request headers | `Content-Type, Accept` |
| Credentials (cookies) | **Not used** — do **not** set `Access-Control-Allow-Credentials` |
| Applies to | **all** `/v1/*` responses, including the `POST /v1/respond` SSE stream and error responses |
| Preflight | `OPTIONS` on `/v1/*` must return `2xx` with the `Allow-*` headers |

Because no cookies/credentials are involved (`user_id` travels in the body/query), `Access-Control-Allow-Origin: *` is acceptable. Restricting to `http://localhost` is preferred and equally functional: **every** Android device reports this exact origin, so one value covers all installs.

---

## Endpoints the Android app calls

All under `/v1`. "Preflight?" = whether the browser sends an `OPTIONS` request first (non-simple requests do).

| Method | Path | Preflight? | Request headers sent |
|---|---|---|---|
| `POST` | `/v1/respond` | **Yes** (JSON body) | `content-type: application/json`, `accept: text/event-stream` |
| `GET` | `/v1/tasks?user_id=` | No (simple) | `accept: application/json` |
| `GET` | `/v1/integrations?user_id=` | No (simple) | `accept: application/json` |
| `PUT` | `/v1/integrations` | **Yes** (PUT) | `accept: application/json`, `content-type: application/json` |
| `GET` | `/v1/oauth/:provider/status?user_id=` | No (simple) | `accept: application/json` |
| `DELETE` | `/v1/oauth/:provider?user_id=` | **Yes** (DELETE) | `accept: application/json` |

- Simple `GET`s don't trigger a preflight, but their **responses still need** `Access-Control-Allow-Origin`.
- `POST`/`PUT`/`DELETE` trigger a preflight, so `OPTIONS` on those paths must succeed with the `Allow-*` headers.
- The most important one is **`POST /v1/respond`**: the `Access-Control-Allow-Origin` header must be present on the streamed response headers (sent before the SSE body begins), or the chat won't start.

**Not a CORS concern:** `GET /v1/oauth/:provider/start` is opened as a top-level navigation in the system browser (not a `fetch` from the WebView), so CORS does not apply to it. (Full in-app OAuth return handling for native is a later phase; the start URL still just needs to point at the configured server, which it does.)

---

## Implementation (pi-llm / Fastify)

Register [`@fastify/cors`](https://github.com/fastify/fastify-cors) before the `/v1` routes:

```ts
import cors from '@fastify/cors';

await app.register(cors, {
  // The Capacitor Android WebView always reports this origin.
  // Use `true` or '*' if you'd rather not enumerate origins.
  origin: ['http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  // Do NOT enable credentials — cookies aren't used, and `credentials: true`
  // is incompatible with `origin: '*'` and unnecessary here.
  maxAge: 86400, // cache preflight for a day
});
```

`@fastify/cors` automatically answers `OPTIONS` preflights for all routes and adds the `Access-Control-Allow-Origin` header to every response, including the streamed `POST /v1/respond`. No per-route changes needed.

If CORS is added by hand instead of via the plugin, ensure the header is written on the SSE response **before** streaming starts, and that an `OPTIONS` handler exists for the `POST`/`PUT`/`DELETE` routes.

---

## Verify

```bash
# 1) Preflight for the streaming endpoint
curl -i -X OPTIONS http://<host>:3000/v1/respond \
  -H 'Origin: http://localhost' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type, accept'
# Expect: 204/200 + Access-Control-Allow-Origin / -Methods / -Headers

# 2) The actual stream carries the allow-origin header
curl -i -N -X POST http://<host>:3000/v1/respond \
  -H 'Origin: http://localhost' \
  -H 'content-type: application/json' \
  -H 'accept: text/event-stream' \
  -d '{"user_id":"web-user","message":"hi"}'
# Expect: Access-Control-Allow-Origin: http://localhost (or *) on the response

# 3) A simple GET response also carries it
curl -i 'http://<host>:3000/v1/tasks?user_id=web-user' -H 'Origin: http://localhost'
```

End-to-end: on an Android device on the same LAN, set the app's **Settings → Agent server → Server URL** to `http://<host>:3000`, send a message, and confirm it streams. `chrome://inspect` (DevTools on the WebView) shows any CORS error in the console first.

---

## Checklist for the pi-llm team

- [ ] `@fastify/cors` (or equivalent) registered before `/v1` routes
- [ ] Allowed origin includes `http://localhost` (or `*`)
- [ ] Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`
- [ ] Allowed headers: `Content-Type, Accept`
- [ ] `Access-Control-Allow-Credentials` is **not** set
- [ ] `Access-Control-Allow-Origin` present on the `POST /v1/respond` **stream** response, not just preflight
- [ ] `OPTIONS` preflight returns `2xx` for `/v1/respond`, `PUT /v1/integrations`, `DELETE /v1/oauth/:provider`
- [ ] Verified with the curl checks above from `Origin: http://localhost`

---

## Notes / security

- This only widens access for cross-origin browsers; it doesn't change auth. `user_id` remains a client-supplied string (same trust model as chat today).
- Restricting the origin to `http://localhost` is safe and sufficient for all Android installs; prefer it over `*` if you want to be tight.
- If cookie-based auth is ever added, the origin can no longer be `*` and `Access-Control-Allow-Credentials: true` becomes required — out of scope here.

## Questions

Contact the frontend owner, or see the Phase 1 Capacitor/Android plan in the ts-llm-frontend repo.
