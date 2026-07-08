import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiHttpError } from '../api/errors.ts';
import { listTasks, type TaskSummary } from '../api/tasks.ts';
import { usePollGate } from './usePollGate.ts';

export interface UseTasksOptions {
  pollIntervalMs: number;
}

export interface UseTasks {
  tasks: TaskSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
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
        const response = await listTasks({ signal: controller.signal });
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

  return { tasks, isLoading: isLoading && canPoll, error, refresh };
}
