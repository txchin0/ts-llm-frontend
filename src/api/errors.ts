function buildApiErrorMessage(status: number, statusText: string): string {
  const hint =
    status === 404
      ? ' Check that the agent server is running and the URL is correct.'
      : status >= 500
        ? ' Try again in a moment.'
        : status === 401 || status === 403
          ? ' Check server auth settings.'
          : '';
  const statusLabel = statusText ? ` ${statusText}` : '';
  return `Could not reach the agent server (HTTP ${status}${statusLabel}).${hint}`;
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string, message?: string) {
    super(message ?? buildApiErrorMessage(status, statusText));
    this.name = 'ApiHttpError';
    this.status = status;
    this.statusText = statusText;
  }
}

interface ApiErrorBody {
  code: string;
  message: string;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { code?: unknown; message?: unknown };
  return typeof body.code === 'string' && typeof body.message === 'string';
}

/**
 * The server encodes request failures as a JSON `{code, message}` body.
 * Decodes one failed response into an ApiHttpError, preferring the server's
 * message and falling back to the generic status-based one. This is the only
 * place that error encoding is known.
 */
export async function apiErrorFromResponse(response: Response): Promise<ApiHttpError> {
  let message: string | undefined;
  try {
    const body: unknown = await response.json();
    if (isApiErrorBody(body)) {
      message = body.message;
    }
  } catch {
    // Non-JSON error body; the generic message carries the status.
  }
  return new ApiHttpError(response.status, response.statusText, message);
}

/**
 * Parse a successful response body as JSON, or throw with the shared
 * "Server URL points at the wrong origin" hint. Used by both authenticated
 * and public JSON callers so that policy lives in one place.
 */
export async function readJsonOrThrow<T>(response: Response): Promise<T> {
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
