import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from '../api/client.ts';
import type { RespondStreamEvent } from '../api/client.ts';
import { useChat, selectLatestAssistant } from './useChat.ts';

const respondStreamMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>();
  return {
    ...actual,
    respondStream: respondStreamMock,
  };
});

async function* streamOf(...events: RespondStreamEvent[]): AsyncGenerator<RespondStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('useChat', () => {
  afterEach(() => {
    respondStreamMock.mockReset();
  });

  it('streams assistant content on a happy path', async () => {
    respondStreamMock.mockReturnValue(
      streamOf(
        {
          type: 'start',
          request_id: 'req-1',
          user_id: 'user-1',
          session_id: 'sess-1',
          started_at: '2026-01-01T00:00:00Z',
        },
        { type: 'delta', text: 'Hello' },
        {
          type: 'final',
          request_id: 'req-1',
          finish_reason: 'stop',
          completed_at: '2026-01-01T00:00:00Z',
        },
      ),
    );

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.hasSession).toBe(true);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi' });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello',
      status: 'complete',
      requestId: 'req-1',
    });
  });

  it('marks the assistant message aborted when stopped', async () => {
    respondStreamMock.mockImplementation((_request, options) =>
      (async function* () {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 100);
          options?.signal?.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
        yield { type: 'delta', text: 'partial' };
      })(),
    );

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    act(() => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const assistant = result.current.messages.find((message) => message.role === 'assistant');
    expect(assistant).toMatchObject({ status: 'aborted' });
  });

  it('records HTTP errors on the assistant message', async () => {
    respondStreamMock.mockImplementation(() => {
      throw new ApiHttpError(503, 'Service Unavailable');
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const assistant = result.current.messages.find((message) => message.role === 'assistant');
    expect(assistant).toMatchObject({
      status: 'error',
      error: { code: 'http_503' },
    });
  });

  it('completes when the stream ends without a final event', async () => {
    respondStreamMock.mockReturnValue(streamOf({ type: 'delta', text: 'Done' }));

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const assistant = result.current.messages.find((message) => message.role === 'assistant');
    expect(assistant).toMatchObject({ content: 'Done', status: 'complete' });
  });

  it('stores usage events on the assistant message', async () => {
    respondStreamMock.mockReturnValue(
      streamOf({
        type: 'usage',
        request_id: 'req-1',
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    );

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const assistant = result.current.messages.find((message) => message.role === 'assistant');
    expect(assistant).toMatchObject({
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      status: 'complete',
    });
  });
});

describe('selectLatestAssistant', () => {
  it('returns the last assistant message', () => {
    const latest = selectLatestAssistant([
      { id: '1', role: 'user', content: 'Hi', createdAt: 1 },
      {
        id: '2',
        role: 'assistant',
        content: 'First',
        thinking: '',
        tools: [],
        status: 'complete',
        createdAt: 2,
      },
      { id: '3', role: 'user', content: 'Again', createdAt: 3 },
      {
        id: '4',
        role: 'assistant',
        content: 'Latest',
        thinking: '',
        tools: [],
        status: 'streaming',
        createdAt: 4,
      },
    ]);

    expect(latest?.content).toBe('Latest');
    expect(latest?.status).toBe('streaming');
  });

  it('returns undefined when no assistant messages exist', () => {
    expect(
      selectLatestAssistant([{ id: '1', role: 'user', content: 'Hi', createdAt: 1 }]),
    ).toBeUndefined();
  });
});
