# Contributing

## Setup

Requires Node 22 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Commands

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm test`          | Unit tests (Vitest, watch mode) |
| `npm test -- --run` | Unit tests once                 |
| `npm run e2e`       | End-to-end tests (Playwright)   |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScript                      |
| `npm run format`    | Prettier                        |
| `npm run build`     | Production build into `dist/`   |

## Folder rules

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- `src/domain/` is pure TypeScript: no React, no DOM, no storage, and it imports
  nothing from other `src/` folders. All tricky logic goes here, with unit tests.
- Test files sit next to the code: `foo.ts` -> `foo.test.ts`. Component tests start
  with `// @vitest-environment jsdom`.
- Colours live only in `src/styles/tokens.css` as custom properties.

## Commits

One logical change per commit, message `type(scope): summary`, where type is
`feat`, `fix`, `test`, `docs` or `chore`.

## Pull requests

Every PR keeps this green (CI runs the same, plus `npm run e2e` and
`docker build .`):

```bash
npm run lint && npm run typecheck && npm test -- --run && npm run build
```
