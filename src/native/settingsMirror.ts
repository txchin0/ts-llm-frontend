import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

import { SERVER_URL_KEY } from '../api/config.ts';

/**
 * Mirrors the settings the native assistant needs (server URL, mic language)
 * from localStorage into Capacitor Preferences, whose Android backing store
 * (`CapacitorStorage` SharedPreferences) is readable from the
 * VoiceInteractionSession — WebView localStorage is not. localStorage remains
 * the source of truth; this mirror is write-only from the web side.
 *
 * Auth tokens live in the same Preferences store but flow both ways (the
 * native layer writes back rotated pairs) — see src/api/authTokens.ts.
 */

export const MIRRORED_SETTING_KEYS = [SERVER_URL_KEY, 'ts-llm.mic_language'];

export function mirrorSettingToNative(key: string, value: string): void {
  if (!Capacitor.isNativePlatform()) return;
  void Preferences.set({ key, value }).catch(() => {
    /* native store unavailable; assistant will fall back to defaults */
  });
}

/** One-time copy of current values so existing installs get mirrored without re-saving. */
export function bootstrapNativeSettingsMirror(): void {
  if (!Capacitor.isNativePlatform()) return;
  for (const key of MIRRORED_SETTING_KEYS) {
    let value: string | null = null;
    try {
      value = localStorage.getItem(key);
    } catch {
      /* storage unavailable */
    }
    if (value !== null) mirrorSettingToNative(key, value);
  }
}
