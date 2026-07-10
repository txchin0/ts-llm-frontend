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

import { SERVER_URL_KEY } from '../native/handshake.ts';

export { SERVER_URL_KEY };

/**
 * Normalizes a stored server URL to a usable base: trim, strip trailing
 * slashes, assume http:// for a bare host:port (a base without a scheme
 * would resolve relative to the WebView origin and hit the app itself).
 * Returns `''` when unset. The Kotlin assistant implements the same rules
 * (EmberSettings.normalizeServerUrl); the shared cases live in
 * protocol/handshake.json and are parity-tested on both sides.
 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    return '';
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * The configured agent-server base URL, or `''` when unset (relative requests,
 * matching the browser build). Trailing slashes are stripped so callers can
 * safely append paths like `/v1/respond`.
 */
export function getApiBaseUrl(): string {
  try {
    return normalizeServerUrl(localStorage.getItem(SERVER_URL_KEY) ?? '');
  } catch {
    // Storage unavailable (private mode / SSR / jsdom-unset) → relative, as today.
    return '';
  }
}

/**
 * Resolves an API path against the configured base URL, or an explicit
 * override (test seam). The only place paths and the base URL meet.
 */
export function resolveApiUrl(path: string, baseUrl?: string): string {
  return `${baseUrl ?? getApiBaseUrl()}${path}`;
}
