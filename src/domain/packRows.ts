import type { DayIndex } from './dates';

/** A day range. `end` is inclusive. */
export interface Span {
  id: string;
  start: DayIndex;
  end: DayIndex;
}

export type TagRowMode = 'dedicated' | 'compact';

export interface PackOptions<T extends Span> {
  /** Tag order (`doc.tags` ids); unknown or missing tags go into the untagged group at the end. */
  tagOrder?: readonly string[];
  /** Primary tag id for a span, or undefined when untagged. */
  tagOf?: (span: T) => string | undefined;
  /** How different tag groups share rows when `pack` is true. Defaults to `'dedicated'`. */
  mode?: TagRowMode;
}

const byStart = <T extends Span>(a: T, b: T) => a.start - b.start || b.end - a.end;

/** Greedy first-fit: each span goes into the first row whose last span ends before it starts. */
function packByDate<T extends Span>(spans: readonly T[]): T[][] {
  const sorted = [...spans].sort(byStart);
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

/** True when two sorted, internally non-overlapping span arrays have no overlapping days. */
function canFitInRow(row: readonly Span[], track: readonly Span[]): boolean {
  let i = 0;
  let j = 0;
  while (i < row.length && j < track.length) {
    if (row[i].end < track[j].start) i++;
    else if (track[j].end < row[i].start) j++;
    else return false;
  }
  return true;
}

/**
 * Packs spans into rows. With `pack=false`, returns one row per span sorted by start.
 * With `pack=true` and `options.tagOf`, groups spans by tag in `tagOrder` (untagged last) so
 * non-overlapping same-tag spans share a line; `'dedicated'` keeps tags on separate rows while
 * `'compact'` merges compatible whole tracks across tags.
 */
export function packRows<T extends Span>(
  spans: readonly T[],
  pack: boolean,
  options?: PackOptions<T>,
): T[][] {
  if (!pack) return [...spans].sort(byStart).map((s) => [s]);
  if (!options?.tagOf) return packByDate(spans);

  const rankOf = new Map<string, number>();
  options.tagOrder?.forEach((id, i) => {
    if (!rankOf.has(id)) rankOf.set(id, i);
  });
  const untaggedRank = rankOf.size;

  const groups = new Map<number, T[]>();
  for (const span of spans) {
    const tagId = options.tagOf(span);
    const rank = tagId !== undefined && rankOf.has(tagId) ? rankOf.get(tagId)! : untaggedRank;
    let bucket = groups.get(rank);
    if (!bucket) {
      bucket = [];
      groups.set(rank, bucket);
    }
    bucket.push(span);
  }

  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const mode = options.mode ?? 'dedicated';
  const rows: T[][] = [];
  for (const rank of ranks) {
    const tracks = packByDate(groups.get(rank)!);
    if (mode === 'dedicated') {
      rows.push(...tracks);
      continue;
    }
    for (const track of tracks) {
      const r = rows.findIndex((row) => canFitInRow(row, track));
      if (r === -1) rows.push(track);
      else rows[r] = [...rows[r], ...track].sort(byStart);
    }
  }
  return rows;
}
