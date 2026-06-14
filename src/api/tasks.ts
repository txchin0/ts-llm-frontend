import { ApiHttpError } from './errors.ts';

const DEFAULT_BASE_URL = '';
const TASKS_PATH = '/v1/tasks';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskSummary {
  id: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  retry_count: number;
  result: string | null;
  error_message: string | null;
}

export interface ListTasksResponse {
  tasks: TaskSummary[];
}

export interface ListTasksOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

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

/**
 * Lists background tasks for a user. Omits status/limit query params so the
 * server returns pending and running tasks in FIFO order.
 */
export async function listTasks(
  userId: string,
  options: ListTasksOptions = {},
): Promise<ListTasksResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const params = new URLSearchParams({ user_id: userId });

  const response = await fetch(`${baseUrl}${TASKS_PATH}?${params}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });

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

  return (await response.json()) as ListTasksResponse;
}
