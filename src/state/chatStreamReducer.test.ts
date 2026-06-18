import { describe, expect, it } from 'vitest';

import { applyRespondEvent, completeStreamingMessage } from './chatStreamReducer.ts';
import { makeAssistantMessage, makeToolActivity } from '../test/fixtures/chat.ts';

describe('applyRespondEvent', () => {
  it('applies start', () => {
    const next = applyRespondEvent(makeAssistantMessage(), {
      type: 'start',
      request_id: 'req-1',
      user_id: 'u1',
      session_id: 'sess-1',
      started_at: '2026-01-01T00:00:00Z',
    });

    expect(next.requestId).toBe('req-1');
  });

  it('appends delta and thinking_delta text', () => {
    let message = makeAssistantMessage();
    message = applyRespondEvent(message, { type: 'delta', text: 'Hello' });
    message = applyRespondEvent(message, { type: 'thinking_delta', text: 'Hmm' });

    expect(message.content).toBe('Hello');
    expect(message.thinking).toBe('Hmm');
  });

  it('tracks tool calls and results', () => {
    let message = makeAssistantMessage();
    message = applyRespondEvent(message, {
      type: 'tool_call',
      request_id: 'req-1',
      session_id: 'sess-1',
      step: 1,
      tool_call_id: 'call-1',
      tool_name: 'search',
      input: { q: 'test' },
    });
    message = applyRespondEvent(message, {
      type: 'tool_result',
      request_id: 'req-1',
      session_id: 'sess-1',
      step: 1,
      tool_call_id: 'call-1',
      tool_name: 'search',
      output: { hits: 1 },
      is_error: false,
    });

    expect(message.tools).toHaveLength(1);
    expect(message.tools[0]).toMatchObject({
      status: 'done',
      output: { hits: 1 },
    });
  });

  it('marks tool errors', () => {
    const message = applyRespondEvent(
      makeAssistantMessage({
        tools: [makeToolActivity({ toolCallId: 'call-1' })],
      }),
      {
        type: 'tool_result',
        request_id: 'req-1',
        session_id: 'sess-1',
        step: 1,
        tool_call_id: 'call-1',
        tool_name: 'search',
        output: null,
        is_error: true,
        error_code: 'tool_failed',
        error_message: 'boom',
      },
    );

    expect(message.tools[0]).toMatchObject({
      status: 'error',
      errorCode: 'tool_failed',
      errorMessage: 'boom',
    });
  });

  it('records usage and final events', () => {
    let message = makeAssistantMessage();
    message = applyRespondEvent(message, {
      type: 'usage',
      request_id: 'req-1',
      usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
    });
    message = applyRespondEvent(message, {
      type: 'final',
      request_id: 'req-1',
      finish_reason: 'stop',
      completed_at: '2026-01-01T00:00:00Z',
    });

    expect(message.usage).toEqual({ input_tokens: 1, output_tokens: 2, total_tokens: 3 });
    expect(message.status).toBe('complete');
    expect(message.finishReason).toBe('stop');
  });

  it('records stream errors', () => {
    const message = applyRespondEvent(makeAssistantMessage(), {
      type: 'error',
      request_id: 'req-1',
      code: 'provider_error',
      message: 'Provider unavailable',
    });

    expect(message.status).toBe('error');
    expect(message.error).toEqual({ code: 'provider_error', message: 'Provider unavailable' });
  });

  it('ignores unknown events', () => {
    const before = makeAssistantMessage({ content: 'keep' });
    const after = applyRespondEvent(before, { type: 'unknown', raw: { type: 'audio' } });

    expect(after).toEqual(before);
  });

  it('does not downgrade a finalized status on final', () => {
    const message = applyRespondEvent(
      makeAssistantMessage({ status: 'error' }),
      {
        type: 'final',
        request_id: 'req-1',
        finish_reason: 'stop',
        completed_at: '2026-01-01T00:00:00Z',
      },
    );

    expect(message.status).toBe('error');
  });
});

describe('completeStreamingMessage', () => {
  it('marks streaming messages complete', () => {
    expect(completeStreamingMessage(makeAssistantMessage()).status).toBe('complete');
  });

  it('leaves terminal statuses unchanged', () => {
    expect(completeStreamingMessage(makeAssistantMessage({ status: 'error' })).status).toBe('error');
  });
});
