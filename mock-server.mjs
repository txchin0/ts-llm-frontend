// Minimal mock of the ts-llm `POST /v1/respond` SSE endpoint.
//
// Lets you develop and test the frontend without the full agent stack
// (Postgres, providers, tools). It is NOT the real server; it just emits a
// representative event sequence: start -> thinking -> tool -> answer -> final.
//
// Usage:
//   node mock-server.mjs               # listens on 127.0.0.1:3001
//   VITE_TS_LLM_TARGET=http://127.0.0.1:3001 npm run dev

import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 3001);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rid = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(
    0,
    prefix.length + 1 + 16,
  );

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

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function handleIntegrationsGet(req, res, url) {
  const userId = parseQuery(url).get('user_id');
  if (!userId) {
    sendJson(res, 400, { code: 'validation_error', message: 'user_id is required' });
    return;
  }
  sendJson(res, 200, listIntegrationsBody(userId));
}

async function handleIntegrationsPut(req, res) {
  const body = await readJsonBody(req);
  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  const patches = body.integrations;
  if (!userId || typeof patches !== 'object' || patches === null) {
    sendJson(res, 400, {
      code: 'validation_error',
      message: 'Body must include user_id and integrations with enabled booleans only.',
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

function handleOAuthStatus(req, res, url) {
  const userId = parseQuery(url).get('user_id');
  if (!userId) {
    sendJson(res, 400, { code: 'validation_error', message: 'user_id is required' });
    return;
  }
  const state = getUserState(userId);
  sendJson(res, 200, {
    connected: state.oauthConnected,
    granted_scopes: state.oauthConnected ? ['https://www.googleapis.com/auth/calendar.readonly'] : [],
    missing_scopes: state.oauthConnected ? [] : ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

function handleOAuthStart(req, res, url) {
  const userId = parseQuery(url).get('user_id');
  if (!userId) {
    sendJson(res, 400, { code: 'validation_error', message: 'user_id is required' });
    return;
  }
  const state = getUserState(userId);
  state.oauthConnected = true;
  res.writeHead(302, {
    location: 'https://accounts.google.com/o/oauth2/auth?mock=true',
    'cache-control': 'no-store',
  });
  res.end();
}

function handleOAuthDisconnect(req, res, url) {
  const userId = parseQuery(url).get('user_id');
  if (!userId) {
    sendJson(res, 400, { code: 'validation_error', message: 'user_id is required' });
    return;
  }
  const state = getUserState(userId);
  state.oauthConnected = false;
  res.writeHead(204, { 'cache-control': 'no-store' });
  res.end();
}

function sse(res, type, payload) {
  res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`);
}

async function handleRespond(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;

  let body = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    body = {};
  }

  const userId = typeof body.user_id === 'string' ? body.user_id : 'web-user';
  const sessionId =
    typeof body.session_id === 'string' && body.session_id.length > 0
      ? body.session_id
      : rid('sess');
  const requestId = rid('req');
  const message = typeof body.message === 'string' ? body.message : '';
  const showThinking = body.show_thinking === true;

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  sse(res, 'start', {
    request_id: requestId,
    user_id: userId,
    session_id: sessionId,
    started_at: new Date().toISOString(),
  });
  await sleep(120);

  if (showThinking) {
    const thoughts = [
      'Let me parse what they actually asked. ',
      `The message was: "${message.slice(0, 60)}". ',`,
      '\nI should check whether a tool is needed before answering, ',
      'then compose a concise, well-structured reply.',
    ];
    for (const part of thoughts) {
      sse(res, 'thinking_delta', { text: part });
      await sleep(160);
    }
  }

  // A representative tool round-trip.
  const toolCallId = rid('call');
  sse(res, 'tool_call', {
    request_id: requestId,
    session_id: sessionId,
    step: 0,
    tool_call_id: toolCallId,
    tool_name: 'search_notes',
    input: { query: message.slice(0, 40), limit: 3 },
  });
  await sleep(700);
  sse(res, 'tool_result', {
    request_id: requestId,
    session_id: sessionId,
    step: 0,
    tool_call_id: toolCallId,
    tool_name: 'search_notes',
    output: { hits: 2, items: ['note-12: roadmap', 'note-31: meeting'] },
    is_error: false,
  });
  await sleep(250);

  const answer = [
    '### Here you go\n\n',
    'I looked that up and here is a quick summary:\n\n',
    '- First, the **streaming** path works token by token.\n',
    '- Second, tool calls render as their own chips.\n',
    '- Third, this is `inline code` and a short block:\n\n',
    '```ts\nconst ok = true;\n```\n\n',
    'Ask a follow-up to continue the same session.',
  ];
  for (const part of answer) {
    sse(res, 'delta', { text: part });
    await sleep(90);
  }

  sse(res, 'usage', {
    request_id: requestId,
    usage: { input_tokens: 142, output_tokens: 96, total_tokens: 238 },
  });
  sse(res, 'final', {
    request_id: requestId,
    finish_reason: 'stop',
    completed_at: new Date().toISOString(),
  });
  res.end();
}

const server = createServer((req, res) => {
  const url = req.url ?? '';

  if (req.method === 'POST' && url === '/v1/respond') {
    handleRespond(req, res).catch(() => {
      try {
        res.end();
      } catch {
        // already closed
      }
    });
    return;
  }

  if (req.method === 'GET' && url.startsWith('/v1/integrations')) {
    void handleIntegrationsGet(req, res, url);
    return;
  }

  if (req.method === 'PUT' && url === '/v1/integrations') {
    void handleIntegrationsPut(req, res);
    return;
  }

  if (req.method === 'GET' && url.startsWith('/v1/oauth/google/status')) {
    handleOAuthStatus(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.startsWith('/v1/oauth/google/start')) {
    handleOAuthStart(req, res, url);
    return;
  }

  if (req.method === 'DELETE' && url.startsWith('/v1/oauth/google')) {
    handleOAuthDisconnect(req, res, url);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('mock ts-llm: unsupported route');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock ts-llm server listening on http://127.0.0.1:${PORT}`);
});
