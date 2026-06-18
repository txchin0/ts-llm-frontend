import { afterEach, describe, expect, it } from 'vitest';

import { isMicLanguagePreference, resolveMicLanguage } from './speechLanguages.ts';

describe('isMicLanguagePreference', () => {
  it('accepts known option values', () => {
    expect(isMicLanguagePreference('system')).toBe(true);
    expect(isMicLanguagePreference('en-US')).toBe(true);
  });

  it('rejects null and unknown values', () => {
    expect(isMicLanguagePreference(null)).toBe(false);
    expect(isMicLanguagePreference('xx-YY')).toBe(false);
  });
});

describe('resolveMicLanguage', () => {
  afterEach(() => {
    document.documentElement.lang = '';
  });

  it('returns explicit preferences unchanged', () => {
    expect(resolveMicLanguage('de-DE')).toBe('de-DE');
  });

  it('uses document language for system preference', () => {
    document.documentElement.lang = 'fr-FR';
    expect(resolveMicLanguage('system')).toBe('fr-FR');
  });

  it('falls back to navigator.language or en-US', () => {
    const original = navigator.language;
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'ja-JP',
    });

    expect(resolveMicLanguage('system')).toBe('ja-JP');

    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: original,
    });
  });
});
