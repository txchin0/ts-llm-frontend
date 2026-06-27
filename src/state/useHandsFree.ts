import { useCallback, useEffect, useRef, useState } from 'react';

export const HANDS_FREE_SILENCE_MS = 2_500;

export type MicState = 'idle' | 'listening' | 'streaming';

export interface UseHandsFreeOptions {
  send: (text: string) => void;
  stop: () => void;
  isStreaming: boolean;
  isListening: boolean;
  startListening: (baseText: string) => void;
  stopListening: (opts?: { abort?: boolean }) => void;
  silenceTimeoutMs?: number;
}

export interface UseHandsFree {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  transcript: string;
  handleTranscript: (text: string) => void;
  toggleMic: () => void;
  micState: MicState;
}

export function useHandsFree({
  send,
  stop,
  isStreaming,
  isListening,
  startListening,
  stopListening,
  silenceTimeoutMs = HANDS_FREE_SILENCE_MS,
}: UseHandsFreeOptions): UseHandsFree {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');

  const transcriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef(send);
  const stopRef = useRef(stop);
  const stopListeningRef = useRef(stopListening);
  const startListeningRef = useRef(startListening);
  const isStreamingRef = useRef(isStreaming);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const finalizeAndSend = useCallback(() => {
    clearSilenceTimer();
    const text = transcriptRef.current;
    stopListeningRef.current();
    setTranscript('');
    transcriptRef.current = '';
    sendRef.current(text);
  }, [clearSilenceTimer]);

  const armSilenceTimer = useCallback(() => {
    if (isStreamingRef.current) return;
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (transcriptRef.current.trim().length === 0) return;
      finalizeAndSend();
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, finalizeAndSend, silenceTimeoutMs]);

  const handleTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      transcriptRef.current = text;
      if (text.trim().length > 0 && !isStreamingRef.current) {
        armSilenceTimer();
      }
    },
    [armSilenceTimer],
  );

  const open = useCallback(() => {
    clearSilenceTimer();
    setTranscript('');
    transcriptRef.current = '';
    setIsOpen(true);
  }, [clearSilenceTimer]);

  const close = useCallback(() => {
    clearSilenceTimer();
    stopListeningRef.current({ abort: true });
    setTranscript('');
    transcriptRef.current = '';
    setIsOpen(false);
  }, [clearSilenceTimer]);

  const toggleMic = useCallback(() => {
    if (isStreamingRef.current) {
      stopRef.current();
      return;
    }
    if (isListening) {
      finalizeAndSend();
      return;
    }
    clearSilenceTimer();
    setTranscript('');
    transcriptRef.current = '';
    startListeningRef.current('');
  }, [clearSilenceTimer, finalizeAndSend, isListening]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
    };
  }, [clearSilenceTimer]);

  const micState: MicState = isStreaming ? 'streaming' : isListening ? 'listening' : 'idle';

  return {
    isOpen,
    open,
    close,
    transcript,
    handleTranscript,
    toggleMic,
    micState,
  };
}
