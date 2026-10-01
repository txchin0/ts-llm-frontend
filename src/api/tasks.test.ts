import { describe, expect, it } from 'vitest';

import { buildTasksQuery, taskDismissPath } from './tasks.ts';

describe('buildTasksQuery', () => {
  it('returns an empty string for an empty query', () => {
    expect(buildTasksQuery({})).toBe('');
    expect(buildTasksQuery({ statuses: [] })).toBe('');
  });

  it('comma-joins statuses into a single status param', () => {
    expect(buildTasksQuery({ statuses: ['pending', 'running'] })).toBe(
      '?status=pending%2Crunning',
    );
  });

  it('serializes the full query', () => {
    const query = buildTasksQuery({
      statuses: ['pending', 'running', 'completed', 'failed'],
      completedAfter: '2026-07-14T00:00:00.000Z',
      limit: 100,
    });

    const params = new URLSearchParams(query.slice(1));
    expect(params.get('status')).toBe('pending,running,completed,failed');
    expect(params.get('completed_after')).toBe('2026-07-14T00:00:00.000Z');
    expect(params.get('limit')).toBe('100');
  });
});

describe('taskDismissPath', () => {
  it('fills the task id into the dismiss template', () => {
    expect(taskDismissPath('task_abc123')).toBe('/v1/tasks/task_abc123/dismiss');
  });

  it('URL-encodes the task id', () => {
    expect(taskDismissPath('task/../x')).toBe('/v1/tasks/task%2F..%2Fx/dismiss');
  });
});
