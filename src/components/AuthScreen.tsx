import { useId, useState, type FormEvent } from 'react';

import { ApiHttpError } from '../api/errors.ts';
import { APP_NAME } from '../brand.ts';
import styles from './AuthScreen.module.css';

interface AuthScreenProps {
  /** Prefilled from the last signed-in account (legacy ts-llm.user_id). */
  initialUserId: string;
  onLogin: (userId: string, password: string) => Promise<void>;
  onRegister: (userId: string, password: string) => Promise<void>;
  /** Shown on native builds so the server can be set before signing in. */
  serverUrl?: string;
  onServerUrlChange?: (next: string) => void;
}

type Mode = 'login' | 'register';

function toAuthErrorMessage(error: unknown, mode: Mode): string {
  if (error instanceof ApiHttpError) {
    if (error.status === 401) {
      return 'Incorrect user ID or password.';
    }
    if (error.status === 409) {
      return 'That user ID is already taken. Sign in instead, or pick another.';
    }
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return mode === 'login'
    ? 'Could not sign in. Check the server connection and try again.'
    : 'Could not create the account. Check the server connection and try again.';
}

/** Full-screen login/register gate shown whenever no session exists. */
export function AuthScreen({
  initialUserId,
  onLogin,
  onRegister,
  serverUrl,
  onServerUrlChange,
}: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [userId, setUserId] = useState(initialUserId);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userIdInputId = useId();
  const passwordInputId = useId();
  const serverUrlInputId = useId();

  const showServerField = onServerUrlChange !== undefined;
  const passwordOk =
    mode === 'register' ? password.length >= 8 : password.length > 0;
  const canSubmit =
    userId.trim().length > 0 && passwordOk && !isSubmitting;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    const action = mode === 'login' ? onLogin : onRegister;
    void action(userId.trim(), password)
      .catch((submitError: unknown) => {
        setError(toAuthErrorMessage(submitError, mode));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const switchMode = (next: Mode) => {
    if (next !== mode) {
      setMode(next);
      setError(null);
    }
  };

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>
            {APP_NAME}<span className={styles.wordmarkDot}>.</span>
          </span>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Sign in or create account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        {showServerField ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={serverUrlInputId}>
              Server URL
            </label>
            <input
              id={serverUrlInputId}
              className={styles.input}
              type="url"
              inputMode="url"
              value={serverUrl ?? ''}
              onChange={(event) => onServerUrlChange(event.target.value)}
              placeholder="http://192.168.1.10:3000"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor={userIdInputId}>
            User ID
          </label>
          <input
            id={userIdInputId}
            className={styles.input}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. thomas"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={passwordInputId}>
            Password
          </label>
          <input
            id={passwordInputId}
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' ? (
            <p className={styles.hint}>At least 8 characters.</p>
          ) : null}
        </div>

        {error !== null ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className={styles.submit} disabled={!canSubmit}>
          {isSubmitting
            ? mode === 'login'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>
    </div>
  );
}
