// Production same-origin server: serves the built `dist/` and reverse-proxies
// `/v1/*` to the ts-llm agent server, so the browser stays on one origin (the
// agent server has no CORS). Run `npm run build` first, then `npm run serve`.
//
// Config via env:
//   PORT            (default 8080)   port this server listens on
//   TS_LLM_TARGET   (default http://127.0.0.1:3000)   the agent server
//   HOST            (default 0.0.0.0) bind address (0.0.0.0 = reachable on LAN)

import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const TARGET = new URL(process.env.TS_LLM_TARGET ?? 'http://127.0.0.1:3000');
const DIST = fileURLToPath(new URL('./dist', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function proxyToAgent(req, res) {
  const driver = TARGET.protocol === 'https:' ? httpsRequest : httpRequest;
  const proxyReq = driver(
    {
      protocol: TARGET.protocol,
      hostname: TARGET.hostname,
      port: TARGET.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: TARGET.host },
    },
    (proxyRes) => {
      // Preserve SSE: forward headers and stream without buffering.
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Bad gateway: the ts-llm agent server is unreachable.');
  });

  req.pipe(proxyReq);
}

async function serveStatic(req, res) {
  // Resolve the request path safely inside DIST.
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const candidate = normalize(join(DIST, urlPath));
  if (!candidate.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let filePath = candidate;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    // SPA fallback to index.html for unknown routes.
    filePath = join(DIST, 'index.html');
  }

  try {
    const info = await stat(filePath);
    const isHashed = /\.[0-9a-zA-Z_-]{8,}\.(js|css|woff2?)$/.test(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}

const server = createServer((req, res) => {
  if (req.url && (req.url === '/v1' || req.url.startsWith('/v1/'))) {
    proxyToAgent(req, res);
    return;
  }
  void serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Ember frontend on http://${HOST}:${PORT}  ->  proxying /v1 to ${TARGET.origin}`);
});
