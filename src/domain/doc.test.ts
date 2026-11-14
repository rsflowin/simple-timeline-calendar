import { describe, expect, it } from 'vitest';
import { addTask, createTag, deleteTag, deleteTask, EMPTY_DOC, updateTag, updateTask } from './doc';

const input = {
  title: '  Design  ',
  details: '',
  start: '2026-01-05',
  end: '2026-01-09',
  tagIds: [],
};
const T0 = '2026-11-13T00:00:00.000Z';
const T1 = '2026-11-14T00:00:00.000Z';

describe('tasks', () => {
  it('adds a trimmed task with id and timestamps', () => {
    const doc = addTask(EMPTY_DOC, input, 't1', T0);
    expect(doc.tasks[0]).toMatchObject({ id: 't1', title: 'Design', createdAt: T0, updatedAt: T0 });
    expect(EMPTY_DOC.tasks).toHaveLength(0);
  });
  it('rejects a blank title and end before start', () => {
    expect(() => addTask(EMPTY_DOC, { ...input, title: ' ' })).toThrow('title');
    expect(() => addTask(EMPTY_DOC, { ...input, end: '2026-01-04' })).toThrow('before start');
  });
  it('rejects details over the limit', () => {
    expect(() => addTask(EMPTY_DOC, { ...input, details: 'x'.repeat(10_001) })).toThrow(
      'Task details are longer than 10000 characters',
    );
  });
  it('keeps only existing tag ids, deduped, in order', () => {
    let doc = createTag(createTag(EMPTY_DOC, 'A', 'g1'), 'B', 'g2');
    doc = addTask(doc, { ...input, tagIds: ['g1', 'nope', 'g1'] }, 't1', T0);
    expect(doc.tasks[0].tagIds).toEqual(['g1']);
    doc = updateTask(doc, 't1', { tagIds: ['g2', 'gone', 'g1', 'g2'] }, T1);
    expect(doc.tasks[0].tagIds).toEqual(['g2', 'g1']);
  });
  it('returns the same doc for a no-op update', () => {
    const doc = addTask(createTag(EMPTY_DOC, 'A', 'g1'), { ...input, tagIds: ['g1'] }, 't1', T0);
    expect(updateTask(doc, 'nope', { title: 'X' }, T1)).toBe(doc);
    expect(updateTask(doc, 't1', { end: '2026-01-09', tagIds: ['g1'] }, T1)).toBe(doc);
  });
  it('updates and deletes', () => {
    let doc = addTask(EMPTY_DOC, input, 't1', T0);
    doc = updateTask(doc, 't1', { end: '2026-01-12' }, T1);
    expect(doc.tasks[0]).toMatchObject({ end: '2026-01-12', updatedAt: T1, createdAt: T0 });
    expect(deleteTask(doc, 't1').tasks).toHaveLength(0);
  });
});

describe('tags', () => {
  it('creates tags with rotating colours and rejects duplicates (any case)', () => {
    let doc = createTag(EMPTY_DOC, 'Backend', 'g1');
    doc = createTag(doc, 'Frontend', 'g2');
    expect(doc.tags.map((t) => t.color)).toEqual(['blue', 'green']);
    expect(() => createTag(doc, ' backend ')).toThrow('already exists');
  });
  it('reuses the least-used colour first', () => {
    let doc = createTag(createTag(EMPTY_DOC, 'A', 'g1'), 'B', 'g2');
    doc = createTag(deleteTag(doc, 'g1'), 'C', 'g3');
    expect(doc.tags.map((t) => t.color)).toEqual(['green', 'blue']);
  });
  it('renames, but not onto another tag name', () => {
    let doc = createTag(createTag(EMPTY_DOC, 'A', 'g1'), 'B', 'g2');
    doc = updateTag(doc, 'g1', { name: 'a', color: 'red' });
    expect(doc.tags[0]).toMatchObject({ name: 'a', color: 'red' });
    expect(() => updateTag(doc, 'g1', { name: 'b' })).toThrow('already exists');
  });
  it('returns the same doc for a no-op tag update', () => {
    const doc = createTag(EMPTY_DOC, 'A', 'g1');
    expect(updateTag(doc, 'nope', { name: 'X' })).toBe(doc);
    expect(updateTag(doc, 'g1', { name: 'A', color: 'blue' })).toBe(doc);
  });
  it('deleting a tag removes it from tasks', () => {
    let doc = createTag(EMPTY_DOC, 'A', 'g1');
    doc = addTask(doc, { ...input, tagIds: ['g1'] }, 't1', T0);
    doc = deleteTag(doc, 'g1');
    expect(doc.tags).toHaveLength(0);
    expect(doc.tasks[0].tagIds).toEqual([]);
  });
});
