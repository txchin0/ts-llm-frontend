import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controls whether the code under test believes it is running on native.
const capacitor = vi.hoisted(() => ({ native: false }));
// Backing store for the mocked Capacitor Preferences (the native mirror).
const prefs = vi.hoisted(() => new Map<string, string>());

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitor.native },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(({ key }: { key: string }) =>
      Promise.resolve({ value: prefs.get(key) ?? null }),
    ),
    set: vi.fn(({ key, value }: { key: string; value: string }) => {
      prefs.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }: { key: string }) => {
      prefs.delete(key);
      return Promise.resolve();
    }),
  },
}));

import { authFetch, refreshAuthTokens } from './auth.ts';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAccessToken,
  getRefreshToken,
  hasSession,
  setAuthTokens,
} from './authTokens.ts';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function refreshBody(access: string, refresh: string) {
  return {
    user_id: 'user-1',
    token_type: 'Bearer' as const,
    access_token: access,
    expires_in: 3600,
    refresh_token: refresh,
  };
}

function bearerOf(init: RequestInit | undefined): string | undefined {
  if (init?.headers == null) {
    return undefined;
  }
  if (init.headers instanceof Headers) {
    return init.headers.get('authorization') ?? undefined;
  }
  if (Array.isArray(init.headers)) {
    const entry = init.headers.find(([key]) => key.toLowerCase() === 'authorization');
    return entry?.[1];
  }
  const record = init.headers as Record<string, string>;
  return record.authorization ?? record.Authorization;
}

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): FetchMock {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  localStorage.clear();
  prefs.clear();
  capacitor.native = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshAuthTokens', () => {
  it('exchanges the refresh token and stores the rotated pair', async () => {
    setAuthTokens('a1', 'r1');
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, refreshBody('a2', 'r2'))));

    await expect(refreshAuthTokens()).resolves.toBe(true);
    expect(getAccessToken()).toBe('a2');
    expect(getRefreshToken()).toBe('r2');
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('is single-flight: concurrent callers share one request', async () => {
    setAuthTokens('a1', 'r1');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = stubFetch(async () => {
      await gate;
      return jsonResponse(200, refreshBody('a2', 'r2'));
    });

    const first = refreshAuthTokens();
    const second = refreshAuthTokens();
    release();

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the session on a 401', async () => {
    setAuthTokens('a1', 'r1');
    stubFetch(() => Promise.resolve(jsonResponse(401)));

    await expect(refreshAuthTokens()).resolves.toBe(false);
    expect(hasSession()).toBe(false);
  });

  it('clears the session on a 403', async () => {
    setAuthTokens('a1', 'r1');
    stubFetch(() => Promise.resolve(jsonResponse(403)));

    await expect(refreshAuthTokens()).resolves.toBe(false);
    expect(hasSession()).toBe(false);
  });

  it('keeps the session on a 500 (transient failure)', async () => {
    setAuthTokens('a1', 'r1');
    stubFetch(() => Promise.resolve(jsonResponse(500)));

    await expect(refreshAuthTokens()).resolves.toBe(false);
    expect(hasSession()).toBe(true);
  });

  it('keeps the session on a network error', async () => {
    setAuthTokens('a1', 'r1');
    stubFetch(() => Promise.reject(new TypeError('offline')));

    await expect(refreshAuthTokens()).resolves.toBe(false);
    expect(hasSession()).toBe(true);
  });

  it('returns false without a request when no refresh token exists', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200)));

    await expect(refreshAuthTokens()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not poison the single-flight cache after a no-token refresh', async () => {
    // A synchronous (no-token) refresh must not leave a stale resolved promise
    // cached; a later refresh with a valid token must still hit the server.
    stubFetch(() => Promise.resolve(jsonResponse(200, refreshBody('a2', 'r2'))));

    await expect(refreshAuthTokens()).resolves.toBe(false); // no token yet
    setAuthTokens('a1', 'r1');
    await expect(refreshAuthTokens()).resolves.toBe(true);
    expect(getAccessToken()).toBe('a2');
  });
});

describe('authFetch', () => {
  it('attaches the bearer token', async () => {
    setAuthTokens('a1', 'r1');
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200)));

    await authFetch('/api/x');

    expect(bearerOf(fetchMock.mock.calls[0][1])).toBe('Bearer a1');
  });

  it('refreshes once then retries on a 401', async () => {
    setAuthTokens('a1', 'r1');
    const fetchMock = stubFetch((url, init) => {
      if (url === '/v1/auth/refresh') {
        return Promise.resolve(jsonResponse(200, refreshBody('a2', 'r2')));
      }
      return Promise.resolve(
        bearerOf(init) === 'Bearer a2' ? jsonResponse(200) : jsonResponse(401),
      );
    });

    const response = await authFetch('/api/x');

    expect(response.status).toBe(200);
    expect(getAccessToken()).toBe('a2');
    expect(fetchMock).toHaveBeenCalledTimes(3); // 401, refresh, retry
  });

  it('returns the retried 401 as-is when refresh does not fix it', async () => {
    setAuthTokens('a1', 'r1');
    stubFetch((url) =>
      Promise.resolve(
        url === '/v1/auth/refresh' ? jsonResponse(200, refreshBody('a2', 'r2')) : jsonResponse(401),
      ),
    );

    const response = await authFetch('/api/x');

    expect(response.status).toBe(401);
  });

  it('adopts a natively-rotated pair and retries before spending the refresh token', async () => {
    capacitor.native = true;
    // WebView holds a stale access token; the assistant rotated the pair in the
    // native store while the WebView was backgrounded.
    localStorage.setItem(ACCESS_TOKEN_KEY, 'a-stale');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r-stale');
    prefs.set(ACCESS_TOKEN_KEY, 'a-fresh');
    prefs.set(REFRESH_TOKEN_KEY, 'r-fresh');

    const fetchMock = stubFetch((url, init) => {
      if (url === '/v1/auth/refresh') {
        return Promise.resolve(jsonResponse(200, refreshBody('should-not-be-used', 'x')));
      }
      return Promise.resolve(
        bearerOf(init) === 'Bearer a-fresh' ? jsonResponse(200) : jsonResponse(401),
      );
    });

    const response = await authFetch('/api/x');

    expect(response.status).toBe(200);
    expect(getAccessToken()).toBe('a-fresh');
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === '/v1/auth/refresh');
    expect(refreshCalls).toHaveLength(0);
  });
});
