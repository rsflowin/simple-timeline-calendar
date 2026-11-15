# Simple Timeline Calendar

A local-first roadmap planner. Put tasks on a horizontal timeline or a
calendar, tag them, and drag them around. Host it on a local machine or server
and access it from any browser or device on your network.

![Timeline in Week zoom](docs/images/timeline-week.png)

## Features

- **Timeline** with Day, Week (ISO week numbers) and Month zoom. It scrolls
  sideways without end.
- **Calendar** with Week, Month and Year views.
- **Tasks** have a title, details, whole-day start and end dates, and tags.
- **Tags** work like Notion: type to filter, press Enter to create. Each tag
  has a colour.
- **Pack rows**: tasks that don't overlap share a row. You can turn it off.
- Create a task by dragging on the timeline or calendar, or with **+ New task**.
- Drag a task to move it. Drag its edges to change its dates.
- Tag filter, tag manager, undo and redo.
- Export and import the roadmap as a JSON file.
- Saves automatically in the browser.

| Calendar (Month)                                       | Task dialog                                 |
| ------------------------------------------------------ | ------------------------------------------- |
| ![Calendar Month view](docs/images/calendar-month.png) | ![Task dialog](docs/images/task-dialog.png) |

## Quick start

You need Node.js 22 or newer.

```bash
npm install
npm run dev   # http://localhost:5173
```

Or run the built app and API server:

```bash
npm run build
npm start                   # http://localhost:8080
```

Or run it with Docker (persists data in `./data`):

```bash
docker compose up --build   # http://localhost:8080
```

## Where is my data?

Tasks and tags are stored on the server as JSON in `data/roadmap.json`
(configurable with `DATA_DIR`; mounted at `./data:/app/data` in Docker), so any
browser or machine opening the server URL loads and edits the same roadmap.
Changes are saved automatically 300 ms after an edit and when leaving the page.

View preferences (Timeline vs Calendar, zoom level, Pack rows, tag filter) are
stored per browser in `localStorage`.

If someone on another machine or tab saves changes while your page is open,
saving warns you to reload so you don't overwrite their edits.

Use **Export JSON** (the `⋯` menu) to back up or move your roadmap, and
**Import JSON** to load it.

If the saved data on the server can't be read, the server keeps a backup copy in
`data/backups/`, starts empty, and shows a banner with a download link. It
never throws your data away silently.

## Keyboard shortcuts

Shortcuts are ignored while you type in a field.

| Key                      | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| `N`                      | New task                                                |
| `T`                      | Go to today                                             |
| `1` / `2` / `3`          | Timeline zoom Day / Week / Month                        |
| `Ctrl+Z`                 | Undo                                                    |
| `Ctrl+Shift+Z`, `Ctrl+Y` | Redo                                                    |
| `Delete` / `Backspace`   | Delete the selected task                                |
| `Esc`                    | Close popover or dialog, cancel a drag, clear selection |

On macOS, use `⌘` instead of `Ctrl`.

## Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Dev server at http://localhost:5173     |
| `npm run build`     | Type-check and build client + server    |
| `npm start`         | Run built app + API at port 8080        |
| `npm run preview`   | Serve `dist/` + API at port 4173        |
| `npm test`          | Unit tests (Vitest, watch mode)         |
| `npm run e2e`       | End-to-end tests (Playwright, Chromium) |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | TypeScript                              |
| `npm run format`    | Prettier                                |

## Roadmap

- Vertical timeline
- Desktop app (Tauri) that saves to a file
- Export to image
- Themes, including dark mode
- Multiple roadmaps

## Documentation

- [Product specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## License

MIT. See [LICENSE](LICENSE).
