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
    if (typeof body === 'object' && body !== null) {
      const { code, message: bodyMessage } = body as { code?: unknown; message?: unknown };
      if (typeof code === 'string' && typeof bodyMessage === 'string') {
        message = bodyMessage;
      }
    }
  } catch {
    // Non-JSON error body; the generic message carries the status.
  }
  return new ApiHttpError(response.status, response.statusText, message);
}
