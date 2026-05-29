import type { ThemePreference } from '../state/useSettings.ts';
import {
  BrainIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  UserIcon,
} from './icons.tsx';
import { IconButton } from './IconButton.tsx';
import styles from './Header.module.css';

interface HeaderProps {
  userId: string;
  theme: ThemePreference;
  onSetTheme: (theme: ThemePreference) => void;
  showThinking: boolean;
  onToggleThinking: () => void;
  hasSession: boolean;
  onNewChat: () => void;
  onOpenUserDialog: () => void;
}

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

export function Header({
  userId,
  theme,
  onSetTheme,
  showThinking,
  onToggleThinking,
  hasSession,
  onNewChat,
  onOpenUserDialog,
}: HeaderProps) {
  const cycleTheme = () => {
    const index = THEME_ORDER.indexOf(theme);
    onSetTheme(THEME_ORDER[(index + 1) % THEME_ORDER.length]);
  };

  const ThemeIcon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>
            Ember<span className={styles.wordmarkDot}>.</span>
          </span>
          {hasSession ? <span className={styles.session}>session active</span> : null}
        </div>

        <div className={styles.controls}>
          <IconButton
            label={showThinking ? 'Hide thinking' : 'Show thinking'}
            aria-pressed={showThinking}
            onClick={onToggleThinking}
          >
            <BrainIcon />
          </IconButton>

          <IconButton label={`${THEME_LABEL[theme]} (click to change)`} onClick={cycleTheme}>
            <ThemeIcon />
          </IconButton>

          <IconButton
            label="New chat"
            onClick={onNewChat}
            disabled={!hasSession}
          >
            <PlusIcon />
          </IconButton>

          <span className={styles.divider} aria-hidden="true" />

          <button
            type="button"
            className={styles.userButton}
            onClick={onOpenUserDialog}
            title="Change user identity"
          >
            <UserIcon width={18} height={18} />
            <span className={styles.userId}>{userId}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
