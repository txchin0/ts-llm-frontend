import { useId, useState } from 'react';

import { BrainIcon, ChevronIcon } from './icons.tsx';
import styles from './ThinkingPanel.module.css';

interface ThinkingPanelProps {
  text: string;
  /** Whether the assistant is still streaming (keeps the panel open + live). */
  streaming: boolean;
}

export function ThinkingPanel({ text, streaming }: ThinkingPanelProps) {
  const bodyId = useId();
  // The panel only mounts once thinking text exists (during streaming), so it
  // opens by default; the user can collapse it once the turn settles.
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <BrainIcon className={styles.icon} width={16} height={16} />
        <span>Thinking</span>
        {streaming ? (
          <span className={styles.live}>reasoning…</span>
        ) : (
          <ChevronIcon
            className={styles.chevron}
            data-open={open}
            width={16}
            height={16}
          />
        )}
      </button>
      {open ? (
        <div className={styles.body} id={bodyId}>
          <pre className={styles.text}>{text}</pre>
        </div>
      ) : null}
    </div>
  );
}
