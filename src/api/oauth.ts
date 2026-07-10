import { resolveApiUrl } from './config.ts';
import { ApiHttpError } from './errors.ts';
import { fetchJson, fetchNoContent } from './http.ts';

export interface OAuthStatusResponse {
  connected: boolean;
  granted_scopes: string[];
  missing_scopes: string[];
}

export interface OAuthRequestOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export const OAUTH_CONNECT_TOKEN_PATH = '/v1/oauth/connect-token';

function oauthPath(providerId: string): string {
  return `/v1/oauth/${encodeURIComponent(providerId)}`;
}

interface ConnectTokenResponse {
  connect_token: string;
  expires_in: number;
}

/**
 * Mints a short-lived single-use connect token bound to the authenticated
 * user. `/start` is a top-level navigation that cannot carry a bearer header,
 * so this token carries the identity instead.
 */
export async function createOAuthConnectToken(
  options: OAuthRequestOptions = {},
): Promise<string> {
  const response = await fetchJson<ConnectTokenResponse>(OAUTH_CONNECT_TOKEN_PATH, {
    method: 'POST',
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
  return response.connect_token;
}

/** Builds the browser navigation URL to start OAuth consent for a provider. */
export function buildOAuthStartUrl(
  providerId: string,
  connectToken: string,
  baseUrl?: string,
): string {
  const params = new URLSearchParams({ connect_token: connectToken });
  return resolveApiUrl(`${oauthPath(providerId)}/start?${params}`, baseUrl);
}

/** Reports OAuth connection state and scope coverage for the authenticated user. */
export async function getOAuthStatus(
  providerId: string,
  options: OAuthRequestOptions = {},
): Promise<OAuthStatusResponse> {
  return fetchJson<OAuthStatusResponse>(`${oauthPath(providerId)}/status`, {
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}

/** Deletes the authenticated user's stored OAuth tokens for a provider. */
export async function disconnectOAuth(
  providerId: string,
  options: OAuthRequestOptions = {},
): Promise<void> {
  await fetchNoContent(oauthPath(providerId), {
    method: 'DELETE',
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
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
