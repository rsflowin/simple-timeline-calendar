import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseRoadmap, serializeRoadmap } from '../src/domain/schema.ts';
import { resolveActor, type Actor } from './auth.ts';
import { StoreConflictError, type RoadmapStore } from './store.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

class PayloadTooLargeError extends Error {}

async function readBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > maxBytes) throw new PayloadTooLargeError('Request body too large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function parseExpectedRevision(req: IncomingMessage): string | null | undefined {
  if (req.headers['if-none-match'] === '*') return null;
  const ifMatch = req.headers['if-match'];
  return typeof ifMatch === 'string' && ifMatch.trim() ? ifMatch.trim() : undefined;
}

export interface ApiHandlerOptions {
  resolveActor?: (req: IncomingMessage) => Promise<Actor | null>;
  corsOrigin?: string;
}

export function createApiHandler(store: RoadmapStore, options: ApiHandlerOptions = {}) {
  const getActor = options.resolveActor ?? resolveActor;

  return async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    if (options.corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', options.corsOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match, If-None-Match');
      res.setHeader('Access-Control-Expose-Headers', 'ETag');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (url.pathname === '/api/health') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return true;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    const actor = await getActor(req);
    if (!actor) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      if (url.pathname === '/api/roadmap') {
        if (req.method === 'GET') {
          const item = await store.load(actor.roadmapId);
          if (!item) {
            res.writeHead(204, { 'Cache-Control': 'no-store' });
            res.end();
            return true;
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ETag: item.revision,
          });
          res.end(item.json);
          return true;
        }

        if (req.method === 'PUT') {
          const raw = await readBody(req);
          let canonical: string;
          try {
            canonical = serializeRoadmap(parseRoadmap(raw));
          } catch (err) {
            sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
            return true;
          }
          const saved = await store.save(actor.roadmapId, canonical, parseExpectedRevision(req));
          sendJson(res, 200, { revision: saved.revision }, { ETag: saved.revision });
          return true;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
        return true;
      }

      if (url.pathname === '/api/roadmap/backup') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return true;
        }
        const raw = await readBody(req);
        await store.backup(actor.roadmapId, raw);
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        res.end();
        return true;
      }

      sendJson(res, 404, { error: 'Not found' });
      return true;
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        sendJson(res, 413, { error: err.message });
        return true;
      }
      if (err instanceof StoreConflictError) {
        sendJson(res, 409, { error: err.message });
        return true;
      }
      sendJson(res, 500, { error: 'Internal server error' });
      return true;
    }
  };
}
