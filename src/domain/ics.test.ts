import { describe, expect, it } from 'vitest';
import { EMPTY_DOC } from './doc';
import { fold, importIcs, selectTasks, toIcs } from './ics';
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

describe('importIcs', () => {
  const pick = (d: RoadmapDoc) =>
    d.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      details: t.details,
      start: t.start,
      end: t.end,
      tags: t.tagIds.map((id) => d.tags.find((g) => g.id === id)!.name),
    }));

  it('round-trips our own export into an empty roadmap', () => {
    const src: RoadmapDoc = {
      ...doc,
      tasks: [
        ...doc.tasks,
        task('k', '2026-05-01', '2026-05-03', ['b'], {
          title: '한글 일정, 긴 제목; '.repeat(8).trim(),
          details: 'a\\b\nc',
        }),
      ],
    };
    const r = importIcs(EMPTY_DOC, toIcs(src, { tagIds: [] }));
    expect(r).toMatchObject({ added: 5, updated: 0, skipped: 0 });
    expect(pick(r.doc)).toEqual(pick(src));
  });

  it('updates tasks with a matching UID instead of duplicating', () => {
    const ics = toIcs(doc, { tagIds: ['a'] });
    const edited: RoadmapDoc = {
      ...doc,
      tasks: doc.tasks.map((t) => (t.id === 'jan' ? { ...t, end: '2026-01-20' } : t)),
    };
    const r = importIcs(edited, ics);
    expect(r).toMatchObject({ added: 0, updated: 2 });
    expect(r.doc.tasks).toHaveLength(4);
    expect(r.doc.tasks[0].end).toBe('2026-01-09');
    expect(r.doc.tags).toHaveLength(2);
  });

  it('reads Google-style events: folding, times, alarms, categories', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:abc@google.com',
      'DTSTART;TZID="Asia/Seoul":20260105T233000',
      'DTEND;TZID="Asia/Seoul":20260106T010000',
      'SUMMARY:Late call wi',
      ' th a folded title',
      'DESCRIPTION:Agenda',
      'CATEGORIES:alpha,Work\\, Home',
      'BEGIN:VALARM',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20260210T120000Z',
      'DTEND;VALUE=DATE:20260210',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:No start',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const r = importIcs(doc, ics);
    expect(r).toMatchObject({ added: 2, updated: 0, skipped: 1 });
    const [call, untitled] = r.doc.tasks.slice(4);
    expect(call).toMatchObject({
      id: 'abc@google.com',
      title: 'Late call with a folded title',
      details: 'Agenda',
      start: '2026-01-05',
      end: '2026-01-06',
    });
    // 'alpha' reuses the existing 'Alpha' tag; 'Work, Home' is created
    expect(call.tagIds[0]).toBe('a');
    expect(r.doc.tags.map((t) => t.name)).toEqual(['Alpha', 'Be;ta', 'Work, Home']);
    // DTEND before DTSTART is clamped to the start day
    expect(untitled).toMatchObject({ title: '(No title)', start: '2026-02-10', end: '2026-02-10' });
  });

  it('rejects files that are not iCalendar', () => {
    expect(() => importIcs(doc, '{"format":"timeline-calendar"}')).toThrow('Not an iCalendar file');
  });
});
