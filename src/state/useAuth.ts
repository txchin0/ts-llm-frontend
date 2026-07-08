import { useCallback, useEffect, useState } from 'react';

import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../api/auth.ts';
import {
  bootstrapAuthTokens,
  hasSession,
  onAuthTokensChange,
} from '../api/authTokens.ts';

const USER_ID_KEY = 'ts-llm.user_id';

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn';

export interface Auth {
  status: AuthStatus;
  /** The signed-in account id ('' while signed out). */
  userId: string;
  login: (userId: string, password: string) => Promise<void>;
  register: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

function readStoredUserId(): string {
  try {
    return localStorage.getItem(USER_ID_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeStoredUserId(userId: string): void {
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {
    // Storage unavailable; display name just won't persist.
  }
}

/**
 * Session state derived from the stored token pair. `user_id` is no longer a
 * user-editable setting — it is the logged-in account (persisted under the
 * legacy `ts-llm.user_id` key, which also prefills the login form so existing
 * installs keep their identity).
 *
 * Starts in `initializing` while the native token bootstrap runs (the
 * assistant may have rotated or cleared the pair since the WebView last ran).
 */
export function useAuth(): Auth {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [userId, setUserId] = useState<string>(readStoredUserId);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (!cancelled) {
        setStatus(hasSession() ? 'signedIn' : 'signedOut');
      }
    };

    const unsubscribe = onAuthTokensChange(sync);
    void bootstrapAuthTokens().then(sync);

    // Re-adopt the native pair whenever the app is foregrounded: the assistant
    // may have rotated or cleared the tokens while the WebView was backgrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void bootstrapAuthTokens().then(sync);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const login = useCallback(async (nextUserId: string, password: string) => {
    const tokens = await apiLogin(nextUserId.trim(), password);
    writeStoredUserId(tokens.user_id);
    setUserId(tokens.user_id);
  }, []);

  const register = useCallback(async (nextUserId: string, password: string) => {
    const tokens = await apiRegister(nextUserId.trim(), password);
    writeStoredUserId(tokens.user_id);
    setUserId(tokens.user_id);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
  }, []);

  return { status, userId: status === 'signedIn' ? userId : '', login, register, logout };
}
