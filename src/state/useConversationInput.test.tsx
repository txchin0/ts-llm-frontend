import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useConversationInput } from './useConversationInput.ts';
import type { UseSpeechInputOptions } from '../voice/useSpeechInput.ts';

const speech = vi.hoisted(() => ({
  options: null as UseSpeechInputOptions | null,
  isListening: false,
  start: vi.fn(),
  stop: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock('../voice/useSpeechInput.ts', () => ({
  useSpeechInput: (options: UseSpeechInputOptions) => {
    const previousLanguage = speech.options?.language;
    speech.options = options;
    // Mirror useSpeechInput's language-restart ownership for wiring tests.
    if (
      previousLanguage !== undefined &&
      previousLanguage !== options.language &&
      speech.isListening
    ) {
      speech.stop({ abort: true });
      speech.clearError();
      speech.start(options.getDictationBase?.() ?? '');
    }
    return {
      supported: true,
      isListening: speech.isListening,
      error: null,
      start: speech.start,
      stop: speech.stop,
      clearError: speech.clearError,
    };
  },
}));

function renderConversation(micLanguage = 'en-US') {
  const send = vi.fn();
  const stop = vi.fn();
  const rendered = renderHook(
    ({ language }: { language: string }) =>
      useConversationInput({ send, stop, isStreaming: false, micLanguage: language }),
    { initialProps: { language: micLanguage } },
  );
  return { ...rendered, send, stop };
}

describe('useConversationInput', () => {
  beforeEach(() => {
    speech.options = null;
    speech.isListening = false;
    speech.start.mockReset();
    speech.stop.mockReset();
    speech.clearError.mockReset();
  });

  it('routes dictation to the composer draft while hands-free is closed', () => {
    const { result } = renderConversation();

    act(() => {
      speech.options?.onTranscript('hello there');
    });

    expect(result.current.input).toBe('hello there');
    expect(result.current.handsFree.transcript).toBe('');
  });

  it('routes dictation to the hands-free transcript while the overlay is open', () => {
    const { result } = renderConversation();

    act(() => {
      result.current.handsFree.enter();
    });
    act(() => {
      speech.options?.onTranscript('ship the release');
    });

    expect(result.current.handsFree.transcript).toBe('ship the release');
    expect(result.current.input).toBe('');
  });

  it('submit stops active dictation, sends the draft, and clears it', () => {
    const { result, rerender, send } = renderConversation();

    act(() => {
      result.current.setInput('ship it');
    });
    speech.isListening = true;
    rerender({ language: 'en-US' });

    act(() => {
      result.current.submit();
    });

    expect(speech.stop).toHaveBeenCalledWith({ abort: true });
    expect(send).toHaveBeenCalledWith('ship it');
    expect(result.current.input).toBe('');
  });

  it('voice.toggle starts dictation from the current draft', () => {
    const { result } = renderConversation();

    act(() => {
      result.current.setInput('draft so far');
    });
    act(() => {
      result.current.voice.toggle();
    });

    expect(speech.clearError).toHaveBeenCalled();
    expect(speech.start).toHaveBeenCalledWith('draft so far');
  });

  it('voice.toggle aborts dictation when already listening', () => {
    const { result, rerender } = renderConversation();

    speech.isListening = true;
    rerender({ language: 'en-US' });

    act(() => {
      result.current.voice.toggle();
    });

    expect(speech.stop).toHaveBeenCalledWith({ abort: true });
    expect(speech.start).not.toHaveBeenCalled();
  });

  it('passes getDictationBase so speech can restart from the draft', () => {
    const { result, rerender } = renderConversation('en-US');

    act(() => {
      result.current.setInput('halfway through');
    });
    speech.isListening = true;
    rerender({ language: 'en-US' });

    rerender({ language: 'de-DE' });

    expect(speech.options?.language).toBe('de-DE');
    expect(speech.stop).toHaveBeenCalledWith({ abort: true });
    expect(speech.start).toHaveBeenCalledWith('halfway through');
  });

  it('passes getDictationBase so speech can restart from the hands-free transcript', () => {
    const { result, rerender } = renderConversation('en-US');

    act(() => {
      result.current.handsFree.enter();
    });
    act(() => {
      speech.options?.onTranscript('spoken so far');
    });
    speech.isListening = true;
    rerender({ language: 'en-US' });

    rerender({ language: 'fr-FR' });

    expect(speech.start).toHaveBeenCalledWith('spoken so far');
  });

  it('does not restart dictation on a language change while idle', () => {
    const { rerender } = renderConversation('en-US');

    rerender({ language: 'de-DE' });

    expect(speech.stop).not.toHaveBeenCalled();
    expect(speech.start).not.toHaveBeenCalled();
  });
});
