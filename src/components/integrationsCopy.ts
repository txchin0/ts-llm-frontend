const INTEGRATION_HINTS: Record<string, string> = {
  web_search: 'Lets the agent search the web during replies.',
};

/** Optional UI hint for a registered integration id. Labels come from the API. */
export function integrationHint(integrationId: string): string | undefined {
  return INTEGRATION_HINTS[integrationId];
}
