import { fetchJson } from './http.ts';

export const INTEGRATIONS_PATH = '/v1/integrations';

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
  return fetchJson<ListIntegrationsResponse>(INTEGRATIONS_PATH, {
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}

/** Applies enable/disable patches for one or more integrations. */
export async function updateIntegrations(
  patches: Record<string, IntegrationEnablementPatch>,
  options: IntegrationsRequestOptions = {},
): Promise<ListIntegrationsResponse> {
  return fetchJson<ListIntegrationsResponse>(INTEGRATIONS_PATH, {
    method: 'PUT',
    json: { integrations: patches },
    signal: options.signal,
    baseUrl: options.baseUrl,
  });
}
