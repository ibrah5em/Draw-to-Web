# Draw to Web

A desktop application that lets you author modern, semantic, responsive web
pages by composing them on a canvas — no code required. Draw on a canvas → get a
portable HTML/CSS bundle plus opt-in vetted JS snippets (theme toggle,
scroll-spy, mobile menu, reveals, animation gating, terminal typing). All
runtime behaviour is independently toggleable; all flags off → JS-free output.

**New in v1.0.0:** _draw a rectangle_ to create an element (the shape is
interpreted into a placed primitive), _match my layout_ to adopt one of six
bundled professional designs from a rough draft, and a **headless MCP server**
that drives the same document / generate / export pipeline over stdio without
Electron. See [Authoring surfaces (v1.0.0)](#authoring-surfaces-v100).

## Stack

- **Electron 28** — desktop shell
- **React 18 + TypeScript 5** — UI
- **Zustand + immer** — document store + history (immer patches for undo/redo)
- **@dnd-kit + react-arborist** — canvas drag & drop + layers tree
- **Radix UI + react-resizable-panels** — UI primitives
- **Zod** — document schema + IPC validation
- **sharp** — image pipeline (WebP + srcset, in the main process)
- **prettier + lightningcss + html-minifier-terser** — output formatting + minification
- **jszip** — export bundling
- **axe-core** — accessibility hard gate (blocks export on critical/serious)
- **@modelcontextprotocol/sdk** — headless MCP server over the document pipeline
- **Vite + electron-vite + electron-builder** — dev + build + packaging
- **Vitest** — testing (1042 tests across document, generator, runtime, seo, export, templates, store, ui, draw, match, mcp)

## Requirements

- Node.js 20+
- Git
- Linux, Windows, or macOS host for development. Per-platform packaging:
  `npm run build:linux` (AppImage + .deb), `npm run build:win` (NSIS),
  `npm run build:mac` (dmg + zip, x64 + arm64). CI builds each natively.

## Setup

```bash
git clone <repo-url>
cd draw-to-web
npm install
npm run dev
```

## Commands

| Command                             | Description                                            |
| ----------------------------------- | ------------------------------------------------------ |
| `npm run dev`                       | Start Electron in dev mode (HMR for main + renderer)   |
| `npm run compile`                   | Build main + preload + renderer bundles (no installer) |
| `npm run build`                     | Build + package for the current platform               |
| `npm run build:win`                 | Build + package Windows NSIS installer                 |
| `npm run build:linux`               | Build + package Linux AppImage and .deb                |
| `npm run build:mac`                 | Build + package macOS dmg + zip (x64 + arm64)          |
| `npm run build:dir`                 | Build only (no installer, fast iteration)              |
| `npm test`                          | Run the full Vitest suite                              |
| `npm run test:a11y`                 | Run only the a11y suites                               |
| `npm run test:perf`                 | Run the wall-clock perf-budget lane (separate config)  |
| `npm run lint`                      | ESLint + Prettier check                                |
| `npm run typecheck`                 | TypeScript `tsc --noEmit` (main + preload)             |
| `npm run typecheck:web`             | TypeScript `tsc --noEmit` (renderer)                   |
| `npm run mcp`                       | Start the headless MCP server over stdio (vite-node)   |
| `npm run build:mcp`                 | Build the MCP server bundle (`dist/mcp/server.mjs`)    |
| `npm run start:mcp`                 | Run the built MCP server bundle                        |
| `npm run generate:match-signatures` | Regenerate the match-library signatures                |

## Architecture

```
UI ─► Document Store ─► Generator ─► SEO ─► Validation ─► Export (axe gate ─► minify ─► ZIP) ─► IPC ─► fs.writeFile
```

Data flows in one direction: **UI writes to the store; generator reads from the
store.** The canvas is a _rendering_ of the document tree, never the model
itself.

- **UI** (`src/ui/`) — Canvas, sidebar, properties panel, layers, topbar, tokens, validation console
- **Document Model** (`src/document/`) — Types, Zod schemas, operations, tokens, validation, migrations, presets — the source of truth
- **Stores** (`src/store/`) — Zustand stores for document + history (immer patches)
- **Output pipeline** (`src/generator/`, `src/runtime/`, `src/seo/`, `src/export/`) — HTML/CSS/JS emit, runtime snippets, SEO injection, export bundling
- **Authoring surfaces** (`src/draw/`, `src/match/`, `mcp/`) — draw-to-create, match-layout, and the headless MCP server (all pure/headless, reusing the operations + export pipeline)
- **Shell** (`src/main/`, `src/preload/`, `src/shared/`) — Electron lifecycle, IPC handlers, native file ops, typed bridge

### Process boundaries

- **Main** (`src/main/`) — Electron lifecycle, native dialogs, `fs` writes, `sharp` image pipeline. No business logic.
- **Renderer** — All UI and business logic; talks to main only via the preload bridge.
- **Preload** (`src/preload/`) — Typed `window.electronAPI`; no raw `ipcRenderer` reachable from the renderer.

### Key invariants

- The Document Model is the only mutable source of truth; the canvas renders it, the generator walks it.
- Output is HTML5 + CSS3 with **opt-in vetted runtime snippets**. All flags off → JS-free output.
- Layout uses CSS Grid + Flexbox + `clamp()` — never `position: absolute`. Regex-guarded in tests.
- Tokens-driven CSS — element styles reference `var(--token)`, never raw hex (except via the editor's "free value" escape hatch).
- Every visual property supports `base / tablet / mobile / small` breakpoints; the generator emits media queries.
- axe-core hard gate — any `critical` or `serious` violation blocks export.
- Exactly one `<h1>`, no heading-level skips, `alt` on every `<img>`, ARIA labels on icon-only buttons, `prefers-reduced-motion` honoured.
- Deterministic output — same input tree → byte-equal HTML/CSS.

See the [`docs/1.0.0v/`](docs/1.0.0v/) supervisor report for the v1.0.0
architecture, [`docs/0.2.0v/plan.md`](docs/0.2.0v/plan.md) for the sprint
execution plan, and [`docs/0.1.0v/`](docs/0.1.0v/) for archived v0.1.0 docs.

## Authoring surfaces (v1.0.0)

Three authoring capabilities added in v1.0.0. All three are pure/headless at the
core and reuse the existing document operations and export pipeline — no new
element primitives, no new store ownership.

- **Draw to create** (`src/draw/`) — drag a rectangle on the canvas and it
  becomes an element. `interpretRectangle` guesses the element kind (ranked
  alternatives + confidence + explainer hint); `snapToGrid` resolves the drawn
  box to a grid placement (column start/span + insertion index — pure math, never
  pixels); the canvas builds the node with the existing `createPrimitive` factory
  and dispatches a normal `insertElement` op. Drawn pixels never touch the store.
- **Match my layout** (`src/match/`) — turn a rough draft into a professional
  design. `extractSignature` builds a deterministic structural fingerprint of the
  tree; `matchLayout` ranks it against six bundled pages (agency, docs-article,
  gallery-media, landing-saas, portfolio-split, resume-minimal), each shipping a
  build-time signature; `adoptLibraryPage` hydrates the chosen page through the
  same path a `.dtw` load uses.
- **Headless MCP server** (`mcp/`) — a stdio [Model Context
  Protocol](https://modelcontextprotocol.io) server exposing ~20 tools over the
  document / perception / mutation / export pipeline (`create_document`,
  `insert_element`, `insert_preset`, `apply_template`, `set_tokens`, `set_theme`,
  `set_runtime`, `set_seo`, `match_layout`, `preview_html`, `export_site`, …).
  Runs without Electron via an `fs`-backed export shim; every tool is a thin
  adapter over the existing operations (C3) and generate / a11y / export entry
  points, so MCP-driven exports go through the same axe-core hard gate. Start it
  with `npm run mcp`; documents and ZIP bundles land under `DTW_MCP_DIR`
  (default `.dtw-mcp/`).

### Using the MCP server

The server speaks MCP over stdio (newline-delimited JSON-RPC 2.0). Point any
MCP-capable client at the launch command:

```jsonc
// e.g. an MCP client config ("mcpServers" entry)
{
  "draw-to-web": {
    "command": "npm",
    "args": ["run", "mcp"],
    "env": { "DTW_MCP_DIR": "/abs/path/to/output" },
  },
}
```

Or drive it directly for a smoke test — initialize, then list tools:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | npm run --silent mcp
# → server advertises "draw-to-web" and lists 20 tools (create_document …
#   apply_template, match_layout, run_a11y_check, preview_html, export_site).
```

A typical agent flow: `create_document` → `apply_template` / `insert_preset` →
`set_tokens` / `set_theme` → `run_a11y_check` → `export_site`. Every mutation
routes through the same `Operation` union the canvas uses, and `export_site`
runs the full nine-stage pipeline including the axe-core gate.

## Export pipeline

`exportProject(document, options)` in `src/export/index.ts` chains nine stages
with structured progress events:

1. `validate` — Zod schema + custom rules (`validateDocument`)
2. `generate` — emit HTML + CSS + JS strings (`generate(document)`)
3. `inject-seo` — `<meta>`, OG, Twitter Card, JSON-LD, theme-color, canonical
4. `a11y-gate` — lazy-loaded axe-core in jsdom; critical/serious blocks export
5. `optimize-images` — read sharp-produced WebP variants off disk, pack into the bundle
6. `minify` — `lightningcss` + `html-minifier-terser` + `terser` (opt-in)
7. `sitemap-robots` — emit `sitemap.xml` + `robots.txt`
8. `bundle` — JSZip packaging (`index.html`, `styles.css`, `scripts.js`, `assets/`, `fonts/`)
9. `save` — IPC `export:zip` → main process → native save dialog → `fs.writeFile`

Each stage failure surfaces `{ success: false, stage, error, report? }`. Pass
`{ dryRun: true }` to short-circuit after `inject-seo` and get
`{ html, css, js, validation }` without writing to disk (used by the
code-preview dialog).

## Project files (`.dtw`)

`File → Save Project…` (Ctrl+S) serializes the document to a versioned JSON
file. `File → Open Project…` (Ctrl+O) validates the payload (Zod) before
hydrating the store. Schema lives in `src/document/schemas.ts`; persistence
helpers in `src/store/persistence.ts`.

Two safety nets run on top of plain save/open:

- **Crash recovery** — edits are autosaved to a sidecar; on next launch the app
  detects an unclean shutdown and offers to restore the unsaved work
  (`src/store/autosave.ts`, `src/store/crashRecovery.ts`).
- **External-change reload** — a `chokidar` watcher in the main process fires
  `onFileChanged` when the open `.dtw` is edited on disk; the renderer prompts to
  reload rather than silently diverging (`src/store/fileReload.ts`).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, typecheck
(main + renderer), and the full Vitest suite on every push to `main` and every
pull request. Compile runs in parallel.
[`.github/workflows/release.yml`](.github/workflows/release.yml) handles tag
pushes (`v*`). Three jobs: `verify` re-runs lint/typecheck/test on the tagged
commit; `package` runs a per-OS matrix (`ubuntu-latest` → AppImage + .deb,
`windows-latest` → NSIS, `macos-latest` → dmg + zip) so each installer builds
natively; `publish` collects every `installers-*` artifact and attaches them
in one shot to a GitHub Release with auto-generated notes from merged PRs.

To cut a release:

```bash
git tag v1.0.0 -m "release notes"
git push origin v1.0.0
```

### Installing the unsigned builds

Release installers are **not code-signed**. The app still runs everywhere, but
each OS shows a one-time warning that needs a manual bypass:

- **Windows (NSIS)** — Windows SmartScreen shows a blue "Windows protected
  your PC — Unknown publisher" dialog. Click **More info** → **Run anyway**.
- **macOS (dmg + zip)** — Gatekeeper blocks the first open: _"can't be opened
  because Apple cannot check it for malicious software."_ Either right-click
  the app → **Open** → **Open** (the menu-bar Open allows it; double-click
  doesn't), or run `xattr -d com.apple.quarantine /Applications/"Draw to Web".app`.
- **Linux (AppImage / .deb)** — no warning; AppImage may need `chmod +x`.

Code signing (Windows Authenticode + Apple Developer ID notarization) is
**deferred indefinitely** — see `I-BLD-05` in `CLAUDE.local.md`. Adding it
later is a one-time config change to `electron-builder.yml` and a
`signtool` / `notarytool` step in the release workflow; no architectural
work required.

## Testing

| Suite              | Coverage                                                |
| ------------------ | ------------------------------------------------------- |
| `tests/document/`  | Types, schemas, operations, tokens, validation, presets |
| `tests/generator/` | HTML + CSS + JS emitters, determinism, prettier         |
| `tests/runtime/`   | Runtime snippet behaviour in jsdom                      |
| `tests/seo/`       | head / OG / JSON-LD / sitemap / robots + axe gate       |
| `tests/export/`    | Full pipeline incl. minify + dry-run + self-host fonts  |
| `tests/templates/` | Blank / portfolio / landing / resume round-trips        |
| `tests/main/`      | IPC handlers — real temp dirs                           |
| `tests/store/`     | Document + history stores, persistence                  |
| `tests/ui/`        | Renderer components (Testing Library + jsdom)           |
| `tests/a11y/`      | End-to-end axe-core runs on rendered output             |
| `tests/draw/`      | Rectangle interpret / grid snap / node mapping          |
| `tests/match/`     | Layout signature / matcher / bundled library            |
| `tests/mcp/`       | MCP tools, session store, end-to-end tool flows         |
| `tests/perf/`      | Wall-clock export/perf budgets (`npm run test:perf`)    |

Run a single suite with `npx vitest run tests/seo/`.

## Project structure

```
src/
  main/             Electron lifecycle + IPC handlers + sharp pipeline
  preload/          contextBridge → window.electronAPI
  shared/           Cross-process types + electronAPI surface
  document/         Document Model — types, schemas, operations, tokens, validation, migrations, presets
  store/            Zustand document + history stores (immer patches)
  ui/               React UI (Canvas, Sidebar, Properties, Layers, Topbar)
  generator/        HTML + CSS + JS emitters
  runtime/          Vanilla JS snippets injected into output (opt-in)
  seo/              Head, OG, JSON-LD, sitemap, robots emitters
  export/           Pipeline orchestrator + axe gate + minify + ZIP + self-host fonts
  templates/        Blank, portfolio, landing, resume starters
  draw/             Draw-to-create — rectangle interpret + grid snap + node mapping
  match/            Match-layout — signature + matcher + bundled page library
mcp/                Headless MCP server (stdio) over the document pipeline
tests/              Vitest suites mirroring src/ (+ draw, match, mcp, perf)
docs/                All project documentation (single home)
  CHANGELOG.md       Release history
  DECISIONS.md       Architecture / scope decision log
  1.0.0v/            v1.0.0 supervisor report (current)
  0.2.0v/            v0.2.0 execution plan + architecture docs
  0.1.0v/            v0.1.0 archived docs (historical reference)
  guides/            Developer guide + user manual (PDF)
  report/            LaTeX graduation report (self-contained; figures + UML)
.github/workflows/  CI + release configuration
```

## License

[MIT](LICENSE) — © 2026 ibrah5em, LuF8y, yousefdeeb-112004
