import type { Tag, Task } from '../domain/types';

/** Bar colours: the first tag's colour, or neutral grey with no tags (SPEC §2.3). */
export function taskColor(task: Task, tags: readonly Tag[]) {
  const color = tags.find((t) => t.id === task.tagIds[0])?.color ?? 'gray';
  return { background: `var(--tag-${color}-bg)`, color: `var(--tag-${color}-fg)` };
}
