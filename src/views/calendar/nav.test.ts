import { describe, expect, it } from 'vitest';
import { dayOf } from '../../domain/dates';
import { calendarTitle, stepCursor } from './nav';

describe('stepCursor', () => {
  it('moves a week by 7 days', () => {
    expect(stepCursor('week', dayOf(2026, 10, 13), 1)).toBe(dayOf(2026, 10, 20));
    expect(stepCursor('week', dayOf(2026, 10, 13), -1)).toBe(dayOf(2026, 10, 6));
  });

  it('moves a month to the 1st, even from the 31st and across years', () => {
    expect(stepCursor('month', dayOf(2026, 0, 31), 1)).toBe(dayOf(2026, 1, 1));
    expect(stepCursor('month', dayOf(2026, 11, 15), 1)).toBe(dayOf(2027, 0, 1));
    expect(stepCursor('month', dayOf(2026, 0, 15), -1)).toBe(dayOf(2025, 11, 1));
  });

  it('moves a year', () => {
    expect(stepCursor('year', dayOf(2026, 10, 13), 1)).toBe(dayOf(2027, 10, 1));
    expect(stepCursor('year', dayOf(2026, 10, 13), -1)).toBe(dayOf(2025, 10, 1));
  });
});

describe('calendarTitle', () => {
  it('names the month or the year', () => {
    expect(calendarTitle('month', dayOf(2026, 10, 13))).toBe('November 2026');
    expect(calendarTitle('year', dayOf(2026, 10, 13))).toBe('2026');
  });

  it('gives the ISO week and its range', () => {
    expect(calendarTitle('week', dayOf(2026, 10, 13))).toBe('W46 · Nov 9 – 15, 2026');
    expect(calendarTitle('week', dayOf(2026, 11, 1))).toBe('W49 · Nov 30 – Dec 6, 2026');
    expect(calendarTitle('week', dayOf(2027, 0, 2))).toBe('W53 · Dec 28, 2026 – Jan 3, 2027');
  });
});
