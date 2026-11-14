import { isValidISODate } from './dates';
import { newId } from './id';
import { LIMITS, TAG_COLORS, type RoadmapDoc, type Tag, type TagColor, type Task } from './types';

export type TaskInput = Pick<Task, 'title' | 'details' | 'start' | 'end' | 'tagIds'>;

export const EMPTY_DOC: RoadmapDoc = { tasks: [], tags: [] };

/** Validates, trims the title and keeps only existing tag ids (deduped, order kept). */
function checked<T extends TaskInput>(t: T, tags: readonly Tag[]): T {
  const title = t.title.trim();
  if (!title) throw new Error('Task title is required');
  if (title.length > LIMITS.title)
    throw new Error(`Task title is longer than ${LIMITS.title} characters`);
  if (t.details.length > LIMITS.details)
    throw new Error(`Task details are longer than ${LIMITS.details} characters`);
  if (!isValidISODate(t.start) || !isValidISODate(t.end))
    throw new Error('Task dates must be YYYY-MM-DD');
  if (t.end < t.start) throw new Error('End date is before start date');
  const tagIds = [...new Set(t.tagIds)].filter((id) => tags.some((g) => g.id === id));
  return { ...t, title, tagIds };
}

const sameTask = (a: TaskInput, b: TaskInput) =>
  a.title === b.title &&
  a.details === b.details &&
  a.start === b.start &&
  a.end === b.end &&
  a.tagIds.length === b.tagIds.length &&
  a.tagIds.every((id, i) => id === b.tagIds[i]);

export function addTask(
  doc: RoadmapDoc,
  input: TaskInput,
  id = newId(),
  now = new Date().toISOString(),
): RoadmapDoc {
  const task: Task = checked({ ...input, id, createdAt: now, updatedAt: now }, doc.tags);
  return { ...doc, tasks: [...doc.tasks, task] };
}

/** Returns `doc` itself when nothing changes, so undo history records no empty step. */
export function updateTask(
  doc: RoadmapDoc,
  id: string,
  patch: Partial<TaskInput>,
  now = new Date().toISOString(),
): RoadmapDoc {
  const i = doc.tasks.findIndex((t) => t.id === id);
  if (i === -1) return doc;
  const next = checked({ ...doc.tasks[i], ...patch }, doc.tags);
  if (sameTask(doc.tasks[i], next)) return doc;
  return { ...doc, tasks: doc.tasks.with(i, { ...next, updatedAt: now }) };
}

export function deleteTask(doc: RoadmapDoc, id: string): RoadmapDoc {
  return { ...doc, tasks: doc.tasks.filter((t) => t.id !== id) };
}

export function findTagByName(doc: RoadmapDoc, name: string): Tag | undefined {
  const n = name.trim().toLowerCase();
  return doc.tags.find((t) => t.name.toLowerCase() === n);
}

function checkTagName(doc: RoadmapDoc, name: string, selfId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name is required');
  if (trimmed.length > LIMITS.tagName)
    throw new Error(`Tag name is longer than ${LIMITS.tagName} characters`);
  const clash = findTagByName(doc, trimmed);
  if (clash && clash.id !== selfId) throw new Error(`Tag "${trimmed}" already exists`);
  return trimmed;
}

/** Caller passes the id so it can select the new tag right away. */
export function createTag(doc: RoadmapDoc, name: string, id = newId()): RoadmapDoc {
  // Least-used colour, first in palette order: colours repeat only once all are taken.
  const uses = (c: TagColor) => doc.tags.filter((t) => t.color === c).length;
  const color = TAG_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
  return { ...doc, tags: [...doc.tags, { id, name: checkTagName(doc, name), color }] };
}

/** Returns `doc` itself when nothing changes. */
export function updateTag(
  doc: RoadmapDoc,
  id: string,
  patch: Partial<Pick<Tag, 'name' | 'color'>>,
): RoadmapDoc {
  const i = doc.tags.findIndex((t) => t.id === id);
  if (i === -1) return doc;
  const old = doc.tags[i];
  const name = patch.name === undefined ? old.name : checkTagName(doc, patch.name, id);
  const color = patch.color ?? old.color;
  if (name === old.name && color === old.color) return doc;
  return { ...doc, tags: doc.tags.with(i, { ...old, name, color }) };
}

export function deleteTag(doc: RoadmapDoc, id: string): RoadmapDoc {
  return {
    tags: doc.tags.filter((t) => t.id !== id),
    tasks: doc.tasks.map((t) =>
      t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t,
    ),
  };
}
