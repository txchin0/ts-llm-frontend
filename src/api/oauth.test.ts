import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from './errors.ts';
import { buildOAuthStartUrl, disconnectOAuth, toOAuthUserMessage } from './oauth.ts';

describe('buildOAuthStartUrl', () => {
  it('builds a start URL with encoded provider and user id', () => {
    expect(buildOAuthStartUrl('google', 'user 1', 'https://api.test')).toBe(
      'https://api.test/v1/oauth/google/start?user_id=user+1',
    );
  });
});

describe('toOAuthUserMessage', () => {
  it('maps 404 to a friendly unavailable message', () => {
    expect(toOAuthUserMessage(new ApiHttpError(404, 'Not Found'))).toContain('not available');
  });

  it('uses validation messages for 400 errors', () => {
    expect(toOAuthUserMessage(new ApiHttpError(400, 'Bad Request', 'Missing client id'))).toBe(
      'Missing client id',
    );
  });

  it('falls back for unknown errors', () => {
    expect(toOAuthUserMessage('nope')).toContain('Try again');
  });
});

describe('disconnectOAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('succeeds on HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
        } as Response),
      ),
    );

    await expect(disconnectOAuth('google', 'user-1')).resolves.toBeUndefined();
  });

  it('throws ApiHttpError with OAuth error message on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ code: 'not_connected', message: 'Not connected' }),
        } as Response),
      ),
    );

    await expect(disconnectOAuth('google', 'user-1')).rejects.toEqual(
      expect.objectContaining<Partial<ApiHttpError>>({ message: 'Not connected' }),
    );
  });
});
