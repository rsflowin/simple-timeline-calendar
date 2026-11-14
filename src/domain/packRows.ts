import type { DayIndex } from './dates';

/** A day range. `end` is inclusive. */
export interface Span {
  id: string;
  start: DayIndex;
  end: DayIndex;
}

/**
 * Greedy first-fit: each span goes into the first row whose last span ends before it starts.
 * Optimal (fewest rows) for interval sets sorted by start. pack=false → one row per span.
 */
export function packRows<T extends Span>(spans: readonly T[], pack: boolean): T[][] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  if (!pack) return sorted.map((s) => [s]);

  const rows: T[][] = [];
  const rowEnds: DayIndex[] = [];
  for (const span of sorted) {
    const r = rowEnds.findIndex((end) => end < span.start);
    if (r === -1) {
      rows.push([span]);
      rowEnds.push(span.end);
    } else {
      rows[r].push(span);
      rowEnds[r] = span.end;
    }
  }
  return rows;
}
