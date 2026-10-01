import { useEffect } from 'react';

import type { TaskSummary } from '../api/tasks.ts';
import { FINISHED_TASK_WINDOW_DAYS } from '../state/taskFilters.ts';
import { AlertIcon, ChevronIcon, CloseIcon, ListIcon } from './icons.tsx';
import styles from './TasksPanel.module.css';

interface TasksPanelProps {
  expanded: boolean;
  onToggle: () => void;
  active: TaskSummary[];
  finished: TaskSummary[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCloseTask: (taskId: string) => void;
}

const TASKS_BODY_ID = 'tasks-panel-body';
const ACTIVE_HEADING_ID = 'tasks-panel-active-heading';
const FINISHED_HEADING_ID = 'tasks-panel-finished-heading';

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

interface TaskRowProps {
  task: TaskSummary;
  onClose?: (taskId: string) => void;
}

function TaskRow({ task, onClose }: TaskRowProps) {
  // Finished rows show when the task finished; active rows show last activity.
  const timestamp = task.completed_at ?? task.updated_at;
  const detail =
    task.status === 'failed' ? task.error_message
    : task.status === 'completed' ? task.result
    : null;

  return (
    <li className={styles.row} data-closable={onClose !== undefined}>
      <div className={styles.rowMain}>
        <p className={styles.description}>{task.description}</p>
        {detail ? (
          <p
            className={styles.rowDetail}
            data-tone={task.status === 'failed' ? 'danger' : 'muted'}
          >
            {detail}
          </p>
        ) : null}
        <div className={styles.meta}>
          <span className={styles.status}>
            <span className={styles.dot} data-status={task.status} />
            {STATUS_LABEL[task.status]}
          </span>
          <time className={styles.time} dateTime={timestamp}>
            {formatRelativeTime(timestamp)}
          </time>
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          className={styles.closeButton}
          onClick={() => onClose(task.id)}
          aria-label={`Dismiss task: ${task.description}`}
        >
          <CloseIcon width={16} height={16} />
        </button>
      ) : null}
    </li>
  );
}

export function TasksPanel({
  expanded,
  onToggle,
  active,
  finished,
  isLoading,
  error,
  onRefresh,
  onCloseTask,
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

  const activeCount = active.length;
  const totalCount = activeCount + finished.length;
  const badgeLabel = activeCount > 99 ? '99+' : String(activeCount);
  const toggleLabel =
    `Background tasks, ${activeCount} active` +
    (finished.length > 0 ? `, ${finished.length} finished` : '');

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

          {isLoading && totalCount === 0 ? <SkeletonRows /> : null}

          {!isLoading && totalCount === 0 && !error ? (
            <p className={styles.empty}>No recent tasks.</p>
          ) : null}

          <div className={styles.groups}>
            {activeCount > 0 ? (
              <section className={styles.group} aria-labelledby={ACTIVE_HEADING_ID}>
                <h3 id={ACTIVE_HEADING_ID} className={styles.groupLabel}>
                  In progress
                </h3>
                <ul
                  className={styles.list}
                  aria-busy={isLoading}
                  aria-labelledby={ACTIVE_HEADING_ID}
                >
                  {active.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              </section>
            ) : null}

            {finished.length > 0 ? (
              <section className={styles.group} aria-labelledby={FINISHED_HEADING_ID}>
                <h3 id={FINISHED_HEADING_ID} className={styles.groupLabel}>
                  Finished · last {FINISHED_TASK_WINDOW_DAYS} days
                </h3>
                <ul
                  className={styles.list}
                  aria-busy={isLoading}
                  aria-labelledby={FINISHED_HEADING_ID}
                >
                  {finished.map((task) => (
                    <TaskRow key={task.id} task={task} onClose={onCloseTask} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

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
        {activeCount > 0 ? (
          <span className={styles.badge} aria-label={`${activeCount} active tasks`}>
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
