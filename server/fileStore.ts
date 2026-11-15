import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertValidRoadmapId,
  StoreConflictError,
  type RoadmapStore,
  type StoredRoadmap,
} from './store';

function computeRevision(json: string): string {
  const hash = createHash('sha256').update(json, 'utf8').digest('hex').slice(0, 16);
  return `"${hash}"`;
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}

export function createFileStore(dataDir: string): RoadmapStore {
  const root = path.resolve(dataDir);
  const locks = new Map<string, Promise<void>>();

  const roadmapPath = (roadmapId: string) => {
    const id = assertValidRoadmapId(roadmapId);
    return id === 'default'
      ? path.join(root, 'roadmap.json')
      : path.join(root, 'roadmaps', `${id}.json`);
  };

  const withLock = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prev.then(() => next);
    locks.set(key, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(key) === tail) locks.delete(key);
    }
  };

  const readCurrent = async (file: string): Promise<StoredRoadmap | null> => {
    try {
      const json = await readFile(file, 'utf8');
      return { json, revision: computeRevision(json) };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  };

  return {
    async load(roadmapId) {
      return readCurrent(roadmapPath(roadmapId));
    },

    async save(roadmapId, json, expectedRevision) {
      const file = roadmapPath(roadmapId);
      return withLock(file, async () => {
        if (expectedRevision !== undefined) {
          const current = await readCurrent(file);
          if (expectedRevision === null) {
            if (current !== null) throw new StoreConflictError();
          } else if (current === null || current.revision !== expectedRevision) {
            throw new StoreConflictError();
          }
        }
        await mkdir(path.dirname(file), { recursive: true });
        const tmp = `${file}.${randomUUID()}.tmp`;
        await writeFile(tmp, json, 'utf8');
        await rename(tmp, file);
        return { json, revision: computeRevision(json) };
      });
    },

    async backup(roadmapId, json) {
      const id = assertValidRoadmapId(roadmapId);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = path.join(root, 'backups');
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${id}-${stamp}-${randomUUID().slice(0, 8)}.json`);
      await writeFile(file, json, 'utf8');
    },
  };
}
