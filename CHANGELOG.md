# Changelog

All notable changes to this project are listed here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Server-backed storage**: tasks and tags persist to `data/roadmap.json` via
  `/api/roadmap` with atomic writes, `data/backups/` recovery, and `ETag` /
  `If-Match` conflict detection across tabs and devices. Standalone Node server
  (`npm start`) and updated Docker image serve both the app and API.
- **Today's tasks side panel** (`Today's tasks` toolbar toggle or `A` shortcut):
  lists every task overlapping today with dates, tags and full details, honours
  the tag filter, opens a task on click, and remembers open state.
- **Unified Export & Import dialogs with `.ics` support**:
  - **Export…** exports as JSON or iCalendar (`.ics`) with optional From/To date
    range and tag filters (pre-filled from the toolbar tag filter).
  - **Import…** imports `.json` or `.ics` in **Add** (merge, default) or
    **Replace** mode as a single undoable step.
- **Tag-aware row packing & ordering**: `Menu → Tag display` switches between
  **Dedicated lines per tag** and **Tag-first compact packing**; tags can be
  reordered by dragging and created directly inside **Manage tags**.
- **Mouse & drag preferences** (`Menu → Mouse & drag`): toggle click-to-create
  on empty space and switch drag behaviour between task create/move/resize,
  pan/scroll, or off.

### Fixed

- Focus returns to the view after deleting a task from the dialog, and to the
  opener after closing `+N more` or Year-day popovers.
- New tasks inherit the active tag filter so they stay visible after saving.
- Autosave waits until unreadable startup data is safely backed up or
  downloaded.

## [0.1.0] - 2026-11-14

First release.

### Added

- Horizontal timeline with Day, Week (ISO week numbers) and Month zoom, endless
  horizontal scroll, a today line and a Today button. Zooming keeps the centre
  date in place.
- Calendar with Week, Month and Year views. Month view splits bars per week
  and shows `+N more` when a day is full. Year view shades days by how many
  tasks they have.
- Tasks with title, details, whole-day start and end dates, and tags.
- Create a task by dragging or clicking on empty space (quick-create popover),
  or with the **+ New task** dialog. Drag to move, drag the edges to resize,
  Esc cancels a drag.
- Notion-style tag input: type to filter, Enter to create. Tag manager to
  rename, recolour and delete tags.
- Pack rows toggle: tasks that don't overlap share a row, in both views.
- Tag filter: show only tasks with any of the selected tags.
- Undo and redo (last 100 steps) for every change to tasks and tags.
- Export and import the roadmap as JSON. Imports are validated and the error
  names the bad field.
- Autosave to browser local storage. Unreadable saved data is backed up and
  offered for download instead of being discarded.
- View preferences (view, zoom, calendar mode, pack rows, tag filter) are
  remembered.
- Keyboard shortcuts: `N`, `T`, `1`/`2`/`3`, `Ctrl+Z`, `Ctrl+Shift+Z`,
  `Ctrl+Y`, `Delete`, `Esc`. Task bars are focusable buttons with labels.
- Docker image (nginx): `docker compose up --build`.
- Unit tests (Vitest), end-to-end tests (Playwright) and CI.

### Known limitations

- No auto-scroll while dragging near the edge of the view.
- English labels only.
- Browser storage is per browser and per address. Use Export to back up or
  move data.
- In Year view, the Tab key only stops on days that have tasks.
- Two tabs on the same roadmap overwrite each other's changes. The other tab
  shows a warning to reload; edit in one tab at a time.
