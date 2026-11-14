import { isValidISODate } from './dates';
import { FILE_FORMAT, FILE_VERSION, LIMITS, TAG_COLORS, type RoadmapDoc, type Tag, type TagColor, type Task } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, problem: string): never {
  throw new Error(`${path} ${problem}`);
}

function text(o: Obj, key: string, path: string, max: number, required = true): string {
  const v = o[key];
  if (v === undefined && !required) return '';
  if (typeof v !== 'string') fail(`${path}.${key}`, 'must be text');
  if (v.length > max) fail(`${path}.${key}`, `is longer than ${max} characters`);
  if (required && !v.trim()) fail(`${path}.${key}`, 'is empty');
  return required ? v.trim() : v;
}

function list(o: Obj, key: string): unknown[] {
  const v = o[key];
  if (!Array.isArray(v)) fail(key, 'must be a list');
  return v;
}

function unique(items: { id: string }[], path: string) {
  if (new Set(items.map((i) => i.id)).size !== items.length) fail(path, 'contain duplicate ids');
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON');
  }
}

/** Validates untrusted JSON (import or storage). Throws an Error naming the first bad field. */
export function parseRoadmap(json: string): RoadmapDoc {
  const raw = parseJson(json);
  if (!isObj(raw) || raw.format !== FILE_FORMAT) throw new Error('Not a Timeline Calendar file');
  if (raw.version !== FILE_VERSION) throw new Error(`Unsupported file version ${String(raw.version)}`);

  const tags: Tag[] = list(raw, 'tags').map((t, i) => {
    const p = `tags[${i}]`;
    if (!isObj(t)) fail(p, 'must be an object');
    if (!TAG_COLORS.includes(t.color as TagColor)) fail(`${p}.color`, `must be one of ${TAG_COLORS.join(', ')}`);
    return { id: text(t, 'id', p, LIMITS.id), name: text(t, 'name', p, LIMITS.tagName), color: t.color as TagColor };
  });
  unique(tags, 'tags');
  const tagIds = new Set(tags.map((t) => t.id));

  const tasks: Task[] = list(raw, 'tasks').map((t, i) => {
    const p = `tasks[${i}]`;
    if (!isObj(t)) fail(p, 'must be an object');
    const { start, end } = t;
    if (!isValidISODate(start)) fail(`${p}.start`, 'must be a date like 2026-01-31');
    if (!isValidISODate(end)) fail(`${p}.end`, 'must be a date like 2026-01-31');
    if (end < start) fail(`${p}.end`, 'is before start');
    const now = new Date().toISOString();
    return {
      id: text(t, 'id', p, LIMITS.id),
      title: text(t, 'title', p, LIMITS.title),
      details: text(t, 'details', p, LIMITS.details, false),
      start,
      end,
      tagIds: Array.isArray(t.tagIds)
        ? t.tagIds.filter((id): id is string => typeof id === 'string' && tagIds.has(id))
        : [],
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : now,
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : now,
    };
  });
  unique(tasks, 'tasks');

  return { tasks, tags };
}

export function serializeRoadmap(doc: RoadmapDoc): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, tasks: doc.tasks, tags: doc.tags }, null, 2);
}
