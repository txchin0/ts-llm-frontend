import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { TaskSummary } from '../api/tasks.ts';
import { TasksPanel } from './TasksPanel.tsx';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id' | 'status'>): TaskSummary {
  return {
    description: `task ${overrides.id}`,
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    retry_count: 0,
    result: null,
    error_message: null,
    completed_at: null,
    ...overrides,
  };
}

const running = task({ id: 'task-run', status: 'running', description: 'Summarize notes' });
const pending = task({ id: 'task-wait', status: 'pending', description: 'Draft email' });
const completed = task({
  id: 'task-done',
  status: 'completed',
  description: 'Compile report',
  result: 'Saved to the shared drive.',
  completed_at: '2026-07-16T10:00:00.000Z',
});
const failed = task({
  id: 'task-broke',
  status: 'failed',
  description: 'Sync calendar',
  error_message: 'Calendar returned 403.',
  completed_at: '2026-07-16T08:00:00.000Z',
});

function renderPanel(overrides: Partial<Parameters<typeof TasksPanel>[0]> = {}) {
  const onCloseTask = vi.fn();
  render(
    <TasksPanel
      expanded
      onToggle={() => {}}
      active={[running, pending]}
      finished={[completed, failed]}
      isLoading={false}
      error={null}
      onRefresh={() => {}}
      onCloseTask={onCloseTask}
      {...overrides}
    />,
  );
  return { onCloseTask };
}

describe('TasksPanel', () => {
  it('renders both groups with their headings', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /finished · last 3 days/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Summarize notes')).toBeInTheDocument();
    expect(screen.getByText('Compile report')).toBeInTheDocument();
  });

  it('counts only active tasks in the chip badge', () => {
    renderPanel();

    expect(screen.getByLabelText('2 active tasks')).toHaveTextContent('2');
    expect(
      screen.getByRole('button', { name: 'Background tasks, 2 active, 2 finished' }),
    ).toBeInTheDocument();
  });

  it('hides the badge when only finished tasks remain', () => {
    renderPanel({ active: [] });

    expect(screen.queryByLabelText(/active tasks/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'In progress' })).not.toBeInTheDocument();
  });

  it('shows failure and result details on finished rows', () => {
    renderPanel();

    expect(screen.getByText('Calendar returned 403.')).toBeInTheDocument();
    expect(screen.getByText('Saved to the shared drive.')).toBeInTheDocument();
  });

  it('only finished rows get a dismiss button, and it reports the task id', async () => {
    const user = userEvent.setup();
    const { onCloseTask } = renderPanel();

    expect(
      screen.queryByRole('button', { name: 'Dismiss task: Summarize notes' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss task: Compile report' }));

    expect(onCloseTask).toHaveBeenCalledWith('task-done');
  });

  it('shows an empty state when every task is gone', () => {
    renderPanel({ active: [], finished: [] });

    expect(screen.getByText('No recent tasks.')).toBeInTheDocument();
  });
});
