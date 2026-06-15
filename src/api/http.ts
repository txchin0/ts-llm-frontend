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

  return (await response.json()) as T;
}
