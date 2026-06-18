import type { OAuthStatusResponse } from '../api/oauth.ts';
import styles from './IntegrationsSection.module.css';

type OAuthConnectionPhase = 'connected' | 'needs_reconnect' | 'disconnected';

function oauthConnectionPhase(status: OAuthStatusResponse | null | undefined): OAuthConnectionPhase {
  if (status === null || status === undefined) {
    return 'disconnected';
  }
  if (!status.connected) {
    return 'disconnected';
  }
  if (status.missing_scopes.length > 0) {
    return 'needs_reconnect';
  }
  return 'connected';
}

interface OAuthIntegrationActionsProps {
  oauth: { provider_id: string };
  enabled: boolean;
  status: OAuthStatusResponse | null | undefined;
  disabled: boolean;
  onConnect: (providerId: string) => void;
  onDisconnect: (providerId: string) => void;
}

const PHASE_LABEL: Record<OAuthConnectionPhase, string> = {
  connected: 'Connected',
  needs_reconnect: 'Needs reconnect',
  disconnected: 'Not connected',
};

export function OAuthIntegrationActions({
  oauth,
  enabled,
  status,
  disabled,
  onConnect,
  onDisconnect,
}: OAuthIntegrationActionsProps) {
  if (!enabled) {
    return null;
  }

  const phase = oauthConnectionPhase(status);
  const showConnect = phase !== 'connected';

  return (
    <div className={styles.oauthRow}>
      <span
        className={`${styles.oauthBadge} ${styles[`oauthBadge_${phase}`]}`}
        aria-live="polite"
      >
        {PHASE_LABEL[phase]}
      </span>
      <div className={styles.oauthActions}>
        {showConnect ? (
          <button
            type="button"
            className={styles.oauthButton}
            disabled={disabled}
            onClick={() => onConnect(oauth.provider_id)}
          >
            {phase === 'needs_reconnect' ? 'Reconnect' : 'Connect'}
          </button>
        ) : null}
        {phase === 'connected' ? (
          <button
            type="button"
            className={`${styles.oauthButton} ${styles.oauthButtonDisconnect}`}
            disabled={disabled}
            onClick={() => onDisconnect(oauth.provider_id)}
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </div>
  );
}
