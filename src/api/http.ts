import { authFetch } from './auth.ts';
import { resolveApiUrl } from './config.ts';
import { apiErrorFromResponse, readJsonOrThrow } from './errors.ts';

export { fetchJsonPublic } from './publicHttp.ts';

/**
 * The one authenticated JSON request path. Endpoint modules declare a path
 * and a response shape; everything else happens here: base-URL resolution,
 * bearer attachment with 401 refresh-and-retry (via authFetch), the server's
 * `{code, message}` error decode, and JSON parsing.
 */

export interface ApiRequestInit extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: Record<string, string>;
  /** Override the configured agent-server base URL (test seam). */
  baseUrl?: string;
  /** JSON payload; serialized with `content-type: application/json`. */
  json?: unknown;
}

async function request(path: string, init: ApiRequestInit): Promise<Response> {
  const { baseUrl, headers, json, ...rest } = init;

  const response = await authFetch(resolveApiUrl(path, baseUrl), {
    ...rest,
    headers: {
      accept: 'application/json',
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }
  return response;
}

export async function fetchJson<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  return readJsonOrThrow<T>(await request(path, init));
}

/** Authenticated request whose success carries no JSON body (e.g. DELETE). */
export async function fetchNoContent(path: string, init: ApiRequestInit = {}): Promise<void> {
  await request(path, init);
}
