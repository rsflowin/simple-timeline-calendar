# Changelog

All notable changes to this project are listed here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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
