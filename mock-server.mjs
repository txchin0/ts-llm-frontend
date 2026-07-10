// Mock of the ts-llm agent server, driven by protocol/endpoints.json (routes)
// and protocol/respond.json (SSE event samples). Fresh ids/timestamps are
// applied per turn so the mock cannot drift from the vocabulary the real
// clients are tested against.
//
// Speaks the real auth model: password register/login issuing bearer token
// pairs, refresh rotation, and 401s for missing/expired tokens. Accounts and
// sessions are in-memory and vanish on restart.
//
// Usage:
//   node mock-server.mjs               # listens on 127.0.0.1:3001
//   VITE_TS_LLM_TARGET=http://127.0.0.1:3001 npm run dev

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const endpoints = JSON.parse(
  readFileSync(new URL('./protocol/endpoints.json', import.meta.url), 'utf8'),
);
const respondContract = JSON.parse(
  readFileSync(new URL('./protocol/respond.json', import.meta.url), 'utf8'),
);
const { events } = respondContract;

const PORT = Number(process.env.MOCK_PORT ?? 3001);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rid = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(
    0,
    prefix.length + 1 + 16,
  );

// ---------------------------------------------------------------------------
// Accounts and bearer tokens (in-memory)
// ---------------------------------------------------------------------------

/** @type {Map<string, { password: string }>} user_id → account */
const accounts = new Map();
/** @type {Map<string, string>} access token → user_id */
const accessTokens = new Map();
/** @type {Map<string, string>} refresh token → user_id */
const refreshTokens = new Map();
/** @type {Map<string, string>} connect token → user_id */
const connectTokens = new Map();

function issueTokens(userId) {
  const accessToken = rid('at');
  const refreshToken = rid('rt');
  accessTokens.set(accessToken, userId);
  refreshTokens.set(refreshToken, userId);
  return {
    user_id: userId,
    token_type: 'Bearer',
    access_token: accessToken,
    expires_in: 900,
    refresh_token: refreshToken,
  };
}

/** Returns the authenticated user_id, or responds 401 and returns null. */
function requireAuth(req, res) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const userId = accessTokens.get(token);
  if (!userId) {
    sendJson(res, 401, { code: 'unauthorized', message: 'Missing or invalid access token.' });
    return null;
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Per-user demo state
// ---------------------------------------------------------------------------

const MOCK_INTEGRATIONS = [
  {
    id: 'web_search',
    label: 'Web Search',
    default_enabled: true,
    enabled: true,
  },
  {
    id: 'google_calendar',
    label: 'Google Calendar',
    default_enabled: false,
    enabled: false,
    oauth: { provider_id: 'google' },
  },
];

/** @type {Map<string, { integrations: Record<string, boolean>, oauthConnected: boolean }>} */
const userState = new Map();

function getUserState(userId) {
  if (!userState.has(userId)) {
    userState.set(userId, {
      integrations: Object.fromEntries(
        MOCK_INTEGRATIONS.map((item) => [item.id, item.enabled]),
      ),
      oauthConnected: false,
    });
  }
  return userState.get(userId);
}

function listIntegrationsBody(userId) {
  const state = getUserState(userId);
  return {
    integrations: MOCK_INTEGRATIONS.map((item) => ({
      ...item,
      enabled: state.integrations[item.id] ?? item.enabled,
      ...(item.oauth ? { oauth: item.oauth } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function parseQuery(url) {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(url.slice(queryIndex + 1));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function readCredentials(body) {
  return {
    userId: typeof body.user_id === 'string' ? body.user_id.trim() : '',
    password: typeof body.password === 'string' ? body.password : '',
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const { userId, password } = readCredentials(body);
  if (!userId || !password) {
    sendJson(res, 400, { code: 'validation_error', message: 'user_id and password are required.' });
    return;
  }
  if (accounts.has(userId)) {
    sendJson(res, 409, { code: 'user_exists', message: 'That account already exists. Sign in instead.' });
    return;
  }
  accounts.set(userId, { password });
  sendJson(res, 200, issueTokens(userId));
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const { userId, password } = readCredentials(body);
  const account = accounts.get(userId);
  if (!account || account.password !== password) {
    sendJson(res, 401, { code: 'invalid_credentials', message: 'Wrong user id or password.' });
    return;
  }
  sendJson(res, 200, issueTokens(userId));
}

async function handleRefresh(req, res) {
  const body = await readJsonBody(req);
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
  const userId = refreshTokens.get(refreshToken);
  if (!userId) {
    sendJson(res, 401, { code: 'invalid_refresh_token', message: 'The session has expired. Sign in again.' });
    return;
  }
  refreshTokens.delete(refreshToken); // rotate: old pair is dead
  sendJson(res, 200, issueTokens(userId));
}

async function handleLogout(req, res) {
  const body = await readJsonBody(req);
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
  refreshTokens.delete(refreshToken);
  sendJson(res, 200, {});
}

// ---------------------------------------------------------------------------
// Integrations + OAuth (bearer-scoped; no user_id params)
// ---------------------------------------------------------------------------

function handleIntegrationsGet(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  sendJson(res, 200, listIntegrationsBody(userId));
}

async function handleIntegrationsPut(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const body = await readJsonBody(req);
  const patches = body.integrations;
  if (typeof patches !== 'object' || patches === null) {
    sendJson(res, 400, {
      code: 'validation_error',
      message: 'Body must include integrations with enabled booleans only.',
    });
    return;
  }

  const state = getUserState(userId);
  for (const [integrationId, patch] of Object.entries(patches)) {
    const known = MOCK_INTEGRATIONS.find((item) => item.id === integrationId);
    if (!known) {
      sendJson(res, 400, { code: 'validation_error', message: `Unknown integration "${integrationId}"` });
      return;
    }
    if (typeof patch?.enabled !== 'boolean') {
      sendJson(res, 400, { code: 'validation_error', message: 'enabled must be a boolean' });
      return;
    }
    state.integrations[integrationId] = patch.enabled;
  }

  sendJson(res, 200, listIntegrationsBody(userId));
}

function handleConnectToken(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const token = rid('oct');
  connectTokens.set(token, userId);
  sendJson(res, 200, { connect_token: token, expires_in: 300 });
}

function handleOAuthStatus(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const state = getUserState(userId);
  sendJson(res, 200, {
    connected: state.oauthConnected,
    granted_scopes: state.oauthConnected ? ['https://www.googleapis.com/auth/calendar.readonly'] : [],
    missing_scopes: state.oauthConnected ? [] : ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

/** `/start` is a top-level navigation: identity comes from the connect token. */
function handleOAuthStart(req, res, url) {
  const connectToken = parseQuery(url).get('connect_token') ?? '';
  const userId = connectTokens.get(connectToken);
  if (!userId) {
    sendJson(res, 400, { code: 'invalid_state', message: 'The sign-in session expired. Try again from settings.' });
    return;
  }
  connectTokens.delete(connectToken); // single-use
  getUserState(userId).oauthConnected = true;
  // The real server bounces via the provider; the mock skips straight to the
  // connected landing page (relative: resolves against the app origin).
  res.writeHead(302, {
    location: '/oauth/connected?provider=google',
    'cache-control': 'no-store',
  });
  res.end();
}

function handleOAuthDisconnect(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  getUserState(userId).oauthConnected = false;
  res.writeHead(204, { 'cache-control': 'no-store' });
  res.end();
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function handleTasksGet(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const now = new Date().toISOString();
  sendJson(res, 200, {
    tasks: [
      {
        id: rid('task'),
        description: 'Summarize this week’s meeting notes',
        status: 'running',
        created_at: now,
        updated_at: now,
        retry_count: 0,
        result: null,
        error_message: null,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Respond (SSE)
// ---------------------------------------------------------------------------

function sse(res, payload) {
  res.write(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function handleRespond(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const body = await readJsonBody(req);
  const sessionId =
    typeof body.session_id === 'string' && body.session_id.length > 0
      ? body.session_id
      : rid('sess');
  const requestId = rid('req');
  const showThinking = body.show_thinking === true;

  // Contract samples are the templates; only ids/timestamps are dynamic.
  const turn = { request_id: requestId, session_id: sessionId };

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  sse(res, {
    ...events.start,
    ...turn,
    user_id: userId,
    started_at: new Date().toISOString(),
  });
  await sleep(120);

  if (showThinking) {
    sse(res, { ...events.thinking_delta });
    await sleep(200);
  }

  const toolCallId = rid('call');
  sse(res, { ...events.tool_call, ...turn, tool_call_id: toolCallId });
  await sleep(600);
  sse(res, { ...events.tool_result, ...turn, tool_call_id: toolCallId });
  await sleep(250);

  const answer = [
    '### Here you go\n\n',
    `${events.delta.text}\n\n`,
    '- The **streaming** path works token by token.\n',
    '- Tool calls render as their own chips.\n',
    '- This is `inline code` and a short block:\n\n',
    '```ts\nconst ok = true;\n```\n\n',
    'Ask a follow-up to continue the same session.',
  ];
  for (const part of answer) {
    sse(res, { ...events.delta, text: part });
    await sleep(90);
  }

  sse(res, { ...events.usage, request_id: requestId });
  sse(res, {
    ...events.final,
    request_id: requestId,
    completed_at: new Date().toISOString(),
  });
  res.end();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const oauthProvider = endpoints.oauthProviderSample;
const fillOAuthPath = (template) => template.replace('{provider_id}', oauthProvider);

const routes = new Map([
  [`POST ${endpoints.respond}`, (req, res) => {
    handleRespond(req, res).catch(() => {
      try {
        res.end();
      } catch {
        // already closed
      }
    });
  }],
  [`POST ${endpoints.authRegister}`, (req, res) => {
    void handleRegister(req, res);
  }],
  [`POST ${endpoints.authLogin}`, (req, res) => {
    void handleLogin(req, res);
  }],
  [`POST ${endpoints.authRefresh}`, (req, res) => {
    void handleRefresh(req, res);
  }],
  [`POST ${endpoints.authLogout}`, (req, res) => {
    void handleLogout(req, res);
  }],
  [`GET ${endpoints.tasks}`, handleTasksGet],
  [`GET ${endpoints.integrations}`, handleIntegrationsGet],
  [`PUT ${endpoints.integrations}`, (req, res) => {
    void handleIntegrationsPut(req, res);
  }],
  [`POST ${endpoints.oauthConnectToken}`, handleConnectToken],
  [`GET ${fillOAuthPath(endpoints.oauthStatus)}`, handleOAuthStatus],
  [`GET ${fillOAuthPath(endpoints.oauthStart)}`, (req, res, url) => {
    handleOAuthStart(req, res, url);
  }],
  [`DELETE ${fillOAuthPath(endpoints.oauthDisconnect)}`, handleOAuthDisconnect],
]);

const server = createServer((req, res) => {
  const url = req.url ?? '';
  const path = url.split('?')[0];
  const method = req.method ?? 'GET';
  const handler = routes.get(`${method} ${path}`);
  if (handler) {
    handler(req, res, url);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('mock ts-llm: unsupported route');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock ts-llm server listening on http://127.0.0.1:${PORT}`);
});
