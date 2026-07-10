import { fetchJson } from './http.ts';

export const TASKS_PATH = '/v1/tasks';

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
  return fetchJson<ListTasksResponse>(TASKS_PATH, {
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}
