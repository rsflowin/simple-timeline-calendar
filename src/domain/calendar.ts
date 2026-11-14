import { type DayIndex, dayOf, startOfWeek } from './dates';
import { packRows, type Span } from './packRows';

/** Mondays of the 4–6 weeks that cover month (0–11) of year. */
export function monthWeeks(year: number, month: number): DayIndex[] {
  const last = dayOf(year, month + 1) - 1;
  const weeks: DayIndex[] = [];
  for (let w = startOfWeek(dayOf(year, month)); w <= last; w += 7) weeks.push(w);
  return weeks;
}

export interface Segment<T> extends Span {
  item: T;
  /** False when the item began in an earlier week (draw a square left edge). */
  startsHere: boolean;
  endsHere: boolean;
}

/** The pieces of `items` that fall in the 7 days from weekStart, packed into lanes. */
export function weekLanes<T extends Span>(
  items: readonly T[], weekStart: DayIndex, pack: boolean,
): Segment<T>[][] {
  const weekEnd = weekStart + 6;
  const segments = items
    .filter((t) => t.start <= weekEnd && t.end >= weekStart)
    .map((t) => ({
      id: t.id,
      item: t,
      start: Math.max(t.start, weekStart),
      end: Math.min(t.end, weekEnd),
      startsHere: t.start >= weekStart,
      endsHere: t.end <= weekEnd,
    }));
  return packRows(segments, pack);
}

/** Per weekday (Mon..Sun), how many segments sit in lanes at index >= shown (for "+N more"). */
export function hiddenCounts(lanes: readonly Span[][], shown: number, weekStart: DayIndex): number[] {
  const counts = Array<number>(7).fill(0);
  for (const lane of lanes.slice(shown))
    for (const seg of lane)
      for (let day = seg.start; day <= seg.end; day++) counts[day - weekStart]++;
  return counts;
}

/** Number of tasks covering each day in [from, to). Days with none are absent. */
export function tasksPerDay(items: readonly Span[], from: DayIndex, to: DayIndex): Map<DayIndex, number> {
  const counts = new Map<DayIndex, number>();
  for (const t of items)
    for (let day = Math.max(t.start, from); day <= Math.min(t.end, to - 1); day++)
      counts.set(day, (counts.get(day) ?? 0) + 1);
  return counts;
}
