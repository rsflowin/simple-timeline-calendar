import type { DayRange } from '../../domain/drag';
import type { Span } from '../../domain/packRows';
import type { TaskSpan } from '../../domain/spans';

/** Month view row geometry: the date number line, then bar lanes. */
export const DATE_HEIGHT = 24;
export const LANE_HEIGHT = 22;
/** Week view: no date line, two-line bars (title + first line of details, CAL-8). */
export const WEEK_TOP = 4;
export const WEEK_LANE_HEIGHT = 44;

/** Lanes that fit in a month row `height` px tall; at least one. */
export const laneFit = (height: number) =>
  Math.max(1, Math.floor((height - DATE_HEIGHT) / LANE_HEIGHT));

/** Lanes to draw: all when they fit (or `fit` is undefined), else one fewer, for `+N more` (CAL-4). */
export const shownLanes = (lanes: number, fit: number | undefined) =>
  fit === undefined || lanes <= fit ? lanes : fit - 1;

/** A task, or the drag-create draft (no task). */
export type CalSpan = TaskSpan | (Span & { task?: undefined });

/**
 * Spans as drawn mid-gesture: the dragged task at its preview range (so it reflows across week
 * rows, CAL-6) plus the drag-create draft (CAL-5). The input itself when there's no gesture.
 */
export function withGesture(
  spans: readonly TaskSpan[],
  preview: (DayRange & { id: string }) | null,
  draft: DayRange | null,
): readonly CalSpan[] {
  if (!preview && !draft) return spans;
  const out: CalSpan[] = spans.map((s) =>
    s.id === preview?.id ? { ...s, start: preview.start, end: preview.end } : s,
  );
  if (draft) out.push({ id: '', ...draft });
  return out;
}

/**
 * Lanes to draw and lanes behind `+N more` (CAL-4). Segments of an active gesture (the draft, the
 * dragged bar) never hide: they're pinned into the last drawn lane (lane 0 if none), so they stay
 * visible and out of the `+N more` counts.
 */
export function splitLanes<T extends { item: CalSpan }>(
  lanes: readonly T[][],
  shown: number,
  active: (s: CalSpan) => boolean,
): { drawn: T[][]; hidden: T[][] } {
  const drawn = lanes.slice(0, shown);
  const rest = lanes.slice(shown);
  const pinned = rest.flatMap((l) => l.filter((s) => active(s.item)));
  if (pinned.length) {
    const slot = Math.max(shown - 1, 0);
    drawn[slot] = [...(drawn[slot] ?? []), ...pinned];
  }
  return { drawn, hidden: rest.map((l) => l.filter((s) => !active(s.item))) };
}
