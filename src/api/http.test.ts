import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from './errors.ts';
import { fetchJson } from './http.ts';

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ ok: true }),
        } as Response),
      ),
    );

    await expect(fetchJson<{ ok: boolean }>('/v1/test')).resolves.toEqual({ ok: true });
  });

  it('maps 400 validation_error bodies to ApiHttpError with message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({ code: 'validation_error', message: 'user_id is required' }),
        } as Response),
      ),
    );

    await expect(fetchJson('/v1/test')).rejects.toEqual(
      expect.objectContaining<Partial<ApiHttpError>>({
        status: 400,
        message: 'user_id is required',
      }),
    );
  });

  it('throws ApiHttpError for other HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.reject(new Error('no body')),
        } as Response),
      ),
    );

    await expect(fetchJson('/v1/test')).rejects.toBeInstanceOf(ApiHttpError);
  });
});
