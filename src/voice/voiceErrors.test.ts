import { describe, expect, it } from 'vitest';

import { voiceErrorMessage } from './voiceErrors.ts';

describe('voiceErrorMessage', () => {
  it('returns user-facing messages for common errors', () => {
    expect(voiceErrorMessage('not-allowed')).toBe('Microphone access blocked');
    expect(voiceErrorMessage('audio-capture')).toBe('No microphone found');
    expect(voiceErrorMessage('service-not-allowed')).toBe(
      'Voice input is not available in this browser tab',
    );
  });

  it('returns null for silent expected errors', () => {
    expect(voiceErrorMessage('no-speech')).toBeNull();
    expect(voiceErrorMessage('aborted')).toBeNull();
  });

  it('falls back for unknown codes', () => {
    expect(voiceErrorMessage('weird-code')).toBe('Voice input failed (weird-code)');
  });
});
