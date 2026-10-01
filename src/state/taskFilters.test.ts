import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '../api/tasks.ts';
import {
  ALL_TASK_STATUSES,
  FINISHED_TASK_WINDOW_DAYS,
  finishedWindowStart,
  selectTaskGroups,
} from './taskFilters.ts';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id' | 'status'>): TaskSummary {
  return {
    description: `task ${overrides.id}`,
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
    retry_count: 0,
    result: null,
    error_message: null,
    completed_at: null,
    ...overrides,
  };
}

describe('finishedWindowStart', () => {
  it('returns an ISO timestamp exactly the window before now', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z');
    const start = finishedWindowStart(now);
    expect(now - Date.parse(start)).toBe(FINISHED_TASK_WINDOW_DAYS * 24 * 3_600_000);
  });
});

describe('selectTaskGroups', () => {
  it('covers every status across the two groups', () => {
    const groups = selectTaskGroups(
      ALL_TASK_STATUSES.map((status, index) =>
        task({ id: `task-${index}`, status }),
      ),
    );
    expect(groups.active).toHaveLength(2);
    expect(groups.finished).toHaveLength(2);
  });

  it('orders active tasks running-first, then FIFO by created_at', () => {
    const groups = selectTaskGroups([
      task({ id: 'p-new', status: 'pending', created_at: '2026-07-12T00:00:00.000Z' }),
      task({ id: 'p-old', status: 'pending', created_at: '2026-07-11T00:00:00.000Z' }),
      task({ id: 'r-new', status: 'running', created_at: '2026-07-12T06:00:00.000Z' }),
      task({ id: 'r-old', status: 'running', created_at: '2026-07-11T06:00:00.000Z' }),
    ]);

    expect(groups.active.map((entry) => entry.id)).toEqual([
      'r-old',
      'r-new',
      'p-old',
      'p-new',
    ]);
  });

  it('orders finished tasks newest-first by completed_at, falling back to updated_at', () => {
    const groups = selectTaskGroups([
      task({
        id: 'done-old',
        status: 'completed',
        completed_at: '2026-07-14T00:00:00.000Z',
      }),
      task({
        id: 'failed-new',
        status: 'failed',
        completed_at: '2026-07-16T00:00:00.000Z',
      }),
      task({
        id: 'done-null',
        status: 'completed',
        completed_at: null,
        updated_at: '2026-07-15T00:00:00.000Z',
      }),
    ]);

    expect(groups.finished.map((entry) => entry.id)).toEqual([
      'failed-new',
      'done-null',
      'done-old',
    ]);
  });
});
