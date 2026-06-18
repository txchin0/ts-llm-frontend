const INTEGRATION_HINTS: Record<string, string> = {
  web_search: 'Lets the agent search the web during replies.',
  google_calendar: 'Read and manage your calendar when the agent needs schedule context.',
};

/** Optional UI hint for a registered integration id. Labels come from the API. */
export function integrationHint(integrationId: string): string | undefined {
  return INTEGRATION_HINTS[integrationId];
}
