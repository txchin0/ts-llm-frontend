import { useCallback, useEffect, useRef, useState } from 'react';

import { Capacitor } from '@capacitor/core';

import { NativeSpeechEngine } from './nativeSpeechEngine.ts';
import type { SpeechInputEngine } from './speechEngine.ts';
import { voiceErrorMessage } from './voiceErrors.ts';
import { WebSpeechEngine } from './webSpeechEngine.ts';

function createSpeechEngine(): SpeechInputEngine {
  return Capacitor.isNativePlatform() ? new NativeSpeechEngine() : new WebSpeechEngine();
}

export interface UseSpeechInputOptions {
  /** Called with the full text (base + recognized) as speech is transcribed. */
  onTranscript: (text: string) => void;
  /** BCP 47 language tag for recognition (e.g. `en-US`). */
  language: string;
  /**
   * Current full dictation text to keep when restarting after a language
   * change mid-session. Defaults to the base passed to the last `start`.
   */
  getDictationBase?: () => string;
}

export interface SpeechInput {
  supported: boolean;
  isListening: boolean;
  /** Last voice error, if any; cleared when starting a new session. */
  error: string | null;
  /** Begin listening, appending recognized speech after `baseText`. */
  start: (baseText: string) => void;
  stop: (opts?: { abort?: boolean }) => void;
  clearError: () => void;
}

/**
 * Speech dictation behind a mic-input strategy: Web Speech API in browsers,
 * android.speech.SpeechRecognizer (via Capacitor plugin) in the native app.
 * Recognized speech is appended to whatever text was already in the composer
 * and pushed back via `onTranscript`; it never auto-sends. Degrades to
 * `supported: false` where no engine is available. When `language` changes
 * while listening, restarts in place with `getDictationBase()`.
 */
export function useSpeechInput({
  onTranscript,
  language,
  getDictationBase,
}: UseSpeechInputOptions): SpeechInput {
  const [engine] = useState<SpeechInputEngine>(createSpeechEngine);

  const [supported, setSupported] = useState<boolean>(() => engine.isAvailableSync?.() ?? true);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseTextRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const languageRef = useRef(language);
  const getDictationBaseRef = useRef(getDictationBase);
  const isListeningRef = useRef(false);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    getDictationBaseRef.current = getDictationBase;
  });
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    let cancelled = false;
    void engine.isAvailable().then((available) => {
      if (!cancelled) setSupported(available);
    });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stop = useCallback(
    (opts?: { abort?: boolean }) => {
      engine.stop(opts);
      setIsListening(false);
    },
    [engine],
  );

  const start = useCallback(
    (baseText: string) => {
      setError(null);

      const base = baseText.length > 0 && !baseText.endsWith(' ') ? `${baseText} ` : baseText;
      baseTextRef.current = base;

      engine.start(languageRef.current, {
        onTranscript: (sessionText) => {
          onTranscriptRef.current(baseTextRef.current + sessionText);
        },
        onStart: () => {
          setIsListening(true);
        },
        onEnd: () => {
          setIsListening(false);
        },
        onError: (code) => {
          const message = voiceErrorMessage(code);
          if (message) setError(message);
        },
      });
    },
    [engine],
  );

  // Restart in place when the recognition language changes mid-session.
  useEffect(() => {
    if (languageRef.current === language) return;
    languageRef.current = language;
    if (!isListeningRef.current) return;

    const base = getDictationBaseRef.current?.() ?? baseTextRef.current.trimEnd();
    stop({ abort: true });
    clearError();
    start(base);
  }, [language, stop, clearError, start]);

  useEffect(() => {
    return () => {
      engine.stop({ abort: true });
    };
  }, [engine]);

  return { supported, isListening, error, start, stop, clearError };
}
