import { describe, expect, it } from 'vitest';
import { fold, selectTasks, toIcs } from './ics';
import type { RoadmapDoc, Task } from './types';

const task = (id: string, start: string, end: string, tagIds: string[] = [], extra = {}): Task => ({
  id,
  title: id,
  details: '',
  start,
  end,
  tagIds,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

const doc: RoadmapDoc = {
  tags: [
    { id: 'a', name: 'Alpha', color: 'blue' },
    { id: 'b', name: 'Be;ta', color: 'red' },
  ],
  tasks: [
    task('jan', '2026-01-05', '2026-01-09', ['a']),
    task('feb', '2026-01-30', '2026-02-03', ['b']),
    task('dec', '2026-12-31', '2026-12-31', ['a', 'b']),
    task('none', '2026-03-01', '2026-03-02'),
  ],
};

const ids = (o: Parameters<typeof selectTasks>[1]) => selectTasks(doc, o).map((t) => t.id);

describe('selectTasks', () => {
  it('returns everything with no range and no tags', () => {
    expect(ids({ tagIds: [] })).toEqual(['jan', 'feb', 'dec', 'none']);
  });

  it('keeps tasks overlapping the range, bounds inclusive', () => {
    expect(ids({ from: '2026-01-09', to: '2026-01-30', tagIds: [] })).toEqual(['jan', 'feb']);
    expect(ids({ from: '2026-02-04', tagIds: [] })).toEqual(['dec', 'none']);
    expect(ids({ to: '2026-01-29', tagIds: [] })).toEqual(['jan']);
  });

  it('keeps tasks having any selected tag', () => {
    expect(ids({ tagIds: ['b'] })).toEqual(['feb', 'dec']);
    expect(ids({ tagIds: ['a', 'b'] })).toEqual(['jan', 'feb', 'dec']);
  });
});

describe('toIcs', () => {
  const now = new Date('2026-11-18T09:08:07.123Z');

  it('writes all-day events with exclusive DTEND across month and year ends', () => {
    const ics = toIcs(doc, { tagIds: ['b'] }, now);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260130\r\nDTEND;VALUE=DATE:20260204\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('DTSTAMP:20261118T090807Z');
    expect(ics).toContain('UID:dec@timeline-calendar');
    expect(ics).toContain('CATEGORIES:Alpha,Be\\;ta');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('escapes text and omits empty fields', () => {
    const d: RoadmapDoc = {
      tags: [],
      tasks: [
        task('x', '2026-01-01', '2026-01-01', [], { title: 'a,b;c\\d', details: 'l1\r\nl2' }),
      ],
    };
    const ics = toIcs(d, { tagIds: [] }, now);
    expect(ics).toContain('SUMMARY:a\\,b\\;c\\\\d\r\n');
    expect(ics).toContain('DESCRIPTION:l1\\nl2\r\n');
    expect(ics).not.toContain('CATEGORIES');
  });
});

describe('fold', () => {
  it('keeps every line within 75 octets without splitting characters', () => {
    const line = `SUMMARY:${'한글일정🎉'.repeat(20)}`;
    const folded = fold(line);
    const enc = new TextEncoder();
    for (const l of folded.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(fold('SUMMARY:hi')).toBe('SUMMARY:hi');
  });
});
