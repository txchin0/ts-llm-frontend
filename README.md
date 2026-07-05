# Ember · ts-llm frontend

A warm, mobile-friendly web chat client for the [ts-llm](../ts-llm) agent
server. It streams the agent's normal output and its reasoning ("thinking")
separately, surfaces tool calls, lets you switch the `user_id` you speak as,
supports hands-free voice input, and has light/dark themes. It never stores
conversations.

Built with React + TypeScript + Vite. UI designed via the impeccable workflow
(see [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md)).

## Features

- Streaming responses over Server-Sent Events (`POST /v1/respond`).
- Distinct rendering of normal output (markdown) and reasoning (a collapsible
  mono "Thinking" panel), plus expandable tool-call/result chips.
- Change `user_id` at any time (switching starts a fresh session).
- Voice input via the Web Speech API: dictate into the composer, then review
  and send. Gracefully hidden where unsupported.
- Light / dark / system themes (defaults to your OS preference).
- No conversation persistence. Only your `user_id` and theme preference are
  saved (in `localStorage`).
- Responsive and touch-friendly; safe-area aware on phones.
- Installable as a PWA (Add to Home Screen). Offline shell only — chat still
  needs a live `/v1` connection to the agent server.
- Packages as a native **Android app** via Capacitor — see
  [Android app (Capacitor)](#android-app-capacitor).

## Prerequisites

- Node.js 20+ (developed on 22).
- A running ts-llm agent server (default `http://127.0.0.1:3000`). See the
  ts-llm repo for its own setup (it needs Postgres and provider credentials).

## How it talks to the server

The ts-llm server has no CORS, so the **web** build reaches it on the **same
origin** — it never calls the agent cross-origin. Instead:

- In development, Vite proxies `/v1` to the agent server.
- In production, `proxy.mjs` serves the built app and reverse-proxies `/v1`.

For the web build the ts-llm server is never modified. The **Android app** is
different: it has no proxy and calls the server directly, so the server must
send CORS headers — see [Android app (Capacitor)](#android-app-capacitor) and
the handoff doc [`docs/android-cors-handoff.md`](docs/android-cors-handoff.md).

The API base URL is resolved in [`src/api/config.ts`](src/api/config.ts):
empty = same origin (web); on Android the user sets an absolute server URL in
**Settings → Agent server**, persisted in `localStorage`.

## Development

```bash
npm install
cp .env.example .env   # optional; only needed to change the proxy target
npm run dev
```

Then open the printed Local URL (e.g. `http://localhost:5173`).

Set the agent server location with `VITE_TS_LLM_TARGET` (defaults to
`http://127.0.0.1:3000`):

```bash
# .env
VITE_TS_LLM_TARGET=http://127.0.0.1:3000
```

### Testing on a phone (same Wi-Fi)

The dev server binds to all interfaces, so open the printed **Network** URL
(e.g. `http://192.168.0.12:5173`) on your phone. If the agent server runs on a
different machine than this dev server, point the proxy at it:

```bash
VITE_TS_LLM_TARGET=http://<agent-host>:3000 npm run dev
```

### Develop without the full backend (mock server)

ts-llm needs Postgres and provider keys. To work on the frontend without that,
a tiny mock of `POST /v1/respond` is included. It emits a representative
sequence (start, thinking, a tool round-trip, a markdown answer, usage, final):

```bash
node mock-server.mjs                                   # terminal 1 (port 3001)
VITE_TS_LLM_TARGET=http://127.0.0.1:3001 npm run dev   # terminal 2
```

The mock is a dev aid only; it is not a real agent.

## PWA (installable web app)

Ember can be installed on phones and desktops (Add to Home Screen / Install).

- **Manifest** — [`src/brand.ts`](src/brand.ts) is the single source for product
  metadata and PWA manifest fields. `vite-plugin-pwa` emits the manifest at
  dev/build time; edit `pwaManifest` there, not in `vite.config.ts`.
- **Service worker** — `vite-plugin-pwa` registers with `autoUpdate` so new
  builds replace the cached app shell on the next visit. Disabled in the native
  (Capacitor) build via `VITE_NATIVE_BUILD=true`, since a service worker caching
  the local WebView origin is pointless and can serve stale assets.
- **API traffic** — the service worker does not cache `/v1`; chat requests still
  go to the agent server (proxied in dev and production).
- **Theme** — install splash uses the dark brand shell (`#191512`, matching the
  icon). After load, `theme-color` tracks your resolved light/dark preference.
- **Production** — `npm run serve` (`proxy.mjs`) serves `dist/` including the
  manifest, icons, and generated `sw.js`.
- **Icons** — PNGs in `public/` can be recompressed after replacement with
  `npm run compress:icons`.

## Android app (Capacitor)

The same web build runs as a native Android app via [Capacitor](https://capacitorjs.com).
The WebView loads the bundled `dist/`; there is no proxy, so the app talks to
the agent server directly over the LAN.

### One-time setup

Requires **Android Studio + JDK 17 + the Android SDK** (Capacitor's toolchain).
The `android/` project is committed, so on a fresh clone just:

```bash
npm install
npm run cap:sync     # builds the native web bundle and copies it into android/
npm run cap:open     # opens the project in Android Studio to Build/Run
```

Scripts (in `package.json`):

| Script | Purpose |
| --- | --- |
| `build:native` | `vite build` with `VITE_NATIVE_BUILD=true` (no service worker) |
| `cap:sync` | `build:native` then `cap sync android` |
| `cap:open` | open the Android project in Android Studio |
| `cap:run` | sync then `cap run android` on a connected device/emulator |

### Connecting to the agent server

1. Run the device/emulator on the **same LAN** as the ts-llm server.
2. In the app: **Settings → Agent server → Server URL** → `http://<server-lan-ip>:3000`.
   (Blank means "same origin" and only works for the web build.)
3. The server **must send CORS headers** for the WebView origin `http://localhost`.
   Hand [`docs/android-cors-handoff.md`](docs/android-cors-handoff.md) to the
   pi-llm team. Without it, every `/v1` call fails.

Config lives in [`capacitor.config.ts`](capacitor.config.ts): the WebView uses
the `http` scheme with cleartext enabled (plain-HTTP LAN target), and
`CapacitorHttp` is left **disabled** — that's required, because it can't stream
responses and would break SSE chat. Debug with `chrome://inspect`.

### Known gaps (native)

- **Voice input** — the Web Speech API isn't available in Android WebView, so the
  mic shows as unsupported. Restoring it needs a native speech plugin (later phase).
- **OAuth integrations** — "Connect" opens the system browser, but the return
  into the app isn't wired yet (needs deep links; later phase). Chat, tasks, and
  integration toggles work.

## Production

```bash
npm run build      # type-checks and builds to dist/
npm run serve      # serves dist/ and proxies /v1 to the agent server
```

`npm run serve` (i.e. `node proxy.mjs`) is configured via env:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Port this server listens on |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` = reachable on the LAN) |
| `TS_LLM_TARGET` | `http://127.0.0.1:3000` | The agent server to proxy `/v1` to |

If you prefer your own reverse proxy (nginx, Caddy), serve `dist/` as static
files and forward `/v1` to the agent server with buffering disabled so SSE
streams in real time. Example nginx location:

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;        # required for SSE
    proxy_read_timeout 1h;
}
```

## API contract (reference)

Single endpoint, `POST /v1/respond`, request body:

```jsonc
{
  "user_id": "web-user",        // required
  "message": "hello",           // required
  "session_id": "sess_...",     // omit on the first turn; reuse after
  "show_thinking": true          // opt in to reasoning events
}
```

The response is `text/event-stream`. Event types handled: `start` (carries the
server-issued `session_id`), `delta`, `thinking_delta`, `tool_call`,
`tool_result`, `usage`, `final`, `error`. Types live in
[`src/api/types.ts`](src/api/types.ts); the streaming client is in
[`src/api/client.ts`](src/api/client.ts).

## Future: voice playback from the server

The server's TTS is internal-only today (no audio HTTP endpoint). The frontend
is prepared for it: the SSE client surfaces unknown events instead of dropping
them, and the assistant message model reserves an `audioUrl` field. When ts-llm
exposes audio (a new `audio` SSE event or a separate stream), playback can be
wired in without reworking the transport or message model.

## Project structure

```
src/
  api/        SSE types + streaming client; config.ts resolves the base URL
  state/      useChat (in-memory transcript), useSettings (userId, theme, server URL)
  voice/      Web Speech API dictation hook
  components/ Header, Transcript, Message, ThinkingPanel, ToolChip,
              Composer, UserIdDialog, SettingsDialog, icons
  styles/     design tokens + global styles
  brand.ts    product name, description, PWA manifest source
PRODUCT.md    strategy / register (impeccable)
DESIGN.md     visual system: palette, type, motion (impeccable)
docs/         backend handoff docs (OAuth, Android CORS)
public/       favicon, PWA icons
capacitor.config.ts  native Android app config (Capacitor)
android/      generated Capacitor Android project (committed)
proxy.mjs     production static + /v1 reverse proxy
mock-server.mjs  dev-only mock of POST /v1/respond
```
