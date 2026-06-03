# Draw-to-Web — Supervisor Architecture Report (v0.2.0)

**Project:** Draw-to-Web Builder
**Author:** Ibrahim Haski (221116)
**Modules covered:** Electron shell · IPC bridge · Document Model · code generator · runtime snippets · SEO injector · accessibility gate · export pipeline · templates · build & CI/CD
**Scope of this report:** the modules Ibrahim owns end-to-end. The Zustand
stores + history (Yousef) and the canvas / panels UI (LuF8y) are referenced
only at their interface boundaries (contracts C5, C10).

> **Status:** DRAFT. Section 7 (Performance) is now filled — `Y-PRF-04`
> (`docs/0.2.0v/perf-baseline.md`, Yousef) has landed. Section 9 (Demo
> readiness) still depends on `X-09` (the demo rehearsal), which has not been
> held; it is stubbed below and must be filled before this report — and the
> `v0.3.0` tag — is considered complete.

## 1. What changed from v0.1.0

The v0.1.0 report described a six-stage, zero-JS pipeline driven by a flat
element store. v0.2.0 is a different machine. The load-bearing changes:

| v0.1.0                                   | v0.2.0                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Flat element store, classified on export | **Document Model** is the single source of truth (`src/document/`)        |
| Zero JavaScript in output                | **Opt-in vetted runtime snippets**; all flags off → JS-free output        |
| Raw values in CSS                        | **Tokens-driven** — `var(--token)` refs + `:root` / `[data-theme]` blocks |
| Single desktop layout                    | **Responsive** — `base / tablet / mobile / small` per visual property     |
| Six-stage export                         | **Nine-stage export** (SEO injection, image optimize, sitemap/robots)     |
| Semantic tag inferred late               | `semanticRole` carried on the node; generator is pure emission            |

The through-line: **the canvas renders the Document Model; the generator walks
it.** No layer owns state except the document.

## 2. Architecture — three layers, one data direction

```
UI layer       Canvas · Sidebar (Insert) · Properties · Layers · Tokens · Validation   (renderer)
   │
   ▼ writes via operations
Document layer Types · Schemas · Operations · Tokens · Validation · Migrations · Presets (pure, no React/DOM)
   │
   ▼ read by stores + generator
Output layer   Generator (HTML/CSS/JS) · SEO · axe gate · Export orchestrator · ZIP      (renderer → main)
   │
   ▼ writes file
File system    index.html · styles.css · scripts.js · assets/ · fonts/  packed as <name>.zip
```

The Document Model has **no React, no Zustand, no DOM imports** — it is
importable from the renderer, the main process, and future Node tooling alike
(`.claude/rules/document-model.md`). Everything downstream of the document is a
pure function of `(document, exportOptions)`.

## 3. Process boundaries

- **Main** (`src/main/`) — Electron lifecycle, `BrowserWindow` with
  `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`, the
  application menu, native dialogs, `fs` writes, the `sharp` image pipeline,
  the chokidar `.dtw` watcher, and recent-files persistence. No business logic.
- **Preload** (`src/preload/`) — the security boundary. Exposes a single typed
  `window.electronAPI` via `contextBridge` (C4); no raw `ipcRenderer` is
  reachable from the renderer.
- **Renderer** — all UI plus every pure module (document, store, generator,
  runtime, seo, export). The export pipeline runs end-to-end in the renderer
  up to the point the ZIP buffer crosses IPC to be written.

Every `ipcMain.handle()` validates input at the boundary (path sanitization
that rejects `..` segments **before** `path.normalize`, a 50 MB cap, MIME
sniffing on uploads). A strict CSP is applied via `onHeadersReceived` — prod
locks `script-src 'self'`; dev relaxes it for HMR (`I-ELE-08`).

## 4. Document Model (`src/document/`)

The contract that lands first and blocks everything else (C1).

- **`types.ts` (C1) / `schemas.ts` (C2)** — kept in lockstep via
  `type X = z.infer<typeof xSchema>`, asserted at compile time. A TypeScript
  shape change and its Zod schema change in the same commit. Files load through
  Zod → migrations → Zod again.
- **`operations.ts` (C3)** — the `Operation` discriminated union (13 ops) plus
  immer mutators, each a pure `(draft, op) => void`. The UI never mutates a node
  directly; coalescing semantics interact with Yousef's history patches (C5).
- **`tokens.ts` (C9)** — `resolveToken(tokens, ref, theme)`, the single
  theme-aware token→CSS-value resolver. The canvas calls it for live render;
  the generator does **not** (it emits `var(--name)`).
- **`validation.ts` (C8)** — `validateDocument(doc): ValidationReport` returning
  `{ errors, warnings, infos }`, each `{ message, nodeId?, fix? }`. Rules:
  single-`<h1>`, no heading-level skips, `alt` presence, token-ref integrity,
  duplicate ids, contrast (chroma-js, AA default / AAA toggle), unused tokens.
  Consumed by LuF8y's live console (L-VAL-01) **and** the export gate
  (I-EXP-02) — one function, two surfaces.
- **`migrations.ts`** — versioned walker; structured throw on an unknown
  version so an old/forged `.dtw` can never silently hydrate.
- **`presets/` (C7)** — eight pure factories `(args, ctx) => ElementNode`
  registered in `presetsRegistry`. Presets compose primitives; they never
  define new element types. Adding a preset = a factory + a registry entry,
  no UI changes.
- **`variables.ts`** — `{{var}}` interpolation in text + attribute values at
  emit time (I-DOC-08).

## 5. Generator + Runtime + SEO (`src/generator/`, `src/runtime/`, `src/seo/`)

The generator is a **compiler, not an inferer**. It walks `document.tree` and
emits HTML/CSS/JS deterministically — same input tree → byte-identical output
(no random IDs, no timestamps). Tag selection is driven by `element.semanticRole`
(preserved by LuF8y's `inferSemantics`, C10), not by spatial heuristics.

Key emission rules (`.claude/rules/code-generator.md`):

- **Tokens block** — `:root { --token: value }` for every token, plus
  `:root[data-theme="dark"]` overrides and a
  `@media (prefers-color-scheme: dark)` block so the OS preference wins until
  the user toggles. Token-bound props reference `var(--name)`; only the
  free-value escape hatch emits raw values.
- **Layout** — CSS Grid + Flexbox + `clamp()`, **never `position: absolute`**.
  A regex guard in tests enforces this (Invariant 5.4).
- **Responsive** — per-breakpoint values become `@media (max-width: 1024 / 768
/ 480px)` blocks, emitted only on override.
- **States** — `:hover` / `:focus-visible` / `:active` in LVHA order, emitting
  only the overridden properties.
- **Always emitted** — skip-to-content link as first `<body>` child (I-GEN-19),
  `rel="noopener noreferrer"` on every `target="_blank"` (I-GEN-17), CSP meta
  (I-GEN-20). `prettier` runs on HTML + CSS before they leave the generator;
  minification happens only in the export pipeline.

**Runtime** is opt-in per behavior via `document.runtime` flags. The JS emitter
concatenates only enabled snippets into an IIFE; **if every flag is `false`, no
`<script>` tag is emitted at all.** Eight snippets ship: `themeToggle`,
`scrollSpy`, `smoothScroll`, `mobileNav`, `navOnScroll`, `reveals`,
`animationGating`, `terminalTyping`. Every snippet is passive (IntersectionObserver
/ `requestAnimationFrame`, never raw scroll listeners), idempotent, honours
`prefers-reduced-motion`, and works in isolation. The theme toggle additionally
ships an inline `<head>` script reading `localStorage` before first paint — the
FOUC guard.

**SEO** post-processes generated HTML: head injector (title/description/
theme-color/canonical/robots), Open Graph + Twitter `summary_large_image`,
JSON-LD (`Person`/`Organization`/`WebSite`, built via `JSON.stringify` never
string concat), inline-SVG favicon with `prefers-color-scheme`, `preconnect` /
`dns-prefetch` per external origin, and `sitemap.xml` + `robots.txt` emitters.
Lighthouse SEO scores 1.00 on the exported templates (`verify:exports`).

## 6. Export pipeline (`src/export/index.ts`, C12)

`exportProject(document, options)` chains **nine stages**, each emitting a
structured progress event `(stage, index, total)`:

```
validate → generate → inject-seo → a11y-gate → optimize-images
        → minify → sitemap-robots → bundle → save
```

Result is a discriminated union — `{ success: true, filePath, report }` or
`{ success: false, stage, error, report? }` — so the UI can say "Export failed
at _Accessibility check_" rather than surface one opaque string.

Design choices carried forward and extended from v0.1.0:

- **Validation/a11y gate before any IPC.** The renderer holds the bundle until
  the axe gate passes; the main process never sees blocked content.
- **`a11y-gate`** (`src/seo/axeGate.ts`) lazily imports `jsdom` + `axe-core`,
  builds a DOM with `runScripts: 'outside-only'` (defence-in-depth — the
  generator emits no inline scripts into the gated HTML), and runs axe with
  `color-contrast` disabled (jsdom computes no layout, so contrast checks false-
  positive; contrast is instead validated in the model via chroma-js). Only
  `critical` / `serious` impacts block export; `moderate` / `minor` are
  reported but non-blocking.
- **Export options** — `{ minify, inlineJS, selfHostFonts, includeSourceComments,
theme }`. `selfHostFonts` fetches gstatic woff2 into `fonts/` with
  deterministic names and rewrites `@font-face` (I-EXP-05), behind a host
  allowlist.
- **`dryRun: true`** short-circuits after SEO injection and returns
  `{ html, css, js, validation }` strings without writing — powers the code
  preview (~324 ms on portfolio, well under the 500 ms budget).

The `axe-core` / `jsdom` integration retains the v0.1.0 lessons that made it
work on Electron's bundled Node: both live in `dependencies` (not
`devDependencies`) so electron-vite externalizes them; the dynamic
`import('axe-core')` is unwrapped via `axeMod.default ?? axeMod` for CJS-from-ESM
interop.

## 7. Performance

Section 14 of `docs/0.2.0v/plan.md` defines the hard budgets. The measured
baseline lives in `docs/0.2.0v/perf-baseline.md` (`Y-PRF-04`, 500-element
reference document, median of 30 iterations). It splits cleanly into two
categories by how they are measured.

**Data-layer budgets — measured headlessly, regression-guarded.** These three
are pure JS/data work and are asserted by `tests/perf/editorPerf.test.ts` on
every run, so a regression trips the suite rather than waiting for a manual
profiler session. All three pass with multiple orders of magnitude of
headroom:

| Metric                                  | Budget    | Measured | Status |
| --------------------------------------- | --------- | -------- | ------ |
| Project save (.dtw serialize, 500 el)   | < 500 ms  | 0.07 ms  | ✅     |
| Project open (parse + migrate + valid.) | < 1500 ms | 1.27 ms  | ✅     |
| Undo/redo round-trip (500 el)           | < 16 ms   | 0.11 ms  | ✅     |

**Export-path budgets — measured on my own pipeline.** Both pass:

- Portfolio full export (nine stages, incl. axe gate + minify): **~1.9 s**.
- Dry-run / code-preview path: **~324 ms** (budget < 500 ms).

**Render-layer budgets — methodology documented, instrumented run pending.**
The drag / theme-toggle / breakpoint-switch / cold-start / layers-scroll
budgets are repaint-bound and cannot be read by the headless harness; they
need the running Electron app and the React DevTools profiler. `perf-baseline.md`
specifies the exact procedure (load Portfolio → 500-element stress fixture →
record in profiler). The architectural levers that hold them are already in
place — `React.memo` on `CanvasNode` (`Y-PRF-01`), stable selectors
(`Y-PRF-02`), and `react-arborist` windowing on the layers tree (`Y-PRF-03`) —
but the measured FPS / millisecond figures are marked _pending instrumented
run_ in the baseline. **This is the one open performance risk** (Section 16,
R-class): the budgets are expected to pass on the strength of the memoization
work, but they are **not empirically signed off, and `v0.3.0` shipped with this
waived** (`DECISIONS.md` D-02). The instrumented run still owes — it should fold
into `X-09` (demo rehearsal) on the demo machine, not a dev box — and is the top
post-release item.

## 8. Build & CI

- **electron-builder** (`electron-builder.yml`) targets Windows NSIS, Linux
  AppImage + .deb, and macOS dmg + zip (x64 + arm64) — each built natively on
  its own CI runner. `sharp` / `@img` / `lightningcss` native binaries are
  `asarUnpack`ed.
- **CI** (`.github/workflows/ci.yml`) runs `lint → typecheck (main + renderer)
→ test → test:a11y` on every push and PR, with `compile` in parallel. The
  a11y gate is wired into PR checks.
- **Release** (`.github/workflows/release.yml`) fires on a `v*` tag: `verify`
  re-runs the three gates on the tagged commit, `package` runs the per-OS
  matrix, `publish` collects every `installers-*` artifact into a single
  GitHub Release with auto-generated notes.
- **Pre-push** — a husky hook (auto-installed via `prepare`) runs
  `lint && typecheck && test`; never bypassed with `--no-verify`.

**Code signing (`I-BLD-05`) is cut from scope — permanently.** No Authenticode
cert and no Apple Developer ID, and the team has decided not to acquire them, so
it is dropped from the M5 / `v0.3.0` gate (the build gate is `I-BLD-01..04`).
Builds ship unsigned for good; users run them with a one-time manual bypass
(documented in the README). Should that ever change, adding signing is a config
block + a `signtool` / `notarytool` step; no architectural work, the matrix
already runs natively per OS.

## 9. Demo readiness

**`v0.3.0` shipped without the `X-09` rehearsal — a conscious, documented
waiver** (`DECISIONS.md` D-02, 2026-06-03). The sacred final integration day
(full demo end-to-end 3×, bug-squash only) was **not held**. The code is green —
lint, both typechecks, 871/871 tests, compile, determinism, contracts, and the
data-layer + export performance budgets all pass — so the build ships on the
strength of the automated suite. What was waived is the _manual_ validation: a
presenter running the **packaged build** end-to-end on **demo hardware** (risk
R13) and the render-layer perf sign-off (§7).

**Accepted risk:** a packaged-build or demo-hardware bug, or a render-layer
budget miss, could surface in front of an audience with no rehearsal having
caught it. Mitigation owed before any live demo: run the turnkey rehearsal in
`docs/0.2.0v/x-09-rehearsal.md` (3× clean) and capture the six render-layer
numbers per §7. Until then `X-09` and `Y-PRF-04`'s render rows remain **open**,
tracked as the top post-`v0.3.0` item.

## 10. Testing strategy

~820 tests across 93 files, mirroring `src/`:

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

Specialized review agents back the suite: `html-validator`,
`generator-determinism-reviewer` (Invariant 5.4 — no `position: absolute`),
`a11y-gate-reviewer`, and `contract-reviewer` for C1–C12 changes.

## 11. Cross-owner contracts I produce

| #   | Contract                              | Consumers     |
| --- | ------------------------------------- | ------------- |
| C1  | `Document` / `ElementNode` / `Tokens` | LuF8y, Yousef |
| C2  | `documentSchema` (Zod, lockstep)      | Yousef        |
| C3  | `Operation` union + mutators          | Yousef        |
| C4  | `electronAPI` typed surface           | LuF8y, Yousef |
| C6  | `generate(document)`                  | self (export) |
| C7  | `presetsRegistry`                     | LuF8y, Yousef |
| C8  | `validateDocument`                    | LuF8y, self   |
| C9  | `resolveToken`                        | LuF8y         |
| C11 | Image-upload IPC contract             | LuF8y         |
| C12 | `exportProject`                       | LuF8y         |

I consume C5 (`useDocumentStore` / `useHistoryStore` / `useSessionStore`,
Yousef) and C10 (`inferSemantics`, LuF8y).

## 12. Open items at handoff

- **Render-layer perf numbers** — `docs/0.2.0v/perf-baseline.md` (`Y-PRF-04`)
  has landed and the data-layer + export budgets pass; the drag / theme /
  breakpoint / cold-start figures were **NOT measured at `v0.3.0` ship**
  (waived, `DECISIONS.md` D-02). Top post-release item — capture during `X-09`.
- **Demo rehearsal (`X-09`)** — not held; `v0.3.0` shipped un-rehearsed (waived,
  `DECISIONS.md` D-02). Run the `x-09-rehearsal.md` run-sheet before any live demo.
- **Code signing (`I-BLD-05`)** — closed: cut from scope permanently (no certs, won't acquire); dropped from the release gate.

## 13. Summary

v0.2.0 turns the v0.1.0 prototype into a tokens-driven, responsive, opt-in-JS
builder whose single source of truth is the Document Model. The output pipeline
is a nine-stage linear chain with per-stage error boundaries, a discriminated
result type, and a hard accessibility gate that blocks rather than warns.
Determinism is enforced by construction and by tests; the no-`position:absolute`
invariant is regex-guarded. The remaining work to cut `v0.3.0` is **not in the
code path** — it is the perf baseline (Yousef) and the demo rehearsal (team).
