import { describe, expect, it } from 'vitest';
import { dayOf, weekday } from '../../domain/dates';
import { headerWindow, rangeAround } from './layout';

describe('rangeAround', () => {
  it('spans about 6 months back and 12 ahead, padded to whole months', () => {
    expect(rangeAround('month', dayOf(2026, 10, 13))).toEqual([
      dayOf(2026, 4, 1),
      dayOf(2027, 11, 1),
    ]);
  });

  it('starts on a Monday in week zoom', () => {
    expect(weekday(rangeAround('week', dayOf(2026, 10, 13))[0])).toBe(0);
  });
});

describe('headerWindow', () => {
  const from = dayOf(2026, 0, 1);
  const to = dayOf(2027, 0, 1);

  it('covers the viewport plus one viewport width each side, in whole months', () => {
    // viewport shows days 100..110 (Apr 11 – Apr 21); ±10 days → Apr 1 … May 1
    expect(headerWindow('day', from, to, 3200, 320)).toEqual([
      dayOf(2026, 3, 1),
      dayOf(2026, 5, 1),
    ]);
  });

  it('is clamped to the rendered range', () => {
    expect(headerWindow('day', from, to, 0, 320)).toEqual([from, dayOf(2026, 1, 1)]);
    expect(headerWindow('day', from, to, 365 * 32 - 320, 320)).toEqual([dayOf(2026, 11, 1), to]);
  });

  it('starts on a unit boundary in week zoom', () => {
    const [weekFrom, weekTo] = rangeAround('week', dayOf(2026, 10, 13));
    const [a] = headerWindow('week', weekFrom, weekTo, 5000, 800);
    expect(weekday(a)).toBe(0);
    expect(a).toBeGreaterThan(weekFrom);
  });
});
