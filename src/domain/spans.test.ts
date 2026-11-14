import { describe, expect, it } from 'vitest';
import { visibleSpans } from './spans';
import { toDayIndex } from './dates';
import type { RoadmapDoc, Task } from './types';

const task = (id: string, start: string, end: string, tagIds: string[] = []): Task =>
  ({ id, title: id, details: '', start, end, tagIds, createdAt: '', updatedAt: '' });

const doc: RoadmapDoc = {
  tags: [{ id: 'x', name: 'X', color: 'blue' }, { id: 'y', name: 'Y', color: 'red' }],
  tasks: [
    task('a', '2026-01-01', '2026-01-03', ['x']),
    task('b', '2026-01-02', '2026-01-02', ['y']),
    task('c', '2026-01-05', '2026-01-06'),
  ],
};
const ids = (f: string[]) => visibleSpans(doc, f).map((s) => s.id);

describe('visibleSpans', () => {
  it('returns every task for an empty filter', () => expect(ids([])).toEqual(['a', 'b', 'c']));
  it('keeps tasks with any selected tag', () => expect(ids(['x', 'y'])).toEqual(['a', 'b']));
  it('ignores filter ids of deleted tags', () => {
    expect(ids(['gone'])).toEqual(['a', 'b', 'c']);
    expect(ids(['x', 'gone'])).toEqual(['a']);
  });
  it('converts dates to day indexes', () => {
    const [a] = visibleSpans(doc, []);
    expect([a.start, a.end]).toEqual([toDayIndex('2026-01-01'), toDayIndex('2026-01-03')]);
  });
});
