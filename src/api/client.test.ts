import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError, respondStream } from './client.ts';
import { isRespondSseEvent } from './types.ts';
import { collectAsync, createSseResponse } from '../test/helpers.ts';

describe('isRespondSseEvent', () => {
  const knownTypes = [
    'start',
    'delta',
    'thinking_delta',
    'final',
    'usage',
    'tool_call',
    'tool_result',
    'error',
  ] as const;

  it.each(knownTypes)('accepts known type %s', (type) => {
    expect(isRespondSseEvent({ type })).toBe(true);
  });

  it('rejects null and missing type', () => {
    expect(isRespondSseEvent(null)).toBe(false);
    expect(isRespondSseEvent({})).toBe(false);
  });

  it('rejects future unknown types', () => {
    expect(isRespondSseEvent({ type: 'audio' })).toBe(false);
  });
});

describe('respondStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields known parsed events', async () => {
    const body = 'data: {"type":"delta","text":"hello"}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(
      respondStream({ user_id: 'u1', message: 'hi' }),
    );

    expect(events).toEqual([{ type: 'delta', text: 'hello' }]);
    expect(fetch).toHaveBeenCalledWith('/v1/respond', expect.objectContaining({ method: 'POST' }));
  });

  it('yields unknown events for non-JSON data', async () => {
    const body = 'data: not-json\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(
      respondStream({ user_id: 'u1', message: 'hi' }),
    );

    expect(events).toEqual([{ type: 'unknown', eventName: undefined, raw: 'not-json' }]);
  });

  it('yields unknown events for unrecognized JSON types', async () => {
    const body = 'data: {"type":"audio","url":"x"}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(
      respondStream({ user_id: 'u1', message: 'hi' }),
    );

    expect(events[0]).toMatchObject({ type: 'unknown', raw: { type: 'audio', url: 'x' } });
  });

  it('throws ApiHttpError on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse('', { ok: false, status: 503 }))),
    );

    await expect(collectAsync(respondStream({ user_id: 'u1', message: 'hi' }))).rejects.toBeInstanceOf(
      ApiHttpError,
    );
  });

  it('throws when the response body is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: null,
        } as Response),
      ),
    );

    await expect(collectAsync(respondStream({ user_id: 'u1', message: 'hi' }))).rejects.toThrow(
      'empty response body',
    );
  });
});

describe('ApiHttpError', () => {
  it('includes status-specific hints for common failures', () => {
    expect(new ApiHttpError(404, 'Not Found').message).toContain('agent server is running');
    expect(new ApiHttpError(500, 'Error').message).toContain('Try again');
    expect(new ApiHttpError(401, 'Unauthorized').message).toContain('auth settings');
  });

  it('uses a custom message when provided', () => {
    expect(new ApiHttpError(400, 'Bad Request', 'Invalid field').message).toBe('Invalid field');
  });
});
