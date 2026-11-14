import { describe, expect, it } from 'vitest';
import { parseRoadmap, serializeRoadmap } from './schema';
import type { RoadmapDoc } from './types';

const doc: RoadmapDoc = {
  tags: [{ id: 'g1', name: 'Backend', color: 'blue' }],
  tasks: [
    {
      id: 't1',
      title: 'API',
      details: 'x',
      start: '2026-01-05',
      end: '2026-01-09',
      tagIds: ['g1'],
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-02T10:30:00.000Z',
    },
  ],
};
const file = (patch: object) => JSON.stringify({ ...JSON.parse(serializeRoadmap(doc)), ...patch });
const withTask = (patch: object) => file({ tasks: [{ ...doc.tasks[0], ...patch }] });

describe('parseRoadmap', () => {
  it('round-trips', () => expect(parseRoadmap(serializeRoadmap(doc))).toEqual(doc));
  it('rejects non-JSON and foreign files', () => {
    expect(() => parseRoadmap('{')).toThrow('not valid JSON');
    expect(() => parseRoadmap('{"tasks":[]}')).toThrow('Not a Timeline Calendar file');
    expect(() => parseRoadmap('[]')).toThrow('Not a Timeline Calendar file');
    expect(() => parseRoadmap('null')).toThrow('Not a Timeline Calendar file');
    expect(() => parseRoadmap(file({ version: 99 }))).toThrow('version 99');
  });
  it('names the bad field', () => {
    expect(() => parseRoadmap(withTask({ end: '2026-01-01' }))).toThrow(
      'tasks[0].end is before start',
    );
    expect(() => parseRoadmap(withTask({ start: '2026-02-30' }))).toThrow('tasks[0].start');
    expect(() => parseRoadmap(withTask({ title: '  ' }))).toThrow('tasks[0].title is empty');
    expect(() => parseRoadmap(withTask({ id: 5 }))).toThrow('tasks[0].id must be text');
    expect(() => parseRoadmap(file({ tags: [{ id: 'g', name: 'A', color: 'teal' }] }))).toThrow(
      'tags[0].color',
    );
  });
  it('drops unknown tag ids and fills optional fields', () => {
    const parsed = parseRoadmap(withTask({ tagIds: ['g1', 'nope'], details: undefined }));
    expect(parsed.tasks[0].tagIds).toEqual(['g1']);
    expect(parsed.tasks[0].details).toBe('');
  });
  it('keeps ids exactly as written', () => {
    const tags = [{ ...doc.tags[0], id: ' g1' }];
    const parsed = parseRoadmap(file({ tags, tasks: [{ ...doc.tasks[0], tagIds: [' g1'] }] }));
    expect(parsed.tags[0].id).toBe(' g1');
    expect(parsed.tasks[0].tagIds).toEqual([' g1']);
  });
  it('replaces unreadable timestamps with the import time', () => {
    const parsed = parseRoadmap(withTask({ createdAt: 'c', updatedAt: 'x'.repeat(41) }));
    expect(Number.isNaN(Date.parse(parsed.tasks[0].createdAt))).toBe(false);
    expect(parsed.tasks[0].updatedAt).toBe(parsed.tasks[0].createdAt);
  });
  it('rejects duplicate tag names, any case', () => {
    const tags = [...doc.tags, { id: 'g2', name: ' backend ', color: 'green' }];
    expect(() => parseRoadmap(file({ tags }))).toThrow(
      'tags[1].name "backend" duplicates another tag',
    );
  });
  it('dedupes task tag ids, keeping first-seen order', () => {
    const tags = [...doc.tags, { id: 'g2', name: 'Frontend', color: 'green' }];
    const tasks = [{ ...doc.tasks[0], tagIds: ['g2', 'g1', 'g2'] }];
    expect(parseRoadmap(file({ tags, tasks })).tasks[0].tagIds).toEqual(['g2', 'g1']);
  });
  it('trims before checking length', () => {
    const tags = [{ id: 'g1', name: 'x'.repeat(50) + ' ', color: 'blue' }];
    expect(parseRoadmap(file({ tags })).tags[0].name).toBe('x'.repeat(50));
  });
  it('rejects duplicate ids', () => {
    expect(() => parseRoadmap(file({ tasks: [doc.tasks[0], doc.tasks[0]] }))).toThrow('duplicate');
  });
});
