import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpeechEngineCallbacks } from './speechEngine.ts';
import { WebSpeechEngine } from './webSpeechEngine.ts';

class FakeRecognition {
  static instances: FakeRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  emitResult(parts: Array<{ transcript: string; isFinal: boolean }>, resultIndex = 0) {
    const results = parts.map((part) => {
      const alternatives = [{ transcript: part.transcript }];
      return Object.assign(alternatives, { isFinal: part.isFinal });
    });
    this.onresult?.({ resultIndex, results });
  }
}

function makeCallbacks(): SpeechEngineCallbacks & {
  transcripts: string[];
  errors: string[];
  startCount: () => number;
  endCount: () => number;
} {
  const transcripts: string[] = [];
  const errors: string[] = [];
  const onStart = vi.fn();
  const onEnd = vi.fn();
  return {
    transcripts,
    errors,
    onTranscript: (text) => transcripts.push(text),
    onError: (code) => errors.push(code),
    onStart,
    onEnd,
    startCount: () => onStart.mock.calls.length,
    endCount: () => onEnd.mock.calls.length,
  };
}

describe('WebSpeechEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('accumulates final results and appends interim text', () => {
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    const rec = FakeRecognition.instances[0];
    expect(rec.lang).toBe('en-US');
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(callbacks.startCount()).toBe(1);

    rec.emitResult([{ transcript: 'hello ', isFinal: true }]);
    rec.emitResult([{ transcript: 'wor', isFinal: false }], 0);
    expect(callbacks.transcripts).toEqual(['hello ', 'hello wor']);
  });

  it('restarts recognition when the browser ends the session early', () => {
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    FakeRecognition.instances[0].onend?.();
    expect(FakeRecognition.instances).toHaveLength(1);
    vi.advanceTimersByTime(50);
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(callbacks.endCount()).toBe(0);

    // Final text survives the restart.
    FakeRecognition.instances[0].emitResult?.([]);
    FakeRecognition.instances[1].emitResult([{ transcript: 'still here', isFinal: false }]);
    expect(callbacks.transcripts).toContain('still here');
  });

  it('does not restart after stop()', () => {
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    engine.stop();
    expect(callbacks.endCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('ignores no-speech and aborted errors', () => {
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    const rec = FakeRecognition.instances[0];
    rec.onerror?.({ error: 'no-speech' });
    rec.onerror?.({ error: 'aborted' });
    expect(callbacks.errors).toEqual([]);
    expect(callbacks.endCount()).toBe(0);
  });

  it('surfaces fatal errors and ends the session', () => {
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    FakeRecognition.instances[0].onerror?.({ error: 'not-allowed' });
    expect(callbacks.errors).toEqual(['not-allowed']);
    expect(callbacks.endCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('reports unsupported when no recognition constructor exists', () => {
    vi.unstubAllGlobals();
    const engine = new WebSpeechEngine();
    const callbacks = makeCallbacks();
    engine.start('en-US', callbacks);

    expect(callbacks.errors).toEqual(['unsupported']);
    expect(callbacks.endCount()).toBe(1);
    expect(engine.isAvailableSync()).toBe(false);
  });
});
