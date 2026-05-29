import { useCallback, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const USER_ID_KEY = 'ts-llm.user_id';
const THEME_KEY = 'ts-llm.theme';
const DEFAULT_USER_ID = 'web-user';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); preferences just won't persist.
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export interface Settings {
  userId: string;
  setUserId: (next: string) => void;
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  /** The actual theme in effect after resolving `system`. */
  resolvedTheme: ResolvedTheme;
}

/**
 * Holds the only persisted state in the app: the active user id and the theme
 * preference. Conversations are never stored. Applies the resolved theme to the
 * document root so CSS tokens can switch via `[data-theme]`.
 */
export function useSettings(): Settings {
  const [userId, setUserIdState] = useState<string>(
    () => readStored(USER_ID_KEY) ?? DEFAULT_USER_ID,
  );

  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = readStored(THEME_KEY);
    return isThemePreference(stored) ? stored : 'system';
  });

  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') return systemDark ? 'dark' : 'light';
    return theme;
  }, [theme, systemDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setUserId = useCallback((next: string) => {
    const trimmed = next.trim();
    if (trimmed.length === 0) return;
    setUserIdState(trimmed);
    writeStored(USER_ID_KEY, trimmed);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeStored(THEME_KEY, next);
  }, []);

  return { userId, setUserId, theme, setTheme, resolvedTheme };
}
