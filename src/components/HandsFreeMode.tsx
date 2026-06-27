import { useEffect, useRef } from 'react';

import type { AssistantMessage } from '../state/types.ts';
import type { MicState } from '../state/useHandsFree.ts';
import { AlertIcon, ChevronIcon } from './icons.tsx';
import { IconButton } from './IconButton.tsx';
import { Markdown } from './Markdown.tsx';
import { MicButton } from './MicButton.tsx';
import { StreamingDots } from './StreamingDots.tsx';
import { useSwipeDismiss } from './useSwipeDismiss.ts';
import styles from './HandsFreeMode.module.css';

export interface HandsFreeModeProps {
  open: boolean;
  onClose: () => void;
  latest?: AssistantMessage;
  transcript: string;
  micState: MicState;
  onMicPress: () => void;
  voiceSupported: boolean;
}

export function HandsFreeMode({
  open,
  onClose,
  latest,
  transcript,
  micState,
  onMicPress,
  voiceSupported,
}: HandsFreeModeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { bind, panelRef } = useSwipeDismiss({ onDismiss: onClose, enabled: open });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const hasContent = (latest?.content.length ?? 0) > 0;
  const isStreaming = latest?.status === 'streaming';
  const hasError = latest?.status === 'error' && latest.error;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-label="Hands-free mode"
    >
      <div
        ref={panelRef}
        className={styles.panel}
        {...bind}
      >
        <div className={styles.topBar}>
          <div className={styles.grabber} aria-hidden="true" />
          <IconButton
            className={styles.dismiss}
            label="Exit hands-free mode"
            onClick={onClose}
          >
            <ChevronIcon className={styles.chevronDown} />
          </IconButton>
        </div>

        <div className={styles.responseRegion} aria-live="polite" aria-atomic="true">
          {!voiceSupported ? (
            <p className={styles.unsupported}>
              Voice input needs Speech Recognition in Chrome, Safari, or Edge over HTTPS or localhost.
            </p>
          ) : null}

          {latest && hasError ? (
            <div className={styles.error} role="alert">
              <AlertIcon className={styles.errorIcon} width={18} height={18} />
              <p>{latest.error?.message}</p>
            </div>
          ) : null}

          {latest && hasContent ? (
            <div className={styles.prose}>
              <Markdown>{latest.content}</Markdown>
              {isStreaming ? <span className={styles.caret} aria-hidden="true" /> : null}
            </div>
          ) : isStreaming ? (
            <StreamingDots />
          ) : !voiceSupported ? null : (
            <p className={styles.hint}>Tap the button below and speak your question.</p>
          )}
        </div>

        <div className={styles.micDock}>
          <MicButton state={micState} transcript={transcript} onPress={onMicPress} />
          <p className={styles.statusHint} aria-hidden="true">
            {micState === 'idle'
              ? 'Tap to speak'
              : micState === 'listening'
                ? 'Listening, tap to send'
                : 'Stop generating'}
          </p>
        </div>
      </div>
    </dialog>
  );
}
