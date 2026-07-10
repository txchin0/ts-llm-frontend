import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSpeechInput } from './useSpeechInput.ts';
import type { SpeechEngineCallbacks, SpeechInputEngine } from './speechEngine.ts';

const engine = vi.hoisted(() => {
  let handlers: SpeechEngineCallbacks | null = null;
  return {
    isAvailableSync: vi.fn(() => true),
    isAvailable: vi.fn(async () => true),
    start: vi.fn((_language: string, next: SpeechEngineCallbacks) => {
      handlers = next;
      next.onStart();
    }),
    stop: vi.fn(() => {
      handlers?.onEnd();
      handlers = null;
    }),
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('./webSpeechEngine.ts', () => ({
  WebSpeechEngine: class implements SpeechInputEngine {
    isAvailableSync = engine.isAvailableSync;
    isAvailable = engine.isAvailable;
    start = engine.start;
    stop = engine.stop;
  },
}));

describe('useSpeechInput language restart', () => {
  beforeEach(() => {
    engine.start.mockClear();
    engine.stop.mockClear();
  });

  it('restarts with getDictationBase when language changes mid-session', () => {
    const getDictationBase = vi.fn(() => 'spoken so far');
    const { result, rerender } = renderHook(
      ({ language }: { language: string }) =>
        useSpeechInput({
          onTranscript: vi.fn(),
          language,
          getDictationBase,
        }),
      { initialProps: { language: 'en-US' } },
    );

    act(() => {
      result.current.start('spoken so far');
    });
    expect(result.current.isListening).toBe(true);
    engine.start.mockClear();
    engine.stop.mockClear();

    rerender({ language: 'de-DE' });

    expect(engine.stop).toHaveBeenCalledWith({ abort: true });
    expect(engine.start).toHaveBeenCalledWith('de-DE', expect.any(Object));
    expect(getDictationBase).toHaveBeenCalled();
    // start() normalizes trailing space onto the base
    expect(engine.start.mock.calls[0][0]).toBe('de-DE');
  });

  it('does not restart when language changes while idle', () => {
    const { rerender } = renderHook(
      ({ language }: { language: string }) =>
        useSpeechInput({
          onTranscript: vi.fn(),
          language,
          getDictationBase: () => 'unused',
        }),
      { initialProps: { language: 'en-US' } },
    );

    rerender({ language: 'de-DE' });

    expect(engine.stop).not.toHaveBeenCalled();
    expect(engine.start).not.toHaveBeenCalled();
  });
});
