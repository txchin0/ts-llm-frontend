import { useEffect, useMemo, useRef, useState } from 'react';

import {
  oauthCallbackErrorMessage,
  parseOAuthConnectedParams,
} from '../api/oauth.ts';
import { useSettings } from '../state/useSettings.ts';
import { AlertIcon, CheckIcon } from './icons.tsx';
import styles from './OAuthConnectedPage.module.css';

const AUTO_CLOSE_DELAY_MS = 1_800;
const FALLBACK_DELAY_MS = 400;

function connectedHeadline(providerLabel?: string): string {
  return providerLabel ? `Connected to ${providerLabel}` : 'Connected';
}

export function OAuthConnectedPage() {
  useSettings();

  const { providerLabel, errorCode } = useMemo(
    () => parseOAuthConnectedParams(window.location.search),
    [],
  );

  const isError = errorCode !== undefined;
  const [showCloseButton, setShowCloseButton] = useState(isError);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = isError ? 'Connection failed · Ember' : 'Connected · Ember';
  }, [isError]);

  useEffect(() => {
    if (isError) {
      return;
    }

    const closeTimer = window.setTimeout(() => {
      window.close();
    }, AUTO_CLOSE_DELAY_MS);

    const fallbackTimer = window.setTimeout(() => {
      setShowCloseButton(true);
    }, AUTO_CLOSE_DELAY_MS + FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [isError]);

  useEffect(() => {
    if (showCloseButton) {
      closeButtonRef.current?.focus();
    }
  }, [showCloseButton]);

  const headline = isError ? 'Connection failed' : connectedHeadline(providerLabel);
  const statusText = isError ? undefined : 'Closing this tab…';
  const errorMessage = errorCode ? oauthCallbackErrorMessage(errorCode) : undefined;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span
          className={`${styles.mark} ${isError ? styles.mark_error : styles.mark_success}`}
          aria-hidden="true"
        >
          {isError ? (
            <AlertIcon width={22} height={22} />
          ) : (
            <CheckIcon width={22} height={22} />
          )}
        </span>

        <h1 className={styles.title}>{headline}</h1>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}

        {statusText ? (
          <p className={styles.status} aria-live="polite">
            {statusText}
          </p>
        ) : null}

        {showCloseButton ? (
          <div className={styles.actions}>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={() => window.close()}
            >
              Close tab
            </button>
          </div>
        ) : (
          <div className={styles.actions} aria-hidden="true" />
        )}
      </div>
    </main>
  );
}
