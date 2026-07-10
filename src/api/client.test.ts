import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError, respondStream } from './client.ts';
import { isRespondSseEvent } from './types.ts';
import { collectAsync, createSseResponse } from '../test/helpers.ts';

describe('isRespondSseEvent', () => {
  it('accepts a well-formed delta', () => {
    expect(isRespondSseEvent({ type: 'delta', text: 'hello' })).toBe(true);
  });

  it('rejects known types that are missing required fields', () => {
    expect(isRespondSseEvent({ type: 'delta' })).toBe(false);
    expect(isRespondSseEvent({ type: 'start' })).toBe(false);
    expect(isRespondSseEvent({ type: 'error', request_id: 'r1' })).toBe(false);
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
      respondStream({ message: 'hi' }),
    );

    expect(events).toEqual([{ type: 'delta', text: 'hello' }]);
    expect(fetch).toHaveBeenCalledWith('/v1/respond', expect.objectContaining({ method: 'POST' }));
  });

  it('yields malformed events for non-JSON data', async () => {
    const body = 'data: not-json\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(
      respondStream({ message: 'hi' }),
    );

    expect(events).toEqual([
      { type: 'malformed', detail: 'unparseable JSON', eventName: undefined, raw: 'not-json' },
    ]);
  });

  it('yields malformed events for unrecognized JSON types', async () => {
    const body = 'data: {"type":"audio","url":"x"}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(
      respondStream({ message: 'hi' }),
    );

    expect(events[0]).toMatchObject({
      type: 'malformed',
      detail: 'unknown event type: audio',
      raw: { type: 'audio', url: 'x' },
    });
  });

  it('yields malformed events for known types missing required fields', async () => {
    const body = 'data: {"type":"start"}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse(body))),
    );

    const events = await collectAsync(respondStream({ message: 'hi' }));

    expect(events[0]).toMatchObject({
      type: 'malformed',
      detail: 'incomplete start event',
      raw: { type: 'start' },
    });
  });

  it('throws ApiHttpError on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(createSseResponse('', { ok: false, status: 503 }))),
    );

    await expect(collectAsync(respondStream({ message: 'hi' }))).rejects.toBeInstanceOf(
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

    await expect(collectAsync(respondStream({ message: 'hi' }))).rejects.toThrow(
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
