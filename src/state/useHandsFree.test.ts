import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HANDS_FREE_SILENCE_MS, useHandsFree } from './useHandsFree.ts';

describe('useHandsFree', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-sends after silence when transcript has content', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const stopListening = vi.fn();
    const startListening = vi.fn();

    const { result } = renderHook(() =>
      useHandsFree({
        send,
        stop: vi.fn(),
        isStreaming: false,
        isListening: true,
        startListening,
        stopListening,
        silenceTimeoutMs: HANDS_FREE_SILENCE_MS,
      }),
    );

    act(() => {
      result.current.open();
      result.current.handleTranscript('hello there');
    });

    act(() => {
      vi.advanceTimersByTime(HANDS_FREE_SILENCE_MS);
    });

    expect(stopListening).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('hello there');
    expect(result.current.transcript).toBe('');
  });

  it('does not arm silence timer while streaming', () => {
    vi.useFakeTimers();
    const send = vi.fn();

    const { result, rerender } = renderHook(
      ({ isStreaming }: { isStreaming: boolean }) =>
        useHandsFree({
          send,
          stop: vi.fn(),
          isStreaming,
          isListening: false,
          startListening: vi.fn(),
          stopListening: vi.fn(),
          silenceTimeoutMs: 500,
        }),
      { initialProps: { isStreaming: true } },
    );

    act(() => {
      result.current.open();
      result.current.handleTranscript('ignored while streaming');
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(send).not.toHaveBeenCalled();

    rerender({ isStreaming: false });

    act(() => {
      result.current.handleTranscript('now it counts');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(send).toHaveBeenCalledWith('now it counts');
  });

  it('toggleMic sends immediately when already listening', () => {
    const send = vi.fn();
    const stopListening = vi.fn();

    const { result } = renderHook(() =>
      useHandsFree({
        send,
        stop: vi.fn(),
        isStreaming: false,
        isListening: true,
        startListening: vi.fn(),
        stopListening,
      }),
    );

    act(() => {
      result.current.open();
      result.current.handleTranscript('ship this');
      result.current.toggleMic();
    });

    expect(stopListening).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('ship this');
  });

  it('toggleMic stops generation while streaming', () => {
    const stop = vi.fn();

    const { result } = renderHook(() =>
      useHandsFree({
        send: vi.fn(),
        stop,
        isStreaming: true,
        isListening: false,
        startListening: vi.fn(),
        stopListening: vi.fn(),
      }),
    );

    act(() => {
      result.current.open();
      result.current.toggleMic();
    });

    expect(stop).toHaveBeenCalled();
  });
});
