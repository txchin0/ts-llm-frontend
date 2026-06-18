# OAuth connected page: server handoff

Self-contained requirements for the agent server (pi-llm) so the ts-llm-frontend can show a branded OAuth success screen instead of plain text after Google consent.

**Consumer:** [ts-llm-frontend](../) `/oauth/connected` route.

**Related (unchanged):** [server-oauth-handoff.md](./server-oauth-handoff.md) covers integrations API and OAuth endpoints. This doc covers only the post-callback redirect to the frontend page.

---

## Context

Today, after Google redirects to `GET /v1/oauth/:providerId/callback`, the server exchanges the authorization code and responds with plain text:

```text
OAuth connected. You can close this tab.
```

The frontend opens consent in a popup (`window.open`). Users deserve a calm, on-brand confirmation that auto-closes. The frontend ships a dedicated page at `/oauth/connected`; the server must redirect there after handling the callback.

---

## Required server change

On `GET /v1/oauth/:providerId/callback`, after token exchange completes:

| Outcome | Response |
|---------|----------|
| **Success** | `302 Found` with `Location: /oauth/connected?provider={providerId}` |
| **Failure** | `302 Found` with `Location: /oauth/connected?provider={providerId}&error={code}` |

Use an absolute path on the same origin as the web app (relative `/oauth/connected?...` is fine when the callback is already same-origin via the proxy).

Do **not** return plain text or JSON for a successful browser callback once this ships.

### What stays the same

- `GOOGLE_OAUTH_REDIRECT_URI` remains the API callback URL, e.g. `http://localhost:5173/v1/oauth/google/callback` (dev) or `https://your-host/v1/oauth/google/callback` (prod).
- Google still redirects to `/v1/oauth/*`; only the **post-exchange response** changes from plain text to a frontend redirect.
- Token storage, scope aggregation, and all other OAuth routes are unchanged.

---

## Error codes (shared contract)

The frontend maps `error` query values via `oauthCallbackErrorMessage()` in `src/api/oauth.ts`. Use these codes on failure redirects:

| `error` code | When | Frontend message |
|--------------|------|------------------|
| `provider_not_configured` | OAuth env vars missing | Sign-in is not configured on this server. |
| `provider_not_found` | Unknown `providerId` | This sign-in provider is not available. |
| `invalid_state` | State mismatch or expired | The sign-in session expired. Try again from settings. |
| `token_exchange_failed` | Google token exchange failed | Could not finish sign-in. Try again. |
| `access_denied` | User denied consent at Google | Sign-in was cancelled. |

Any other code shows a generic fallback: "Could not complete sign-in. Try again."

When adding new codes, update both pi-llm redirect logic and `OAUTH_CALLBACK_ERROR_MESSAGES` in the frontend.

---

## Example URLs

### Local dev (Vite on 5173)

| Step | URL |
|------|-----|
| Google redirect (unchanged) | `http://localhost:5173/v1/oauth/google/callback?code=...&state=...` |
| Server success redirect | `http://localhost:5173/oauth/connected?provider=google` |
| Server failure redirect | `http://localhost:5173/oauth/connected?provider=google&error=invalid_state` |

### Production

| Step | URL |
|------|-----|
| Google redirect | `https://your-app-host/v1/oauth/google/callback?code=...&state=...` |
| Server success redirect | `https://your-app-host/oauth/connected?provider=google` |

---

## Frontend behavior (for context)

- Success: checkmark, "Connected to Google", status "Closing this tab…", auto-close after ~1.8s.
- If auto-close is blocked: "Close tab" button appears.
- Error: no auto-close; "Connection failed" plus mapped message and "Close tab".
- Main app tab re-checks OAuth status on window focus; no cross-tab messaging required.

### Test without server change

Visit directly:

```text
http://localhost:5173/oauth/connected?provider=google
http://localhost:5173/oauth/connected?provider=google&error=access_denied
```

---

## Checklist for pi-llm

- [ ] On successful callback, respond `302` to `/oauth/connected?provider={providerId}`
- [ ] On failed callback, respond `302` to `/oauth/connected?provider={providerId}&error={code}` using the codes above
- [ ] Remove or gate the plain-text success response
- [ ] Verify redirect works behind the frontend proxy (dev and prod)
- [ ] Manually test: consent flow ends on branded page, popup closes, main tab shows connected status on focus

---

## Out of scope

- Changing `GOOGLE_OAUTH_REDIRECT_URI` to point at `/oauth/connected` (Google must still hit the API callback)
- Frontend changes to `useOAuthIntegrations` (focus polling is sufficient)
- Bundling connection status into `GET /v1/integrations`
