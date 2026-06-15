import { useEffect, useId, useRef, type ChangeEvent } from 'react';

import type { ThemePreference } from '../state/useSettings.ts';
import type { MicLanguagePreference } from '../voice/speechLanguages.ts';
import { MIC_LANGUAGE_OPTIONS } from '../voice/speechLanguages.ts';
import { IntegrationsSection } from './IntegrationsSection.tsx';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  open: boolean;
  userId: string;
  hasActiveSession: boolean;
  theme: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
  showThinking: boolean;
  onShowThinkingChange: (next: boolean) => void;
  micLanguage: MicLanguagePreference;
  onMicLanguageChange: (next: MicLanguagePreference) => void;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsDialog({
  open,
  userId,
  hasActiveSession,
  theme,
  onThemeChange,
  showThinking,
  onShowThinkingChange,
  micLanguage,
  onMicLanguageChange,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const displaySectionId = useId();
  const themeId = useId();
  const thinkingId = useId();
  const micLanguageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleThemeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onThemeChange(event.target.value as ThemePreference);
  };

  const handleMicLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onMicLanguageChange(event.target.value as MicLanguagePreference);
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose} onClose={onClose}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
        </div>

        <section className={styles.section} aria-labelledby={displaySectionId}>
          <h3 className={styles.sectionTitle} id={displaySectionId}>
            Display
          </h3>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={themeId}>
              Theme
            </label>
            <select
              id={themeId}
              className={styles.select}
              value={theme}
              onChange={handleThemeChange}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className={styles.hint}>Follows your device when set to system default.</p>
          </div>
          <div className={styles.field}>
            <label className={styles.toggle} htmlFor={thinkingId}>
              <input
                id={thinkingId}
                className={styles.toggleInput}
                type="checkbox"
                checked={showThinking}
                onChange={(event) => onShowThinkingChange(event.target.checked)}
              />
              <span className={styles.toggleLabel}>Show thinking steps</span>
            </label>
            <p className={styles.hint}>
              When on, reasoning text appears above each answer while the agent works.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby={`${micLanguageId}-legend`}>
          <h3 className={styles.sectionTitle} id={`${micLanguageId}-legend`}>
            Voice input
          </h3>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={micLanguageId}>
              Microphone language
            </label>
            <select
              id={micLanguageId}
              className={styles.select}
              value={micLanguage}
              onChange={handleMicLanguageChange}
            >
              {MIC_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              Language the browser uses when you dictate in the composer. Pick system default to
              follow your device.
            </p>
          </div>
        </section>

        <IntegrationsSection
          userId={userId}
          hasActiveSession={hasActiveSession}
          open={open}
        />

        <div className={styles.actions}>
          <button type="button" className={`${styles.button} ${styles.done}`} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
