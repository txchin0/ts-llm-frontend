import { ApiHttpError } from './errors.ts';
import { fetchJson } from './http.ts';

const DEFAULT_BASE_URL = '';

export interface OAuthStatusResponse {
  connected: boolean;
  granted_scopes: string[];
  missing_scopes: string[];
}

export interface OAuthRequestOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

interface OAuthErrorBody {
  code: string;
  message: string;
  provider_id?: string;
}

function isOAuthErrorBody(value: unknown): value is OAuthErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

function oauthPath(providerId: string, baseUrl: string): string {
  return `${baseUrl}/v1/oauth/${encodeURIComponent(providerId)}`;
}

/** Builds the browser navigation URL to start OAuth consent for a provider. */
export function buildOAuthStartUrl(
  providerId: string,
  userId: string,
  baseUrl: string = DEFAULT_BASE_URL,
): string {
  const params = new URLSearchParams({ user_id: userId });
  return `${oauthPath(providerId, baseUrl)}/start?${params}`;
}

/** Reports OAuth connection state and scope coverage for a user and provider. */
export async function getOAuthStatus(
  providerId: string,
  userId: string,
  options: OAuthRequestOptions = {},
): Promise<OAuthStatusResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const params = new URLSearchParams({ user_id: userId });

  return fetchJson<OAuthStatusResponse>(`${oauthPath(providerId, baseUrl)}/status?${params}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });
}

/** Deletes stored OAuth tokens for a user and provider. */
export async function disconnectOAuth(
  providerId: string,
  userId: string,
  options: OAuthRequestOptions = {},
): Promise<void> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const params = new URLSearchParams({ user_id: userId });

  const response = await fetch(`${oauthPath(providerId, baseUrl)}?${params}`, {
    method: 'DELETE',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 400) {
      try {
        const body: unknown = await response.json();
        if (isOAuthErrorBody(body)) {
          throw new ApiHttpError(response.status, response.statusText, body.message);
        }
      } catch (error) {
        if (error instanceof ApiHttpError) {
          throw error;
        }
      }
    }
    throw new ApiHttpError(response.status, response.statusText);
  }
}

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
};

const OAUTH_CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  provider_not_configured: 'Sign-in is not configured on this server.',
  provider_not_found: 'This sign-in provider is not available.',
  invalid_state: 'The sign-in session expired. Try again from settings.',
  token_exchange_failed: 'Could not finish sign-in. Try again.',
  access_denied: 'Sign-in was cancelled.',
};

export interface OAuthConnectedParams {
  providerId?: string;
  providerLabel?: string;
  errorCode?: string;
}

/** Maps a known OAuth provider id to a display label. */
export function oauthProviderLabel(providerId: string): string | undefined {
  return OAUTH_PROVIDER_LABELS[providerId];
}

/** Maps callback redirect error codes to user-facing messages. */
export function oauthCallbackErrorMessage(code: string): string {
  return OAUTH_CALLBACK_ERROR_MESSAGES[code] ?? 'Could not complete sign-in. Try again.';
}

/** Parses query params from the OAuth connected landing page. */
export function parseOAuthConnectedParams(search: string): OAuthConnectedParams {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const providerId = params.get('provider')?.trim() || undefined;
  const errorCode = params.get('error')?.trim() || undefined;
  const providerLabel = providerId ? oauthProviderLabel(providerId) : undefined;

  return { providerId, providerLabel, errorCode };
}

/** Maps OAuth API errors to user-facing messages. */
export function toOAuthUserMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    if (error.status === 404) {
      return 'Google sign-in is not available on this server.';
    }
    if (error.status === 400) {
      return error.message || 'Google sign-in is not configured on this server.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete Google sign-in. Try again.';
}
