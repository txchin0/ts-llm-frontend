export type MicLanguagePreference = 'system' | (string & {});

export interface MicLanguageOption {
  value: MicLanguagePreference;
  label: string;
}

/** Curated list of Web Speech API language tags the UI exposes. */
export const MIC_LANGUAGE_OPTIONS: MicLanguageOption[] = [
  { value: 'system', label: 'System default' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'sv-SE', label: 'Swedish' },
  { value: 'da-DK', label: 'Danish' },
  { value: 'nb-NO', label: 'Norwegian' },
  { value: 'fi-FI', label: 'Finnish' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'cs-CZ', label: 'Czech' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'ar-SA', label: 'Arabic' },
  { value: 'ru-RU', label: 'Russian' },
  { value: 'tr-TR', label: 'Turkish' },
];

const OPTION_VALUES = new Set(MIC_LANGUAGE_OPTIONS.map((option) => option.value));

export function isMicLanguagePreference(value: string | null): value is MicLanguagePreference {
  return value !== null && OPTION_VALUES.has(value as MicLanguagePreference);
}

/** Resolve a stored preference to the BCP 47 tag passed to SpeechRecognition. */
export function resolveMicLanguage(preference: MicLanguagePreference): string {
  if (preference !== 'system') return preference;
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}
