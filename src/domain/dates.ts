/** Calendar date with no time or time zone: 'YYYY-MM-DD'. */
export type ISODate = string;
/** Whole days since 1970-01-01. All layout maths uses this, never Date. */
export type DayIndex = number;

/** Single place to change the UI language later. */
export const LOCALE = 'en';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayIndex(date: ISODate): DayIndex {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY;
}

export function fromDayIndex(day: DayIndex): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** True for real calendar dates only ('2026-02-30' is rejected by the round trip). */
export function isValidISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && ISO_DATE.test(value) && fromDayIndex(toDayIndex(value)) === value;
}

/** Today in the user's local time zone — the only place that reads the clock's zone. */
export function todayISO(now = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Month is 0–11. */
export function parts(day: DayIndex) {
  const d = new Date(day * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() };
}

/** Month may overflow (12 → January next year), like Date.UTC. */
export function dayOf(year: number, month: number, date = 1): DayIndex {
  return Date.UTC(year, month, date) / MS_PER_DAY;
}

export function monthStart(day: DayIndex): DayIndex {
  const p = parts(day);
  return dayOf(p.year, p.month);
}

export function nextMonthStart(day: DayIndex): DayIndex {
  const p = parts(day);
  return dayOf(p.year, p.month + 1);
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday (3). */
export function weekday(day: DayIndex): number {
  return (((day + 3) % 7) + 7) % 7;
}

export function startOfWeek(day: DayIndex): DayIndex {
  return day - weekday(day);
}

/** ISO-8601 week. The week's year and month are those of its Thursday. */
export function isoWeek(day: DayIndex): { week: number; year: number; month: number } {
  const thursday = startOfWeek(day) + 3;
  const { year, month } = parts(thursday);
  return { week: Math.floor((thursday - dayOf(year, 0, 1)) / 7) + 1, year, month };
}

const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...o, timeZone: 'UTC' });
const MONTH = fmt({ month: 'short' });
const MONTH_YEAR = fmt({ month: 'short', year: 'numeric' });
const MONTH_DAY = fmt({ month: 'short', day: 'numeric' });
const WEEKDAY = fmt({ weekday: 'short' });

export const formatMonth = (day: DayIndex) => MONTH.format(day * MS_PER_DAY);
export const formatMonthYear = (day: DayIndex) => MONTH_YEAR.format(day * MS_PER_DAY);
export const formatMonthDay = (day: DayIndex) => MONTH_DAY.format(day * MS_PER_DAY);
export const formatWeekday = (day: DayIndex) => WEEKDAY.format(day * MS_PER_DAY);

export function formatRange(start: DayIndex, end: DayIndex): string {
  return start === end ? formatMonthDay(start) : `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}
