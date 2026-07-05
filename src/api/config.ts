/**
 * Single source of truth for the API base URL.
 *
 * In the browser the app is served from the same origin as the agent server
 * (dev: Vite proxies `/v1`; prod: a reverse proxy), so the base URL is empty
 * and every request stays relative. In the Capacitor Android app there is no
 * proxy — the WebView is served from a local origin — so the user configures an
 * absolute agent-server URL in Settings, persisted under {@link SERVER_URL_KEY}.
 *
 * `getApiBaseUrl` reads that persisted value lazily at request time. Keeping the
 * value in one place (localStorage) means there is nothing to synchronise and no
 * render/effect ordering hazard: whatever Settings persisted is exactly what the
 * next `fetch` reads.
 */

/** localStorage key holding the configured agent-server URL. Owned here so the
 * settings layer and API layer share one constant (state imports from api). */
export const SERVER_URL_KEY = 'ts-llm.server_url';

/**
 * The configured agent-server base URL, or `''` when unset (relative requests,
 * matching the browser build). Trailing slashes are stripped so callers can
 * safely append paths like `/v1/respond`.
 */
export function getApiBaseUrl(): string {
  try {
    const raw = (localStorage.getItem(SERVER_URL_KEY) ?? '').trim().replace(/\/+$/, '');
    if (raw === '') {
      return '';
    }
    // A base without a scheme resolves relative to the WebView origin
    // (http://localhost) and would hit the app itself, not the agent server.
    // Assume http for a bare host:port (matches the plain-HTTP LAN setup).
    return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  } catch {
    // Storage unavailable (private mode / SSR / jsdom-unset) → relative, as today.
    return '';
  }
}
