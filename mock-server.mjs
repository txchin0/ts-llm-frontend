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
  if (req.method === 'POST' && req.url === '/v1/respond') {
    handleRespond(req, res).catch(() => {
      try {
        res.end();
      } catch {
        // already closed
      }
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('mock ts-llm: only POST /v1/respond is implemented');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock ts-llm server listening on http://127.0.0.1:${PORT}`);
});
