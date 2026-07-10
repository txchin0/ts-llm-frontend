import { useCallback, useEffect, useMemo, useState } from 'react';

import { themeColorHex } from '../brand.ts';
import { MIC_LANGUAGE_KEY, SERVER_URL_KEY } from '../native/handshake.ts';
import {
  bootstrapNativeSettingsMirror,
  mirrorSettingToNative,
} from '../native/settingsMirror.ts';
import {
  isMicLanguagePreference,
  type MicLanguagePreference,
} from '../voice/speechLanguages.ts';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'ts-llm.theme';
const SHOW_THINKING_KEY = 'ts-llm.show_thinking';
const SHOW_TOOL_CALLS_KEY = 'ts-llm.show_tool_calls';
const DEFAULT_SHOW_TOOL_CALLS = true;

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

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  const stored = readStored(key);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return defaultValue;
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = themeColorHex(theme);
  }
}

export interface Settings {
  /** Absolute agent-server URL. Empty = same origin (browser); set on native. */
  serverUrl: string;
  setServerUrl: (next: string) => void;
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  /** The actual theme in effect after resolving `system`. */
  resolvedTheme: ResolvedTheme;
  micLanguage: MicLanguagePreference;
  setMicLanguage: (next: MicLanguagePreference) => void;
  showThinking: boolean;
  setShowThinking: (next: boolean) => void;
  showToolCalls: boolean;
  setShowToolCalls: (next: boolean) => void;
}

/**
 * Holds persisted app preferences: theme, thinking visibility, tool call
 * visibility, and voice input language. Identity lives in useAuth (derived
 * from the logged-in account), not here. Conversations are never stored.
 * Applies the resolved theme to the document root so CSS tokens can switch
 * via `[data-theme]`.
 */
export function useSettings(): Settings {
  const [serverUrl, setServerUrlState] = useState<string>(
    () => readStored(SERVER_URL_KEY) ?? '',
  );

  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = readStored(THEME_KEY);
    return isThemePreference(stored) ? stored : 'system';
  });

  const [micLanguage, setMicLanguageState] = useState<MicLanguagePreference>(() => {
    const stored = readStored(MIC_LANGUAGE_KEY);
    return isMicLanguagePreference(stored) ? stored : 'system';
  });

  const [showThinking, setShowThinkingState] = useState<boolean>(() =>
    readStoredBoolean(SHOW_THINKING_KEY, false),
  );

  const [showToolCalls, setShowToolCallsState] = useState<boolean>(() =>
    readStoredBoolean(SHOW_TOOL_CALLS_KEY, DEFAULT_SHOW_TOOL_CALLS),
  );

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
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    bootstrapNativeSettingsMirror();
  }, []);

  const setServerUrl = useCallback((next: string) => {
    // Persist the raw (trimmed) value; getApiBaseUrl() owns URL normalization.
    // Empty is allowed and resets to same-origin (relative) requests.
    const trimmed = next.trim();
    setServerUrlState(trimmed);
    writeStored(SERVER_URL_KEY, trimmed);
    mirrorSettingToNative(SERVER_URL_KEY, trimmed);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeStored(THEME_KEY, next);
  }, []);

  const setMicLanguage = useCallback((next: MicLanguagePreference) => {
    setMicLanguageState(next);
    writeStored(MIC_LANGUAGE_KEY, next);
    mirrorSettingToNative(MIC_LANGUAGE_KEY, next);
  }, []);

  const setShowThinking = useCallback((next: boolean) => {
    setShowThinkingState(next);
    writeStored(SHOW_THINKING_KEY, next ? 'true' : 'false');
  }, []);

  const setShowToolCalls = useCallback((next: boolean) => {
    setShowToolCallsState(next);
    writeStored(SHOW_TOOL_CALLS_KEY, next ? 'true' : 'false');
  }, []);

  return {
    serverUrl,
    setServerUrl,
    theme,
    setTheme,
    resolvedTheme,
    micLanguage,
    setMicLanguage,
    showThinking,
    setShowThinking,
    showToolCalls,
    setShowToolCalls,
  };
}
