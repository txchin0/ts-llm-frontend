import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskSummary } from '../api/tasks.ts';
import { useTasks } from './useTasks.ts';

const listTasksMock = vi.hoisted(() => vi.fn());

vi.mock('../api/tasks.ts', () => ({
  listTasks: listTasksMock,
}));

vi.mock('./usePollGate.ts', () => ({
  usePollGate: () => true,
}));

const sampleTask: TaskSummary = {
  id: 'task-1',
  description: 'Summarize inbox',
  status: 'running',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  retry_count: 0,
  result: null,
  error_message: null,
};

describe('useTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listTasksMock.mockResolvedValue({ tasks: [sampleTask] });
  });

  afterEach(() => {
    vi.useRealTimers();
    listTasksMock.mockReset();
  });

  it('loads tasks for the active user', async () => {
    const { result } = renderHook(() => useTasks({ userId: 'user-1', pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listTasksMock).toHaveBeenCalledWith('user-1', expect.any(Object));
    expect(result.current.tasks).toEqual([sampleTask]);
  });

  it('clears tasks when the user id changes', async () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useTasks({ userId, pollIntervalMs: 1000 }),
      { initialProps: { userId: 'user-1' } },
    );

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
    });

    listTasksMock.mockResolvedValueOnce({ tasks: [] });

    rerender({ userId: 'user-2' });

    await waitFor(() => {
      expect(listTasksMock).toHaveBeenLastCalledWith('user-2', expect.any(Object));
    });
  });

  it('polls on the configured interval', async () => {
    renderHook(() => useTasks({ userId: 'user-1', pollIntervalMs: 1000 }));

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

    const { result } = renderHook(() => useTasks({ userId: 'user-1', pollIntervalMs: 1000 }));

    await waitFor(() => {
      expect(result.current.error).toBe('network down');
    });
  });
});
