# Simple Timeline Calendar — Product Specification (v1)

Status: v1 implemented · Last updated: 2026-11-18

A local-first roadmap tool. You put tasks on a horizontal timeline or a
Google-Calendar-style calendar, tag them, and move them around with the mouse.

Requirement IDs (`TL-3`, `CAL-2`, …) are referenced from the implementation
plan and from tests, so each behaviour can be traced to the code that does it.

---

## 1. Scope

### In v1

| Area | What ships |
|---|---|
| Views | Horizontal timeline; Calendar (Week / Month / Year); Today's tasks side panel |
| Timeline zoom | Daily, Weekly, Monthly |
| Tasks | Title, details, start date, end date, tags; create / edit / move / resize / delete |
| Row packing | Non-overlapping tasks share a row, grouped by primary tag (Dedicated or Compact); user can turn it off |
| Tags | Notion-style: type to filter, Enter to create, colour per tag; tag manager (add, rename, recolour, reorder, delete) |
| Filter | Show only tasks with any of the selected tags |
| History | Undo / redo |
| Data | Saved automatically on the server (`data/roadmap.json`); Export / Import as JSON or iCalendar (`.ics`) |
| Run | `npm run dev`, `npm run build && npm start`, or Docker (`docker compose up`) |

### Later (not v1, but the design must not block them)

| Item | What the design does now to keep it open |
|---|---|
| Vertical timeline | Layout math is axis-free (`DayIndex → px`); only the renderer is horizontal |
| Desktop app (Tauri) | All persistence goes through one `StorageAdapter` interface |
| Multiple roadmaps | The roadmap file is one self-contained JSON document |
| Export to image | — |
| Themes / dark mode | All colours are CSS custom properties in one file |
| Localisation | Month/weekday names come from `Intl`, locale in one constant |

### Explicitly out of scope

Times of day, time zones, recurring tasks, dependencies between tasks,
multi-user real-time sync, accounts.

---

## 2. Core concepts

### 2.1 Dates

- A task covers **whole days**. There are no times.
- Dates are stored as `YYYY-MM-DD` strings (`ISODate`), years 1900–2199. The
  bound keeps one bad date from making the timeline millions of days wide.
- **End date is inclusive.** A task with `start = end` is a one-day task
  (milestone).
- `start <= end` is always true. The UI never lets you save otherwise.
- "Today" is the user's **local** calendar date.
- Weeks start on **Monday** and use **ISO-8601 week numbers**.
- A week that spans two months belongs to the month that contains its
  **Thursday** (the ISO rule). Example for 2026: W5 is Jan 26 – Feb 1 and
  belongs to January; W6 (Feb 2 – 8) is the first February week.

### 2.2 Task

| Field | Type | Rules |
|---|---|---|
| `id` | string | UUID, generated |
| `title` | string | Required, trimmed, 1–200 chars |
| `details` | string | Optional plain text, multi-line, ≤ 10 000 chars |
| `start` | ISODate | Required |
| `end` | ISODate | Required, `>= start` |
| `tagIds` | string[] | References tags; order is the order shown |
| `createdAt`, `updatedAt` | ISO timestamp | Set by the app |

### 2.3 Tag

| Field | Type | Rules |
|---|---|---|
| `id` | string | UUID |
| `name` | string | Required, unique case-insensitively, 1–50 chars |
| `color` | `TagColor` | One of: `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red` |

A task bar is drawn in the colour of its **first** tag, or neutral grey with no
tags.

---

## 3. Timeline view

### 3.1 Layout

- **TL-1** Time runs left → right. The view scrolls horizontally without an
  end in either direction (the rendered range grows as you approach an edge).
- **TL-2** A two-row sticky header sits on top:

  | Zoom | Top row | Bottom row (one cell per…) |
  |---|---|---|
  | Daily | Month + year (`Jan 2026`) | day — day of month (`1`, `2`, … `31`) |
  | Weekly | Month + year, grouped by ISO-Thursday rule | ISO week — `W1`, `W2`, … |
  | Monthly | Year (`2026`) | month — `Jan`, `Feb`, … |

- **TL-3** Bars are placed by day in every zoom level: a task from Jan 3 to
  Jan 9 starts 2 days into January even in Monthly zoom. Zoom only changes how
  many pixels one day takes (Daily 32 px, Weekly 16 px, Monthly 4 px).
- **TL-4** A vertical line marks today. Weekends are shaded in Daily zoom.
- **TL-5** Changing zoom keeps the date at the centre of the screen at the
  centre.
- **TL-6** "Today" button scrolls so today is centred.
- **TL-7** Each bar shows its title (truncated with ellipsis). Hover shows a
  tooltip: title and date range.

### 3.2 Row packing (requirement 2.2)

- **TL-8** With **Pack rows ON** (default), tasks are grouped by their primary
  tag (`tagIds[0]`, ordered by the document's tag list with untagged tasks
  last), sorted by start date (longer first on ties), and packed so
  non-overlapping tasks with the same tag share a line (inclusive end days
  overlap). In **Dedicated lines per tag** mode (default), each tag keeps its
  own row(s); in **Tag-first compact packing** mode, compatible whole tracks
  across tags can share rows when dates do not overlap.
- **TL-9** With **Pack rows OFF**, every task gets its own row, same order.
- **TL-10** The toggle is a view preference: it is remembered, it is not part
  of the roadmap data, and it is not undoable.

### 3.3 Creating and editing on the timeline

| ID | Gesture | Result |
|---|---|---|
| **TL-11** | Press on empty space and drag sideways | A draft bar follows the pointer, snapped to days. On release, the quick-create popover opens for that range |
| **TL-12** | Click (move < 4 px) on empty space | Quick-create for one column unit: 1 day (Daily), that ISO week Mon–Sun (Weekly), that whole month (Monthly) |
| **TL-13** | Drag a bar's body | Moves the task by whole days; duration unchanged |
| **TL-14** | Drag a bar's left / right edge (6 px handle) | Changes start / end by whole days; a task can't become shorter than 1 day |
| **TL-15** | Click a bar | Selects it and opens the Task dialog |
| **TL-16** | While dragging | A tooltip shows the new start – end |
| **TL-17** | Esc while dragging | Cancels; nothing changes |

A finished move or resize is **one** undo step.

---

## 4. Calendar view

Navigation bar: `Today` · `‹` · `›` · title · `Week | Month | Year`.
`‹ ›` step by one week / month / year.

### 4.1 Month view

- **CAL-1** Grid of weeks (Mon–Sun) covering the month, 4–6 rows. Days from
  neighbouring months are dimmed. Today is highlighted.
- **CAL-2** Tasks are bars that span the days they cover. A task that crosses a
  week boundary is drawn as one piece per week row; rounded ends only where
  the task really starts / ends.
- **CAL-3** Within each week row, bars use the same tag-aware packing rule as
  TL-8 (per week, respecting the Pack rows toggle and Tag display preference).
- **CAL-4** If a day cell can't fit all its lanes, the last lane shows
  `+N more`; clicking it opens a popover listing that day's tasks.
- **CAL-5** Click a day → quick-create a 1-day task. Drag across days →
  quick-create for that range (can span week rows).
- **CAL-6** Drag a bar → move by whole days. Drag a bar's end handle → resize.
  Click a bar → Task dialog.

### 4.2 Week view

- **CAL-7** Seven day columns (Mon–Sun) with date headers. Title shows
  `W46 · Nov 9 – 15, 2026`.
- **CAL-8** Same bars, packing and gestures as Month view, but rows are not
  capped (no `+N more`); the area scrolls vertically if needed. Each bar also
  shows the first line of its details.

### 4.3 Year view

- **CAL-9** Twelve mini-months (Mon-first grids) for the year.
- **CAL-10** Days covered by at least one task are shaded; darker for more
  tasks (1, 2, 3+).
- **CAL-11** Click a day → popover listing that day's tasks, plus
  `+ Add task` (opens quick-create for that day).
- **CAL-12** Click a month name → Month view for that month.

---

## 5. Creating tasks (requirement 2.3)

### 5.1 Quick-create popover

- **QC-1** Appears next to the draft range with a single title field, already
  focused. The range is shown as text (`Jan 3 – Jan 9`).
- **QC-2** Enter → creates the task (if the title isn't blank) and closes.
- **QC-3** Esc or clicking outside → closes without creating.
- **QC-4** `More options` → opens the full Task dialog with the title and
  dates filled in.

### 5.2 Task dialog

Opened by the `+ New task` button (`N` key), by `More options`, or by clicking
an existing task.

- **TD-1** Fields: Title, Start date, End date (native date inputs), Tags
  (TagInput), Details (textarea).
- **TD-2** New task from the button defaults to today – today.
- **TD-3** If Start is moved after End, End moves with it to the same day; if
  End is set before Start, Save is disabled and the field shows
  "End date can't be before start date".
- **TD-4** Save (Ctrl/⌘+Enter) and Cancel (Esc). Existing tasks also have
  Delete.
- **TD-5** Saving is one undo step. Deleting is one undo step (no confirm
  prompt — undo is the safety net). A tag created from the dialog's TagInput
  is saved at once as its own undo step and stays if the dialog is cancelled.

### 5.3 TagInput (Notion-style)

- **TAG-1** Selected tags show as coloured chips with an × to remove.
- **TAG-2** Typing filters existing tags in a dropdown; ↑/↓ move, Enter
  selects.
- **TAG-3** If no tag has that exact name (case-insensitive), the last option
  is `Create "<text>"`. Enter on it creates the tag with the next colour in the
  palette rotation and selects it.
- **TAG-4** Backspace in an empty field removes the last chip.
- **TAG-5** Tag manager (`Menu → Manage tags`): add, rename, change colour,
  drag to reorder (determines row order in Dedicated display mode), and delete.
  Deleting a tag removes it from all tasks (one undo step).

---

## 6. Toolbar and global behaviour

| ID | Item |
|---|---|
| **UI-1** | View switch: `Timeline` / `Calendar` |
| **UI-2** | Timeline: zoom `Day / Week / Month`, `Today` |
| **UI-3** | Calendar: navigation bar (§4) |
| **UI-4** | `Pack rows` toggle (applies to both views) and `Today's tasks` side panel toggle (`A`) |
| **UI-5** | Tag filter: multi-select; shows tasks having **any** selected tag; empty = all tasks |
| **UI-6** | `+ New task`, Undo, Redo |
| **UI-7** | Menu (`Manage tags`, `Tag display` submenu, `Mouse & drag` submenu, `Export…`, `Import…`) |
| **UI-8** | Today's tasks side panel: lists tasks overlapping today with dates, tags and full details, honours the tag filter, opens a task on click, overlays on narrow screens; open state persisted |

`Menu → Mouse & drag` lets users toggle click-to-create on empty space and
switch drag behaviour between **Move task or create new task** (default),
**Move scroll** (pan/scroll), and **Do nothing** (clicking a task bar always
opens it).

Keyboard shortcuts (ignored while typing in a field):

| Key | Action |
|---|---|
| `N` | New task |
| `T` | Go to today |
| `A` | Toggle Today's tasks panel |
| `1` / `2` / `3` | Timeline zoom Day / Week / Month |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z`, `Ctrl+Y` | Redo |
| `Delete` / `Backspace` | Delete the selected task |
| `Esc` | Close popover / dialog, cancel drag, clear selection |

### 6.1 Undo / redo

- **UR-1** Undo covers every change to tasks and tags (create, edit, move,
  resize, delete, tag create/rename/recolour/delete, import).
- **UR-2** It does **not** cover view state (zoom, scroll, filter, toggle).
- **UR-3** History keeps the last 100 steps and is not saved between sessions.

---

## 7. Data and storage

- **DATA-1** Every change is saved automatically to the server (`data/roadmap.json`)
  (debounced 300 ms) and flushed when the page is hidden/closed.
- **DATA-2** Roadmap file format:

  ```json
  {
    "format": "timeline-calendar",
    "version": 1,
    "tasks": [ { "id": "…", "title": "…", "details": "", "start": "2026-01-05",
                 "end": "2026-01-09", "tagIds": ["…"],
                 "createdAt": "…", "updatedAt": "…" } ],
    "tags":  [ { "id": "…", "name": "Backend", "color": "blue" } ]
  }
  ```

- **DATA-3** Export opens one dialog: format (JSON in this format, or iCalendar
  `.ics` with one all-day event per task), an optional From/To range (tasks
  overlapping it are kept) and tags (none = all; otherwise tasks with any
  checked tag, pre-filled from the tag filter). It downloads
  `roadmap-YYYY-MM-DD.json` or `.ics`. Filtered JSON keeps every tag.
- **DATA-4** Import opens one dialog: mode **Add** (default) or **Replace**,
  then one file, `.json` or `.ics`. Either mode is one undoable step. JSON is
  validated first; if invalid, nothing changes and the error says what's wrong
  (e.g. `tasks[3].end is before start`). **Replace** swaps the whole roadmap for
  the file's tasks and tags. **Add** merges: existing tags are never changed: an
  incoming tag (JSON tag or `.ics` CATEGORIES) maps onto the existing tag with
  the same id, else the same name, else is added. A task (or `.ics` event UID)
  whose id matches an existing task updates it; others are added. Unknown tag
  ids are dropped; invalid tasks and `.ics` events without a start date are
  skipped.
- **DATA-5** If the saved data on the server can't be read, the raw text is
  kept in `data/backups/`, the app starts empty, and a banner says so and
  offers to download the backup. Data is never silently discarded.
- **DATA-6** View preferences (view, zoom, calendar mode, pack rows, tag display
  mode, tag filter, click-to-create, drag behavior, Today's tasks panel open
  state) are saved separately per browser in `localStorage`.

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| **NF-1** | Smooth (no visible lag) with 500 tasks and 50 tags |
| **NF-2** | Self-hosted / local-network only; no external network requests |
| **NF-3** | Latest Chrome, Edge, Firefox, Safari; and WebView2 (for Tauri later) |
| **NF-4** | Keyboard: every action reachable without a mouse except drag gestures; bars are focusable buttons with an `aria-label` such as `Design review, Jan 3 – Jan 9` |
| **NF-5** | Domain logic (dates, packing, header scales, calendar grid, history, file validation, `.ics` import/export) has unit tests |
| **NF-6** | MIT-licensed, with README, CONTRIBUTING and architecture docs |
