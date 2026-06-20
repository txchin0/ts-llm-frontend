import { APP_NAME } from '../brand.ts';
import type { ThemePreference } from '../state/useSettings.ts';
import {
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from './icons.tsx';
import { IconButton } from './IconButton.tsx';
import styles from './Header.module.css';

interface HeaderProps {
  userId: string;
  theme: ThemePreference;
  onSetTheme: (theme: ThemePreference) => void;
  hasSession: boolean;
  onNewChat: () => void;
  onOpenUserDialog: () => void;
  onOpenSettings: () => void;
}

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Use system theme',
  light: 'Use light theme',
  dark: 'Use dark theme',
};
const THEME_SHORT: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function Header({
  userId,
  theme,
  onSetTheme,
  hasSession,
  onNewChat,
  onOpenUserDialog,
  onOpenSettings,
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
            {APP_NAME}<span className={styles.wordmarkDot}>.</span>
          </span>
          {hasSession ? (
            <>
              <span className={styles.session}>Active session</span>
              <span className={styles.sessionDot} aria-label="Active session" />
            </>
          ) : null}
        </div>

        <div className={styles.controls}>
          <IconButton
            className={styles.overflowToSettings}
            label={`${THEME_LABEL[theme]}. Currently ${THEME_SHORT[theme].toLowerCase()}.`}
            visibleLabel={THEME_SHORT[theme]}
            showLabel
            onClick={cycleTheme}
          >
            <ThemeIcon />
          </IconButton>

          <IconButton
            label="Start a new chat"
            visibleLabel="New"
            showLabel
            onClick={onNewChat}
            disabled={!hasSession}
          >
            <PlusIcon />
          </IconButton>

          <IconButton
            label="Open settings"
            visibleLabel="Options"
            showLabel
            onClick={onOpenSettings}
          >
            <SettingsIcon />
          </IconButton>

          <span className={styles.divider} aria-hidden="true" />

          <button
            type="button"
            className={styles.userButton}
            onClick={onOpenUserDialog}
            aria-label={`Speaking as ${userId}. Change identity.`}
            title={`Speaking as ${userId}`}
          >
            <UserIcon width={18} height={18} />
            <span className={styles.userId}>{userId}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
