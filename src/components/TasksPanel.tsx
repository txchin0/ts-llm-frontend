import { useEffect } from 'react';

import type { TaskSummary } from '../api/tasks.ts';
import { AlertIcon, ChevronIcon, ListIcon } from './icons.tsx';
import styles from './TasksPanel.module.css';

interface TasksPanelProps {
  expanded: boolean;
  onToggle: () => void;
  tasks: TaskSummary[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const TASKS_BODY_ID = 'tasks-panel-body';

const STATUS_LABEL: Record<TaskSummary['status'], string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
};

const RFTF = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const deltaSeconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);

  if (abs < 60) {
    return RFTF.format(deltaSeconds, 'second');
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) {
    return RFTF.format(deltaMinutes, 'minute');
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return RFTF.format(deltaHours, 'hour');
  }
  const deltaDays = Math.round(deltaHours / 24);
  return RFTF.format(deltaDays, 'day');
}

function SkeletonRows() {
  return (
    <ul className={styles.list} aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <li key={key} className={styles.skeletonRow}>
          <span className={styles.skeletonText} />
          <span className={styles.skeletonMeta} />
        </li>
      ))}
    </ul>
  );
}

export function TasksPanel({
  expanded,
  onToggle,
  tasks,
  isLoading,
  error,
  onRefresh,
}: TasksPanelProps) {
  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onToggle]);

  const taskCount = tasks.length;
  const badgeLabel = taskCount > 99 ? '99+' : String(taskCount);
  const toggleLabel = `Background tasks, ${taskCount} in queue`;

  if (taskCount === 0) {
    return null;
  }

  return (
    <div className={styles.root} data-expanded={expanded}>
      {expanded ? (
        <div
          id={TASKS_BODY_ID}
          className={styles.sheet}
          role="region"
          aria-label="Background tasks"
        >
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <h2 className={styles.title}>Background tasks</h2>
              <button
                type="button"
                className={styles.headerCollapse}
                onClick={onToggle}
                aria-label="Collapse tasks"
              >
                <ChevronIcon className={styles.headerChevron} width={16} height={16} />
              </button>
            </div>
            <p className={styles.desc}>
              Work the agent queued for later. Writes and actions run here while you keep chatting.
            </p>
          </header>

          {error ? (
            <div className={styles.errorBlock} role="alert">
              <AlertIcon className={styles.errorIcon} width={18} height={18} />
              <p className={styles.errorText}>{error}</p>
              <button type="button" className={styles.retryButton} onClick={onRefresh}>
                Try again
              </button>
            </div>
          ) : null}

          {isLoading && taskCount === 0 ? <SkeletonRows /> : null}

          <ul className={styles.list} aria-busy={isLoading}>
            {tasks.map((task) => (
              <li key={task.id} className={styles.row}>
                <p className={styles.description}>{task.description}</p>
                <div className={styles.meta}>
                  <span className={styles.status}>
                    <span className={styles.dot} data-status={task.status} />
                    {STATUS_LABEL[task.status]}
                  </span>
                  <time className={styles.time} dateTime={task.updated_at}>
                    {formatRelativeTime(task.updated_at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>

          <footer className={styles.footer}>
            <p className={styles.footerMeta}>
              Updates every few seconds while open.
            </p>
          </footer>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.chip}
        aria-expanded={expanded}
        aria-controls={TASKS_BODY_ID}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        <ListIcon className={styles.chipIcon} width={16} height={16} />
        <span>Tasks</span>
        {error ? (
          <span className={styles.errorDot} aria-label="Task list failed to load" />
        ) : null}
        {taskCount > 0 ? (
          <span className={styles.badge} aria-label={`${taskCount} tasks`}>
            {badgeLabel}
          </span>
        ) : null}
        <ChevronIcon
          className={styles.chevron}
          data-open={expanded}
          width={16}
          height={16}
        />
      </button>
    </div>
  );
}
