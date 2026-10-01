import type { TaskStatus, TaskSummary } from '../api/tasks.ts';

/** Finished (completed/failed) tasks are shown for this many days after finishing. */
export const FINISHED_TASK_WINDOW_DAYS = 3;

/** Every status — the panel fetches everything and groups locally. */
export const ALL_TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
];

/** Server-side maximum for the tasks list endpoint. */
export const TASKS_FETCH_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp of the start of the finished-task window. */
export function finishedWindowStart(now: number): string {
  return new Date(now - FINISHED_TASK_WINDOW_DAYS * DAY_MS).toISOString();
}

export interface TaskGroups {
  /** pending/running — running first, then oldest created_at first (FIFO). */
  active: TaskSummary[];
  /** completed/failed — most recently finished first. */
  finished: TaskSummary[];
}

function isActive(task: TaskSummary): boolean {
  return task.status === 'pending' || task.status === 'running';
}

/** Sort key for finished rows; falls back to updated_at for a null completed_at. */
function finishedAt(task: TaskSummary): string {
  return task.completed_at ?? task.updated_at;
}

/**
 * Partitions server-ordered tasks into display groups. Window and dismissal
 * filtering already happened server-side; this is presentation only.
 */
export function selectTaskGroups(tasks: readonly TaskSummary[]): TaskGroups {
  const active = tasks
    .filter(isActive)
    .sort((a, b) =>
      a.status === b.status
        ? a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
        : a.status === 'running'
          ? -1
          : 1,
    );

  const finished = tasks
    .filter((task) => !isActive(task))
    .sort(
      (a, b) =>
        finishedAt(b).localeCompare(finishedAt(a)) || a.id.localeCompare(b.id),
    );

  return { active, finished };
}
