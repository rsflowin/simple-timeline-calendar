import { fromDayIndex, isValidISODate, toDayIndex, todayISO, type ISODate } from './dates';
import { addTask, createTag, findTagByName, updateTask, type TaskInput } from './doc';
import { newId } from './id';
import { LIMITS, type RoadmapDoc, type Task } from './types';

const UID_SUFFIX = '@timeline-calendar';

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
      `UID:${t.id}${UID_SUFFIX}`,
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

export interface IcsEvent {
  uid: string;
  input: TaskInput & { tagNames: string[] };
}

const DATE_TIME = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/;

/**
 * DATE or DATE-TIME value → calendar date. UTC times become the user's local date; TZID and
 * floating times keep the wall-clock date. `exclusiveEnd` steps back 1 s so an all-day DTEND
 * (or a timed one ending at midnight) lands on the previous day.
 */
function icsDate(value: string, exclusiveEnd: boolean): ISODate | null {
  const m = DATE_TIME.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', utc] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - (exclusiveEnd ? 1000 : 0));
  const iso = utc ? todayISO(date) : date.toISOString().slice(0, 10);
  return isValidISODate(iso) ? iso : null;
}

const unescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c) => (/n/i.test(c) ? '\n' : c));

/**
 * Splits `NAME;PARAM="a:b":value` at the first colon outside quotes. Params are dropped:
 * icsDate tells DATE from DATE-TIME by shape, and TZID times keep their wall-clock date.
 */
function splitProp(line: string): [name: string, value: string] | null {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted)
      return [line.slice(0, i).split(';')[0].toUpperCase(), line.slice(i + 1)];
  }
  return null;
}

/**
 * Reads VEVENTs as all-day date spans. Events without a usable DTSTART are counted in `skipped`.
 * shortcut: RRULE/DURATION are ignored (first occurrence, start day only); expand them if users
 * import recurring events.
 */
export function parseIcs(text: string): { events: IcsEvent[]; skipped: number } {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  if (!lines.some((l) => l.trim().toUpperCase() === 'BEGIN:VCALENDAR'))
    throw new Error('Not an iCalendar file');
  const events: IcsEvent[] = [];
  let skipped = 0;
  const stack: string[] = [];
  let props: Record<string, string[]> = {};
  for (const line of lines) {
    const prop = splitProp(line);
    if (!prop) continue;
    const [name, value] = prop;
    if (name === 'BEGIN') {
      stack.push(value.trim().toUpperCase());
      if (stack.at(-1) === 'VEVENT') props = {};
    } else if (name === 'END') {
      if (stack.pop() !== 'VEVENT') continue;
      const start = props.DTSTART && icsDate(props.DTSTART[0], false);
      if (!start) {
        skipped++;
        continue;
      }
      const end = (props.DTEND && icsDate(props.DTEND[0], true)) || start;
      const title = unescape(props.SUMMARY?.[0] ?? '')
        .trim()
        .slice(0, LIMITS.title);
      const tagNames = (props.CATEGORIES ?? [])
        .flatMap((v) => v.match(/(?:\\.|[^,])+/g) ?? [])
        .map((n) => unescape(n).trim().slice(0, LIMITS.tagName))
        .filter(Boolean);
      events.push({
        uid: (props.UID?.[0] ?? '').trim(),
        input: {
          title: title || '(No title)',
          details: unescape(props.DESCRIPTION?.[0] ?? '').slice(0, LIMITS.details),
          start,
          end: end < start ? start : end,
          tagIds: [],
          tagNames,
        },
      });
    } else if (stack.at(-1) === 'VEVENT') {
      // only direct VEVENT props: a nested VALARM's DESCRIPTION must not overwrite the event's
      (props[name] ??= []).push(value);
    }
  }
  return { events, skipped };
}

/**
 * Merges events into the roadmap: CATEGORIES become tags (matched by name, created if missing);
 * an event whose UID matches a task id (ours carry `@timeline-calendar`) updates that task,
 * others are added. Re-importing the same file therefore updates instead of duplicating.
 */
export function importIcs(
  doc: RoadmapDoc,
  text: string,
): { doc: RoadmapDoc; added: number; updated: number; skipped: number } {
  const parsed = parseIcs(text);
  let { skipped } = parsed;
  let added = 0;
  let updated = 0;
  for (const { uid, input } of parsed.events) {
    const { tagNames, ...task } = input;
    try {
      // work on a copy so a failing event leaves no half-created tags behind
      let next = doc;
      for (const name of tagNames) if (!findTagByName(next, name)) next = createTag(next, name);
      task.tagIds = tagNames.map((n) => findTagByName(next, n)!.id);
      const id = uid.endsWith(UID_SUFFIX) ? uid.slice(0, -UID_SUFFIX.length) : uid;
      if (id && next.tasks.some((t) => t.id === id)) {
        doc = updateTask(next, id, task);
        updated++;
      } else {
        doc = addTask(next, task, id && id.length <= LIMITS.id ? id : newId());
        added++;
      }
    } catch {
      skipped++;
    }
  }
  return { doc, added, updated, skipped };
}
