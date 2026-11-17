import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_DOC } from '../src/domain/doc';
import { serializeRoadmap } from '../src/domain/schema';
import { createFileStore } from './fileStore';
import { createApiHandler, type ApiHandlerOptions } from './handler';

async function startTestServer(dataDir: string, options?: ApiHandlerOptions) {
  const handleApi = createApiHandler(createFileStore(dataDir), options);
  const server = createServer((req, res) => {
    void handleApi(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, url: `http://127.0.0.1:${port}` };
}

describe('API handler', () => {
  let dir: string;
  let server: Server | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tc-api-'));
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('loads empty (204), saves valid JSON, checks ETag conflicts, and writes backups', async () => {
    const started = await startTestServer(dir);
    server = started.server;

    const health = await fetch(`${started.url}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const initial = await fetch(`${started.url}/api/roadmap`);
    expect(initial.status).toBe(204);

    const doc1 = serializeRoadmap({
      ...EMPTY_DOC,
      tags: [{ id: 't1', name: 'Ops', color: 'blue' }],
    });
    const put1 = await fetch(`${started.url}/api/roadmap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
      body: doc1,
    });
    expect(put1.status).toBe(200);
    const etag1 = put1.headers.get('etag');
    expect(etag1).toBeTruthy();

    // Another client still thinks it's empty -> 409 Conflict
    const conflictEmpty = await fetch(`${started.url}/api/roadmap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
      body: serializeRoadmap(EMPTY_DOC),
    });
    expect(conflictEmpty.status).toBe(409);

    // Matching ETag succeeds
    const doc2 = serializeRoadmap(EMPTY_DOC);
    const put2 = await fetch(`${started.url}/api/roadmap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag1! },
      body: doc2,
    });
    expect(put2.status).toBe(200);

    // Stale ETag fails
    const stale = await fetch(`${started.url}/api/roadmap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag1! },
      body: doc1,
    });
    expect(stale.status).toBe(409);

    // Reload returns latest saved document
    const loaded = await fetch(`${started.url}/api/roadmap`);
    expect(loaded.status).toBe(200);
    expect(JSON.parse(await loaded.text())).toEqual(JSON.parse(doc2));

    // Backup endpoint writes to backups directory
    const backup = await fetch(`${started.url}/api/roadmap/backup`, {
      method: 'POST',
      body: '{corrupt',
    });
    expect(backup.status).toBe(204);
    expect(await readdir(path.join(dir, 'backups'))).toHaveLength(1);
  });

  it('rejects malformed roadmap payloads with 400', async () => {
    const started = await startTestServer(dir);
    server = started.server;

    const bad = await fetch(`${started.url}/api/roadmap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"format":"wrong"}',
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Not a Timeline Calendar file' });
  });

  it('returns 401 when resolveActor rejects', async () => {
    const started = await startTestServer(dir, { resolveActor: async () => null });
    server = started.server;

    const res = await fetch(`${started.url}/api/roadmap`);
    expect(res.status).toBe(401);
  });
});
