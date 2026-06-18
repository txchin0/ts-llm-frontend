import { useCallback, useEffect, useRef, useState } from 'react';

import type { IntegrationEnablementPatch, IntegrationSummary } from '../api/integrations.ts';
import {
  buildOAuthStartUrl,
  disconnectOAuth,
  getOAuthStatus,
  toOAuthUserMessage,
  type OAuthStatusResponse,
} from '../api/oauth.ts';
import { usePollGate } from './usePollGate.ts';

export interface UseOAuthIntegrationsOptions {
  userId: string;
  active: boolean;
  items: IntegrationSummary[];
}

export interface UseOAuthIntegrations {
  statusByProvider: Record<string, OAuthStatusResponse | null>;
  isLoading: boolean;
  isProviderLoading: (providerId: string) => boolean;
  error: string | null;
  clearError: () => void;
  connect: (providerId: string) => void;
  disconnect: (providerId: string) => Promise<void>;
  afterSave: (
    patches: Record<string, IntegrationEnablementPatch>,
    savedItems: IntegrationSummary[],
  ) => Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function oauthProviderIds(items: IntegrationSummary[]): string[] {
  return [
    ...new Set(items.flatMap((item) => (item.oauth ? [item.oauth.provider_id] : []))),
  ];
}

function needsOAuthConsent(status: OAuthStatusResponse): boolean {
  return !status.connected || status.missing_scopes.length > 0;
}

function newlyEnabledOAuthProviders(
  patches: Record<string, IntegrationEnablementPatch>,
  savedItems: IntegrationSummary[],
): string[] {
  const savedById = new Map(savedItems.map((item) => [item.id, item]));

  return [
    ...new Set(
      Object.entries(patches).flatMap(([integrationId, patch]) => {
        if (!patch.enabled) {
          return [];
        }
        const item = savedById.get(integrationId);
        return item?.oauth ? [item.oauth.provider_id] : [];
      }),
    ),
  ];
}

function consentComplete(status: OAuthStatusResponse): boolean {
  return status.connected && status.missing_scopes.length === 0;
}

export function useOAuthIntegrations({
  userId,
  active,
  items,
}: UseOAuthIntegrationsOptions): UseOAuthIntegrations {
  const [statusByProvider, setStatusByProvider] = useState<
    Record<string, OAuthStatusResponse | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const awaitingConsentRef = useRef<Set<string>>(new Set());
  const canPoll = usePollGate();

  const providerIds = oauthProviderIds(items);
  const providerIdsKey = providerIds.join('\0');
  const hasOAuthProviders = providerIds.length > 0;
  const isProviderLoading = useCallback(
    (providerId: string) => active && !(providerId in statusByProvider),
    [active, statusByProvider],
  );

  const isLoading =
    active &&
    hasOAuthProviders &&
    providerIds.some((providerId) => isProviderLoading(providerId));

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const applyStatusEntries = useCallback(
    (entries: Array<[string, OAuthStatusResponse | null]>) => {
      setStatusByProvider((current) => {
        const next = { ...current };
        for (const [providerId, status] of entries) {
          next[providerId] = status;
          if (status !== null && consentComplete(status)) {
            awaitingConsentRef.current.delete(providerId);
          }
        }
        return next;
      });
    },
    [],
  );

  const fetchStatusForProviders = useCallback(
    async (
      providers: string[],
      signal: AbortSignal,
    ): Promise<Array<[string, OAuthStatusResponse | null]>> => {
      if (providers.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        providers.map(async (providerId) => {
          const status = await getOAuthStatus(providerId, userId, { signal });
          return [providerId, status] as [string, OAuthStatusResponse];
        }),
      );

      if (signal.aborted) {
        return [];
      }

      const entries: Array<[string, OAuthStatusResponse | null]> = [];
      let firstFailure: unknown = null;

      for (let index = 0; index < providers.length; index += 1) {
        const providerId = providers[index];
        const result = results[index];
        if (result.status === 'fulfilled') {
          entries.push(result.value);
          continue;
        }
        if (!isAbortError(result.reason)) {
          firstFailure ??= result.reason;
        }
        entries.push([providerId, null]);
      }

      applyStatusEntries(entries);

      if (firstFailure !== null) {
        throw firstFailure;
      }

      return entries;
    },
    [applyStatusEntries, userId],
  );

  const openConsent = useCallback(
    (providerId: string) => {
      awaitingConsentRef.current.add(providerId);
      window.open(buildOAuthStartUrl(providerId, userId), '_blank', 'noopener,noreferrer');
    },
    [userId],
  );

  const connect = useCallback(
    (providerId: string) => {
      clearError();
      openConsent(providerId);
    },
    [clearError, openConsent],
  );

  const disconnect = useCallback(
    async (providerId: string) => {
      clearError();
      try {
        await disconnectOAuth(providerId, userId);
        awaitingConsentRef.current.delete(providerId);
        const controller = new AbortController();
        await fetchStatusForProviders([providerId], controller.signal);
      } catch (disconnectError) {
        setError(toOAuthUserMessage(disconnectError));
      }
    },
    [clearError, fetchStatusForProviders, userId],
  );

  const afterSave = useCallback(
    async (
      patches: Record<string, IntegrationEnablementPatch>,
      savedItems: IntegrationSummary[],
    ) => {
      const providers = newlyEnabledOAuthProviders(patches, savedItems);
      if (providers.length === 0) {
        return;
      }

      const controller = new AbortController();
      try {
        setError(null);
        const entries = await fetchStatusForProviders(providers, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        for (const [providerId, status] of entries) {
          if (status !== null && needsOAuthConsent(status)) {
            openConsent(providerId);
          }
        }
      } catch (saveError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(toOAuthUserMessage(saveError));
      }
    },
    [fetchStatusForProviders, openConsent],
  );

  useEffect(() => {
    if (!active || !hasOAuthProviders) {
      abortRef.current?.abort();
      abortRef.current = null;
      if (!active) {
        awaitingConsentRef.current.clear();
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      try {
        setError(null);
        await fetchStatusForProviders(providerIds, controller.signal);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(toOAuthUserMessage(fetchError));
      }
    })();

    return () => {
      controller.abort();
    };
    // providerIdsKey serializes providerIds for stable dependency comparison.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- providerIdsKey tracks providerIds
  }, [active, fetchStatusForProviders, hasOAuthProviders, providerIdsKey]);

  useEffect(() => {
    if (!active || !canPoll || awaitingConsentRef.current.size === 0) {
      return;
    }

    const controller = new AbortController();
    void fetchStatusForProviders([...awaitingConsentRef.current], controller.signal).catch(
      (fetchError) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(toOAuthUserMessage(fetchError));
      },
    );

    return () => {
      controller.abort();
    };
  }, [active, canPoll, fetchStatusForProviders]);

  return {
    statusByProvider: hasOAuthProviders ? statusByProvider : {},
    isLoading,
    isProviderLoading,
    error,
    clearError,
    connect,
    disconnect,
    afterSave,
  };
}
