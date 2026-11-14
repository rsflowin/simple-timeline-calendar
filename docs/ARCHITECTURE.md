# Architecture

How the code is organised and why. Read [SPEC.md](SPEC.md) for *what* the app
does.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Contributors get types for the data model and layout math |
| UI | React + Vite | Fast dev server; Tauri's recommended frontend setup |
| State | Zustand | One small store with undo; no boilerplate |
| Dates | Own ~80-line module + `Intl.DateTimeFormat` | We only need whole days, ISO weeks and month names. A date library would add dependencies without removing much code |
| Styling | CSS Modules + CSS custom properties (`src/styles/tokens.css`) | No build plugin; themes later = swap variables |
| Dialogs | Native `<dialog>` | Focus trap, Esc and backdrop for free; accessible |
| Tests | Vitest + Testing Library; Playwright for end-to-end gestures | Vitest shares Vite config |
| Serve | Vite dev server; nginx in Docker for the built app | |
| Desktop (later) | Tauri 2 | Small installer, uses the OS WebView |

Exact versions are whatever is current stable when the project is scaffolded;
`package-lock.json` pins them.

## 2. Layers

```
src/
├─ domain/        Pure TypeScript. No React, no DOM, no storage.
│  ├─ types.ts        Task, Tag, TagColor, RoadmapDoc
│  ├─ dates.ts        ISODate ⇄ DayIndex, weekday, ISO week, month helpers
│  ├─ packRows.ts     Row packing (TL-8/TL-9, CAL-3)
│  ├─ scale.ts        Zoom levels, px per day, timeline header cells, range
│  ├─ calendar.ts     Month grid, per-week bar segments, tasks-per-day counts
│  ├─ drag.ts         Pure result of a move / resize / create gesture
│  ├─ history.ts      Undo / redo stack
│  └─ schema.ts       Validate + migrate a roadmap file (trust boundary)
├─ store/
│  ├─ roadmapStore.ts Tasks + tags + history; every mutation is one undo step
│  └─ prefsStore.ts   View preferences (not undoable)
├─ storage/
│  ├─ StorageAdapter.ts      interface { load(), save() }
│  ├─ localStorageAdapter.ts v1 implementation
│  ├─ autosave.ts            store → adapter, debounced
│  └─ fileTransfer.ts        Export (download) / Import (file picker)
├─ components/    Shared UI: Toolbar, TaskDialog, QuickCreate, TagInput,
│                 TagChip, TagFilter, TagManager, Popover
├─ views/
│  ├─ timeline/   TimelineView, TimelineHeader, TaskBar, useTimelineScroll
│  └─ calendar/   CalendarView, MonthView, WeekView, YearView, WeekRow
├─ hooks/         usePointerDrag, useShortcuts
├─ styles/        tokens.css, global.css
├─ App.tsx
└─ main.tsx
```

**Rule:** `domain/` imports nothing from the other folders. All tricky logic
lives there and is unit-tested without a browser. Views turn domain output
into absolutely-positioned `div`s.

## 3. Key decisions

### 3.1 Dates are strings; layout uses day numbers

`Task.start/end` are `YYYY-MM-DD` strings. For layout they are converted to a
`DayIndex` — the number of whole days since 1970-01-01, computed with
`Date.UTC`. All arithmetic (widths, overlaps, packing, dragging) is integer
maths on `DayIndex`.

Why: a JavaScript `Date` is an instant in time, not a calendar day. Using
`new Date('2026-03-29')` and local-time maths gives 23- or 25-hour "days" around
daylight-saving changes and off-by-one bugs in other time zones. Integer days
have none of that. Only `todayISO()` reads the local clock.

### 3.2 One linear scale for every zoom level

`x = (day − rangeStart) × pxPerDay`. Zoom only changes `pxPerDay`
(32 / 16 / 4) and how header cells are grouped. Consequences:

- Bars keep day precision in every zoom (TL-3).
- Monthly columns have different widths (28–31 days) automatically.
- Pointer → day is `rangeStart + floor(x / pxPerDay)`.
- The vertical timeline (later) is the same maths on the `y` axis.

### 3.3 One packing function for both views

`packRows(spans, pack)` is a greedy first-fit over spans sorted by start. The
timeline feeds it whole tasks; the calendar feeds it each task's piece clipped
to one week row. Same rule, same toggle, one test file.

### 3.4 No timeline/calendar library

No library offered all of: horizontal timeline with day/week/month zoom,
calendar week/month/year, shared packing toggle, and drag-create/move/resize
— without a paid licence or fighting its layout. The custom layout core is a
few hundred lines of pure, tested functions.

### 3.5 Undo = snapshots

The undoable document is `{ tasks, tags }`. Each mutation pushes the previous
document onto `past` (max 100) and clears `future`. Documents are replaced,
never mutated, so snapshots share unchanged tasks and cost little memory.

During a drag, the bar's preview position lives in component state; the store
is updated once on release → one undo step per gesture.

### 3.6 Storage behind an interface

```ts
interface StorageAdapter {
  load(): Promise<string | null>;  // raw JSON text, or null if nothing saved
  save(json: string): Promise<void>;
  backup(json: string): Promise<void>; // keep unreadable data before it's overwritten
}
```

v1 uses `localStorage`. The Tauri build swaps in a file-based adapter that
writes `roadmap.json` to the app data folder. Nothing else changes.
Validation (`domain/schema.ts`) runs on everything loaded or imported.

## 4. Data flow

```
pointer / keyboard
      │
      ▼
 view component ── preview state during drag
      │ on release / save
      ▼
 roadmapStore.commit(nextDoc) ──► history (past/future)
      │ subscribe
      ├──► views re-render (filter → pack → position)
      └──► autosave (300 ms debounce) ──► StorageAdapter
```

## 5. Running

| Mode | Command | URL |
|---|---|---|
| Dev | `npm run dev` | http://localhost:5173 |
| Production build, local | `npm run build && npm run preview` | http://localhost:4173 |
| Docker | `docker compose up --build` | http://localhost:8080 |
| Desktop (later) | `npm run tauri dev` / `npm run tauri build` | native window |

## 6. Adding Tauri later (Phase 9)

1. Install Rust (`rustup`) and Microsoft C++ Build Tools. WebView2 is
   already on Windows 11.
2. `npm i -D @tauri-apps/cli` and `npx tauri init` (dist dir `../dist`, dev URL
   `http://localhost:5173`).
3. Add `@tauri-apps/plugin-fs`; write `storage/tauriFileAdapter.ts`
   implementing `StorageAdapter`.
4. In `main.tsx`, pick the adapter: Tauri if `'__TAURI_INTERNALS__' in window`,
   otherwise localStorage.
5. On first desktop launch, offer to import from a JSON export.
