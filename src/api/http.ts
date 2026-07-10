import { authFetch } from './auth.ts';
import { resolveApiUrl } from './config.ts';
import { apiErrorFromResponse, ApiHttpError } from './errors.ts';

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
  const response = await request(path, init);

  try {
    return (await response.json()) as T;
  } catch {
    // A 2xx response that isn't JSON almost always means the request never
    // reached the agent server: on the native app an empty/relative base URL
    // resolves to the WebView origin, which serves the app's own index.html.
    const contentType = response.headers?.get?.('content-type') ?? undefined;
    const detail = contentType ? ` (received ${contentType})` : '';
    throw new ApiHttpError(
      response.status,
      response.statusText,
      `The agent server did not return JSON${detail}. Check that the Server URL in Settings points at the agent server.`,
    );
  }
}

/** Authenticated request whose success carries no JSON body (e.g. DELETE). */
export async function fetchNoContent(path: string, init: ApiRequestInit = {}): Promise<void> {
  await request(path, init);
}
