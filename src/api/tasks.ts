import { getApiBaseUrl } from './config.ts';
import { fetchJson } from './http.ts';

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

/**
 * Lists the authenticated user's background tasks. Omits status/limit query
 * params so the server returns pending and running tasks in FIFO order.
 */
export async function listTasks(
  options: ListTasksOptions = {},
): Promise<ListTasksResponse> {
  const baseUrl = options.baseUrl ?? getApiBaseUrl();

  return fetchJson<ListTasksResponse>(`${baseUrl}${TASKS_PATH}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });
}
