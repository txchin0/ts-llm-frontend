import type { MicState } from '../state/useHandsFree.ts';
import { MicIcon, StopIcon } from './icons.tsx';
import styles from './MicButton.module.css';

interface MicButtonProps {
  state: MicState;
  transcript: string;
  onPress: () => void;
}

function micLabel(state: MicState): string {
  switch (state) {
    case 'idle':
      return 'Tap to speak';
    case 'listening':
      return 'Listening, tap to send';
    case 'streaming':
      return 'Stop generating';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function micAriaLabel(state: MicState): string {
  switch (state) {
    case 'idle':
      return 'Start voice input';
    case 'listening':
      return 'Stop voice input and send message';
    case 'streaming':
      return 'Stop generating response';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function MicButton({ state, transcript, onPress }: MicButtonProps) {
  const label = micLabel(state);
  const showTranscript = state === 'listening' && transcript.trim().length > 0;

  return (
    <div className={styles.wrap}>
      {showTranscript ? (
        <p className={styles.transcript} aria-live="polite">
          {transcript}
        </p>
      ) : null}
      <button
        type="button"
        className={`${styles.button} ${styles[state]}`}
        onClick={onPress}
        aria-label={micAriaLabel(state)}
        aria-pressed={state === 'listening'}
      >
        {state === 'listening' ? <span className={styles.pulse} aria-hidden="true" /> : null}
        {state === 'streaming' ? <StopIcon width={36} height={36} /> : <MicIcon width={36} height={36} />}
        <span className={styles.label}>{label}</span>
      </button>
    </div>
  );
}
