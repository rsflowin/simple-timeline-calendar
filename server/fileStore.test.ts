import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStore } from './fileStore';
import { StoreConflictError } from './store';

describe('createFileStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tc-store-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null when nothing is saved yet', async () => {
    const store = createFileStore(dir);
    expect(await store.load('default')).toBeNull();
  });

  it('saves and loads default roadmap at dataDir/roadmap.json', async () => {
    const store = createFileStore(dir);
    const saved = await store.save('default', '{"hello":1}', null);
    expect(saved.revision).toMatch(/^"[a-f0-9]{16}"$/);
    expect(await readFile(path.join(dir, 'roadmap.json'), 'utf8')).toBe('{"hello":1}');
    expect(await store.load('default')).toEqual(saved);
  });

  it('enforces optimistic concurrency on expectedRevision', async () => {
    const store = createFileStore(dir);
    const first = await store.save('default', '{"v":1}', null);

    await expect(store.save('default', '{"v":2}', null)).rejects.toThrow(StoreConflictError);
    await expect(store.save('default', '{"v":2}', '"stale"')).rejects.toThrow(StoreConflictError);

    const second = await store.save('default', '{"v":2}', first.revision);
    expect(second.revision).not.toBe(first.revision);
    await expect(store.save('default', '{"v":3}', first.revision)).rejects.toThrow(
      StoreConflictError,
    );
  });

  it('writes backups without overwriting previous backups', async () => {
    const store = createFileStore(dir);
    await store.backup('default', 'corrupt-1');
    await store.backup('default', 'corrupt-2');
    const files = await readdir(path.join(dir, 'backups'));
    expect(files).toHaveLength(2);
    const contents = await Promise.all(
      files.map((f) => readFile(path.join(dir, 'backups', f), 'utf8')),
    );
    expect(contents.sort()).toEqual(['corrupt-1', 'corrupt-2']);
  });

  it('rejects invalid roadmap ids', async () => {
    const store = createFileStore(dir);
    await expect(store.load('../secret')).rejects.toThrow('Invalid roadmap id');
  });
});
