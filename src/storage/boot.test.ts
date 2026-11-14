import { describe, expect, it, vi } from 'vitest';
import { parseRoadmap, serializeRoadmap } from '../domain/schema';
import { loadRoadmap } from './boot';

const adapter = (raw: string | null) => ({
  load: async () => raw,
  save: vi.fn(),
  backup: vi.fn(async () => {}),
});

describe('loadRoadmap', () => {
  it('returns an empty doc when nothing is saved', async () => {
    expect(await loadRoadmap(adapter(null))).toEqual({ doc: { tasks: [], tags: [] }, error: null });
  });
  it('loads a valid doc', async () => {
    const doc = { tasks: [], tags: [{ id: 'g', name: 'A', color: 'blue' as const }] };
    expect((await loadRoadmap(adapter(serializeRoadmap(doc)))).doc).toEqual(doc);
  });
  it('backs up unreadable data instead of discarding it', async () => {
    const a = adapter('{broken');
    const result = await loadRoadmap(a);
    expect(a.backup).toHaveBeenCalledWith('{broken');
    expect(result.doc).toEqual({ tasks: [], tags: [] });
    expect(result.error).toMatch('not valid JSON');
  });
  it('overwrites unreadable data with an empty doc after backing it up, so it is backed up once', async () => {
    const calls: string[] = [];
    const save = vi.fn<(json: string) => Promise<void>>(async () => {
      calls.push('save');
    });
    await loadRoadmap({
      load: async () => '{broken',
      save,
      backup: async () => {
        calls.push('backup');
      },
    });
    expect(calls).toEqual(['backup', 'save']);
    expect(parseRoadmap(save.mock.calls[0][0])).toEqual({ tasks: [], tags: [] });
  });
});
