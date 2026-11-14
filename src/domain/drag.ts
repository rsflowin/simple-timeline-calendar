import type { DayIndex } from './dates';

export type DragKind = 'move' | 'resize-start' | 'resize-end';

/** New range after dragging by `delta` whole days. A task never gets shorter than one day. */
export function applyDrag(
  span: { start: DayIndex; end: DayIndex }, kind: DragKind, delta: number,
): { start: DayIndex; end: DayIndex } {
  if (kind === 'move') return { start: span.start + delta, end: span.end + delta };
  if (kind === 'resize-start') return { start: Math.min(span.start + delta, span.end), end: span.end };
  return { start: span.start, end: Math.max(span.end + delta, span.start) };
}

/** Inclusive range between the day where a drag began and where the pointer is now. */
export function rangeBetween(a: DayIndex, b: DayIndex): [DayIndex, DayIndex] {
  return a <= b ? [a, b] : [b, a];
}
