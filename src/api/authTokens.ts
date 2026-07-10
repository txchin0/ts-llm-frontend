import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Persistence for the auth token pair, shared with the native voice assistant.
 *
 * localStorage is the working copy the fetch layer reads synchronously. On
 * native, every write is mirrored into Capacitor Preferences (the
 * `CapacitorStorage` SharedPreferences store) because the assistant's
 * `AuthTokenStore.kt` reads — and, after refreshing, writes — the same keys.
 * At startup {@link bootstrapAuthTokens} copies the Preferences pair back into
 * localStorage, so a rotation performed natively while the WebView was closed
 * wins over the stale local copy.
 *
 * On native, localStorage + Preferences mutations share a lock with bootstrap
 * so a visibilitychange read cannot observe an empty Preferences store mid-
 * mirror and wipe a fresh login.
 */

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../native/handshake.ts';

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY };

type AuthChangeListener = () => void;

const listeners = new Set<AuthChangeListener>();

/** Serializes native Preferences mirrors with bootstrap reads. */
let authStoreLock: Promise<void> = Promise.resolve();

function withAuthStoreLock(work: () => Promise<void>): Promise<void> {
  const run = authStoreLock.then(work, work);
  authStoreLock = run.catch(() => {});
  return run;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes to token changes (login/logout/refresh). Returns an unsubscribe. */
export function onAuthTokensChange(listener: AuthChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_TOKEN_KEY);
}

export function hasSession(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}

function writeLocalPair(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Storage unavailable; the session just won't survive a reload.
  }
}

function clearLocalPair(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

/** Persists a token pair locally and mirrors it to the native store. */
export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await withAuthStoreLock(async () => {
      writeLocalPair(accessToken, refreshToken);
      try {
        await Promise.all([
          Preferences.set({ key: ACCESS_TOKEN_KEY, value: accessToken }),
          Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken }),
        ]);
      } catch {
        // Preferences unavailable; localStorage still holds the pair.
      }
    });
  } else {
    writeLocalPair(accessToken, refreshToken);
  }
  notify();
}

/** Clears the session everywhere (logout or a definitively rejected refresh). */
export async function clearAuthTokens(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await withAuthStoreLock(async () => {
      clearLocalPair();
      try {
        await Promise.all([
          Preferences.remove({ key: ACCESS_TOKEN_KEY }),
          Preferences.remove({ key: REFRESH_TOKEN_KEY }),
        ]);
      } catch {
        // Preferences unavailable; localStorage is already cleared.
      }
    });
  } else {
    clearLocalPair();
  }
  notify();
}

/**
 * On native, adopts the Preferences pair as the source of truth: the native
 * assistant may have rotated (or cleared) the tokens since the WebView last
 * ran. No-op in the browser.
 */
export async function bootstrapAuthTokens(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await withAuthStoreLock(async () => {
    try {
      const [access, refresh] = await Promise.all([
        Preferences.get({ key: ACCESS_TOKEN_KEY }),
        Preferences.get({ key: REFRESH_TOKEN_KEY }),
      ]);

      const nativeAccess = access.value?.trim() ?? '';
      const nativeRefresh = refresh.value?.trim() ?? '';

      if (nativeAccess !== '' && nativeRefresh !== '') {
        writeLocalPair(nativeAccess, nativeRefresh);
      } else {
        // Empty (cleared natively — refresh token revoked) or a partial pair
        // (corruption / interrupted write): treat as signed out rather than
        // leaving the WebView with a half-valid session.
        clearLocalPair();
      }
    } catch {
      // Preferences unavailable; keep whatever localStorage has.
    }
  });
  notify();
}
