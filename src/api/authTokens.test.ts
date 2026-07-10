import { beforeEach, describe, expect, it, vi } from 'vitest';

// Controls whether the code under test believes it is running on native.
const capacitor = vi.hoisted(() => ({ native: false }));
// Backing store for the mocked Capacitor Preferences (the native mirror).
const prefs = vi.hoisted(() => ({
  store: new Map<string, string>(),
  /** When true, Preferences.set parks until {@link releaseSets} runs. */
  holdSets: false,
  pendingSets: [] as Array<() => void>,
  releaseSets() {
    const queued = this.pendingSets.splice(0);
    for (const release of queued) {
      release();
    }
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitor.native },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(({ key }: { key: string }) =>
      Promise.resolve({ value: prefs.store.get(key) ?? null }),
    ),
    set: vi.fn(({ key, value }: { key: string; value: string }) => {
      if (prefs.holdSets) {
        return new Promise<void>((resolve) => {
          prefs.pendingSets.push(() => {
            prefs.store.set(key, value);
            resolve();
          });
        });
      }
      prefs.store.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }: { key: string }) => {
      prefs.store.delete(key);
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
  prefs.store.clear();
  prefs.holdSets = false;
  prefs.pendingSets.length = 0;
  capacitor.native = false;
});

describe('token accessors', () => {
  it('round-trips a stored pair and reports a session', async () => {
    await setAuthTokens('access-1', 'refresh-1');
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

  it('clears both tokens', async () => {
    await setAuthTokens('access-1', 'refresh-1');
    await clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});

describe('change listeners', () => {
  it('notifies subscribers on set and clear, and stops after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = onAuthTokensChange(listener);

    await setAuthTokens('a', 'r');
    await clearAuthTokens();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await setAuthTokens('a2', 'r2');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('native mirroring', () => {
  it('mirrors writes and removals into Preferences on native', async () => {
    capacitor.native = true;

    await setAuthTokens('access-1', 'refresh-1');
    expect(prefs.store.get(ACCESS_TOKEN_KEY)).toBe('access-1');
    expect(prefs.store.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');

    await clearAuthTokens();
    expect(prefs.store.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(prefs.store.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});

describe('bootstrapAuthTokens', () => {
  it('is a no-op in the browser', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'web-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'web-refresh');
    prefs.store.set(ACCESS_TOKEN_KEY, 'native-access');
    prefs.store.set(REFRESH_TOKEN_KEY, 'native-refresh');

    await bootstrapAuthTokens();

    expect(getAccessToken()).toBe('web-access');
  });

  it('adopts the native pair over a stale local copy', async () => {
    capacitor.native = true;
    localStorage.setItem(ACCESS_TOKEN_KEY, 'stale-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    prefs.store.set(ACCESS_TOKEN_KEY, 'fresh-access');
    prefs.store.set(REFRESH_TOKEN_KEY, 'fresh-refresh');

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
    prefs.store.set(ACCESS_TOKEN_KEY, 'lonely-access'); // refresh missing

    await bootstrapAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });

  it('does not wipe a fresh login while the Preferences mirror is in flight', async () => {
    capacitor.native = true;
    prefs.holdSets = true;

    const login = setAuthTokens('fresh-access', 'fresh-refresh');
    // Give the login mirror a turn to park on Preferences.set.
    await Promise.resolve();
    const bootstrap = bootstrapAuthTokens();

    expect(prefs.pendingSets.length).toBeGreaterThan(0);
    prefs.holdSets = false;
    prefs.releaseSets();

    await Promise.all([login, bootstrap]);

    expect(getAccessToken()).toBe('fresh-access');
    expect(getRefreshToken()).toBe('fresh-refresh');
    expect(prefs.store.get(ACCESS_TOKEN_KEY)).toBe('fresh-access');
    expect(prefs.store.get(REFRESH_TOKEN_KEY)).toBe('fresh-refresh');
  });
});
