import { describe, expect, it } from 'vitest';
import {
  formatMonthYear,
  formatRange,
  fromDayIndex,
  isoWeek,
  isValidISODate,
  monthStart,
  nextMonthStart,
  startOfWeek,
  toDayIndex as d,
  todayISO,
  weekday,
} from './dates';

describe('dates', () => {
  it('converts between ISODate and DayIndex', () => {
    expect(d('1970-01-01')).toBe(0);
    expect(d('1970-01-02')).toBe(1);
    for (const s of ['2024-02-29', '2026-03-29', '2026-12-31', '1969-12-29']) {
      expect(fromDayIndex(d(s))).toBe(s);
    }
  });

  it('rejects malformed and impossible dates', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-1-5')).toBe(false);
    expect(isValidISODate(20260105)).toBe(false);
    expect(isValidISODate('1899-12-31')).toBe(false);
    expect(isValidISODate('2200-01-01')).toBe(false);
    expect(isValidISODate('1900-01-01')).toBe(true);
    expect(isValidISODate('2199-12-31')).toBe(true);
    expect(() => d('nope')).toThrow('Invalid date');
  });

  it('weekday is Monday-based, also before 1970', () => {
    expect(weekday(d('2026-11-09'))).toBe(0); // Monday
    expect(weekday(d('2026-11-13'))).toBe(4); // Friday
    expect(weekday(d('2026-11-15'))).toBe(6); // Sunday
    expect(weekday(d('1969-12-29'))).toBe(0); // Monday, negative index
    expect(fromDayIndex(startOfWeek(d('2026-11-15')))).toBe('2026-11-09');
  });

  it('ISO week number and month follow the Thursday rule', () => {
    expect(isoWeek(d('2026-01-01'))).toEqual({ week: 1, year: 2026, month: 0 });
    expect(isoWeek(d('2025-12-29'))).toEqual({ week: 1, year: 2026, month: 0 });
    expect(isoWeek(d('2026-02-01'))).toEqual({ week: 5, year: 2026, month: 0 });
    expect(isoWeek(d('2026-02-02'))).toEqual({ week: 6, year: 2026, month: 1 });
    expect(isoWeek(d('2027-01-01'))).toEqual({ week: 53, year: 2026, month: 11 });
    expect(isoWeek(d('2024-12-30'))).toEqual({ week: 1, year: 2025, month: 0 });
  });

  it('month boundaries', () => {
    expect(fromDayIndex(monthStart(d('2026-02-17')))).toBe('2026-02-01');
    expect(fromDayIndex(nextMonthStart(d('2026-12-17')))).toBe('2027-01-01');
  });

  it('todayISO uses the local calendar date', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('formats labels', () => {
    expect(formatMonthYear(d('2026-01-15'))).toBe('Jan 2026');
    expect(formatRange(d('2026-01-03'), d('2026-01-09'))).toBe('Jan 3 – Jan 9');
    expect(formatRange(d('2026-01-03'), d('2026-01-03'))).toBe('Jan 3');
  });
});
