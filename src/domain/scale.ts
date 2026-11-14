import {
  type DayIndex,
  dayOf,
  formatMonth,
  formatMonthYear,
  isoWeek,
  monthStart,
  nextMonthStart,
  parts,
  startOfWeek,
} from './dates';

export type Zoom = 'day' | 'week' | 'month';

/** One linear scale for every zoom: x = (day - rangeStart) * PX_PER_DAY[zoom]. */
export const PX_PER_DAY: Record<Zoom, number> = { day: 32, week: 16, month: 4 };

export interface HeaderCell {
  key: string;
  label: string;
  start: DayIndex;
  days: number;
}

interface Unit {
  next(day: DayIndex): DayIndex;
  label(day: DayIndex): string;
  group(day: DayIndex): { key: string; label: string };
}

const byMonth = (first: DayIndex) => ({ key: `m${first}`, label: formatMonthYear(first) });

const UNITS: Record<Zoom, Unit> = {
  day: {
    next: (d) => d + 1,
    label: (d) => String(parts(d).date),
    group: (d) => byMonth(monthStart(d)),
  },
  week: {
    next: (d) => d + 7,
    label: (d) => `W${isoWeek(d).week}`,
    group: (d) => {
      const w = isoWeek(d);
      return byMonth(dayOf(w.year, w.month));
    },
  },
  month: {
    next: nextMonthStart,
    label: formatMonth,
    group: (d) => ({ key: `y${parts(d).year}`, label: String(parts(d).year) }),
  },
};

/** Two header rows for [from, to). `from` must be a unit boundary (use timelineRange). */
export function headerRows(zoom: Zoom, from: DayIndex, to: DayIndex) {
  const unit = UNITS[zoom];
  const top: HeaderCell[] = [];
  const bottom: HeaderCell[] = [];
  for (let day = from; day < to;) {
    const next = unit.next(day);
    bottom.push({ key: String(day), label: unit.label(day), start: day, days: next - day });
    const g = unit.group(day);
    const last = top[top.length - 1];
    if (last?.key === g.key) last.days += next - day;
    else top.push({ ...g, start: day, days: next - day });
    day = next;
  }
  return { top, bottom };
}

/** Half-open range [from, to) covering minDay..maxDay, padded to whole months (and weeks). */
export function timelineRange(
  zoom: Zoom,
  minDay: DayIndex,
  maxDay: DayIndex,
): [DayIndex, DayIndex] {
  const from = monthStart(minDay);
  const to = nextMonthStart(maxDay);
  return zoom === 'week' ? [startOfWeek(from), startOfWeek(to + 6)] : [from, to];
}

/** Inclusive range of the column containing `day` — what a plain click creates (TL-12). */
export function unitRange(zoom: Zoom, day: DayIndex): [DayIndex, DayIndex] {
  if (zoom === 'day') return [day, day];
  if (zoom === 'week') return [startOfWeek(day), startOfWeek(day) + 6];
  return [monthStart(day), nextMonthStart(day) - 1];
}
