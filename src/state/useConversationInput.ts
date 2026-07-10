import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveMicLanguage } from '../voice/speechLanguages.ts';
import type { MicLanguagePreference } from '../voice/speechLanguages.ts';
import { useSpeechInput } from '../voice/useSpeechInput.ts';
import { useHandsFree } from './useHandsFree.ts';
import type { MicState } from './useHandsFree.ts';

export interface UseConversationInputOptions {
  send: (text: string) => void;
  stop: () => void;
  isStreaming: boolean;
  /** Mic language preference as stored in settings; resolved internally. */
  micLanguage: MicLanguagePreference;
}

export interface ConversationInput {
  /** Composer draft text. */
  input: string;
  setInput: (text: string) => void;
  /** Send the draft: stops any active dictation and clears the draft. */
  submit: () => void;
  voice: {
    supported: boolean;
    isListening: boolean;
    error: string | null;
    /** Start dictation into the draft, or abort it if already listening. */
    toggle: () => void;
  };
  handsFree: {
    isOpen: boolean;
    /** Open the overlay, taking over dictation from the composer. */
    enter: () => void;
    close: () => void;
    transcript: string;
    micState: MicState;
    toggleMic: () => void;
  };
}

/**
 * Everything between the user's keyboard/voice and `useChat.send`: the
 * composer draft, dictation (behind the speech-engine seam), and the
 * hands-free overlay. Owns the routing rule — dictation lands in the
 * hands-free transcript while the overlay is open, in the composer draft
 * otherwise — and restarts dictation in place when the mic language changes.
 */
export function useConversationInput({
  send,
  stop,
  isStreaming,
  micLanguage,
}: UseConversationInputOptions): ConversationInput {
  const [input, setInput] = useState('');

  const resolvedLanguage = useMemo(() => resolveMicLanguage(micLanguage), [micLanguage]);

  // Routing depends on hands-free state, but the speech hook needs a stable
  // callback and hands-free needs the speech controls — refs break the cycle.
  const handsFreeIsOpenRef = useRef(false);
  const handsFreeTranscriptRef = useRef<(text: string) => void>(() => {});

  const onTranscript = useCallback((text: string) => {
    if (handsFreeIsOpenRef.current) {
      handsFreeTranscriptRef.current(text);
    } else {
      setInput(text);
    }
  }, []);

  const voice = useSpeechInput({ onTranscript, language: resolvedLanguage });

  const handsFree = useHandsFree({
    send,
    stop,
    isStreaming,
    isListening: voice.isListening,
    startListening: voice.start,
    stopListening: voice.stop,
  });

  useEffect(() => {
    handsFreeIsOpenRef.current = handsFree.isOpen;
    handsFreeTranscriptRef.current = handsFree.handleTranscript;
  }, [handsFree.isOpen, handsFree.handleTranscript]);

  // Restart dictation in place when the language changes mid-session, keeping
  // whatever text the user already produced as the base.
  const prevLanguageRef = useRef(resolvedLanguage);
  useEffect(() => {
    if (prevLanguageRef.current === resolvedLanguage) return;
    prevLanguageRef.current = resolvedLanguage;
    if (!voice.isListening) return;
    const base = handsFree.isOpen ? handsFree.transcript : input;
    voice.stop({ abort: true });
    voice.clearError();
    voice.start(base);
  });

  const submit = useCallback(() => {
    if (voice.isListening) voice.stop({ abort: true });
    const text = input;
    setInput('');
    send(text);
  }, [input, send, voice]);

  const toggleVoice = useCallback(() => {
    if (voice.isListening) {
      voice.stop({ abort: true });
    } else {
      voice.clearError();
      voice.start(input);
    }
  }, [input, voice]);

  const enterHandsFree = useCallback(() => {
    if (voice.isListening) voice.stop({ abort: true });
    voice.clearError();
    handsFree.open();
  }, [handsFree, voice]);

  return {
    input,
    setInput,
    submit,
    voice: {
      supported: voice.supported,
      isListening: voice.isListening,
      error: voice.error,
      toggle: toggleVoice,
    },
    handsFree: {
      isOpen: handsFree.isOpen,
      enter: enterHandsFree,
      close: handsFree.close,
      transcript: handsFree.transcript,
      micState: handsFree.micState,
      toggleMic: handsFree.toggleMic,
    },
  };
}
