import { fromDayIndex, toDayIndex, type ISODate } from './dates';
import type { RoadmapDoc, Task } from './types';

export interface IcsOptions {
  /** Inclusive; undefined = no lower bound. */
  from?: ISODate;
  /** Inclusive; undefined = no upper bound. */
  to?: ISODate;
  /** Empty = every task; otherwise tasks having any of these tags. */
  tagIds: string[];
}

/** Tasks overlapping [from, to] that match the tag rule. ISO dates compare correctly as strings. */
export function selectTasks(doc: RoadmapDoc, { from, to, tagIds }: IcsOptions): Task[] {
  return doc.tasks.filter(
    (t) =>
      (!to || t.start <= to) &&
      (!from || t.end >= from) &&
      (tagIds.length === 0 || t.tagIds.some((id) => tagIds.includes(id))),
  );
}

const date = (d: ISODate) => d.replaceAll('-', '');

const escape = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[\\;,]/g, (c) => `\\${c}`)
    .replace(/\n/g, '\\n');

/** RFC 5545 §3.1: lines over 75 octets continue on the next line after CRLF + space. */
export function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    // continuation lines start with a space, so they hold 74 octets of content
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** All-day iCalendar events, one per selected task, ready for Google Calendar import. */
export function toIcs(doc: RoadmapDoc, opts: IcsOptions, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const tagName = new Map(doc.tags.map((t) => [t.id, t.name]));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//timeline-calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const t of selectTasks(doc, opts)) {
    const tags = t.tagIds.flatMap((id) => tagName.get(id) ?? []);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@timeline-calendar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date(t.start)}`,
      // iCalendar DTEND is exclusive; Task.end is inclusive
      `DTEND;VALUE=DATE:${date(fromDayIndex(toDayIndex(t.end) + 1))}`,
      `SUMMARY:${escape(t.title)}`,
    );
    if (t.details) lines.push(`DESCRIPTION:${escape(t.details)}`);
    if (tags.length) lines.push(`CATEGORIES:${tags.map(escape).join(',')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
