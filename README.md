# Draw to Web

A desktop application that converts visual canvas layouts into clean, semantic HTML/CSS.
Draw on a canvas → get a portable, zero-JS web page.

## Stack

- **Electron 28** — desktop shell
- **React 18 + TypeScript 5.3** — UI
- **Konva.js** — canvas rendering
- **Zustand** — element store
- **Vite + electron-vite** — dev server + build
- **electron-builder** — Windows `.exe` packaging

## Requirements

- Node.js 20+
- Git
- **Windows** for producing the `.exe` installer (`npm run build`). Dev mode (`npm run dev`) and tests run on any platform.

## Setup

```bash
git clone <repo-url>
cd draw-to-web
npm install
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start in dev mode with hot reload |
| `npm run build` | Build + package to `.exe` (Windows) |
| `npm run build:dir` | Build only (no installer, faster iteration) |
| `npm run test` | Run Vitest test suite |
| `npm run test:a11y` | Run axe-core accessibility checks |
| `npm run lint` | ESLint + Prettier check |
| `npm run typecheck` | TypeScript type check |

## Architecture

```
Canvas Editor → Element Store → Inference Engine → Code Generator → SEO Injector → ZIP Export
```

See [`docs/architecture.md`](docs/architecture.md) and [`docs/element-model.md`](docs/element-model.md) for details.

## Project Structure

```
src/
  main/        Electron main process (IPC, native file ops)
  preload/     contextBridge API surface
  renderer/    React UI (canvas, toolbar, properties panel)
  store/       Zustand element store
  engine/      Spatial → semantic HTML inference
  generator/   HTML + CSS code emitter
  seo/         Meta tags, ARIA, heading structure
  export/      ZIP bundler
tests/
  fixtures/    Sample element trees for unit tests
docs/
  architecture.md
  element-model.md
```

## License

[MIT](LICENSE) — © 2026 ibrah5em, Luf8y, Yousef-Deep
