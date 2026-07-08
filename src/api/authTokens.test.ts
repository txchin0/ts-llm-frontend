import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  bootstrapAuthTokens,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  hasSession,
  onAuthTokensChange,
  setAuthTokens,
} from './authTokens.ts';

beforeEach(() => {
  localStorage.clear();
  prefs.clear();
  capacitor.native = false;
});

describe('token accessors', () => {
  it('round-trips a stored pair and reports a session', () => {
    setAuthTokens('access-1', 'refresh-1');
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(hasSession()).toBe(true);
  });

  it('treats blank/absent values as no session', () => {
    expect(getAccessToken()).toBeNull();
    expect(hasSession()).toBe(false);
    localStorage.setItem(ACCESS_TOKEN_KEY, '   ');
    expect(getAccessToken()).toBeNull();
  });

  it('reports a session when only one token survives', () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-only');
    expect(hasSession()).toBe(true);
  });

  it('clears both tokens', () => {
    setAuthTokens('access-1', 'refresh-1');
    clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});

describe('change listeners', () => {
  it('notifies subscribers on set and clear, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = onAuthTokensChange(listener);

    setAuthTokens('a', 'r');
    clearAuthTokens();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setAuthTokens('a2', 'r2');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('native mirroring', () => {
  it('mirrors writes and removals into Preferences on native', async () => {
    capacitor.native = true;

    setAuthTokens('access-1', 'refresh-1');
    // Preferences.set is fire-and-forget; let the microtasks settle.
    await Promise.resolve();
    expect(prefs.get(ACCESS_TOKEN_KEY)).toBe('access-1');
    expect(prefs.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');

    clearAuthTokens();
    await Promise.resolve();
    expect(prefs.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(prefs.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});

describe('bootstrapAuthTokens', () => {
  it('is a no-op in the browser', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'web-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'web-refresh');
    prefs.set(ACCESS_TOKEN_KEY, 'native-access');
    prefs.set(REFRESH_TOKEN_KEY, 'native-refresh');

    await bootstrapAuthTokens();

    expect(getAccessToken()).toBe('web-access');
  });

  it('adopts the native pair over a stale local copy', async () => {
    capacitor.native = true;
    localStorage.setItem(ACCESS_TOKEN_KEY, 'stale-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    prefs.set(ACCESS_TOKEN_KEY, 'fresh-access');
    prefs.set(REFRESH_TOKEN_KEY, 'fresh-refresh');

    await bootstrapAuthTokens();

    expect(getAccessToken()).toBe('fresh-access');
    expect(getRefreshToken()).toBe('fresh-refresh');
  });

  it('signs out when the native store was cleared', async () => {
    capacitor.native = true;
    localStorage.setItem(ACCESS_TOKEN_KEY, 'stale-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');

    await bootstrapAuthTokens();

    expect(hasSession()).toBe(false);
  });

  it('signs out on a partial native pair rather than keeping a half-session', async () => {
    capacitor.native = true;
    localStorage.setItem(ACCESS_TOKEN_KEY, 'stale-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    prefs.set(ACCESS_TOKEN_KEY, 'lonely-access'); // refresh missing

    await bootstrapAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});
