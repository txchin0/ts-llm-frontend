import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskSummary } from '../api/tasks.ts';
import { useTasks } from './useTasks.ts';

const listTasksMock = vi.hoisted(() => vi.fn());
const dismissTaskMock = vi.hoisted(() => vi.fn());

vi.mock('../api/tasks.ts', () => ({
  listTasks: listTasksMock,
  dismissTask: dismissTaskMock,
}));

vi.mock('./usePollGate.ts', () => ({
  usePollGate: () => true,
}));

const runningTask: TaskSummary = {
  id: 'task-1',
  description: 'Summarize inbox',
  status: 'running',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  retry_count: 0,
  result: null,
  error_message: null,
  completed_at: null,
};

const finishedTask: TaskSummary = {
  id: 'task-2',
  description: 'Compile report',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  retry_count: 0,
  result: 'Report ready.',
  error_message: null,
  completed_at: '2026-01-02T00:00:00Z',
};

describe('useTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listTasksMock.mockResolvedValue({ tasks: [runningTask, finishedTask] });
    dismissTaskMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    listTasksMock.mockReset();
    dismissTaskMock.mockReset();
  });

  it('loads and groups tasks for the signed-in user', async () => {
    const { result } = renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.active).toEqual([runningTask]);
    expect(result.current.finished).toEqual([finishedTask]);
  });

  it('requests every status with the finished window and limit', async () => {
    renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(1);
    });

    const [query, options] = listTasksMock.mock.calls[0] as [
      { statuses: string[]; completedAfter: string; limit: number },
      { signal: AbortSignal },
    ];
    expect(query.statuses).toEqual(['pending', 'running', 'completed', 'failed']);
    expect(query.limit).toBe(100);
    // The window start sits three days back from now.
    const windowMs = Date.now() - Date.parse(query.completedAfter);
    expect(windowMs).toBeGreaterThan(3 * 24 * 3_600_000 - 60_000);
    expect(windowMs).toBeLessThan(3 * 24 * 3_600_000 + 60_000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('polls on the configured interval', async () => {
    renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(listTasksMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces API errors', async () => {
    listTasksMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.error).toBe('network down');
    });
  });

  it('optimistically removes a closed task and dismisses it server-side', async () => {
    const { result } = renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.finished).toHaveLength(1);
    });

    act(() => {
      result.current.closeTask(finishedTask.id);
    });

    expect(result.current.finished).toHaveLength(0);
    expect(result.current.active).toEqual([runningTask]);
    expect(dismissTaskMock).toHaveBeenCalledWith(finishedTask.id);
  });

  it('refetches and surfaces the error when a dismiss fails', async () => {
    dismissTaskMock.mockRejectedValueOnce(new Error('dismiss failed'));

    const { result } = renderHook(() => useTasks({ pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.finished).toHaveLength(1);
    });
    expect(listTasksMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.closeTask(finishedTask.id);
    });

    // The failed dismiss triggers a reconciliation fetch that restores the task.
    await waitFor(() => {
      expect(result.current.error).toBe('dismiss failed');
    });
    await waitFor(() => {
      expect(result.current.finished).toHaveLength(1);
    });
    expect(listTasksMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
