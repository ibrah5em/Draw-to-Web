# Draw-to-Web — Supervisor Architecture Report

**Project:** Draw-to-Web Builder
**Author:** Ibrahim Haski (221116)
**Modules covered:** Electron shell · IPC bridge · code generator · SEO injector · accessibility gate · export engine · build pipeline · CI/CD
**Scope of this report:** the modules Ibrahim owns end-to-end. The semantic
inference engine (Yousef) and the canvas UI (Luf8y) are referenced only at
their interface boundaries.

## 1. Problem & goals

The user draws a layout on a canvas; the application produces a portable web
page that is:

1. **Semantic** — uses `<header>`, `<main>`, `<nav>`, `<footer>`, `<h1>`–`<h3>`,
   `<p>`, `<button>`, `<img>` rather than `<div>` soup.
2. **Accessible** — passes axe-core with zero critical or serious violations.
3. **Portable** — a single ZIP containing `index.html` + `styles.css`. Zero
   JavaScript in the generated output.
4. **Responsive** — laid out with CSS Grid / Flexbox / `clamp()`. No absolute
   positioning, no media queries where avoidable.

These goals translate to **hard invariants** enforced by the code:

| Invariant                                 | Enforced by                                   |
| ----------------------------------------- | --------------------------------------------- |
| No JavaScript in generated HTML           | Generator emits no `<script>`; no JS template |
| No `position: absolute`                   | CSS emitter uses Grid + Flexbox exclusively   |
| Grid-aligned positions                    | `x`, `width` are 12-column indices, not px    |
| Zero axe-core critical/serious violations | `runAxeGate` blocks export at the gate stage  |
| Determinism                               | No random IDs, no timestamps, no `Date.now()` |

## 2. Architecture

### 2.1 Three layers, one data direction

```
UI layer       Canvas · Toolbar · Properties · LivePreview · Dialogs   (renderer)
   │
   ▼ writes to
Core layer     Element Store · Engine · Generator · SEO Injector       (renderer, pure)
   │
   ▼ reads from
Output layer   Export Orchestrator · JSZip · IPC bridge                (renderer → main)
   │
   ▼ writes file
File system    index.html + styles.css packed as <name>.zip
```

Data flows one direction. The canvas is a _rendering_ of the element store,
never the model itself. Once an element is in the store, every downstream
stage is a pure function of that store plus a small `SEOConfig`.

### 2.2 Process boundaries

The application runs across three Electron contexts:

- **Main process** (`src/main/`) — Electron lifecycle, menu, native `fs` and
  dialog access. Contains no business logic. Every operation is an
  `ipcMain.handle()` that validates input, performs one file-system action,
  and returns a structured result.

- **Preload** (`src/preload/`) — Defines the entire surface area of native
  capabilities exposed to the renderer via `contextBridge`. The renderer can
  call exactly:
  - `exportZip(buffer, filename)` — write a ZIP via save dialog
  - `saveProject(json, name)` / `openProject()` — `.dtw` file I/O
  - `showSaveDialog(opts)` — generic save dialog
  - `getAppVersion()` — synchronous, stamped at preload startup
  - `onMenuAction(cb)` — receive menu-driven events from main

  `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` are all
  enforced at `BrowserWindow` creation. There is no path for arbitrary code
  in the renderer to reach Node APIs.

- **Renderer** (`src/renderer/`) — All UI plus every pure-business module
  (`store`, `engine`, `generator`, `seo`, `export`, `project`). The renderer
  is where the export pipeline runs end-to-end up until the moment the ZIP
  buffer is handed across IPC.

### 2.3 The export pipeline

`exportProject(elements, seoConfig)` in `src/export/index.ts` is a six-stage
chain, each stage wrapped in its own `try/catch` so the UI can pinpoint where
a failure occurred:

```
┌───────────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐
│ 1. inferSemantics │─▶│ 2. generate() │─▶│ 3. injectSEO  │─▶│ 4. axe-core gate    │
│  (engine — Yousef)│  │  HTML + CSS   │  │ meta · ARIA   │  │ jsdom + axe.run()   │
└───────────────────┘  └───────────────┘  └───────────────┘  └─────────────────────┘
                                                                       │
                                                                       ▼ pass
                                                              ┌────────────────┐
                                                              │ 5. JSZip       │
                                                              │ index.html +   │
                                                              │ styles.css     │
                                                              └────────┬───────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────────┐
                                                              │ 6. IPC export:zip  │
                                                              │ ▶ main process     │
                                                              │ ▶ native dialog    │
                                                              │ ▶ fs.writeFile     │
                                                              └────────────────────┘
```

Result shape (discriminated union):

```ts
type ExportProjectResult =
  | { success: true; filePath: string; report: FullExportReport }
  | { success: false; stage: ExportStage; error: string; report?: FullExportReport }
```

Key choices:

- **Per-stage error tagging.** A user-facing "Export failed at _Accessibility
  check_" is far more actionable than a single string. The `stage` enum maps
  directly to UI labels in `ExportReportDialog`.
- **Report is returned on a11y failure.** When the gate blocks, the violation
  list is the diagnostic. Suppressing it would force the user to guess.
- **Zero IPC traffic before the gate.** The renderer holds the ZIP buffer
  until the gate passes, so the main process never sees blocked content.

## 3. Module-by-module decisions

### 3.1 Code generator (`src/generator/`)

The generator is a **compiler**, not an inferer. The element tree it receives
has already been classified by the engine into `SemanticElement`s with
explicit `semanticTag` fields. The generator's job is purely emission: walk
the tree, render each tag, accumulate CSS Grid rules.

Design choices:

- **Separate emitters** (`htmlEmitter.ts`, `cssEmitter.ts`) so each can be
  snapshot-tested independently. Both are pure.
- **Scoped class names** (`dtw-el-<id>`) to avoid collisions with any future
  embed of the output.
- **Containers explicitly enumerated.** Non-container tags emit
  `<tag>text</tag>`; containers emit open/close pairs and recurse.
- **All text content is HTML-escaped**, including attribute values, before
  emission. The SEO injector applies the same escape policy.

### 3.2 SEO injector (`src/seo/index.ts`)

`injectSEO` post-processes the generator's HTML rather than modifying the
generator. This keeps the generator focused on layout and lets the SEO module
be tested against arbitrary HTML.

Steps:

1. `updateLang` — sets `<html lang="…">` from `config.lang ?? 'en'`.
2. `injectHeadTags` — inserts `<title>`, `<meta name="description">`, OG
   tags, optional `og:image` and `link rel="canonical"` immediately before
   `</head>`. Preserves the generator's `charset` and `viewport` metas.
3. `addAriaRoles` — adds landmark roles to `<header>`/`<nav>`/`<main>`/
   `<footer>` _only if not already present_ — the regex is idempotent.

All user-supplied strings flow through `escapeHtml` before injection. The
test suite includes a dedicated XSS escape case (`<script>alert("xss")</script>`).

### 3.3 Accessibility gate (`src/seo/axeGate.ts`)

The gate uses jsdom + axe-core, which has known integration quirks. The
adopted pattern:

```ts
const dom = new JSDOM(html, { runScripts: 'outside-only' })
dom.window.eval(axe.source)
const results = await dom.window.axe.run(dom.window.document, {
  rules: { 'color-contrast': { enabled: false } },
})
```

Decisions:

- **`runScripts: 'outside-only'`** — allows our axe-source injection without
  executing any `<script>` tags that may be in the input. The generator
  never emits scripts, but this is defence-in-depth.
- **`color-contrast` disabled.** jsdom does not perform layout or compute
  styles, so contrast checks either crash or produce false positives.
- **Block on `critical` or `serious` only.** `moderate` and `minor` are
  surfaced in the report but do not block export. This matches the WCAG-A
  bar most projects target.
- **Violations are aggregated by rule.** axe-core reports node arrays; the
  report shows one entry per rule with a `nodes` count, so the dialog never
  becomes a wall of duplicates.

**Execution boundary.** jsdom uses Node-only APIs and cannot run in the
sandboxed renderer. `runAxeGate(html)` detects the renderer and delegates to
the main process via the `a11y:run-axe` IPC handler, which calls the same
`runAxeGateNode` implementation. In Node contexts (tests, main handler) the
function runs locally. Three runtime details made this work on Electron 28's
bundled Node 18:

- `jsdom` and `axe-core` live in `dependencies` (not `devDependencies`) so
  electron-vite's `externalizeDepsPlugin` keeps them out of the main bundle.
  Inlining them caused Rollup to hoist `undici`'s lazy `require('node:sqlite')`
  into a top-level eager require, which Node 18 rejects with
  `ERR_UNKNOWN_BUILTIN_MODULE`.
- `jsdom` is pinned to `^25.x` — 26+ pulls `html-encoding-sniffer@5`, which
  uses ESM-only `@exodus/bytes` and cannot be `require()`d on Node 18.
- The dynamic `import('axe-core')` is unwrapped via `axeMod.default ?? axeMod`.
  Node's native CJS-from-ESM interop nests the export under `.default`;
  Vitest's loader flattens it. Without the unwrap, `axe.source` was
  `undefined` and `window.axe` was never populated.

### 3.4 Combined report (`generateFullReport`)

The pre-/post-export dialog needs three things:

1. SEO summary numbers (title/description lengths, OG presence, h1 count).
2. The a11y verdict and violation list.
3. Actionable guidance strings.

`generateFullReport` produces all three. The guidance lines use a marker
convention: `⚠` for informational findings (over-long title, missing OG
image), `✗` for blocking accessibility violations. This lets the UI render
a single flat list without further classification.

### 3.5 Project files (`src/project/`)

`.dtw` is the on-disk representation of an in-progress design. The schema is
versioned (`version: 1`) and validated on load:

- `deserializeProject` returns `null` on any malformed input — an unknown
  version, a missing field, or an element with an invalid type. The renderer
  surfaces a single user-facing error in that case.
- Element validation is exhaustive: every field is type-checked, and `type`
  is enforced against the closed `ElementType` union.

This pattern protects against:

- Casual hand-editing producing schema drift
- Old `.dtw` files attempting to load against newer schemas
- Malicious files exploiting a `JSON.parse` → store hydration

### 3.6 IPC handlers (`src/main/ipc.ts`)

Three handlers, all defensive in the same way:

| Handler        | Validates                                    | Writes to        |
| -------------- | -------------------------------------------- | ---------------- |
| `export:zip`   | `ArrayBuffer`, ≤ 50 MB, filename is a string | Save-dialog path |
| `project:save` | `string`, ≤ 10 MB                            | Save-dialog path |
| `project:open` | `.dtw` extension, ≤ 10 MB after read         | (read-only)      |

`sanitizePath` rejects any input containing `..` segments **before**
`path.normalize` runs. (`normalize` collapses `..` into a path that _looks_
canonical — letting `/tmp/../etc/passwd` through as `/etc/passwd`.) The IPC
test suite explicitly verifies this case.

## 4. Testing strategy

The suite has three layers:

| Layer         | Files                                                                    | Strategy                                                         |
| ------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Unit          | `tests/generator/`, `tests/seo/injectSEO.test.ts`, `tests/project/`      | Pure functions, fast, deterministic                              |
| Integration   | `tests/export/exportProject.test.ts`, `tests/export/e2eValidate.test.ts` | Mocks engine + IPC, exercises real pipeline                      |
| Round-trip    | `tests/integration/ipcRoundTrip.test.ts`                                 | Mocks `electron`, calls handlers, writes real files to a tempdir |
| Real axe-core | `tests/seo/axeGate.test.ts`                                              | Drives jsdom + axe.run against known-good and known-bad HTML     |

Totals at the v0.1.0 release: **167 tests across 17 files, full suite under
3 s on a laptop.** The IPC suite uncovered the path-traversal bug noted in
section 3.6 — a good example of why round-trip tests pay for themselves
even when most of the logic is already covered by unit tests.

One caveat surfaced post-v0.1.0: Vitest's CJS-to-ESM shim flattens the
`axe-core` namespace, hiding the `axe.default` interop that the bundled
main-process build needed. The lesson is that for code paths that only run
in the packaged Electron main process, the test suite alone is not a
sufficient integration check — an `npm run dev` smoke test against the
real Electron runtime is the load-bearing validation.

## 5. Build & CI

- **electron-builder** packages the app for Windows (NSIS) and Linux
  (AppImage + .deb). Build commands: `npm run build:win`, `npm run build:linux`.
  Windows is cross-built from Linux through Wine; both targets produce
  identical artifacts to native builds for unsigned installers.
- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request:
  `lint → typecheck → test` (verify job) and `compile` (build job). On tag
  pushes matching `v*` it additionally installs Wine, cross-builds the
  Windows NSIS installer alongside the Linux AppImage + .deb, and attaches
  all three to a GitHub Release via `softprops/action-gh-release`.
  `electron-builder` is invoked with `--publish never` so it does not also
  attempt to publish the artifacts independently.
- Tag `v0.1.0` is the first end-to-end release; the artifacts are published
  at `github.com/ibrah5em/Draw-to-Web/releases/tag/v0.1.0`.

## 6. Deviations from the original specification

| Spec item                                                         | What shipped                   | Why                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Live preview via BrowserView / `<webview>` / hidden BrowserWindow | Sandboxed iframe with `srcdoc` | Generated output is zero-JS — the iframe is byte-identical to the export, simpler to wire, no separate process |
| Build targets macOS                                               | Not addressed                  | macOS isn't a development target for the team                                                                  |

## 7. Open items at handoff

- Application icon — currently the default Electron icon. A 512×512 PNG in
  `build/icon.png` will be picked up automatically by electron-builder.
- `actions/checkout@v4`, `actions/setup-node@v4`, and
  `softprops/action-gh-release@v2` log Node 20 deprecation warnings on
  GitHub Actions runners. Upgrades are due before June 2026 when Node 24
  becomes the default runtime.
- macOS target — not built; the team works on Linux/Windows only. The
  electron-builder config does not list a `mac:` section.

## 8. Summary

The output-layer modules form a single linear pipeline with explicit error
boundaries between stages, a discriminated result type that surfaces failures
specifically, and a hard accessibility gate that blocks export rather than
warning. The test suite covers each stage individually, the pipeline as a
whole, and the IPC round-trip against the real file system. The remaining
work is interface-level (engine implementation, canvas interactions) and
does not change anything in the export path.
