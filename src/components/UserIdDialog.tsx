import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import styles from './UserIdDialog.module.css';

interface UserIdDialogProps {
  open: boolean;
  currentUserId: string;
  /** True if a conversation is in progress (warns it will be cleared). */
  hasActiveSession: boolean;
  onClose: () => void;
  onSave: (userId: string) => void;
}

export function UserIdDialog({
  open,
  currentUserId,
  hasActiveSession,
  onClose,
  onSave,
}: UserIdDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const [draft, setDraft] = useState(currentUserId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setDraft(currentUserId);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, currentUserId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onSave(trimmed);
  };

  const trimmed = draft.trim();
  const changed = trimmed.length > 0 && trimmed !== currentUserId;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div>
          <h2 className={styles.title}>User identity</h2>
        </div>
        <p className={styles.desc}>
          The agent receives this as <code>user_id</code> with every request.
        </p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={inputId}>
            user_id
          </label>
          <input
            id={inputId}
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. web-user"
          />
          {changed && hasActiveSession ? (
            <span className={styles.note}>
              Switching identity starts a fresh conversation.
            </span>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button type="button" className={`${styles.button} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.button} ${styles.save}`}
            disabled={!changed}
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
