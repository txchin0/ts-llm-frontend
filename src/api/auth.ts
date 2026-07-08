import { Capacitor } from '@capacitor/core';

import {
  bootstrapAuthTokens,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from './authTokens.ts';
import { getApiBaseUrl } from './config.ts';
import { ApiHttpError } from './errors.ts';

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

interface AuthErrorBody {
  code: string;
  message: string;
}

function isAuthErrorBody(value: unknown): value is AuthErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

/** POSTs to an auth endpoint (no bearer, no retry) and returns parsed JSON. */
async function postAuth<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message: string | undefined;
    try {
      const body: unknown = await response.json();
      if (isAuthErrorBody(body)) {
        message = body.message;
      }
    } catch {
      // Non-JSON error body; fall through to the generic message.
    }
    throw new ApiHttpError(response.status, response.statusText, message);
  }

  return (await response.json()) as T;
}

/** Creates an account and stores the returned session. */
export async function register(userId: string, password: string): Promise<AuthTokensResponse> {
  const tokens = await postAuth<AuthTokensResponse>('register', {
    user_id: userId,
    password,
  });
  setAuthTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

/** Logs in and stores the returned session. */
export async function login(userId: string, password: string): Promise<AuthTokensResponse> {
  const tokens = await postAuth<AuthTokensResponse>('login', {
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
    await postAuth<void>('logout', { refresh_token: refreshToken });
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
    const tokens = await postAuth<AuthTokensResponse>('refresh', {
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
 * session is gone and the caller surfaces it).
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
