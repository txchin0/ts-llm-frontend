import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ApiHttpError } from '../api/errors.ts';
import {
  listIntegrations,
  updateIntegrations,
  type IntegrationSummary,
} from '../api/integrations.ts';
import { integrationHint } from './integrationsCopy.ts';
import styles from './IntegrationsSection.module.css';

interface IntegrationsSectionProps {
  userId: string;
  hasActiveSession: boolean;
  open: boolean;
}

function enabledMap(items: IntegrationSummary[]): Record<string, boolean> {
  return Object.fromEntries(items.map((item) => [item.id, item.enabled]));
}

function draftHasChanges(
  draft: Record<string, boolean>,
  items: IntegrationSummary[],
): boolean {
  return items.some((item) => draft[item.id] !== item.enabled);
}

function buildPatches(
  draft: Record<string, boolean>,
  items: IntegrationSummary[],
): Record<string, { enabled: boolean }> {
  const patches: Record<string, { enabled: boolean }> = {};
  for (const item of items) {
    const nextEnabled = draft[item.id];
    if (nextEnabled !== undefined && nextEnabled !== item.enabled) {
      patches[item.id] = { enabled: nextEnabled };
    }
  }
  return patches;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not load integrations. Try again.';
}

function toSaveErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not save integrations. Try again.';
}

function SkeletonRows() {
  return (
    <ul className={styles.skeletonList} aria-hidden="true">
      {[0, 1].map((key) => (
        <li key={key} className={styles.skeletonRow} />
      ))}
    </ul>
  );
}

export function IntegrationsSection({ userId, hasActiveSession, open }: IntegrationsSectionProps) {
  const sectionId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<IntegrationSummary[]>([]);
  const [items, setItems] = useState<IntegrationSummary[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = useMemo(() => draftHasChanges(draft, items), [draft, items]);
  const canSave = hasChanges && !isLoading && !isSaving && items.length > 0;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fetchIntegrations = useCallback((signal: AbortSignal) => {
    if (itemsRef.current.length === 0) {
      setIsLoading(true);
    }

    void (async () => {
      try {
        setError(null);
        const response = await listIntegrations(userId, { signal });
        if (signal.aborted) {
          return;
        }
        setItems(response.integrations);
        setDraft(enabledMap(response.integrations));
      } catch (loadError) {
        if (signal.aborted) {
          return;
        }
        setError(toErrorMessage(loadError));
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    })();
  }, [userId]);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchIntegrations(controller.signal);
  }, [fetchIntegrations]);

  const resetDraft = useCallback(() => {
    setDraft(enabledMap(items));
    setError(null);
  }, [items]);

  const save = useCallback(() => {
    const patches = buildPatches(draft, items);
    if (Object.keys(patches).length === 0) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSaving(true);
    setError(null);

    void (async () => {
      try {
        const response = await updateIntegrations(userId, patches, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setItems(response.integrations);
        setDraft(enabledMap(response.integrations));
      } catch (saveError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(toSaveErrorMessage(saveError));
      } finally {
        if (!controller.signal.aborted) {
          setIsSaving(false);
        }
      }
    })();
  }, [draft, items, userId]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    void fetchIntegrations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchIntegrations, open]);

  const setEnabled = (integrationId: string, enabled: boolean) => {
    setDraft((current) => ({ ...current, [integrationId]: enabled }));
  };

  return (
    <section className={styles.section} aria-labelledby={sectionId}>
      <h3 className={styles.sectionTitle} id={sectionId}>
        Integrations
      </h3>

      {error ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>{error}</p>
          <button type="button" className={styles.retryButton} onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {isLoading && items.length === 0 ? <SkeletonRows /> : null}

      {!isLoading && items.length === 0 && !error ? (
        <p className={styles.empty}>No integrations are registered on this server.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.list} aria-busy={isLoading || isSaving}>
          {items.map((item) => {
            const hint = integrationHint(item.id);
            const toggleId = `${sectionId}-${item.id}`;
            return (
              <li key={item.id} className={styles.item}>
                <label className={styles.toggle} htmlFor={toggleId}>
                  <input
                    id={toggleId}
                    className={styles.toggleInput}
                    type="checkbox"
                    checked={draft[item.id] ?? item.enabled}
                    disabled={isLoading || isSaving}
                    onChange={(event) => setEnabled(item.id, event.target.checked)}
                  />
                  <span className={styles.toggleLabel}>{item.label}</span>
                </label>
                {hint ? <p className={styles.hint}>{hint}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasActiveSession && hasChanges ? (
        <p className={styles.note}>
          Integration changes apply on your next chat. Start a new chat when you are ready.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.reset}`}
            disabled={!hasChanges || isSaving}
            onClick={resetDraft}
          >
            Reset changes
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.save}`}
            disabled={!canSave}
            onClick={save}
          >
            {isSaving ? 'Saving…' : 'Save integrations'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
