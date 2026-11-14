import { isValidISODate } from './dates';
import { newId } from './id';
import { LIMITS, TAG_COLORS, type RoadmapDoc, type Tag, type Task } from './types';

export type TaskInput = Pick<Task, 'title' | 'details' | 'start' | 'end' | 'tagIds'>;

export const EMPTY_DOC: RoadmapDoc = { tasks: [], tags: [] };

function checked<T extends TaskInput>(t: T): T {
  const title = t.title.trim();
  if (!title) throw new Error('Task title is required');
  if (title.length > LIMITS.title) throw new Error(`Task title is longer than ${LIMITS.title} characters`);
  if (!isValidISODate(t.start) || !isValidISODate(t.end)) throw new Error('Task dates must be YYYY-MM-DD');
  if (t.end < t.start) throw new Error('End date is before start date');
  return { ...t, title, details: t.details.slice(0, LIMITS.details) };
}

export function addTask(doc: RoadmapDoc, input: TaskInput, id = newId(), now = new Date().toISOString()): RoadmapDoc {
  const task: Task = checked({ ...input, id, createdAt: now, updatedAt: now });
  return { ...doc, tasks: [...doc.tasks, task] };
}

export function updateTask(doc: RoadmapDoc, id: string, patch: Partial<TaskInput>, now = new Date().toISOString()): RoadmapDoc {
  return { ...doc, tasks: doc.tasks.map((t) => (t.id === id ? checked({ ...t, ...patch, updatedAt: now }) : t)) };
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
  if (trimmed.length > LIMITS.tagName) throw new Error(`Tag name is longer than ${LIMITS.tagName} characters`);
  const clash = findTagByName(doc, trimmed);
  if (clash && clash.id !== selfId) throw new Error(`Tag "${trimmed}" already exists`);
  return trimmed;
}

/** Caller passes the id so it can select the new tag right away. */
export function createTag(doc: RoadmapDoc, name: string, id = newId()): RoadmapDoc {
  const color = TAG_COLORS[doc.tags.length % TAG_COLORS.length];
  return { ...doc, tags: [...doc.tags, { id, name: checkTagName(doc, name), color }] };
}

export function updateTag(doc: RoadmapDoc, id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>): RoadmapDoc {
  const name = patch.name === undefined ? undefined : checkTagName(doc, patch.name, id);
  return {
    ...doc,
    tags: doc.tags.map((t) => (t.id === id ? { ...t, ...patch, ...(name && { name }) } : t)),
  };
}

export function deleteTag(doc: RoadmapDoc, id: string): RoadmapDoc {
  return {
    tags: doc.tags.filter((t) => t.id !== id),
    tasks: doc.tasks.map((t) => (t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t)),
  };
}
