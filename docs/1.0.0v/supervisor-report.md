# Draw-to-Web — Supervisor Architecture Report (v1.0.0)

**Project:** Draw-to-Web Builder
**Author:** Ibrahim Haski (221116)
**Modules covered:** Electron shell · IPC bridge · Document Model · code generator · runtime snippets · SEO injector · accessibility gate · export pipeline · templates · build & CI/CD · **draw-to-create · match-layout · headless MCP server**
**Scope of this report:** the output pipeline and shell Ibrahim owns end-to-end, plus the three new v1.0.0 authoring surfaces (draw / match / MCP) referenced at their integration boundaries. The Zustand stores + history (Yousef) and the canvas / panels UI (LuF8y) are referenced at their contract boundaries (C5, C10).

> **Status:** FINAL for the `v1.0.0` cut — the sprint demo cut. This report
> supersedes `docs/0.2.0v/supervisor-report.md` (v0.3.0) and carries its open
> items forward. v1.0.0 lands three new authoring capabilities (§5a) on top of
> the v0.3.0 architecture without changing the load-bearing data direction.
> §9 (Demo readiness) still records a **conscious waiver**: `v1.0.0` shipped
> without the `X-09` rehearsal and without render-layer perf sign-off
> (`DECISIONS.md` D-02 / **D-04**). Landing the Tier-2 draw/match features is
> itself a documented scope decision (`DECISIONS.md` **D-03**).

## 1. What changed from v0.3.0

v0.3.0 was the M5 polish of the tokens-driven, responsive, opt-in-JS builder.
v1.0.0 keeps that machine unchanged and adds three authoring surfaces, each
pure/headless at the core and reusing the existing Document Model operations
(C3) and export pipeline (C12):

| v0.3.0                                     | v1.0.0                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| Insert elements via sidebar / presets      | **+ Draw a rectangle** on the canvas → interpreted into a placed element      |
| Start from a blank doc or a template       | **+ Match my layout** — fingerprint a rough draft, adopt a bundled pro design |
| Editor drives the pipeline (Electron-only) | **+ Headless MCP server** drives the same pipeline over stdio, no Electron    |
| 871 tests / 93 files                       | **1042 tests / 110 files**                                                    |
| Single perf/test lane                      | Wall-clock budgets split into a dedicated perf lane (`vitest.perf.config.ts`) |

The through-line is unchanged: **the canvas renders the Document Model; the
generator walks it. No layer owns state except the document.** All three new
surfaces respect it — draw/match produce ordinary document nodes/trees, and the
MCP server mutates through the same `Operation` union everything else uses.

## 2. Architecture — three layers, one data direction

```
UI layer       Canvas · Sidebar · Properties · Layers · Tokens · Validation · DrawSurface · MatchLayout   (renderer)
   │
   ▼ writes via operations (C3)
Document layer Types · Schemas · Operations · Tokens · Validation · Migrations · Presets                  (pure)
   │            ▲
   │            └── draw/ (interpret + snap → node) · match/ (signature + matcher → adopt)   (pure, no store)
   ▼ read by stores + generator + MCP
Output layer   Generator (HTML/CSS/JS) · SEO · axe gate · Export orchestrator · ZIP                        (renderer → main)
   │            ▲
   │            └── mcp/ (stdio server → same generate / validate / export entry points)     (headless Node)
   ▼ writes file
File system    index.html · styles.css · scripts.js · assets/ · fonts/  packed as <name>.zip
```

The Document Model (and `src/draw/`, `src/match/`) have **no React, no Zustand,
no DOM imports** — importable from the renderer, the main process, and the MCP
server alike. Everything downstream of the document is a pure function of
`(document, exportOptions)`.

## 3. Process boundaries

- **Main** (`src/main/`) — Electron lifecycle, `BrowserWindow` with
  `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`, menu,
  native dialogs, `fs` writes, the `sharp` image pipeline, the chokidar `.dtw`
  watcher, recent-files persistence. No business logic.
- **Preload** (`src/preload/`) — the security boundary; single typed
  `window.electronAPI` via `contextBridge` (C4), no raw `ipcRenderer` reachable.
- **Renderer** — all UI plus every pure module (document, draw, match, store,
  generator, runtime, seo, export).
- **MCP process** (`mcp/`) — a **fourth** entry point: a headless Node process
  (no Electron, no DOM) that installs an `fs`-backed export shim
  (`electronShim.ts`), builds a `Workspace` session store, and speaks MCP over
  stdio. It reuses the exact renderer-side pure modules; the only substitution is
  the save seam (IPC → `fs`).

Every `ipcMain.handle()` validates input at the boundary (path sanitization that
rejects `..` before `path.normalize`, a 50 MB cap, MIME sniffing). A strict CSP
via `onHeadersReceived` locks `script-src 'self'` in prod (I-ELE-08).

## 4. Document Model (`src/document/`)

The contract that lands first and blocks everything else (C1). Unchanged from
v0.3.0 — summarized here because the new surfaces consume it:

- **`types.ts` (C1) / `schemas.ts` (C2)** — kept in lockstep via `z.infer`.
- **`operations.ts` (C3)** — the `Operation` discriminated union (13 ops) + immer
  mutators. Draw, match-adopt, and every MCP mutation route through this union.
- **`tokens.ts` (C9)** — `resolveToken(tokens, ref, theme)`.
- **`validation.ts` (C8)** — `validateDocument(doc): ValidationReport`; one
  function, two surfaces (live console + export gate), now also a third (MCP).
- **`migrations.ts`** — versioned walker; structured throw on unknown version.
- **`presets/` (C7)** — eight pure factories in `presetsRegistry`.
- **`variables.ts`** — `{{var}}` interpolation at emit time.

## 5. Generator + Runtime + SEO (`src/generator/`, `src/runtime/`, `src/seo/`)

The generator is a **compiler, not an inferer** — it walks `document.tree` and
emits HTML/CSS/JS deterministically (same tree → byte-identical output). Tag
selection is driven by `element.semanticRole` (C10), not spatial heuristics.
Tokens block (`:root` + `[data-theme="dark"]` + `prefers-color-scheme`), Grid +
Flex + `clamp()` (**never `position: absolute`**, regex-guarded), per-breakpoint
media queries on override, LVHA states, skip-link, `rel="noopener"`, CSP meta.
`prettier` runs before output leaves the generator; minify is export-only.
Runtime is opt-in per behavior (eight passive snippets; all flags off → no
`<script>`). SEO post-processes head/OG/JSON-LD/favicon/sitemap/robots
(Lighthouse SEO 1.00 on exported templates).

### 5a. New authoring surfaces (v1.0.0)

**Draw to create (`src/draw/`)** — three pure pieces plus node-mapping helpers:

- `interpret.ts` — `interpretRectangle(shape)`: guesses the element kind a drawn
  rectangle represents, with ranked alternatives, a confidence score, and an
  explainer hint.
- `snap.ts` — `snapToGrid(bounds, gridConfig, breakpoint)`: converts the
  normalised rectangle to a grid placement (column start/span + insertion index).
  Pure math, never pixels.
- `node.ts` — maps a guess + placement onto the document model so the canvas
  hands an ordinary node to the existing `insertElement` op.
- The canvas (`DrawSurface` + `DrawTypePicker`) normalises the drawn rectangle to
  the target container box, builds the node with the existing `createPrimitive`
  factory, and dispatches a normal op. **Drawn pixels never touch the store**;
  the whole draw coalesces into one history entry.

**Match my layout (`src/match/`)** — three pure pieces plus a thin store reuse:

- `signature.ts` — `extractSignature(document)`: a deterministic structural
  fingerprint of a document tree (region map, section kinds, column profiles —
  never pixels).
- `matcher.ts` — `matchLayout(userSignature, library)`: ranked, best-first
  comparison with a per-dimension `MatchBreakdown`.
- `library/` — six bundled professional pages (agency, docs-article,
  gallery-media, landing-saas, portfolio-split, resume-minimal), each shipping a
  **build-time precomputed** signature (`signatures.generated.ts`, regenerated by
  `npm run generate:match-signatures`).
- `adopt.ts` — the only store touch: hydrates a chosen page through the same
  entry point a `.dtw` load uses.

**Headless MCP server (`mcp/`)** — a stdio Model Context Protocol server exposing
~20 tools (`create_document`, `load_document`, `save_document`, `insert_element`,
`insert_preset`, `batch_insert`, `apply_template`, `update_element`,
`move_element`, `remove_element`, `duplicate_element`, `wrap_elements`,
`set_tokens`, `set_theme`, `set_runtime`, `set_seo`, `match_layout`,
`preview_html`, `export_site`). Every tool is a **thin adapter**: it resolves a
document by id, builds an existing `Operation` (C3) or calls an existing
generate / validate / a11y / export / match / preset entry point, and returns
both a readable summary and machine-readable `structuredContent`. No tree is
mutated directly; no validation/generation/a11y logic is reimplemented. It runs
without Electron via `installExportShim` (fs-backed save under `DTW_MCP_DIR`,
default `<cwd>/.dtw-mcp`). `createServer` is transport-agnostic so tests drive it
through an in-memory pair.

## 6. Export pipeline (`src/export/index.ts`, C12)

`exportProject(document, options)` chains **nine stages**, each emitting a
structured progress event:

```
validate → generate → inject-seo → a11y-gate → optimize-images
        → minify → sitemap-robots → bundle → save
```

Result is a discriminated union — `{ success: true, filePath, report }` or
`{ success: false, stage, error, report? }`. The a11y gate
(`src/seo/axeGate.ts`) lazily imports `jsdom` + `axe-core`, runs with
`color-contrast` disabled (contrast validated in the model via chroma-js), and
blocks export on `critical` / `serious`. `dryRun: true` short-circuits after SEO
injection and returns `{ html, css, js, validation }`. The MCP `export_site` and
`preview_html` tools call this same orchestrator (through the fs save shim), so
the accessibility hard gate applies to MCP-driven exports too.

## 7. Performance

Data-layer and export-path budgets are measured headlessly and regression-guarded
in the perf lane (`npm run test:perf`, `vitest.perf.config.ts` — split out in
v1.0.0 so a loaded machine can't flake the default suite). All pass with orders
of magnitude of headroom:

| Metric                                   | Budget    | Measured   | Status |
| ---------------------------------------- | --------- | ---------- | ------ |
| Project save (.dtw serialize, 500 el)    | < 500 ms  | ~0.1 ms    | ✅     |
| Project open (parse + migrate + valid.)  | < 1500 ms | ~1.3 ms    | ✅     |
| Undo/redo round-trip (500 el)            | < 16 ms   | ~0.1 ms    | ✅     |
| Dry-run / code preview                   | < 500 ms  | ~72 ms     | ✅     |
| Full export (nine stages + axe + minify) | < 10 s    | ~0.2–0.3 s | ✅     |

**Render-layer budgets — methodology documented, instrumented run still pending.**
The drag / theme-toggle / breakpoint-switch / cold-start / layers-scroll budgets
are repaint-bound and need the running Electron app + React DevTools profiler.
The architectural levers hold them (`React.memo` on `CanvasNode`, stable
selectors, `react-arborist` windowing, structural sharing of semantic subtrees),
but the measured figures are **not empirically signed off, and `v1.0.0` shipped
with this waived** (`DECISIONS.md` D-02 / D-04). Draw/match add no repaint-hot
path (draw coalesces to one op; match hydrates once), so they don't change the
render-perf picture. This remains **the one open performance risk** and the top
post-release item.

## 8. Build & CI

- **electron-builder** targets Windows NSIS, Linux AppImage + .deb, macOS dmg +
  zip (x64 + arm64) — each native on its own runner; `sharp` / `@img` /
  `lightningcss` binaries `asarUnpack`ed.
- **CI** (`.github/workflows/ci.yml`) runs `lint → typecheck (main + renderer) →
test → test:a11y` with `compile` in parallel, on Node 24 runners
  (`windows-2025` pinned in the matrix).
- **Release** (`.github/workflows/release.yml`) fires on a `v*` tag: `verify`
  re-runs the gates, `package` runs the per-OS matrix, `publish` collects every
  `installers-*` artifact into one GitHub Release.
- **Pre-push** — husky hook (auto-installed via `prepare`) runs
  `lint && typecheck && test`; never bypassed.

**Code signing (`I-BLD-05`) is cut permanently** (`DECISIONS.md` D-01) — builds
ship unsigned; users bypass SmartScreen / Gatekeeper once (documented in README).

## 9. Demo readiness

**`v1.0.0` shipped without the `X-09` rehearsal — a conscious, documented waiver**
(`DECISIONS.md` D-02, carried forward as **D-04**). The code is green — lint, both
typechecks, 1042/1042 tests, compile, determinism, contracts, a11y gate, and the
data-layer + export perf budgets all pass — so the build ships on the automated
suite. What is waived is the _manual_ validation: a presenter running the
**packaged build** end-to-end on **demo hardware** (risk R13) and the
render-layer perf sign-off (§7).

**Accepted risk:** a packaged-build or demo-hardware bug, or a render-layer budget
miss, could surface in front of an audience with no rehearsal having caught it.
**Mitigation owed before the live demo:** run `docs/0.2.0v/x-09-rehearsal.md`
(3× clean) on demo hardware and capture the six render-layer numbers. Until then
`X-09` and `Y-PRF-04`'s render rows remain **open** — the top post-`v1.0.0` item.

## 10. Testing strategy

**1042 tests across 110 files**, mirroring `src/`:

| Suite              | Coverage                                                |
| ------------------ | ------------------------------------------------------- |
| `tests/document/`  | Types, schemas, operations, tokens, validation, presets |
| `tests/generator/` | HTML + CSS + JS emitters, determinism, prettier         |
| `tests/runtime/`   | Runtime snippet behaviour in jsdom                      |
| `tests/seo/`       | head / OG / JSON-LD / sitemap / robots + axe gate       |
| `tests/export/`    | Full pipeline incl. minify + dry-run + self-host fonts  |
| `tests/templates/` | Blank / portfolio / landing / resume round-trips        |
| `tests/main/`      | IPC handlers against real temp dirs                     |
| `tests/store/`     | Document + history stores, persistence                  |
| `tests/ui/`        | Renderer components (Testing Library + jsdom)           |
| `tests/a11y/`      | End-to-end axe-core on rendered output                  |
| `tests/draw/`      | interpret / snap / node + draw integration (4 files)    |
| `tests/match/`     | signature / matcher / library (3 files)                 |
| `tests/mcp/`       | tools / session / integration / phase 2–3 (5 files)     |

Wall-clock perf budgets run in a separate lane (`tests/perf/`,
`npm run test:perf`). Specialized review agents back the suite: `html-validator`,
`generator-determinism-reviewer` (Invariant 5.4), `a11y-gate-reviewer`,
`contract-reviewer`.

## 11. Cross-owner contracts I produce

C1 `Document`/`ElementNode`/`Tokens` · C2 `documentSchema` · C3 `Operation` union
· C4 `electronAPI` · C6 `generate(document)` · C7 `presetsRegistry` · C8
`validateDocument` · C9 `resolveToken` · C11 image-upload IPC · C12
`exportProject`. I consume C5 (stores, Yousef) and C10 (`inferSemantics`, LuF8y).

**v1.0.0 note:** the draw/match/MCP surfaces are **consumers** of C3 / C6 / C7 /
C8 / C12, not new contracts. No C1–C12 contract file was touched by the feature
merge (verified pre-merge), so no `contract-change` ritual applied. The MCP tool
surface is new but **un-contracted** — see §12.

## 12. Open items at handoff

- **Render-layer perf numbers** (`Y-PRF-04`) — data-layer + export budgets pass;
  drag / theme / breakpoint / cold-start figures **NOT measured** at ship
  (waived, D-02 / D-04). Top post-release item — capture during `X-09`.
- **Demo rehearsal (`X-09`)** — not held; `v1.0.0` shipped un-rehearsed. Run the
  run-sheet on demo hardware before any live demo.
- **MCP surface is un-contracted** — the ~20 MCP tools mutate/export documents
  outside the C1–C12 set and the sprint's axe/export gate story. It reuses the
  gated pipeline (so exports are still a11y-gated), but the tool surface itself
  should be brought under a contract before external consumers depend on it.
- **Tier-2 scope** — draw/match are Tier-2 "editor experience"; landing them in
  v1.0.0 (D-03) partially moves the scope line. The rest of `future-authoring.md`
  stays out of scope.
- **Code signing (`I-BLD-05`)** — closed permanently (D-01).

## 13. Summary

v1.0.0 is the sprint demo cut. It adds three authoring surfaces — draw-to-create,
match-layout, and a headless MCP server — on top of the v0.3.0 tokens-driven,
responsive, opt-in-JS builder, without changing the one-way data direction: the
Document Model is the only source of truth, and all three new surfaces mutate
through the same `Operation` union and export through the same nine-stage,
axe-gated pipeline. The suite is green at 1042 tests with determinism and the
no-`position:absolute` invariant enforced by construction. The remaining work is
**not in the code path** — it is the render-layer perf baseline and the demo
rehearsal, both consciously waived (D-04) and tracked as the top post-release
items.
