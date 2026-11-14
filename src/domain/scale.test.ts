import { describe, expect, it } from 'vitest';
import { fromDayIndex as f, toDayIndex as d } from './dates';
import { headerRows, timelineRange, unitRange } from './scale';

describe('headerRows', () => {
  it('daily: one cell per day, grouped by month', () => {
    const { top, bottom } = headerRows('day', d('2026-01-01'), d('2026-03-01'));
    expect(bottom).toHaveLength(59);
    expect([bottom[0].label, bottom[30].label, bottom[31].label]).toEqual(['1', '31', '1']);
    expect(top.map((c) => [c.label, c.days])).toEqual([['Jan 2026', 31], ['Feb 2026', 28]]);
  });

  it('weekly: ISO week numbers, grouped by the month of each Thursday', () => {
    const { top, bottom } = headerRows('week', d('2025-12-29'), d('2026-03-02'));
    expect(bottom.map((c) => c.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9']);
    expect(top.map((c) => [c.label, c.days])).toEqual([['Jan 2026', 35], ['Feb 2026', 28]]);
  });

  it('monthly: one cell per month, grouped by year', () => {
    const { top, bottom } = headerRows('month', d('2026-01-01'), d('2027-02-01'));
    expect(bottom).toHaveLength(13);
    expect(bottom.map((c) => c.days).slice(0, 2)).toEqual([31, 28]);
    expect(top.map((c) => [c.label, c.days])).toEqual([['2026', 365], ['2027', 31]]);
  });
});

describe('timelineRange', () => {
  it('pads to whole months', () => {
    expect(timelineRange('day', d('2026-01-15'), d('2026-02-10')).map(f))
      .toEqual(['2026-01-01', '2026-03-01']);
  });
  it('weekly range also starts and ends on Mondays', () => {
    expect(timelineRange('week', d('2026-01-15'), d('2026-02-10')).map(f))
      .toEqual(['2025-12-29', '2026-03-02']);
  });
});

describe('unitRange', () => {
  it('returns the column unit containing a day', () => {
    const fri = d('2026-11-13');
    expect(unitRange('day', fri).map(f)).toEqual(['2026-11-13', '2026-11-13']);
    expect(unitRange('week', fri).map(f)).toEqual(['2026-11-09', '2026-11-15']);
    expect(unitRange('month', fri).map(f)).toEqual(['2026-11-01', '2026-11-30']);
  });
});
