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
    expect(await loadRoadmap(adapter(null))).toEqual({
      doc: { tasks: [], tags: [] },
      error: null,
      unreadable: null,
    });
  });
  it('loads a valid doc', async () => {
    const doc = { tasks: [], tags: [{ id: 'g', name: 'A', color: 'blue' as const }] };
    expect(await loadRoadmap(adapter(serializeRoadmap(doc)))).toEqual({
      doc,
      error: null,
      unreadable: null,
    });
  });
  it('backs up unreadable data instead of discarding it', async () => {
    const a = adapter('{broken');
    const result = await loadRoadmap(a);
    expect(a.backup).toHaveBeenCalledWith('{broken');
    expect(result.doc).toEqual({ tasks: [], tags: [] });
    expect(result.error).toMatch('not valid JSON');
    expect(result.error).toMatch('A backup copy was kept; starting with an empty roadmap.');
    expect(result.unreadable).toBe('{broken');
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
  it('leaves the data in place when the backup fails', async () => {
    const a = {
      ...adapter('{broken'),
      backup: async () => {
        throw new Error('quota');
      },
    };
    const result = await loadRoadmap(a);
    expect(a.save).not.toHaveBeenCalled();
    expect(result.error).toMatch("Saved roadmap couldn't be read (File is not valid JSON)");
    expect(result.error).toMatch('no backup could be written');
    expect(result.error).not.toMatch('backup copy was kept');
    expect(result.unreadable).toBe('{broken');
    expect(result.doc).toEqual({ tasks: [], tags: [] });
  });
  it('still starts when the empty doc cannot be saved after a backup', async () => {
    const a = {
      ...adapter('{broken'),
      save: async () => {
        throw new Error('quota');
      },
    };
    const result = await loadRoadmap(a);
    expect(result.error).toMatch('not valid JSON');
    expect(result.unreadable).toBe('{broken');
  });
});
