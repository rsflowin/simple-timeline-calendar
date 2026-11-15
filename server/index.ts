import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createFileStore } from './fileStore';
import { createApiHandler } from './handler';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticRoot: string,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  const filePath = path.resolve(staticRoot, `.${rel}`);
  if (filePath !== staticRoot && !filePath.startsWith(staticRoot + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    const cacheControl = rel.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': info.size,
      'Cache-Control': cacheControl,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(await readFile(filePath));
  } catch {
    res.writeHead(404);
    res.end();
  }
}

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8080);
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const staticDir = path.resolve(process.env.STATIC_DIR ?? 'dist');
const corsOrigin = process.env.CORS_ORIGIN;

const handleApi = createApiHandler(createFileStore(dataDir), { corsOrigin });

const server = createServer((req, res) => {
  void (async () => {
    if (await handleApi(req, res)) return;
    await serveStatic(req, res, staticDir);
  })().catch((err) => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    }
  });
});

server.listen(port, host, () => {
  console.log(`Simple Timeline Calendar listening on http://${host}:${port} (data: ${dataDir})`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
