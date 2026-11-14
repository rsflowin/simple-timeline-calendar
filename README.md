# Timeline Calendar

A local-first roadmap planner. Put tasks on a horizontal timeline or a
calendar, tag them, and drag them around. No account, no server: your data
stays in your browser (and later, in a file on your computer with the desktop
app).

> **Status:** planning. Nothing is built yet. See the [implementation plan](docs/plans/2026-11-13-v1-implementation.md).

## Features (v1)

- **Timeline** with Day / Week (ISO week numbers) / Month zoom and endless horizontal scroll
- **Calendar** with Week / Month / Year views
- **Tasks**: title, details, whole-day start and end dates, Notion-style tags
- **Pack rows**: tasks that don't overlap share a row (can be turned off)
- Create by dragging on the timeline or calendar, or with the **+ New task** dialog
- Drag to move, drag the edges to resize
- Tag filter, undo / redo, JSON export / import

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

Or with Docker:

```bash
docker compose up --build   # http://localhost:8080
```

## Where is my data?

In your browser's local storage, separately for each browser and each address
(`localhost:5173` and `localhost:8080` don't share data). Use **Export** to back
up or move your roadmap, and **Import** to load it.

## Roadmap

- Vertical timeline
- Desktop app (Tauri) that saves to a file
- Export to image
- Themes / dark mode
- Multiple roadmaps

## Documentation

- [Product specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [v1 implementation plan](docs/plans/2026-11-13-v1-implementation.md)

## License

To be decided (MIT proposed).
