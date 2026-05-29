import { useId, useState } from 'react';

import type { ToolActivity } from '../state/types.ts';
import { ChevronIcon, WrenchIcon } from './icons.tsx';
import styles from './ToolChip.module.css';

interface ToolChipProps {
  tool: ToolActivity;
}

function formatPayload(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATUS_LABEL: Record<ToolActivity['status'], string> = {
  running: 'running',
  done: 'done',
  error: 'error',
};

export function ToolChip({ tool }: ToolChipProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(false);

  const input = formatPayload(tool.input);
  const output = formatPayload(tool.output);

  return (
    <div className={styles.tool}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <WrenchIcon className={styles.icon} width={16} height={16} />
        <span className={styles.name}>{tool.toolName}</span>
        <span className={styles.status}>
          <span className={styles.dot} data-status={tool.status} />
          {STATUS_LABEL[tool.status]}
        </span>
        <ChevronIcon className={styles.chevron} data-open={open} width={16} height={16} />
      </button>
      {open ? (
        <div className={styles.body} id={bodyId}>
          {input ? (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Input</span>
              <pre className={styles.payload}>{input}</pre>
            </div>
          ) : null}
          {tool.errorMessage ? (
            <div className={styles.section}>
              <span className={`${styles.sectionLabel} ${styles.error}`}>
                Error{tool.errorCode ? ` · ${tool.errorCode}` : ''}
              </span>
              <pre className={styles.payload}>{tool.errorMessage}</pre>
            </div>
          ) : null}
          {output ? (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Output</span>
              <pre className={styles.payload}>{output}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
