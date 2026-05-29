import { useCallback, useEffect, useRef, useState } from 'react';

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export interface UseSpeechInputOptions {
  /** Called with the full text (base + recognized) as speech is transcribed. */
  onTranscript: (text: string) => void;
}

export interface SpeechInput {
  supported: boolean;
  isListening: boolean;
  /** Begin listening, appending recognized speech after `baseText`. */
  start: (baseText: string) => void;
  stop: () => void;
}

/**
 * Web Speech API dictation. Recognized speech is appended to whatever text was
 * already in the composer and pushed back via `onTranscript`; it never auto-
 * sends. Degrades to `supported: false` where the API is unavailable.
 */
export function useSpeechInput({ onTranscript }: UseSpeechInputOptions): SpeechInput {
  const [supported] = useState(() => getRecognitionConstructor() !== undefined);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef('');
  const finalTextRef = useRef('');
  // Keep the latest callback without re-subscribing recognition handlers.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(
    (baseText: string) => {
      const Constructor = getRecognitionConstructor();
      if (!Constructor || recognitionRef.current) return;

      const recognition = new Constructor();
      recognition.lang =
        typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const base = baseText.length > 0 && !baseText.endsWith(' ') ? `${baseText} ` : baseText;
      baseTextRef.current = base;
      finalTextRef.current = '';

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

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    },
    [],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, isListening, start, stop };
}
