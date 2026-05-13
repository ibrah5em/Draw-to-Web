# Draw to Web

A desktop application that converts visual canvas layouts into clean, semantic
HTML/CSS. Draw on a canvas → get a portable, zero-JS web page.

## Stack

- **Electron 28** — desktop shell
- **React 18 + TypeScript 5.3** — UI
- **Konva.js** — canvas rendering
- **Zustand** — element store
- **Vite + electron-vite** — dev server + build
- **electron-builder** — Windows NSIS / Linux AppImage + .deb packaging
- **Vitest + axe-core + jsdom** — testing

## Requirements

- Node.js 20+
- Git
- Linux or Windows host for development. Cross-platform packaging is supported
  on Linux via `npm run build:linux` and on Windows via `npm run build:win`.

## Setup

```bash
git clone <repo-url>
cd draw-to-web
npm install
npm run dev
```

## Commands

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Start Electron in dev mode (HMR for main + renderer)   |
| `npm run compile`     | Build main + preload + renderer bundles (no installer) |
| `npm run build`       | Build + package for the current platform               |
| `npm run build:win`   | Build + package Windows NSIS installer                 |
| `npm run build:linux` | Build + package Linux AppImage and .deb                |
| `npm run build:dir`   | Build only (no installer, fast iteration)              |
| `npm test`            | Run the full Vitest suite                              |
| `npm run lint`        | ESLint + Prettier check                                |
| `npm run typecheck`   | TypeScript `tsc --noEmit` on every tsconfig            |

## Architecture

```
Canvas ──► Element Store ──► Engine ──► Generator ──► SEO Injector ──► axe-core gate ──► JSZip ──► IPC ──► fs.writeFile
```

Three layers, one data direction:

- **UI layer** (`src/renderer/`) — Canvas, toolbar, properties panel, live preview, export/report dialogs
- **Core layer** (`src/store/`, `src/engine/`, `src/generator/`, `src/seo/`) — element store and pure transforms
- **Output layer** (`src/export/`, `src/project/`, `src/main/`) — pipeline orchestrator, .dtw (de)serializer, native file ops

### Process boundaries

- **Main** (`src/main/`) — Electron lifecycle, native dialogs, `fs` writes. No business logic.
- **Renderer** — All UI and business logic; talks to main only via the preload bridge.
- **Preload** (`src/preload/`) — Typed `window.electronAPI`; no raw `ipcRenderer` in the renderer.

### Key invariants

- Generated HTML contains zero JavaScript.
- Layout uses CSS Grid/Flexbox — never `position: absolute`.
- Element positions snap to a 12-column grid.
- Export is blocked if axe-core reports any `critical` or `serious` violation.
- The element store is the only mutable source of truth; the canvas reads from it.

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/element-model.md`](docs/element-model.md) for the full design.

## Export pipeline

`exportProject(elements, seoConfig)` in `src/export/index.ts` chains six stages:

1. `inferSemantics(elements)` — spatial → semantic tag inference (engine)
2. `generate(tree)` — emit HTML + CSS strings (generator)
3. `injectSEO(html, config)` — meta tags, OG tags, ARIA landmark roles, `lang`
4. `generateFullReport(html, config)` — axe-core gate via jsdom
5. `JSZip` — bundle `index.html` + `styles.css`
6. IPC `export:zip` → main process → native save dialog → `fs.writeFile`

Each stage returns a discriminated `{ success, stage, error, report? }` result.
The accessibility report is returned even on failure so the user can fix
violations and retry.

## Project files (`.dtw`)

`File → Save Project…` (Ctrl+S) serializes the element store to a versioned JSON
file. `File → Open Project…` (Ctrl+O) reads and validates the payload before
hydrating the store. The schema lives in `src/project/index.ts`.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, and unit tests on every push and
pull request. Tagged commits (`v*`) additionally package Linux AppImage + .deb
artifacts and upload them to the workflow run.

## Testing

| Suite                         | Coverage                                      |
| ----------------------------- | --------------------------------------------- |
| `tests/generator/`            | HTML + CSS emitter snapshots                  |
| `tests/seo/injectSEO.test.ts` | Meta/OG/ARIA injection, escaping              |
| `tests/seo/axeGate.test.ts`   | axe-core gate pass/fail behaviour             |
| `tests/export/`               | Full pipeline including filename sanitization |
| `tests/project/`              | `.dtw` schema (de)serialization               |
| `tests/main/ipc.test.ts`      | IPC round-trip — writes & reads real files    |

Run a single suite with `npm test -- --run tests/seo/`.

## Project structure

```
src/
  main/             Electron lifecycle + IPC handlers
  preload/          contextBridge → window.electronAPI
  renderer/         React UI (Canvas, Toolbar, LivePreview, dialogs)
  store/            Zustand element store
  engine/           Semantic inference (spatial → tag)
  generator/        HTML + CSS emitters
  seo/              SEO injector + axe-core gate
  export/           Pipeline orchestrator + JSZip bundler
  project/          .dtw schema (de)serializer
  shared/           Cross-process types
tests/              Vitest suites mirroring src/
docs/               architecture.md, element-model.md
.github/workflows/  CI configuration
```

## License

[MIT](LICENSE) — © 2026 ibrah5em, Luf8y, Yousef-Deep
