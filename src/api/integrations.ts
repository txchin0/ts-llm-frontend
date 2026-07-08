import { getApiBaseUrl } from './config.ts';
import { fetchJson } from './http.ts';

const INTEGRATIONS_PATH = '/v1/integrations';

export interface IntegrationSummary {
  id: string;
  label: string;
  default_enabled: boolean;
  enabled: boolean;
  oauth?: { provider_id: string };
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

/** Lists registered integrations and effective enablement for the authenticated user. */
export async function listIntegrations(
  options: IntegrationsRequestOptions = {},
): Promise<ListIntegrationsResponse> {
  const baseUrl = options.baseUrl ?? getApiBaseUrl();

  return fetchJson<ListIntegrationsResponse>(`${baseUrl}${INTEGRATIONS_PATH}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: options.signal,
  });
}

/** Applies enable/disable patches for one or more integrations. */
export async function updateIntegrations(
  patches: Record<string, IntegrationEnablementPatch>,
  options: IntegrationsRequestOptions = {},
): Promise<ListIntegrationsResponse> {
  const baseUrl = options.baseUrl ?? getApiBaseUrl();

  return fetchJson<ListIntegrationsResponse>(`${baseUrl}${INTEGRATIONS_PATH}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ integrations: patches }),
    signal: options.signal,
  });
}
