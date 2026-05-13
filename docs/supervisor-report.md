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
has already been classified by Yousef's engine (or the local stub) into
`SemanticElement`s with explicit `semanticTag` fields. The generator's job is
purely emission: walk the tree, render each tag, accumulate CSS Grid rules.

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

| Layer         | Files                                                                                                 | Strategy                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Unit          | `tests/generator/`, `tests/seo/injectSEO.test.ts`, `tests/project/`, `tests/engine/stubInfer.test.ts` | Pure functions, fast, deterministic                              |
| Integration   | `tests/export/exportProject.test.ts`                                                                  | Mocks engine + IPC, exercises real pipeline                      |
| Round-trip    | `tests/main/ipc.test.ts`                                                                              | Mocks `electron`, calls handlers, writes real files to a tempdir |
| Real axe-core | `tests/seo/axeGate.test.ts`                                                                           | Drives jsdom + axe.run against known-good and known-bad HTML     |

Totals at the time of writing: **102 tests across 9 files, full suite under
3 s on a laptop.** The IPC suite uncovered the path-traversal bug noted in
section 3.6 — a good example of why round-trip tests pay for themselves
even when most of the logic is already covered by unit tests.

## 5. Build & CI

- **electron-builder** packages the app for Windows (NSIS) and Linux
  (AppImage + .deb). Build commands: `npm run build:win`, `npm run build:linux`.
- **CI** runs in GitHub Actions on every push and pull request:
  `lint → typecheck → test → compile`. On tagged commits `v*` it additionally
  packages Linux artifacts and attaches them to the workflow.

## 6. Deviations from the original specification

| Spec item                                                         | What shipped                                     | Why                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Live preview via BrowserView / `<webview>` / hidden BrowserWindow | Sandboxed iframe with `srcdoc`                   | Generated output is zero-JS — the iframe is byte-identical to the export, simpler to wire, no separate process                              |
| Real `inferSemantics`                                             | Local stub fallback in `src/engine/stubInfer.ts` | Yousef's engine is still WIP; the stub lets the rest of the app run end-to-end and will be replaced transparently when the real engine lands |
| Build targets macOS                                               | Not addressed                                    | macOS isn't a development target for the team                                                                                               |

## 7. Open items at handoff

- Yousef's `inferSemantics` — once it ships, the `runEngine` fallback in
  `src/export/index.ts` will dead-stop firing and `src/engine/stubInfer.ts`
  can be deleted.
- Luf8y's canvas interactions (drag/resize/select) and undo/redo middleware.
- Renderer bundle size — jsdom is bundled into the renderer because the
  axe-core gate runs there. A future optimisation is to move the gate into a
  worker or the main process; not done because the current 13 MB bundle
  loads in well under a second on local disk.
- Application icon — currently the default Electron icon. A 512×512 PNG in
  `build/icon.png` will be picked up automatically by electron-builder.

## 8. Summary

The output-layer modules form a single linear pipeline with explicit error
boundaries between stages, a discriminated result type that surfaces failures
specifically, and a hard accessibility gate that blocks export rather than
warning. The test suite covers each stage individually, the pipeline as a
whole, and the IPC round-trip against the real file system. The remaining
work is interface-level (engine implementation, canvas interactions) and
does not change anything in the export path.
