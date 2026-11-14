# Timeline Calendar v1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build v1 of Timeline Calendar as a local web app (dev server or Docker): a horizontal timeline with Day/Week/Month zoom and a Week/Month/Year calendar, for whole-day tagged tasks, with row packing, undo/redo and JSON import/export.

**Architecture:** Pure TypeScript domain layer (`src/domain/`) does all date maths, row packing, header scales and calendar layout on integer day numbers, all unit-tested. A Zustand store holds `{tasks, tags}` with snapshot undo. React views turn domain output into absolutely-positioned elements. Persistence goes through a `StorageAdapter` (localStorage now, Tauri file later).

**Tech Stack:** TypeScript (strict), React, Vite, Zustand, Vitest + Testing Library, Playwright, CSS Modules, nginx (Docker). No date or timeline library.

**Read first:** [`docs/SPEC.md`](../SPEC.md) (requirement IDs like `TL-8`) and [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).

**How detailed each task is:** Domain tasks (1–9) include complete code and tests, because that is where the bugs hide. UI tasks (11–25) list the exact files, the props/behaviour contract, the spec IDs covered and how to check them; markup and CSS are left to the implementer.

**Conventions**
- Run `npm test -- --run` (all unit tests) before every commit.
- One commit per task, message `type(scope): summary` (`feat`, `fix`, `test`, `docs`, `chore`).
- Test files sit next to the code: `foo.ts` → `foo.test.ts`.
- Domain tests run in the `node` environment (the default). Component test files start with `// @vitest-environment jsdom`.

---

## Phase 0 — Project setup

### Task 0: Scaffold, tooling, repository files

**Files:** project root, `src/`, `.github/workflows/ci.yml`, `LICENSE`, `CONTRIBUTING.md`, `.editorconfig`, `.prettierrc`

**Step 1: Initialise git** (the folder already holds `docs/` and `README.md`)

```bash
git init
```

**Step 2: Scaffold Vite into a temporary sibling folder.** Do **not** run create-vite in this folder: if the folder isn't empty it offers to delete everything, including `docs/`.

```bash
cd ..
npm create vite@latest tc-scaffold -- --template react-ts
```

Copy everything from `tc-scaffold/` into `timeline-calendar/` **except** `README.md`, then delete `tc-scaffold/`. Delete the demo files `src/App.css`, `src/assets/`, `public/vite.svg`.

**Step 3: Dependencies**

```bash
npm install zustand
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test prettier
```

**Step 4: Vite + Vitest config** — `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 5: Scripts in `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "vitest",
  "e2e": "playwright test"
}
```

Also add `"engines": { "node": ">=22" }`.

**Step 6: Folders and style tokens.** Create the empty folders from ARCHITECTURE §2. Create `src/styles/tokens.css` with every colour as a custom property (surface, text, muted text, grid line, weekend shade, today line, selection, and the nine tag colours as `--tag-<name>-bg` / `--tag-<name>-fg`). No colour literals anywhere else.

**Step 7: Repository files**
- `LICENSE` — MIT (**confirm the licence with the owner first**).
- `CONTRIBUTING.md` — setup (`npm ci`, `npm run dev`), test commands, folder rules (domain is pure), commit style, "every PR keeps `npm run lint && npm run typecheck && npm test -- --run && npm run build` green".
- `.editorconfig` (2 spaces, LF, UTF-8), `.prettierrc` (`{ "singleQuote": true, "printWidth": 100 }`).
- `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build
```

**Step 8: Verify**

Run: `npm run dev` → blank page at http://localhost:5173 with no console errors.
Run: `npm test -- --run` → "No test files found" (exit code 1 is fine for now; passes from Task 1 on).
Run: `npm run build` → succeeds.

**Step 9: Commit** — `chore: scaffold Vite + React + TS project with tooling and CI`

---

## Phase 1 — Domain (pure, fully tested)

### Task 1: Types, ids and dates

**Files:**
- Create: `src/domain/types.ts`, `src/domain/id.ts`, `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Step 1: `types.ts`**

```ts
import type { ISODate } from './dates';

/** Rotation order for new tags — first tag gets blue, not gray. */
export const TAG_COLORS = [
  'blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  start: ISODate;
  /** Inclusive. */
  end: ISODate;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** The undoable document. */
export interface RoadmapDoc {
  tasks: Task[];
  tags: Tag[];
}

export const FILE_FORMAT = 'timeline-calendar';
export const FILE_VERSION = 1;

export const LIMITS = { title: 200, details: 10_000, tagName: 50, id: 100 } as const;
```

**Step 2: `id.ts`**

```ts
/**
 * crypto.randomUUID only exists in secure contexts. The Docker build opened via a LAN IP
 * (http://192.168.x.x:8080) is not one, so fall back to a random string there.
 */
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
```

**Step 3: Write the failing test** — `src/domain/dates.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  formatMonthYear, formatRange, fromDayIndex, isoWeek, isValidISODate,
  monthStart, nextMonthStart, startOfWeek, toDayIndex as d, todayISO, weekday,
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
  });

  it('formats labels', () => {
    expect(formatMonthYear(d('2026-01-15'))).toBe('Jan 2026');
    expect(formatRange(d('2026-01-03'), d('2026-01-09'))).toBe('Jan 3 – Jan 9');
    expect(formatRange(d('2026-01-03'), d('2026-01-03'))).toBe('Jan 3');
  });
});
```

**Step 4: Run it to make sure it fails**

Run: `npm test -- --run src/domain/dates.test.ts`
Expected: FAIL — `Failed to resolve import "./dates"`.

**Step 5: Implement `dates.ts`**

```ts
/** Calendar date with no time or time zone: 'YYYY-MM-DD'. */
export type ISODate = string;
/** Whole days since 1970-01-01. All layout maths uses this, never Date. */
export type DayIndex = number;

/** Single place to change the UI language later. */
export const LOCALE = 'en';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayIndex(date: ISODate): DayIndex {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY;
}

export function fromDayIndex(day: DayIndex): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** True for real calendar dates only ('2026-02-30' is rejected by the round trip). */
export function isValidISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && ISO_DATE.test(value) && fromDayIndex(toDayIndex(value)) === value;
}

/** Today in the user's local time zone — the only place that reads the clock's zone. */
export function todayISO(now = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Month is 0–11. */
export function parts(day: DayIndex) {
  const d = new Date(day * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() };
}

/** Month may overflow (12 → January next year), like Date.UTC. */
export function dayOf(year: number, month: number, date = 1): DayIndex {
  return Date.UTC(year, month, date) / MS_PER_DAY;
}

export function monthStart(day: DayIndex): DayIndex {
  const p = parts(day);
  return dayOf(p.year, p.month);
}

export function nextMonthStart(day: DayIndex): DayIndex {
  const p = parts(day);
  return dayOf(p.year, p.month + 1);
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday (3). */
export function weekday(day: DayIndex): number {
  return (((day + 3) % 7) + 7) % 7;
}

export function startOfWeek(day: DayIndex): DayIndex {
  return day - weekday(day);
}

/** ISO-8601 week. The week's year and month are those of its Thursday. */
export function isoWeek(day: DayIndex): { week: number; year: number; month: number } {
  const thursday = startOfWeek(day) + 3;
  const { year, month } = parts(thursday);
  return { week: Math.floor((thursday - dayOf(year, 0, 1)) / 7) + 1, year, month };
}

const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...o, timeZone: 'UTC' });
const MONTH = fmt({ month: 'short' });
const MONTH_YEAR = fmt({ month: 'short', year: 'numeric' });
const MONTH_DAY = fmt({ month: 'short', day: 'numeric' });
const WEEKDAY = fmt({ weekday: 'short' });

export const formatMonth = (day: DayIndex) => MONTH.format(day * MS_PER_DAY);
export const formatMonthYear = (day: DayIndex) => MONTH_YEAR.format(day * MS_PER_DAY);
export const formatMonthDay = (day: DayIndex) => MONTH_DAY.format(day * MS_PER_DAY);
export const formatWeekday = (day: DayIndex) => WEEKDAY.format(day * MS_PER_DAY);

export function formatRange(start: DayIndex, end: DayIndex): string {
  return start === end ? formatMonthDay(start) : `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}
```

**Step 6: Run tests** — `npm test -- --run src/domain/dates.test.ts` → PASS (7 tests).

**Step 7: Commit** — `feat(domain): add types, ids and day-index date helpers`

---

### Task 2: Row packing and visible spans (TL-8, TL-9, UI-5)

**Files:**
- Create: `src/domain/packRows.ts`, `src/domain/spans.ts`
- Test: `src/domain/packRows.test.ts`, `src/domain/spans.test.ts`

**Step 1: Failing tests** — `packRows.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { packRows, type Span } from './packRows';

const s = (id: string, start: number, end: number): Span => ({ id, start, end });
const ids = (rows: Span[][]) => rows.map((r) => r.map((x) => x.id));

describe('packRows', () => {
  it('puts non-overlapping spans in one row', () => {
    expect(ids(packRows([s('a', 0, 2), s('b', 3, 5)], true))).toEqual([['a', 'b']]);
  });
  it('treats the inclusive end day as an overlap', () => {
    expect(ids(packRows([s('a', 0, 2), s('b', 2, 4)], true))).toEqual([['a'], ['b']]);
  });
  it('fills the first row that fits', () => {
    const rows = packRows([s('a', 0, 9), s('b', 0, 2), s('c', 3, 5), s('d', 10, 11)], true);
    expect(ids(rows)).toEqual([['a', 'd'], ['b', 'c']]);
  });
  it('sorts by start, longer first on ties', () => {
    const rows = packRows([s('short', 0, 1), s('late', 5, 6), s('long', 0, 8)], true);
    expect(ids(rows)).toEqual([['long'], ['short', 'late']]);
  });
  it('gives every span its own row when packing is off', () => {
    expect(ids(packRows([s('b', 3, 5), s('a', 0, 2)], false))).toEqual([['a'], ['b']]);
  });
  it('handles empty input and does not mutate it', () => {
    const input = [s('b', 3, 5), s('a', 0, 2)];
    packRows(input, true);
    expect(ids([input])).toEqual([['b', 'a']]);
    expect(packRows([], true)).toEqual([]);
  });
});
```

`spans.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { visibleSpans } from './spans';
import { toDayIndex } from './dates';
import type { RoadmapDoc, Task } from './types';

const task = (id: string, start: string, end: string, tagIds: string[] = []): Task =>
  ({ id, title: id, details: '', start, end, tagIds, createdAt: '', updatedAt: '' });

const doc: RoadmapDoc = {
  tags: [{ id: 'x', name: 'X', color: 'blue' }, { id: 'y', name: 'Y', color: 'red' }],
  tasks: [
    task('a', '2026-01-01', '2026-01-03', ['x']),
    task('b', '2026-01-02', '2026-01-02', ['y']),
    task('c', '2026-01-05', '2026-01-06'),
  ],
};
const ids = (f: string[]) => visibleSpans(doc, f).map((s) => s.id);

describe('visibleSpans', () => {
  it('returns every task for an empty filter', () => expect(ids([])).toEqual(['a', 'b', 'c']));
  it('keeps tasks with any selected tag', () => expect(ids(['x', 'y'])).toEqual(['a', 'b']));
  it('ignores filter ids of deleted tags', () => {
    expect(ids(['gone'])).toEqual(['a', 'b', 'c']);
    expect(ids(['x', 'gone'])).toEqual(['a']);
  });
  it('converts dates to day indexes', () => {
    const [a] = visibleSpans(doc, []);
    expect([a.start, a.end]).toEqual([toDayIndex('2026-01-01'), toDayIndex('2026-01-03')]);
  });
});
```

**Step 2: Run** — `npm test -- --run src/domain` → FAIL (modules missing).

**Step 3: Implement** — `packRows.ts`

```ts
import type { DayIndex } from './dates';

/** A day range. `end` is inclusive. */
export interface Span {
  id: string;
  start: DayIndex;
  end: DayIndex;
}

/**
 * Greedy first-fit: each span goes into the first row whose last span ends before it starts.
 * Optimal (fewest rows) for interval sets sorted by start. pack=false → one row per span.
 */
export function packRows<T extends Span>(spans: readonly T[], pack: boolean): T[][] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  if (!pack) return sorted.map((s) => [s]);

  const rows: T[][] = [];
  const rowEnds: DayIndex[] = [];
  for (const span of sorted) {
    const r = rowEnds.findIndex((end) => end < span.start);
    if (r === -1) {
      rows.push([span]);
      rowEnds.push(span.end);
    } else {
      rows[r].push(span);
      rowEnds[r] = span.end;
    }
  }
  return rows;
}
```

`spans.ts`

```ts
import { toDayIndex } from './dates';
import type { Span } from './packRows';
import type { RoadmapDoc, Task } from './types';

export interface TaskSpan extends Span {
  task: Task;
}

/** Tasks passing the tag filter (any selected tag; empty = all), as day spans. */
export function visibleSpans(doc: RoadmapDoc, tagFilter: readonly string[]): TaskSpan[] {
  const known = new Set(doc.tags.map((t) => t.id));
  const wanted = new Set(tagFilter.filter((id) => known.has(id)));
  return doc.tasks
    .filter((t) => wanted.size === 0 || t.tagIds.some((id) => wanted.has(id)))
    .map((t) => ({ id: t.id, start: toDayIndex(t.start), end: toDayIndex(t.end), task: t }));
}
```

**Step 4: Run** — PASS.

**Step 5: Commit** — `feat(domain): add row packing and tag-filtered spans`

---

### Task 3: Timeline scale and headers (TL-2, TL-3, TL-12)

**Files:** Create `src/domain/scale.ts`; Test `src/domain/scale.test.ts`

**Step 1: Failing test**

```ts
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
```

**Step 2: Run** → FAIL.

**Step 3: Implement**

```ts
import {
  type DayIndex, dayOf, formatMonth, formatMonthYear, isoWeek, monthStart,
  nextMonthStart, parts, startOfWeek,
} from './dates';

export type Zoom = 'day' | 'week' | 'month';

/** One linear scale for every zoom: x = (day - rangeStart) * PX_PER_DAY[zoom]. */
export const PX_PER_DAY: Record<Zoom, number> = { day: 32, week: 16, month: 4 };

export interface HeaderCell {
  key: string;
  label: string;
  start: DayIndex;
  days: number;
}

interface Unit {
  next(day: DayIndex): DayIndex;
  label(day: DayIndex): string;
  group(day: DayIndex): { key: string; label: string };
}

const byMonth = (first: DayIndex) => ({ key: `m${first}`, label: formatMonthYear(first) });

const UNITS: Record<Zoom, Unit> = {
  day: {
    next: (d) => d + 1,
    label: (d) => String(parts(d).date),
    group: (d) => byMonth(monthStart(d)),
  },
  week: {
    next: (d) => d + 7,
    label: (d) => `W${isoWeek(d).week}`,
    group: (d) => {
      const w = isoWeek(d);
      return byMonth(dayOf(w.year, w.month));
    },
  },
  month: {
    next: nextMonthStart,
    label: formatMonth,
    group: (d) => ({ key: `y${parts(d).year}`, label: String(parts(d).year) }),
  },
};

/** Two header rows for [from, to). `from` must be a unit boundary (use timelineRange). */
export function headerRows(zoom: Zoom, from: DayIndex, to: DayIndex) {
  const unit = UNITS[zoom];
  const top: HeaderCell[] = [];
  const bottom: HeaderCell[] = [];
  for (let day = from; day < to; ) {
    const next = unit.next(day);
    bottom.push({ key: String(day), label: unit.label(day), start: day, days: next - day });
    const g = unit.group(day);
    const last = top[top.length - 1];
    if (last?.key === g.key) last.days += next - day;
    else top.push({ ...g, start: day, days: next - day });
    day = next;
  }
  return { top, bottom };
}

/** Half-open range [from, to) covering minDay..maxDay, padded to whole months (and weeks). */
export function timelineRange(zoom: Zoom, minDay: DayIndex, maxDay: DayIndex): [DayIndex, DayIndex] {
  const from = monthStart(minDay);
  const to = nextMonthStart(maxDay);
  return zoom === 'week' ? [startOfWeek(from), startOfWeek(to + 6)] : [from, to];
}

/** Inclusive range of the column containing `day` — what a plain click creates (TL-12). */
export function unitRange(zoom: Zoom, day: DayIndex): [DayIndex, DayIndex] {
  if (zoom === 'day') return [day, day];
  if (zoom === 'week') return [startOfWeek(day), startOfWeek(day) + 6];
  return [monthStart(day), nextMonthStart(day) - 1];
}
```

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(domain): add timeline scale, headers and ranges`

---

### Task 4: Calendar layout (CAL-1 … CAL-4, CAL-10)

**Files:** Create `src/domain/calendar.ts`; Test `src/domain/calendar.test.ts`

**Step 1: Failing test**

```ts
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
```

**Step 2: Run** → FAIL.

**Step 3: Implement**

```ts
import { type DayIndex, dayOf, startOfWeek } from './dates';
import { packRows, type Span } from './packRows';

/** Mondays of the 4–6 weeks that cover month (0–11) of year. */
export function monthWeeks(year: number, month: number): DayIndex[] {
  const last = dayOf(year, month + 1) - 1;
  const weeks: DayIndex[] = [];
  for (let w = startOfWeek(dayOf(year, month)); w <= last; w += 7) weeks.push(w);
  return weeks;
}

export interface Segment<T> extends Span {
  item: T;
  /** False when the item began in an earlier week (draw a square left edge). */
  startsHere: boolean;
  endsHere: boolean;
}

/** The pieces of `items` that fall in the 7 days from weekStart, packed into lanes. */
export function weekLanes<T extends Span>(
  items: readonly T[], weekStart: DayIndex, pack: boolean,
): Segment<T>[][] {
  const weekEnd = weekStart + 6;
  const segments = items
    .filter((t) => t.start <= weekEnd && t.end >= weekStart)
    .map((t) => ({
      id: t.id,
      item: t,
      start: Math.max(t.start, weekStart),
      end: Math.min(t.end, weekEnd),
      startsHere: t.start >= weekStart,
      endsHere: t.end <= weekEnd,
    }));
  return packRows(segments, pack);
}

/** Per weekday (Mon..Sun), how many segments sit in lanes at index >= shown (for "+N more"). */
export function hiddenCounts(lanes: readonly Span[][], shown: number, weekStart: DayIndex): number[] {
  const counts = Array<number>(7).fill(0);
  for (const lane of lanes.slice(shown))
    for (const seg of lane)
      for (let day = seg.start; day <= seg.end; day++) counts[day - weekStart]++;
  return counts;
}

/** Number of tasks covering each day in [from, to). Days with none are absent. */
export function tasksPerDay(items: readonly Span[], from: DayIndex, to: DayIndex): Map<DayIndex, number> {
  const counts = new Map<DayIndex, number>();
  for (const t of items)
    for (let day = Math.max(t.start, from); day <= Math.min(t.end, to - 1); day++)
      counts.set(day, (counts.get(day) ?? 0) + 1);
  return counts;
}
```

Note: `tasksPerDay` returns entries in insertion order; the test spans are inserted in day order so the assertion holds.

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(domain): add calendar month grid, week lanes and day counts`

---

### Task 5: Drag maths (TL-13, TL-14, CAL-6)

**Files:** Create `src/domain/drag.ts`; Test `src/domain/drag.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { applyDrag, rangeBetween } from './drag';

const span = { start: 10, end: 12 };

describe('applyDrag', () => {
  it('moves both ends', () => expect(applyDrag(span, 'move', 3)).toEqual({ start: 13, end: 15 }));
  it('resizes start, never past end', () => {
    expect(applyDrag(span, 'resize-start', -2)).toEqual({ start: 8, end: 12 });
    expect(applyDrag(span, 'resize-start', 5)).toEqual({ start: 12, end: 12 });
  });
  it('resizes end, never before start', () => {
    expect(applyDrag(span, 'resize-end', 4)).toEqual({ start: 10, end: 16 });
    expect(applyDrag(span, 'resize-end', -5)).toEqual({ start: 10, end: 10 });
  });
});

describe('rangeBetween', () => {
  it('orders the two days', () => {
    expect(rangeBetween(5, 2)).toEqual([2, 5]);
    expect(rangeBetween(2, 5)).toEqual([2, 5]);
  });
});
```

**Step 2: Run** → FAIL. **Step 3: Implement**

```ts
import type { DayIndex } from './dates';

export type DragKind = 'move' | 'resize-start' | 'resize-end';

/** New range after dragging by `delta` whole days. A task never gets shorter than one day. */
export function applyDrag(
  span: { start: DayIndex; end: DayIndex }, kind: DragKind, delta: number,
): { start: DayIndex; end: DayIndex } {
  if (kind === 'move') return { start: span.start + delta, end: span.end + delta };
  if (kind === 'resize-start') return { start: Math.min(span.start + delta, span.end), end: span.end };
  return { start: span.start, end: Math.max(span.end + delta, span.start) };
}

/** Inclusive range between the day where a drag began and where the pointer is now. */
export function rangeBetween(a: DayIndex, b: DayIndex): [DayIndex, DayIndex] {
  return a <= b ? [a, b] : [b, a];
}
```

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(domain): add drag range maths`

---

### Task 6: Undo history (UR-1 … UR-3)

**Files:** Create `src/domain/history.ts`; Test `src/domain/history.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, initHistory, pushHistory, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = pushHistory(pushHistory(initHistory(0), 1), 2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
  });
  it('a new change clears redo', () => {
    const h = pushHistory(undo(pushHistory(initHistory(0), 1)), 5);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });
  it('ignores a no-op push and an undo with no past', () => {
    const h = initHistory({ a: 1 });
    expect(pushHistory(h, h.present)).toBe(h);
    expect(undo(h)).toBe(h);
  });
  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = pushHistory(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
  });
});
```

**Step 2: Run** → FAIL. **Step 3: Implement**

```ts
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 100;

export const initHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function pushHistory<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}
```

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(domain): add snapshot undo history`

---

### Task 7: Document operations (tasks and tags)

**Files:** Create `src/domain/doc.ts`; Test `src/domain/doc.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { addTask, createTag, deleteTag, deleteTask, EMPTY_DOC, updateTag, updateTask } from './doc';

const input = { title: '  Design  ', details: '', start: '2026-01-05', end: '2026-01-09', tagIds: [] };
const T0 = '2026-11-13T00:00:00.000Z';
const T1 = '2026-11-14T00:00:00.000Z';

describe('tasks', () => {
  it('adds a trimmed task with id and timestamps', () => {
    const doc = addTask(EMPTY_DOC, input, 't1', T0);
    expect(doc.tasks[0]).toMatchObject({ id: 't1', title: 'Design', createdAt: T0, updatedAt: T0 });
    expect(EMPTY_DOC.tasks).toHaveLength(0);
  });
  it('rejects a blank title and end before start', () => {
    expect(() => addTask(EMPTY_DOC, { ...input, title: ' ' })).toThrow('title');
    expect(() => addTask(EMPTY_DOC, { ...input, end: '2026-01-04' })).toThrow('before start');
  });
  it('updates and deletes', () => {
    let doc = addTask(EMPTY_DOC, input, 't1', T0);
    doc = updateTask(doc, 't1', { end: '2026-01-12' }, T1);
    expect(doc.tasks[0]).toMatchObject({ end: '2026-01-12', updatedAt: T1, createdAt: T0 });
    expect(deleteTask(doc, 't1').tasks).toHaveLength(0);
  });
});

describe('tags', () => {
  it('creates tags with rotating colours and rejects duplicates (any case)', () => {
    let doc = createTag(EMPTY_DOC, 'Backend', 'g1');
    doc = createTag(doc, 'Frontend', 'g2');
    expect(doc.tags.map((t) => t.color)).toEqual(['blue', 'green']);
    expect(() => createTag(doc, ' backend ')).toThrow('already exists');
  });
  it('renames, but not onto another tag name', () => {
    let doc = createTag(createTag(EMPTY_DOC, 'A', 'g1'), 'B', 'g2');
    doc = updateTag(doc, 'g1', { name: 'a', color: 'red' });
    expect(doc.tags[0]).toMatchObject({ name: 'a', color: 'red' });
    expect(() => updateTag(doc, 'g1', { name: 'b' })).toThrow('already exists');
  });
  it('deleting a tag removes it from tasks', () => {
    let doc = createTag(EMPTY_DOC, 'A', 'g1');
    doc = addTask(doc, { ...input, tagIds: ['g1'] }, 't1', T0);
    doc = deleteTag(doc, 'g1');
    expect(doc.tags).toHaveLength(0);
    expect(doc.tasks[0].tagIds).toEqual([]);
  });
});
```

**Step 2: Run** → FAIL. **Step 3: Implement**

```ts
import { isValidISODate } from './dates';
import { newId } from './id';
import { LIMITS, TAG_COLORS, type RoadmapDoc, type Tag, type Task } from './types';

export type TaskInput = Pick<Task, 'title' | 'details' | 'start' | 'end' | 'tagIds'>;

export const EMPTY_DOC: RoadmapDoc = { tasks: [], tags: [] };

function checked<T extends TaskInput>(t: T): T {
  const title = t.title.trim();
  if (!title) throw new Error('Task title is required');
  if (title.length > LIMITS.title) throw new Error(`Task title is longer than ${LIMITS.title} characters`);
  if (!isValidISODate(t.start) || !isValidISODate(t.end)) throw new Error('Task dates must be YYYY-MM-DD');
  if (t.end < t.start) throw new Error('End date is before start date');
  return { ...t, title, details: t.details.slice(0, LIMITS.details) };
}

export function addTask(doc: RoadmapDoc, input: TaskInput, id = newId(), now = new Date().toISOString()): RoadmapDoc {
  const task: Task = checked({ ...input, id, createdAt: now, updatedAt: now });
  return { ...doc, tasks: [...doc.tasks, task] };
}

export function updateTask(doc: RoadmapDoc, id: string, patch: Partial<TaskInput>, now = new Date().toISOString()): RoadmapDoc {
  return { ...doc, tasks: doc.tasks.map((t) => (t.id === id ? checked({ ...t, ...patch, updatedAt: now }) : t)) };
}

export function deleteTask(doc: RoadmapDoc, id: string): RoadmapDoc {
  return { ...doc, tasks: doc.tasks.filter((t) => t.id !== id) };
}

export function findTagByName(doc: RoadmapDoc, name: string): Tag | undefined {
  const n = name.trim().toLowerCase();
  return doc.tags.find((t) => t.name.toLowerCase() === n);
}

function checkTagName(doc: RoadmapDoc, name: string, selfId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name is required');
  if (trimmed.length > LIMITS.tagName) throw new Error(`Tag name is longer than ${LIMITS.tagName} characters`);
  const clash = findTagByName(doc, trimmed);
  if (clash && clash.id !== selfId) throw new Error(`Tag "${trimmed}" already exists`);
  return trimmed;
}

/** Caller passes the id so it can select the new tag right away. */
export function createTag(doc: RoadmapDoc, name: string, id = newId()): RoadmapDoc {
  const color = TAG_COLORS[doc.tags.length % TAG_COLORS.length];
  return { ...doc, tags: [...doc.tags, { id, name: checkTagName(doc, name), color }] };
}

export function updateTag(doc: RoadmapDoc, id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>): RoadmapDoc {
  const name = patch.name === undefined ? undefined : checkTagName(doc, patch.name, id);
  return {
    ...doc,
    tags: doc.tags.map((t) => (t.id === id ? { ...t, ...patch, ...(name && { name }) } : t)),
  };
}

export function deleteTag(doc: RoadmapDoc, id: string): RoadmapDoc {
  return {
    tags: doc.tags.filter((t) => t.id !== id),
    tasks: doc.tasks.map((t) => (t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t)),
  };
}
```

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(domain): add task and tag document operations`

---

### Task 8: File format validation (DATA-2, DATA-4) — trust boundary

**Files:** Create `src/domain/schema.ts`; Test `src/domain/schema.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { parseRoadmap, serializeRoadmap } from './schema';
import type { RoadmapDoc } from './types';

const doc: RoadmapDoc = {
  tags: [{ id: 'g1', name: 'Backend', color: 'blue' }],
  tasks: [{ id: 't1', title: 'API', details: 'x', start: '2026-01-05', end: '2026-01-09',
            tagIds: ['g1'], createdAt: 'c', updatedAt: 'u' }],
};
const file = (patch: object) => JSON.stringify({ ...JSON.parse(serializeRoadmap(doc)), ...patch });
const withTask = (patch: object) => file({ tasks: [{ ...doc.tasks[0], ...patch }] });

describe('parseRoadmap', () => {
  it('round-trips', () => expect(parseRoadmap(serializeRoadmap(doc))).toEqual(doc));
  it('rejects non-JSON and foreign files', () => {
    expect(() => parseRoadmap('{')).toThrow('not valid JSON');
    expect(() => parseRoadmap('{"tasks":[]}')).toThrow('Not a Timeline Calendar file');
    expect(() => parseRoadmap(file({ version: 99 }))).toThrow('version 99');
  });
  it('names the bad field', () => {
    expect(() => parseRoadmap(withTask({ end: '2026-01-01' }))).toThrow('tasks[0].end is before start');
    expect(() => parseRoadmap(withTask({ start: '2026-02-30' }))).toThrow('tasks[0].start');
    expect(() => parseRoadmap(withTask({ title: '  ' }))).toThrow('tasks[0].title is empty');
    expect(() => parseRoadmap(file({ tags: [{ id: 'g', name: 'A', color: 'teal' }] }))).toThrow('tags[0].color');
  });
  it('drops unknown tag ids and fills optional fields', () => {
    const parsed = parseRoadmap(withTask({ tagIds: ['g1', 'nope'], details: undefined }));
    expect(parsed.tasks[0].tagIds).toEqual(['g1']);
    expect(parsed.tasks[0].details).toBe('');
  });
  it('rejects duplicate ids', () => {
    expect(() => parseRoadmap(file({ tasks: [doc.tasks[0], doc.tasks[0]] }))).toThrow('duplicate');
  });
});
```

**Step 2: Run** → FAIL. **Step 3: Implement**

```ts
import { isValidISODate } from './dates';
import { FILE_FORMAT, FILE_VERSION, LIMITS, TAG_COLORS, type RoadmapDoc, type Tag, type TagColor, type Task } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, problem: string): never {
  throw new Error(`${path} ${problem}`);
}

function text(o: Obj, key: string, path: string, max: number, required = true): string {
  const v = o[key];
  if (v === undefined && !required) return '';
  if (typeof v !== 'string') fail(`${path}.${key}`, 'must be text');
  if (v.length > max) fail(`${path}.${key}`, `is longer than ${max} characters`);
  if (required && !v.trim()) fail(`${path}.${key}`, 'is empty');
  return required ? v.trim() : v;
}

function list(o: Obj, key: string): unknown[] {
  const v = o[key];
  if (!Array.isArray(v)) fail(key, 'must be a list');
  return v;
}

function unique(items: { id: string }[], path: string) {
  if (new Set(items.map((i) => i.id)).size !== items.length) fail(path, 'contain duplicate ids');
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON');
  }
}

/** Validates untrusted JSON (import or storage). Throws an Error naming the first bad field. */
export function parseRoadmap(json: string): RoadmapDoc {
  const raw = parseJson(json);
  if (!isObj(raw) || raw.format !== FILE_FORMAT) throw new Error('Not a Timeline Calendar file');
  if (raw.version !== FILE_VERSION) throw new Error(`Unsupported file version ${String(raw.version)}`);

  const tags: Tag[] = list(raw, 'tags').map((t, i) => {
    const p = `tags[${i}]`;
    if (!isObj(t)) fail(p, 'must be an object');
    if (!TAG_COLORS.includes(t.color as TagColor)) fail(`${p}.color`, `must be one of ${TAG_COLORS.join(', ')}`);
    return { id: text(t, 'id', p, LIMITS.id), name: text(t, 'name', p, LIMITS.tagName), color: t.color as TagColor };
  });
  unique(tags, 'tags');
  const tagIds = new Set(tags.map((t) => t.id));

  const tasks: Task[] = list(raw, 'tasks').map((t, i) => {
    const p = `tasks[${i}]`;
    if (!isObj(t)) fail(p, 'must be an object');
    const { start, end } = t;
    if (!isValidISODate(start)) fail(`${p}.start`, 'must be a date like 2026-01-31');
    if (!isValidISODate(end)) fail(`${p}.end`, 'must be a date like 2026-01-31');
    if (end < start) fail(`${p}.end`, 'is before start');
    const now = new Date().toISOString();
    return {
      id: text(t, 'id', p, LIMITS.id),
      title: text(t, 'title', p, LIMITS.title),
      details: text(t, 'details', p, LIMITS.details, false),
      start,
      end,
      tagIds: Array.isArray(t.tagIds)
        ? t.tagIds.filter((id): id is string => typeof id === 'string' && tagIds.has(id))
        : [],
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : now,
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : now,
    };
  });
  unique(tasks, 'tasks');

  return { tasks, tags };
}

export function serializeRoadmap(doc: RoadmapDoc): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, tasks: doc.tasks, tags: doc.tags }, null, 2);
}
```

**Step 4: Run** → PASS. Then run the whole suite: `npm test -- --run` → all domain tests PASS.

**Step 5: Commit** — `feat(domain): validate and serialise roadmap files`

---

## Phase 2 — State and storage

### Task 9: Stores

**Files:**
- Create: `src/store/roadmapStore.ts`, `src/store/prefsStore.ts`
- Test: `src/store/roadmapStore.test.ts`

**Step 1: Failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { addTask, EMPTY_DOC } from '../domain/doc';
import { useRoadmap } from './roadmapStore';

const input = { title: 'A', details: '', start: '2026-01-05', end: '2026-01-06', tagIds: [] };
const tasks = () => useRoadmap.getState().history.present.tasks;

describe('roadmapStore', () => {
  beforeEach(() => useRoadmap.getState().reset(EMPTY_DOC));

  it('commits, undoes and redoes', () => {
    useRoadmap.getState().commit((d) => addTask(d, input));
    expect(tasks()).toHaveLength(1);
    useRoadmap.getState().undo();
    expect(tasks()).toHaveLength(0);
    useRoadmap.getState().redo();
    expect(tasks()).toHaveLength(1);
  });

  it('a failed commit changes nothing', () => {
    const before = useRoadmap.getState().history;
    expect(() => useRoadmap.getState().commit((d) => addTask(d, { ...input, title: '' }))).toThrow();
    expect(useRoadmap.getState().history).toBe(before);
  });
});
```

**Step 2: Run** → FAIL. **Step 3: Implement** `roadmapStore.ts`

```ts
import { create } from 'zustand';
import { EMPTY_DOC } from '../domain/doc';
import { initHistory, pushHistory, redo, undo, type History } from '../domain/history';
import type { RoadmapDoc } from '../domain/types';

interface RoadmapState {
  history: History<RoadmapDoc>;
  /** One call = one undo step. Throws (and changes nothing) if `update` throws. */
  commit(update: (doc: RoadmapDoc) => RoadmapDoc): void;
  /** Replace without history — for loading at startup. Import uses commit instead. */
  reset(doc: RoadmapDoc): void;
  undo(): void;
  redo(): void;
}

export const useRoadmap = create<RoadmapState>()((set, get) => ({
  history: initHistory(EMPTY_DOC),
  commit: (update) => {
    const h = get().history;
    set({ history: pushHistory(h, update(h.present)) });
  },
  reset: (doc) => set({ history: initHistory(doc) }),
  undo: () => set((s) => ({ history: undo(s.history) })),
  redo: () => set((s) => ({ history: redo(s.history) })),
}));

export const useDoc = () => useRoadmap((s) => s.history.present);
```

`prefsStore.ts` (DATA-6, TL-10, UR-2):

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, type ISODate } from '../domain/dates';
import type { Zoom } from '../domain/scale';

export type ViewMode = 'timeline' | 'calendar';
export type CalendarMode = 'week' | 'month' | 'year';

interface Prefs {
  view: ViewMode;
  zoom: Zoom;
  calendarMode: CalendarMode;
  /** Date the calendar is showing. Not persisted: the app opens on today. */
  cursor: ISODate;
  packRows: boolean;
  tagFilter: string[];
  set(patch: Partial<Omit<Prefs, 'set'>>): void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      view: 'timeline', zoom: 'week', calendarMode: 'month', cursor: todayISO(),
      packRows: true, tagFilter: [],
      set: (patch) => set(patch),
    }),
    {
      name: 'timeline-calendar:prefs',
      partialize: ({ view, zoom, calendarMode, packRows, tagFilter }) =>
        ({ view, zoom, calendarMode, packRows, tagFilter }),
    },
  ),
);
```

**Step 4: Run** → PASS. **Step 5: Commit** — `feat(store): add roadmap store with undo and persisted view prefs`

---

### Task 10: Storage adapter, autosave, startup (DATA-1, DATA-5)

**Files:**
- Create: `src/storage/StorageAdapter.ts`, `src/storage/localStorageAdapter.ts`, `src/storage/autosave.ts`, `src/storage/boot.ts`, `src/storage/fileTransfer.ts`
- Test: `src/storage/autosave.test.ts`, `src/storage/boot.test.ts`

**Step 1: Interface and adapter**

```ts
// StorageAdapter.ts
export interface StorageAdapter {
  /** Raw saved JSON, or null when nothing has been saved yet. */
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
  /** Keep unreadable data somewhere safe before it gets overwritten. */
  backup(json: string): Promise<void>;
}
```

```ts
// localStorageAdapter.ts
import type { StorageAdapter } from './StorageAdapter';

const KEY = 'timeline-calendar:roadmap';

export function localStorageAdapter(storage: Storage = localStorage): StorageAdapter {
  return {
    load: async () => storage.getItem(KEY),
    save: async (json) => storage.setItem(KEY, json),
    backup: async (json) => storage.setItem(`${KEY}:backup:${new Date().toISOString()}`, json),
  };
}
```

**Step 2: Failing tests**

`autosave.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTask, EMPTY_DOC } from '../domain/doc';
import { parseRoadmap } from '../domain/schema';
import { useRoadmap } from '../store/roadmapStore';
import { startAutosave } from './autosave';

const input = { title: 'A', details: '', start: '2026-01-05', end: '2026-01-06', tagIds: [] };

describe('autosave', () => {
  beforeEach(() => { vi.useFakeTimers(); useRoadmap.getState().reset(EMPTY_DOC); });
  afterEach(() => vi.useRealTimers());

  it('saves once, 300 ms after the last change', async () => {
    const save = vi.fn<(json: string) => Promise<void>>(async () => {});
    const stop = startAutosave({ load: async () => null, save, backup: async () => {} }, () => {});
    useRoadmap.getState().commit((d) => addTask(d, input));
    useRoadmap.getState().commit((d) => addTask(d, input));
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);
    expect(parseRoadmap(save.mock.calls[0][0]).tasks).toHaveLength(2);
    stop();
  });

  it('reports save errors', async () => {
    const onError = vi.fn();
    const stop = startAutosave(
      { load: async () => null, save: async () => { throw new Error('quota'); }, backup: async () => {} },
      onError);
    useRoadmap.getState().commit((d) => addTask(d, input));
    await vi.advanceTimersByTimeAsync(300);
    expect(onError).toHaveBeenCalled();
    stop();
  });
});
```

`boot.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { serializeRoadmap } from '../domain/schema';
import { loadRoadmap } from './boot';

const adapter = (raw: string | null) => ({ load: async () => raw, save: vi.fn(), backup: vi.fn(async () => {}) });

describe('loadRoadmap', () => {
  it('returns an empty doc when nothing is saved', async () => {
    expect(await loadRoadmap(adapter(null))).toEqual({ doc: { tasks: [], tags: [] }, error: null });
  });
  it('loads a valid doc', async () => {
    const doc = { tasks: [], tags: [{ id: 'g', name: 'A', color: 'blue' as const }] };
    expect((await loadRoadmap(adapter(serializeRoadmap(doc)))).doc).toEqual(doc);
  });
  it('backs up unreadable data instead of discarding it', async () => {
    const a = adapter('{broken');
    const result = await loadRoadmap(a);
    expect(a.backup).toHaveBeenCalledWith('{broken');
    expect(result.doc).toEqual({ tasks: [], tags: [] });
    expect(result.error).toMatch('not valid JSON');
  });
});
```

**Step 3: Run** → FAIL. **Step 4: Implement**

```ts
// autosave.ts
import { serializeRoadmap } from '../domain/schema';
import { useRoadmap } from '../store/roadmapStore';
import type { StorageAdapter } from './StorageAdapter';

/** Saves the document 300 ms after the last change, and immediately when the page is hidden. */
export function startAutosave(adapter: StorageAdapter, onError: (e: unknown) => void, delay = 300) {
  let doc = useRoadmap.getState().history.present;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    adapter.save(serializeRoadmap(doc)).catch(onError);
  };
  const unsubscribe = useRoadmap.subscribe((s) => {
    if (s.history.present === doc) return;
    doc = s.history.present;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });
  const onHide = () => { if (timer !== undefined) flush(); };
  globalThis.addEventListener?.('pagehide', onHide);
  globalThis.document?.addEventListener('visibilitychange', onHide);

  return () => {
    unsubscribe();
    clearTimeout(timer);
    globalThis.removeEventListener?.('pagehide', onHide);
    globalThis.document?.removeEventListener('visibilitychange', onHide);
  };
}
```

Note: adapters must be `async` functions (as in `localStorageAdapter`), so a thrown quota error becomes a rejection that `.catch(onError)` sees.

```ts
// boot.ts
import { EMPTY_DOC } from '../domain/doc';
import { parseRoadmap } from '../domain/schema';
import type { RoadmapDoc } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

/** Never throws: unreadable data is backed up and the app starts empty with an error to show. */
export async function loadRoadmap(adapter: StorageAdapter): Promise<{ doc: RoadmapDoc; error: string | null }> {
  const raw = await adapter.load();
  if (raw === null) return { doc: EMPTY_DOC, error: null };
  try {
    return { doc: parseRoadmap(raw), error: null };
  } catch (e) {
    await adapter.backup(raw);
    return { doc: EMPTY_DOC, error: e instanceof Error ? e.message : String(e) };
  }
}
```

```ts
// fileTransfer.ts — browser-only helpers, exercised by the E2E test in Task 24
export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Resolves with the file's text, or null if the user cancels. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => (input.files?.[0] ? input.files[0].text().then(resolve) : resolve(null));
    input.oncancel = () => resolve(null);
    input.click();
  });
}
```

**Step 5: Wire up `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useRoadmap } from './store/roadmapStore';
import { loadRoadmap } from './storage/boot';
import { startAutosave } from './storage/autosave';
import { localStorageAdapter } from './storage/localStorageAdapter';
import { useStatus } from './store/statusStore';
import './styles/tokens.css';
import './styles/global.css';

const adapter = localStorageAdapter(); // Phase 9: pick the Tauri adapter here

const { doc, error } = await loadRoadmap(adapter);
useRoadmap.getState().reset(doc);
if (error) useStatus.getState().show(`Saved data couldn't be read (${error}). A backup was kept; starting empty.`);
startAutosave(adapter, () => useStatus.getState().show("Couldn't save. Export your roadmap to keep a copy."));

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

Add `src/store/statusStore.ts`: `{ message: string | null; show(msg): void; clear(): void }` (a tiny Zustand store; the banner in Task 11 reads it). Top-level `await` needs `build.target: 'es2022'` in `vite.config.ts` if the build complains.

**Step 6: Run** → `npm test -- --run` PASS; `npm run dev` → no console errors; in DevTools, `localStorage` is still empty (nothing changed yet).

**Step 7: Commit** — `feat(storage): autosave to localStorage with safe startup load`

---

## Phase 3 — Shell and shared components

### Task 11: App shell, toolbar, status banner, shortcuts (UI-1 … UI-7, §6 keys)

**Files:** Create `src/App.tsx`, `src/App.module.css`, `src/components/Toolbar/Toolbar.tsx` (+ `.module.css`), `src/components/StatusBanner.tsx`, `src/hooks/useShortcuts.ts`, `src/styles/global.css`; Test `src/hooks/useShortcuts.test.tsx`

Contract:
- `App` = `Toolbar` on top, `StatusBanner` under it, then `TimelineView` or `CalendarView` by `usePrefs().view`, filling the rest of the window. Until Tasks 15/18 exist, render placeholders.
- `Toolbar` reads/writes `usePrefs`; Undo/Redo buttons are disabled when `past`/`future` are empty; `+ New task` opens the Task dialog (wired in Task 13). Menu items Export / Import / Manage tags are wired in Tasks 22–23.
- `useShortcuts(map: Record<string, () => void>)` — keys like `'n'`, `'t'`, `'1'`, `'mod+z'`, `'mod+shift+z'`, `'mod+y'`, `'delete'`, `'backspace'`, `'escape'`. `mod` = Ctrl, or ⌘ on macOS. Ignores events whose target is an `input`, `textarea`, `select` or `[contenteditable]`, except `escape`.

Test (`// @vitest-environment jsdom`): dispatching `keydown` `n` on `document` calls the handler; the same key inside an `<input>` doesn't; `ctrl+z` maps to `mod+z`.

Verify: `npm run dev` — toolbar renders, view switch and zoom buttons change and survive reload (prefs persisted), Undo is disabled.

Commit — `feat(ui): add app shell, toolbar and keyboard shortcuts`

### Task 12: TagChip and TagInput (TAG-1 … TAG-4)

**Files:** Create `src/components/TagChip.tsx`, `src/components/TagInput/TagInput.tsx` (+ css); Test `src/components/TagInput/TagInput.test.tsx`

Contract:
```ts
interface TagInputProps {
  value: string[];                 // selected tag ids
  onChange(ids: string[]): void;
}
```
- Reads tags from `useDoc()`. Creating a tag: `const id = newId(); commit(d => createTag(d, text, id)); onChange([...value, id])`.
- Dropdown is an ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, options `role="option"`).
- Already-selected tags are not offered again.

Tests (Testing Library + user-event): typing filters; Enter selects the highlighted tag; typing a new name shows `Create "x"` and Enter creates + selects it (store has the tag); Backspace on empty input removes the last chip; × removes a chip.

Commit — `feat(ui): add Notion-style tag input`

### Task 13: Task dialog (TD-1 … TD-5)

**Files:** Create `src/components/TaskDialog/TaskDialog.tsx` (+ css), `src/store/uiStore.ts`; Test `TaskDialog.test.tsx`

`uiStore` (not persisted, not undoable):
```ts
type Editing = { mode: 'new'; draft: TaskInput } | { mode: 'edit'; id: string } | null;
interface UiState {
  editing: Editing; selectedId: string | null;
  quickCreate: { start: ISODate; end: ISODate; anchor: DOMRect } | null;
  openNew(draft?: Partial<TaskInput>): void; openEdit(id: string): void; close(): void;
  select(id: string | null): void;
  openQuickCreate(qc: UiState['quickCreate']): void; closeQuickCreate(): void;
}
```

Dialog contract:
- Native `<dialog>` opened with `showModal()` when `editing` is set; `close` event → `uiStore.close()`.
- Form state is local; Save calls `commit(d => addTask(d, form))` or `commit(d => updateTask(d, id, form))`, then closes. Delete calls `commit(d => deleteTask(d, id))`.
- TD-3: changing Start to after End sets End = Start; End before Start disables Save and shows the message.
- Ctrl/⌘+Enter saves. Title is focused on open.

Tests: new task saves to the store; blank title disables Save; end-before-start message; editing prefills and updates; Delete removes it and `undo()` restores it.

Commit — `feat(ui): add task dialog`

### Task 14: Quick-create popover (QC-1 … QC-4)

**Files:** Create `src/components/Popover.tsx`, `src/components/QuickCreate.tsx`; Test `QuickCreate.test.tsx`

- `Popover`: positioned `fixed` next to an anchor `DOMRect`, flipped to stay inside the window; closes on outside pointerdown and Esc; `role="dialog"`.
- `QuickCreate` renders when `uiStore.quickCreate` is set: range text (`formatRange`), focused title input. Enter → `addTask` (if not blank) and close. `More options` → `openNew({ title, start, end })` and close quick-create.

Tests: Enter creates the task with the right dates; Esc creates nothing; More options opens the dialog prefilled.

Commit — `feat(ui): add quick-create popover`

---

## Phase 4 — Timeline view

### Task 15: Static timeline (TL-1 … TL-4, TL-7, TL-8, TL-9)

**Files:** Create `src/views/timeline/TimelineView.tsx`, `TimelineHeader.tsx`, `TaskBar.tsx`, `timeline.module.css`, `src/views/taskColor.ts`

Rendering (inside one horizontally scrolling element):
```tsx
const px = PX_PER_DAY[zoom];
const spans = useMemo(() => visibleSpans(doc, tagFilter), [doc, tagFilter]);
const rows = useMemo(() => packRows(spans, packRows), [spans, packRows]);
const { top, bottom } = useMemo(() => headerRows(zoom, from, to), [zoom, from, to]);
// content width = (to - from) * px; header is position: sticky; top: 0
// bar: left = (s.start - from) * px, width = (s.end - s.start + 1) * px, top = rowIndex * ROW_HEIGHT
```
- Constants: `ROW_HEIGHT = 32`, bar height 24, header rows 24 px each. The grid area is at least the viewport's height so there's empty space to drag in.
- Grid lines: one absolutely-positioned 1 px line per bottom header cell. Weekend shading only in `day` zoom. Today line at `(today - from) * px + px / 2`.
- `TaskBar` is a `<button>` with `aria-label="${title}, ${formatRange(start, end)}"`, `title` tooltip, ellipsis text, background from `taskColor(task, tags)` = CSS variables for the first tag's colour.
- For now, `[from, to]` = `timelineRange(zoom, today − 183, today + 365)`. Do **not** stretch the range to cover every task: dates go from 1900 to 2199, so one far-off task would make the track millions of pixels wide. Bars are clipped to `[from, to)`.
- Header cells and grid lines: call `headerRows` only for the visible window ± one viewport width (aligned with `timelineRange(zoom, …)`), not for the whole range. Bars: render only spans that overlap the rendered range.

Verify manually: seed tasks with the dev console (`useRoadmap` can be exposed on `window` in dev only) — overlapping tasks stack, toggling Pack rows switches to one per row, all three zooms show the header from SPEC §3.1 (2026 weekly: Feb starts at W6).

Commit — `feat(timeline): render header, grid, today line and packed bars`

### Task 16: Timeline scrolling and zoom (TL-1, TL-5, TL-6)

**Files:** Create `src/views/timeline/useTimelineRange.ts`; Modify `TimelineView.tsx`

Behaviour:
- Keep `[from, to]` in state. On scroll, if `scrollLeft < clientWidth`, extend: `from' = timelineRange(zoom, from − 183, from)[0]`; after render (`useLayoutEffect`) add `(from − from') * px` to `scrollLeft` so the view doesn't jump. Same on the right edge with `to' = timelineRange(zoom, to, to + 183)[1]` (no scroll adjustment needed).
- Never shrink while mounted. `scrollToDay(day)` outside the range re-centres the range on that day (`timelineRange(zoom, day − 183, day + 365)`) instead of stretching it, so jumping far away never builds a huge track.
- On zoom change: before it, read the centre day `from + (scrollLeft + clientWidth / 2) / oldPx`; after re-render, set `scrollLeft = (centreDay − from) * newPx − clientWidth / 2`. Recompute `[from, to]` with `timelineRange` for the new zoom (week alignment).
- Expose `scrollToDay(day)`; `Today` button and `T` key call it with today. On first mount, centre today.

Verify manually: scroll far left/right without hitting an end, no jump when the range grows; zoom keeps the centred date; Today works.

Commit — `feat(timeline): endless horizontal scroll, zoom anchoring and Today`

### Task 17: Timeline gestures (TL-11 … TL-17)

**Files:** Create `src/hooks/pointerDrag.ts`; Modify `TimelineView.tsx`, `TaskBar.tsx`

`pointerDrag.ts`:

```ts
export interface DragCallbacks {
  onMove(dx: number, dy: number, e: PointerEvent): void;
  /** moved=false means it was a click (pointer moved less than the threshold). */
  onEnd(dx: number, dy: number, e: PointerEvent, moved: boolean): void;
  onCancel(): void;
}

export function startPointerDrag(e: React.PointerEvent, cb: DragCallbacks, threshold = 4) {
  if (e.button !== 0) return;
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < threshold) return;
    moved = true;
    cb.onMove(dx, dy, ev);
  };
  const up = (ev: PointerEvent) => { stop(); cb.onEnd(ev.clientX - x0, ev.clientY - y0, ev, moved); };
  const cancel = () => { stop(); cb.onCancel(); };
  const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cancel(); };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
}
```

Timeline wiring:
- `dayAt(clientX) = from + Math.floor((clientX − content.getBoundingClientRect().left) / px)` (the content element's rect already includes the scroll offset).
- Empty grid `pointerdown` → `d0 = dayAt(x)`; on move, draft = `rangeBetween(d0, dayAt(ev.clientX))`, drawn as a dashed bar; on end: range = `moved ? draft : unitRange(zoom, d0)` → `openQuickCreate({ start, end, anchor })`.
- Bar `pointerdown`: target is the left handle → `'resize-start'`, right handle → `'resize-end'`, else `'move'`. On move: `preview = applyDrag(span, kind, Math.round(dx / px))`; the bar keeps its row during the drag and shows a date tooltip (TL-16). On end: `moved ? commit(updateTask(…fromDayIndex(preview)…)) : (select(id), openEdit(id))`. On cancel: clear preview.
- Call `e.preventDefault()` on pointerdown to stop text selection.
- When quick-create closes, return focus to the timeline scroller (or the new bar), not `<body>` (NF-4).
- Every key handler must ignore IME composition: `if (e.isComposing || e.keyCode === 229) return;` (same rule as the existing components).

> `shortcut:` no auto-scroll when dragging past the viewport edge. To move a task far, zoom out or use the dialog. Add auto-scroll if users ask.

Verify manually against TL-11 … TL-17 in all three zooms; each move/resize is a single Undo.

Commit — `feat(timeline): drag to create, move and resize tasks`

---

## Phase 5 — Calendar view

### Task 18: Calendar shell and Month view (CAL-1 … CAL-4)

**Files:** Create `src/views/calendar/CalendarView.tsx`, `CalendarNav.tsx`, `MonthView.tsx`, `WeekRow.tsx`, `calendar.module.css`

- `CalendarView` renders `CalendarNav` + `WeekView`/`MonthView`/`YearView` from `calendarMode`. Nav moves `cursor` by ±7 days / ±1 month / ±1 year (`dayOf(y, m ± 1, 1)` for months). Title: `November 2026`, `2026`, or `W46 · Nov 9 – 15, 2026`.
- `MonthView`: `monthWeeks(year, month)` → one `WeekRow` per Monday. Weekday header Mon…Sun (`formatWeekday`).
- `WeekRow` props: `{ weekStart, spans, maxLanes?: number, dimOutside?: { year; month } }`. Computes `weekLanes(spans, weekStart, packRows)`. Each day cell has `data-day={dayIndex}`. Segment: `left = (seg.start − weekStart) / 7 * 100%`, `width = (seg.end − seg.start + 1) / 7 * 100%`, rounded corners only where `startsHere` / `endsHere`.
- `+N more` (CAL-4): measure a row's height with `ResizeObserver` → `fit = floor((rowHeight − 24) / 22)`. If `lanes.length > fit`, show `fit − 1` lanes and `hiddenCounts(lanes, fit − 1, weekStart)` per day as `+N more` buttons opening a `Popover` listing that day's tasks (click → `openEdit`).

Verify manually: November 2026 shows 6 rows starting Oct 26; a task Nov 5–20 shows as three pieces with square inner ends; shrink the window to see `+N more`.

Commit — `feat(calendar): add month view with week-split bars and overflow`

### Task 19: Calendar gestures (CAL-5, CAL-6)

**Files:** Modify `WeekRow.tsx`, `MonthView.tsx`; Create `src/views/calendar/dayAtPoint.ts`

- `dayAtPoint(x, y)`: `document.elementsFromPoint(x, y)` → first element with `data-day` → `Number(dataset.day)`, else `null`. (`elementsFromPoint` sees through the bar under the pointer.)
- Empty cell drag → draft range across days/rows via `rangeBetween`; drawn by passing a synthetic draft span into the rows. Click → 1-day quick-create (CAL-5).
- Bar drag: `delta = dayAtPoint(now) − dayAtPoint(start)`; preview by substituting the dragged task's `{start, end}` into `spans` before `weekLanes`, so the preview reflows across weeks. Resize handles only on real ends (`startsHere`/`endsHere`). Release commits once.

Verify manually: drag-create spanning two week rows; move a task across a week boundary; Esc cancels.

Commit — `feat(calendar): drag to create, move and resize in month view`

### Task 20: Week view (CAL-7, CAL-8)

**Files:** Create `src/views/calendar/WeekView.tsx`

- One `WeekRow` for `startOfWeek(cursor)` with no `maxLanes`, taller cells, date header per column (`Mon 9`), first line of `details` under each title. Scrolls vertically if needed. Gestures come from `WeekRow` (Task 19).

Commit — `feat(calendar): add week view`

### Task 21: Year view (CAL-9 … CAL-12)

**Files:** Create `src/views/calendar/YearView.tsx`, `MiniMonth.tsx`

- 12 `MiniMonth`s in a responsive grid (4×3 wide, 2×6 narrow). Counts from `tasksPerDay(spans, dayOf(y,0,1), dayOf(y+1,0,1))` computed once for the year.
- Shade class by count: 1 / 2 / 3+. Day button `aria-label="Nov 13, 2 tasks"`.
- Day click → `Popover` listing tasks covering that day (click → `openEdit`) + `+ Add task` → quick-create for that day. Month name click → `set({ calendarMode: 'month', cursor })`.

Commit — `feat(calendar): add year view`

---

## Phase 6 — Tags, data and quality

### Task 22: Tag filter and tag manager (UI-5, TAG-5)

**Files:** Create `src/components/TagFilter.tsx`, `src/components/TagManager.tsx`; Tests for both

- `TagFilter`: toolbar button showing `Tags (2)`; popover with a checkbox per tag + `Clear`. Writes `usePrefs.tagFilter`.
- `TagManager`: dialog listing tags with rename input (commit on blur/Enter via `updateTag`, show the error from a duplicate name inline), colour swatches (`updateTag`), Delete (`deleteTag`, undoable).

Tests: filter hides tasks without selected tags (render `TimelineView` with a seeded store, assert bar labels); renaming to an existing name shows the error; deleting a tag then `undo()` restores it on its tasks.

Commit — `feat(tags): add tag filter and tag manager`

### Task 23: Export / Import UI (DATA-3, DATA-4, DATA-5)

**Files:** Modify `Toolbar.tsx`, `StatusBanner.tsx`

- Export: `downloadText(serializeRoadmap(doc), \`roadmap-${todayISO()}.json\`)`.
- Import: `pickTextFile()` → `parseRoadmap` → `commit(() => parsed)` (one undo step). On error show the message in the banner; nothing changes.
- Banner from Task 10 for unreadable saved data gets a `Download backup` button (keep the raw text in `statusStore` alongside the message).

Verify manually: export, delete a task, import the file → task back; Undo → deleted again; import a broken file → banner names the field.

Commit — `feat(data): export and import roadmap JSON`

### Task 24: End-to-end tests (Playwright)

**Files:** Create `playwright.config.ts`, `e2e/timeline.spec.ts`, `e2e/calendar.spec.ts`

`playwright.config.ts` starts `npm run dev` as `webServer` on port 5173, Chromium only for now. Install browsers once: `npx playwright install chromium`.

Scenarios:
1. Timeline, Day zoom: drag across 3 day cells → quick-create → type title + Enter → bar with that title exists with `aria-label` containing the 3-day range.
2. Drag that bar 2 days right → label shows the shifted range → `Ctrl+Z` → original range.
3. Pack rows: two non-overlapping tasks share a row (same `top`); toggle off → different `top`.
4. Calendar Month: click a day → quick-create → task appears in that cell; drag it to the next week → appears there.
5. Export downloads a file whose JSON contains the task (`page.waitForEvent('download')`).
6. Reload the page → tasks still there (autosave).

Run: `npm run e2e` → all pass.

Commit — `test(e2e): cover create, move, undo, packing and persistence`

### Task 25: Accessibility and keyboard pass (NF-4)

**Files:** various

Checklist:
- Every bar is a focusable button with the `aria-label` from Task 15; Enter opens the dialog; Delete deletes the selected/focused task.
- Toolbar toggle buttons use `aria-pressed`; view/zoom groups have `role="group"` + `aria-label`.
- Visible focus ring everywhere (`:focus-visible`), colours from tokens with ≥ 4.5:1 text contrast on bars (check each tag colour pair).
- Run axe in the browser (or `@axe-core/playwright` in one E2E test) on Timeline and Calendar Month: no serious violations.

Commit — `fix(a11y): keyboard and screen-reader pass`

---

## Phase 7 — Docker and documentation

### Task 26: Docker

**Files:** Create `Dockerfile`, `.dockerignore`, `docker-compose.yml`

```dockerfile
# Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the static build
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`.dockerignore`:

```
node_modules
dist
.git
e2e
test-results
playwright-report
```

`docker-compose.yml`:

```yaml
services:
  timeline-calendar:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

Verify: `docker compose up --build` → http://localhost:8080 works; create a task, reload, still there.

Commit — `chore: add Docker image and compose file`

### Task 27: Documentation and v0.1.0

**Files:** Modify `README.md`; Create `CHANGELOG.md`, `docs/images/` screenshots

- README: what it is + screenshot, features, quick start (dev, Docker), where data is stored and the per-address warning (SPEC §7 note), keyboard shortcuts, roadmap (vertical timeline, desktop app, image export, themes, multiple roadmaps), links to SPEC / ARCHITECTURE / CONTRIBUTING, licence.
- Update SPEC/ARCHITECTURE wherever the implementation differs.
- `CHANGELOG.md` (Keep a Changelog format) with `0.1.0`.
- `npm version 0.1.0 --no-git-tag-version`, commit, tag `v0.1.0`.

Commit — `docs: README, changelog and screenshots for 0.1.0`

---

## Later phases (not in v1)

| Phase | Outline |
|---|---|
| 9 — Desktop (Tauri) | ARCHITECTURE §6. New `tauriFileAdapter.ts` implementing `StorageAdapter`; adapter choice in `main.tsx`; `npm run tauri build` in CI for Windows/macOS/Linux |
| 10 — Vertical timeline | Reuse `scale.ts`, `packRows`, `drag.ts`; new renderer that maps day → `top` instead of `left` and rows → columns; `dayAt(clientY)` |
| 11 — Export image | Render the visible view to PNG (e.g. `html-to-image`) |
| 12 — Themes | Dark theme = second set of values in `tokens.css` under `[data-theme="dark"]` |
| 13 — Multiple roadmaps | Storage key per roadmap id + roadmap switcher; Tauri: File → Open |

## Known limitations accepted for v1

- No auto-scroll while dragging near the edge (Task 17).
- No virtualisation of timeline cells (Task 15).
- English labels only; `LOCALE` is one constant in `dates.ts`.
- Browser storage is per browser and per address; users must Export to back up.
