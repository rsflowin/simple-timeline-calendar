import { describe, expect, it } from 'vitest';
import { dayOf, weekday } from '../../domain/dates';
import {
  centreDay,
  dayAt,
  headerWindow,
  rangeAround,
  scrollLeftFor,
  settle,
  type RangeState,
} from './layout';

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

describe('centreDay / scrollLeftFor', () => {
  it('round-trips', () => {
    expect(centreDay(1000, 16, scrollLeftFor(1234.5, 1000, 16, 800), 800)).toBe(1234.5);
  });

  it('keeps the centre date when the zoom and range change', () => {
    const day = centreDay(dayOf(2026, 0, 1), 16, 4000, 1000);
    const left = scrollLeftFor(day, dayOf(2025, 11, 1), 32, 1000);
    expect(centreDay(dayOf(2025, 11, 1), 32, left, 1000)).toBe(day);
  });
});

describe('settle', () => {
  const [from, to] = rangeAround('week', dayOf(2026, 10, 13));
  const cw = 1000;
  const mid = ((to - from) * 16) / 2;
  const state = (s: Partial<RangeState> = {}): RangeState => ({
    zoom: 'week',
    from,
    to,
    win: headerWindow('week', from, to, mid, cw),
    ...s,
  });

  it('returns the same state when nothing changes', () => {
    const st = state();
    expect(settle(st, mid, cw)).toBe(st);
  });

  it('updates the header window as the view moves', () => {
    const next = settle(state(), mid + 1500, cw);
    expect(next.win).toEqual(headerWindow('week', from, to, mid + 1500, cw));
    expect([next.from, next.to]).toEqual([from, to]);
  });

  it('grows about 6 months on the left near the start, staying on Mondays', () => {
    const next = settle(state(), 500, cw);
    expect(next.to).toBe(to);
    expect(from - next.from).toBeGreaterThanOrEqual(183);
    expect(from - next.from).toBeLessThan(183 + 31 + 7);
    expect(weekday(next.from)).toBe(0);
    expect(next.win[0]).toBeGreaterThanOrEqual(next.from);
  });

  it('grows on the right near the end', () => {
    const next = settle(state(), (to - from) * 16 - 1500, cw);
    expect(next.from).toBe(from);
    expect(next.to - to).toBeGreaterThanOrEqual(183);
    expect(weekday(next.to)).toBe(0);
  });

  it('keeps growing until a whole viewport is free on each side', () => {
    const wide = 5000;
    const next = settle(state(), -20_000, wide);
    expect(-20_000 + (from - next.from) * 16).toBeGreaterThanOrEqual(wide);
    expect(next.to).toBe(to);
  });
});

describe('dayAt', () => {
  it('maps an x offset on the track to the day under it', () => {
    expect(dayAt(1000, 32, 0)).toBe(1000);
    expect(dayAt(1000, 32, 31.9)).toBe(1000);
    expect(dayAt(1000, 32, 32)).toBe(1001);
    expect(dayAt(1000, 32, -1)).toBe(999);
  });
});
