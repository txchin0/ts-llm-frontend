import { ApiHttpError } from './errors.ts';

interface ValidationErrorBody {
  code: 'validation_error';
  message: string;
}

function isValidationErrorBody(value: unknown): value is ValidationErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { code?: unknown; message?: unknown };
  return body.code === 'validation_error' && typeof body.message === 'string';
}

/** Parses JSON from a fetch response and maps API validation errors to ApiHttpError. */
export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    if (response.status === 400) {
      try {
        const body: unknown = await response.json();
        if (isValidationErrorBody(body)) {
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
