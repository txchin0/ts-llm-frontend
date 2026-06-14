import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react';

import { ArrowUpIcon, MicIcon, StopIcon } from './icons.tsx';
import { IconButton } from './IconButton.tsx';
import styles from './Composer.module.css';

interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  voiceSupported: boolean;
  isListening: boolean;
  voiceError: string | null;
  onToggleVoice: () => void;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  voiceSupported,
  isListening,
  voiceError,
  onToggleVoice,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content (capped by CSS max-height).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSend = value.trim().length > 0 && !isStreaming;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.bar}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening…' : 'Message the agent…'}
            rows={1}
            aria-label="Message the agent"
            autoComplete="off"
            autoCorrect="on"
            spellCheck
          />
          <div className={styles.actions}>
            {voiceSupported ? (
              <IconButton
                label={isListening ? 'Stop voice input' : 'Start voice input'}
                className={styles.mic}
                aria-pressed={isListening}
                onClick={onToggleVoice}
              >
                <MicIcon />
              </IconButton>
            ) : null}
            {isStreaming ? (
              <button
                type="button"
                className={`${styles.send} ${styles.stop}`}
                onClick={onStop}
                aria-label="Stop generating"
                title="Stop generating"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="button"
                className={styles.send}
                onClick={onSubmit}
                disabled={!canSend}
                aria-label="Send message"
                title="Send message"
              >
                <ArrowUpIcon />
              </button>
            )}
          </div>
        </div>
        <div className={styles.hint}>
          <span>
            {isListening ? (
              <span className={styles.listening}>Recording. Speak now.</span>
            ) : voiceError ? (
              <span className={styles.voiceError}>{voiceError}</span>
            ) : (
              'Nothing is saved after you leave.'
            )}
          </span>
          <span className={styles.desktopHint}>Enter to send · Shift+Enter for a new line</span>
        </div>
      </div>
    </div>
  );
}
