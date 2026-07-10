import { resolveApiUrl } from './config.ts';
import { apiErrorFromResponse, readJsonOrThrow } from './errors.ts';

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

  return readJsonOrThrow<T>(response);
}
