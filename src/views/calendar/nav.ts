import {
  dayOf,
  formatMonthDay,
  formatMonthName,
  isoWeek,
  parts,
  startOfWeek,
  type DayIndex,
} from '../../domain/dates';
import type { CalendarMode } from '../../store/prefsStore';

/** The cursor one week / month / year before or after `day`. Months and years land on the 1st. */
export function stepCursor(mode: CalendarMode, day: DayIndex, dir: 1 | -1): DayIndex {
  if (mode === 'week') return day + 7 * dir;
  const { year, month } = parts(day);
  return mode === 'month' ? dayOf(year, month + dir) : dayOf(year + dir, month);
}

/** `November 2026`, `2026`, or `W46 · Nov 9 – 15, 2026`. */
export function calendarTitle(mode: CalendarMode, day: DayIndex): string {
  const { year } = parts(day);
  if (mode === 'year') return String(year);
  if (mode === 'month') return `${formatMonthName(day)} ${year}`;
  const start = startOfWeek(day);
  const a = parts(start);
  const b = parts(start + 6);
  const range =
    a.year !== b.year
      ? `${formatMonthDay(start)}, ${a.year} – ${formatMonthDay(start + 6)}, ${b.year}`
      : `${formatMonthDay(start)} – ${a.month === b.month ? b.date : formatMonthDay(start + 6)}, ${b.year}`;
  return `W${isoWeek(start).week} · ${range}`;
}
