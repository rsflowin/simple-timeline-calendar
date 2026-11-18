import { describe, expect, it } from 'vitest';
import {
  addTask,
  createTag,
  deleteTag,
  deleteTask,
  EMPTY_DOC,
  mergeRoadmap,
  reorderTags,
  updateTag,
  updateTask,
} from './doc';

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
    expect(deleteTask(doc, 'nope')).toBe(doc);
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
    expect(deleteTag(doc, 'nope')).toBe(doc);
  });
  it('reorders tags, ignores unknown/duplicate ids, appends omitted tags, and no-ops cleanly', () => {
    const doc = createTag(createTag(createTag(EMPTY_DOC, 'A', 'g1'), 'B', 'g2'), 'C', 'g3');
    expect(reorderTags(doc, ['g1', 'g2', 'g3'])).toBe(doc);
    expect(reorderTags(EMPTY_DOC, [])).toBe(EMPTY_DOC);

    const reordered = reorderTags(doc, ['g3', 'missing', 'g1', 'g3']);
    expect(reordered.tags.map((t) => t.id)).toEqual(['g3', 'g1', 'g2']);
    expect(doc.tags.map((t) => t.id)).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('mergeRoadmap', () => {
  const task = (id: string, tagIds: string[], title = id) => ({
    ...input,
    id,
    title,
    tagIds,
    createdAt: T0,
    updatedAt: T0,
  });
  const doc = {
    tags: [
      { id: 'a', name: 'Alpha', color: 'red' as const },
      { id: 'b', name: 'Beta', color: 'blue' as const },
    ],
    tasks: [task('t1', ['a']), task('t2', ['b'])],
  };

  it('keeps existing tasks and tags as they are and adds new ones', () => {
    const r = mergeRoadmap(doc, {
      tags: [{ id: 'n', name: 'New', color: 'green' }],
      tasks: [task('n1', ['n']), task('n2', ['n'])],
    });
    expect(r).toMatchObject({ added: 2, updated: 0, skipped: 0 });
    expect(r.doc.tasks.slice(0, 2)).toEqual(doc.tasks);
    expect(r.doc.tags).toEqual([...doc.tags, { id: 'n', name: 'New', color: 'green' }]);
    expect(r.doc.tasks.slice(2).map((t) => t.tagIds)).toEqual([['n'], ['n']]);
  });

  it('maps incoming tags onto existing ones by id, then by name, without changing them', () => {
    const r = mergeRoadmap(doc, {
      tags: [
        { id: 'a', name: 'Renamed', color: 'gray' },
        { id: 'x', name: 'beta', color: 'gray' },
      ],
      tasks: [task('n1', ['a', 'x'])],
    });
    expect(r.doc.tags).toEqual(doc.tags);
    expect(r.doc.tasks[2].tagIds).toEqual(['a', 'b']);
  });

  it('updates a task with the same id and skips invalid ones', () => {
    const r = mergeRoadmap(doc, {
      tags: [],
      tasks: [task('t1', ['a'], 'Changed'), { ...task('bad', []), title: '   ' }],
    });
    expect(r).toMatchObject({ added: 0, updated: 1, skipped: 1 });
    expect(r.doc.tasks[0].title).toBe('Changed');
    expect(r.doc.tasks[1]).toBe(doc.tasks[1]);
  });
});
