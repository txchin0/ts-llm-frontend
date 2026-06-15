import { useCallback, useEffect, useRef, useState } from 'react';

import { voiceErrorMessage } from './voiceErrors.ts';

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function releaseRecognition(recognition: SpeechRecognition | null, opts?: { abort?: boolean }) {
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    if (opts?.abort) recognition.abort();
    else recognition.stop();
  } catch {
    /* already ended */
  }
}

export interface UseSpeechInputOptions {
  /** Called with the full text (base + recognized) as speech is transcribed. */
  onTranscript: (text: string) => void;
  /** BCP 47 language tag for recognition (e.g. `en-US`). */
  language: string;
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
 * Web Speech API dictation. Recognized speech is appended to whatever text was
 * already in the composer and pushed back via `onTranscript`; it never auto-
 * sends. Degrades to `supported: false` where the API is unavailable.
 *
 * Uses continuous listening; restarts automatically when the browser ends a
 * session early (common on Android Chrome).
 */
export function useSpeechInput({ onTranscript, language }: UseSpeechInputOptions): SpeechInput {
  const [supported] = useState(() => getRecognitionConstructor() !== undefined);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantsListeningRef = useRef(false);
  const baseTextRef = useRef('');
  const finalTextRef = useRef('');
  const launchRecognitionRef = useRef<() => void>(() => {});
  const onTranscriptRef = useRef(onTranscript);
  const languageRef = useRef(language);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });
  useEffect(() => {
    languageRef.current = language;
  });

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearEngine = useCallback((opts?: { abort?: boolean }) => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    releaseRecognition(rec, opts);
  }, []);

  const stop = useCallback(
    (opts?: { abort?: boolean }) => {
      wantsListeningRef.current = false;
      clearEngine(opts);
      setIsListening(false);
    },
    [clearEngine],
  );

  const launchRecognition = useCallback(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor || !wantsListeningRef.current) return;

    const recognition = new Constructor();
    recognition.lang = languageRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTextRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      onTranscriptRef.current(baseTextRef.current + finalTextRef.current + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      wantsListeningRef.current = false;
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      releaseRecognition(recognition, { abort: true });
      setIsListening(false);
      const message = voiceErrorMessage(event.error);
      if (message) setError(message);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;

      if (!wantsListeningRef.current) {
        setIsListening(false);
        return;
      }

      // Android Chrome often ends sessions despite continuous=true; restart.
      window.setTimeout(() => {
        if (!wantsListeningRef.current) {
          setIsListening(false);
          return;
        }
        launchRecognitionRef.current();
      }, 50);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      wantsListeningRef.current = false;
      setIsListening(false);
      const message =
        err instanceof Error && err.message.includes('already started')
          ? 'Voice input already running'
          : 'Could not start voice input';
      setError(message);
    }
  }, []);

  useEffect(() => {
    launchRecognitionRef.current = launchRecognition;
  }, [launchRecognition]);

  const start = useCallback(
    (baseText: string) => {
      const Constructor = getRecognitionConstructor();
      if (!Constructor) {
        setError('Voice input needs Speech Recognition (Chrome, Safari, or Edge)');
        return;
      }
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Voice input needs HTTPS or localhost');
        return;
      }

      clearEngine({ abort: true });
      setError(null);

      const base = baseText.length > 0 && !baseText.endsWith(' ') ? `${baseText} ` : baseText;
      baseTextRef.current = base;
      finalTextRef.current = '';
      wantsListeningRef.current = true;
      launchRecognition();
    },
    [clearEngine, launchRecognition],
  );

  useEffect(() => {
    return () => {
      stop({ abort: true });
    };
  }, [stop]);

  return { supported, isListening, error, start, stop, clearError };
}
