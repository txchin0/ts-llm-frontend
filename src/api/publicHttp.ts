import { resolveApiUrl } from './config.ts';
import { apiErrorFromResponse, ApiHttpError } from './errors.ts';

/**
 * Unauthenticated JSON POST (register / login / refresh / logout). Same URL
 * resolution and `{code, message}` error decode as the authenticated path in
 * http.ts — kept separate so auth.ts can use it without a circular import.
 */
export async function fetchJsonPublic<T>(path: string, json: unknown, baseUrl?: string): Promise<T> {
  const response = await fetch(resolveApiUrl(path, baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(json),
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }

  try {
    return (await response.json()) as T;
  } catch {
    const contentType = response.headers?.get?.('content-type') ?? undefined;
    const detail = contentType ? ` (received ${contentType})` : '';
    throw new ApiHttpError(
      response.status,
      response.statusText,
      `The agent server did not return JSON${detail}. Check that the Server URL in Settings points at the agent server.`,
    );
  }
}
