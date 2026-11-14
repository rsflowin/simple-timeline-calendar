import { toDayIndex } from './dates';
import type { Span } from './packRows';
import type { RoadmapDoc, Task } from './types';

export interface TaskSpan extends Span {
  task: Task;
}

/** Tasks passing the tag filter (any selected tag; empty = all), as day spans. */
export function visibleSpans(doc: RoadmapDoc, tagFilter: readonly string[]): TaskSpan[] {
  const known = new Set(doc.tags.map((t) => t.id));
  const wanted = new Set(tagFilter.filter((id) => known.has(id)));
  return doc.tasks
    .filter((t) => wanted.size === 0 || t.tagIds.some((id) => wanted.has(id)))
    .map((t) => ({ id: t.id, start: toDayIndex(t.start), end: toDayIndex(t.end), task: t }));
}
