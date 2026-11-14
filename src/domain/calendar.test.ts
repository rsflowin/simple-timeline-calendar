import { describe, expect, it } from 'vitest';
import { fromDayIndex as f, toDayIndex as d } from './dates';
import { hiddenCounts, monthWeeks, tasksPerDay, weekLanes } from './calendar';
import type { Span } from './packRows';

const s = (id: string, start: number, end: number): Span => ({ id, start, end });

describe('monthWeeks', () => {
  it('returns the Mondays of the weeks covering the month', () => {
    const nov = monthWeeks(2026, 10);
    expect(nov.map(f)).toEqual(
      ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(monthWeeks(2021, 1).map(f)).toEqual(
      ['2021-02-01', '2021-02-08', '2021-02-15', '2021-02-22']);
  });
});

describe('weekLanes', () => {
  it('clips spans to the week and marks real start/end', () => {
    const mon = d('2026-11-09');
    const lanes = weekLanes(
      [s('a', d('2026-11-05'), d('2026-11-10')), s('b', d('2026-11-12'), d('2026-11-20')),
       s('c', d('2026-11-11'), d('2026-11-11')), s('out', d('2026-12-01'), d('2026-12-01'))],
      mon, true);
    expect(lanes.map((l) => l.map((x) => x.id))).toEqual([['a', 'c', 'b']]);
    const [a, , b] = lanes[0];
    expect([f(a.start), f(a.end), a.startsHere, a.endsHere]).toEqual(['2026-11-09', '2026-11-10', false, true]);
    expect([f(b.start), f(b.end), b.startsHere, b.endsHere]).toEqual(['2026-11-12', '2026-11-15', true, false]);
    expect(a.item.id).toBe('a');
  });
});

describe('hiddenCounts', () => {
  it('counts segments per day in lanes that do not fit', () => {
    expect(hiddenCounts([[s('a', 9, 10)], [s('b', 10, 12)]], 1, 9)).toEqual([0, 1, 1, 1, 0, 0, 0]);
  });
});

describe('tasksPerDay', () => {
  it('counts overlapping tasks per day inside [from, to)', () => {
    const counts = tasksPerDay([s('a', 0, 2), s('b', 2, 3)], 0, 3);
    expect([...counts]).toEqual([[0, 1], [1, 1], [2, 2]]);
  });
});
