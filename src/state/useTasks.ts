import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiHttpError } from '../api/errors.ts';
import { dismissTask, listTasks, type TaskSummary } from '../api/tasks.ts';
import {
  ALL_TASK_STATUSES,
  finishedWindowStart,
  selectTaskGroups,
  TASKS_FETCH_LIMIT,
} from './taskFilters.ts';
import { usePollGate } from './usePollGate.ts';

export interface UseTasksOptions {
  pollIntervalMs: number;
}

export interface UseTasks {
  /** pending/running tasks — running first, then FIFO. */
  active: TaskSummary[];
  /** Recently finished (completed/failed) tasks — newest first. */
  finished: TaskSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  /** Optimistically hides a finished task and dismisses it server-side. */
  closeTask: (taskId: string) => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not load background tasks. Try again.';
}

export function useTasks({ pollIntervalMs }: UseTasksOptions): UseTasks {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tasksRef = useRef<TaskSummary[]>([]);
  const canPoll = usePollGate();

  const refresh = useCallback(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    if (tasksRef.current.length === 0) {
      setIsLoading(true);
    }

    void (async () => {
      try {
        setError(null);
        // Tasks that finished more than the window ago are filtered
        // server-side, so between polls the window lags by at most one
        // poll interval — invisible at a days-scale window.
        const response = await listTasks(
          {
            statuses: ALL_TASK_STATUSES,
            completedAfter: finishedWindowStart(Date.now()),
            limit: TASKS_FETCH_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        tasksRef.current = response.tasks;
        setTasks(response.tasks);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(toErrorMessage(fetchError));
      } finally {
        const wasCurrent = abortRef.current === controller;
        if (wasCurrent) {
          abortRef.current = null;
        }
        if (wasCurrent || (controller.signal.aborted && abortRef.current === null)) {
          setIsLoading(false);
        }
      }
    })();
  }, []);

  const closeTask = useCallback(
    (taskId: string) => {
      // Optimistic removal; the dismiss endpoint is idempotent, and a failure
      // resurfaces the task via refresh.
      tasksRef.current = tasksRef.current.filter((task) => task.id !== taskId);
      setTasks((previous) => previous.filter((task) => task.id !== taskId));

      void dismissTask(taskId).catch((dismissError: unknown) => {
        refresh();
        setError(toErrorMessage(dismissError));
      });
    },
    [refresh],
  );

  useEffect(() => {
    if (!canPoll) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    refresh();
    const intervalId = window.setInterval(refresh, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [canPoll, pollIntervalMs, refresh]);

  const groups = useMemo(() => selectTaskGroups(tasks), [tasks]);

  return {
    active: groups.active,
    finished: groups.finished,
    isLoading: isLoading && canPoll,
    error,
    refresh,
    closeTask,
  };
}
