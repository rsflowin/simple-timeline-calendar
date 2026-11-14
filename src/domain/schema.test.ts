import { describe, expect, it } from 'vitest';
import { parseRoadmap, serializeRoadmap } from './schema';
import type { RoadmapDoc } from './types';

const doc: RoadmapDoc = {
  tags: [{ id: 'g1', name: 'Backend', color: 'blue' }],
  tasks: [{ id: 't1', title: 'API', details: 'x', start: '2026-01-05', end: '2026-01-09',
            tagIds: ['g1'], createdAt: 'c', updatedAt: 'u' }],
};
const file = (patch: object) => JSON.stringify({ ...JSON.parse(serializeRoadmap(doc)), ...patch });
const withTask = (patch: object) => file({ tasks: [{ ...doc.tasks[0], ...patch }] });

describe('parseRoadmap', () => {
  it('round-trips', () => expect(parseRoadmap(serializeRoadmap(doc))).toEqual(doc));
  it('rejects non-JSON and foreign files', () => {
    expect(() => parseRoadmap('{')).toThrow('not valid JSON');
    expect(() => parseRoadmap('{"tasks":[]}')).toThrow('Not a Timeline Calendar file');
    expect(() => parseRoadmap(file({ version: 99 }))).toThrow('version 99');
  });
  it('names the bad field', () => {
    expect(() => parseRoadmap(withTask({ end: '2026-01-01' }))).toThrow('tasks[0].end is before start');
    expect(() => parseRoadmap(withTask({ start: '2026-02-30' }))).toThrow('tasks[0].start');
    expect(() => parseRoadmap(withTask({ title: '  ' }))).toThrow('tasks[0].title is empty');
    expect(() => parseRoadmap(file({ tags: [{ id: 'g', name: 'A', color: 'teal' }] }))).toThrow('tags[0].color');
  });
  it('drops unknown tag ids and fills optional fields', () => {
    const parsed = parseRoadmap(withTask({ tagIds: ['g1', 'nope'], details: undefined }));
    expect(parsed.tasks[0].tagIds).toEqual(['g1']);
    expect(parsed.tasks[0].details).toBe('');
  });
  it('rejects duplicate ids', () => {
    expect(() => parseRoadmap(file({ tasks: [doc.tasks[0], doc.tasks[0]] }))).toThrow('duplicate');
  });
});
