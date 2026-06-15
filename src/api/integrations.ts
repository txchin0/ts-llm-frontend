import { fetchJson } from './http.ts';

const DEFAULT_BASE_URL = '';
const INTEGRATIONS_PATH = '/v1/integrations';

export interface IntegrationSummary {
  id: string;
  label: string;
  default_enabled: boolean;
  enabled: boolean;
}

export interface ListIntegrationsResponse {
  integrations: IntegrationSummary[];
}

export interface IntegrationsRequestOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export type IntegrationEnablementPatch = {
  enabled: boolean;
};

/** Lists registered integrations and effective enablement for a user. */
export async function listIntegrations(
  userId: string,
  options: IntegrationsRequestOptions = {},
): Promise<ListIntegrationsResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const params = new URLSearchParams({ user_id: userId });

  return fetchJson<ListIntegrationsResponse>(`${baseUrl}${INTEGRATIONS_PATH}?${params}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });
}

/** Applies enable/disable patches for one or more integrations. */
export async function updateIntegrations(
  userId: string,
  patches: Record<string, IntegrationEnablementPatch>,
  options: IntegrationsRequestOptions = {},
): Promise<ListIntegrationsResponse> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return fetchJson<ListIntegrationsResponse>(`${baseUrl}${INTEGRATIONS_PATH}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      integrations: patches,
    }),
    signal: options.signal,
  });
}
