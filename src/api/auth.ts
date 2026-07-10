import { Capacitor } from '@capacitor/core';

import {
  bootstrapAuthTokens,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from './authTokens.ts';
import {
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_PATH_PREFIX,
  AUTH_REFRESH_PATH,
  AUTH_REGISTER_PATH,
} from './endpoints.ts';
import { ApiHttpError } from './errors.ts';
import { fetchJsonPublic } from './publicHttp.ts';

/**
 * Auth endpoints plus the shared authenticated fetch. `authFetch` is the one
 * place Authorization headers are attached and 401s are handled
 * (refresh-once-then-retry), so JSON calls and the SSE stream behave the same.
 */

export interface AuthTokensResponse {
  user_id: string;
  token_type: 'Bearer';
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

export { AUTH_PATH_PREFIX };

/** Creates an account and stores the returned session. */
export async function register(userId: string, password: string): Promise<AuthTokensResponse> {
  const tokens = await fetchJsonPublic<AuthTokensResponse>(AUTH_REGISTER_PATH, {
    user_id: userId,
    password,
  });
  setAuthTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

/** Logs in and stores the returned session. */
export async function login(userId: string, password: string): Promise<AuthTokensResponse> {
  const tokens = await fetchJsonPublic<AuthTokensResponse>(AUTH_LOGIN_PATH, {
    user_id: userId,
    password,
  });
  setAuthTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

/** Revokes the refresh token server-side and clears the local session. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearAuthTokens();
  if (refreshToken === null) {
    return;
  }
  try {
    await fetchJsonPublic<Record<string, never>>(AUTH_LOGOUT_PATH, {
      refresh_token: refreshToken,
    });
  } catch {
    // Local session is already cleared; server-side revocation failing
    // (offline, already revoked) should not block signing out.
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the stored refresh token for a new pair. Single-flight: concurrent
 * 401s share one request. Returns false when no session can be established;
 * a definitive 401 from the server clears the stored tokens (signed out).
 */
export function refreshAuthTokens(): Promise<boolean> {
  // Reset via .finally() rather than a finally block inside the IIFE: the
  // callback always runs on a later microtask, so refreshInFlight is assigned
  // before it is cleared even when runRefresh settles synchronously (no stored
  // refresh token). An in-body reset would be clobbered by this assignment and
  // poison the cache with a stale resolved promise, making every later refresh
  // a silent no-op.
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function runRefresh(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken === null) {
      return false;
    }
    const tokens = await fetchJsonPublic<AuthTokensResponse>(AUTH_REFRESH_PATH, {
      refresh_token: refreshToken,
    });
    setAuthTokens(tokens.access_token, tokens.refresh_token);
    return true;
  } catch (error) {
    if (error instanceof ApiHttpError && (error.status === 401 || error.status === 403)) {
      clearAuthTokens();
    }
    return false;
  }
}

/**
 * `fetch` with the access token attached. On a 401 it refreshes once and
 * retries; the retried response is returned as-is (a second 401 means the
 * session is gone and the caller surfaces it). On the native app a 401 also
 * re-reads the Capacitor Preferences store first, adopting a token pair the
 * voice assistant may have rotated — that platform dependency is part of this
 * interface, not visible in the signature.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const attempt = (): Promise<Response> => {
    const token = getAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(token !== null ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const response = await attempt();
  if (response.status !== 401) {
    return response;
  }

  if (Capacitor.isNativePlatform()) {
    // The voice assistant may have rotated the pair natively; adopt whatever it
    // stored and retry before spending our (possibly already-consumed) refresh
    // token. No-op on web, where bootstrapAuthTokens returns immediately.
    await bootstrapAuthTokens();
    const retried = await attempt();
    if (retried.status !== 401) {
      return retried;
    }
  }

  const refreshed = await refreshAuthTokens();
  if (!refreshed) {
    return response;
  }

  return attempt();
}
