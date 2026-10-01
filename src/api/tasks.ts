import { TASK_DISMISS_PATH, TASKS_PATH } from './endpoints.ts';
import { fetchJson, fetchNoContent } from './http.ts';

export { TASKS_PATH } from './endpoints.ts';

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
  /** ISO timestamp of the completed/failed transition; null while active. */
  completed_at: string | null;
}

export interface ListTasksResponse {
  tasks: TaskSummary[];
}

export interface ListTasksQuery {
  /** Statuses to include; the server defaults to pending+running when omitted. */
  statuses?: readonly TaskStatus[];
  /**
   * ISO-8601 lower bound for finished tasks: completed/failed tasks that
   * finished earlier are excluded. Active tasks are unaffected.
   */
  completedAfter?: string;
  /** Maximum tasks returned (server caps at 100). */
  limit?: number;
}

export interface ListTasksOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

/**
 * Serializes a list query to a URL query string ('' when empty). Statuses are
 * comma-separated; the server accepts both comma-separated and repeated forms.
 */
export function buildTasksQuery(query: ListTasksQuery): string {
  const params = new URLSearchParams();
  if (query.statuses !== undefined && query.statuses.length > 0) {
    params.set('status', query.statuses.join(','));
  }
  if (query.completedAfter !== undefined) {
    params.set('completed_after', query.completedAfter);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Lists the authenticated user's background tasks.
 *
 * Query contract (source of truth: pi-llm src/contracts/tasks.ts, mirrored by
 * mock-server.mjs):
 *   - `status`: statuses to include; omitted = pending+running FIFO.
 *   - `completed_after`: hides completed/failed tasks that finished before
 *     this ISO timestamp; active tasks always pass.
 *   - `limit`: max tasks returned (1-100). The task panel is a recent-activity
 *     surface, not a complete history.
 * Dismissed tasks never appear in any response.
 */
export async function listTasks(
  query: ListTasksQuery = {},
  options: ListTasksOptions = {},
): Promise<ListTasksResponse> {
  return fetchJson<ListTasksResponse>(`${TASKS_PATH}${buildTasksQuery(query)}`, {
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}

/** Fills the dismiss path template with an encoded task id. */
export function taskDismissPath(taskId: string): string {
  return TASK_DISMISS_PATH.replace('{task_id}', encodeURIComponent(taskId));
}

/**
 * Permanently hides a finished (completed/failed) task from task lists.
 * Succeeds (204) even when the task was already dismissed, so retries are safe.
 */
export async function dismissTask(
  taskId: string,
  options: ListTasksOptions = {},
): Promise<void> {
  await fetchNoContent(taskDismissPath(taskId), {
    method: 'POST',
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}
