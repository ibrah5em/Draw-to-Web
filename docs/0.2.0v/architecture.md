# Draw-to-Web — Architecture (v0.2.0)

> Companion to `docs/0.2.0v/plan.md` (the execution plan + task list). This
> document describes the **steady-state architecture** of the v0.2.0 build:
> the layers, the data-flow direction, the process boundaries, and the
> cross-owner contracts that hold it together. For the element model
> specifically, see `docs/0.2.0v/element-model.md`.

## 1. One-sentence model

Draw-to-Web is a **deterministic compiler with a visual front-end**: the UI
edits a single in-memory document tree through pure operations, and the
generator walks that same tree to emit human-readable HTML + CSS + opt-in JS.
The canvas is a _rendering_ of the document, never the source of truth.

## 2. Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ UI (src/ui/)                          LuF8y                        │
│   Canvas · Sidebar(Insert) · Properties · Layers · Topbar ·       │
│   Tokens · Validation console · Dialogs                            │
└───────────────┬───────────────────────────────────────────────────┘
                │ dispatch(Operation)            reads Document
                ▼                                      ▲
┌─────────────────────────────────────────────────────────────────┐
│ Element Store (src/store/)            Yousef                       │
│   documentStore · historyStore (immer patches) · sessionStore ·   │
│   persistence (.dtw) · autosave · selectors                       │
└───────────────┬───────────────────────────────────────────────────┘
                │ applies operations to a draft
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Document Model (src/document/)        Ibrahim                      │
│   types(C1) · schemas(C2) · operations(C3) · tokens(C9) ·         │
│   validation(C8) · migrations · presets(C7) · variables           │
└───────────────┬───────────────────────────────────────────────────┘
                │ generate(document) walks the tree
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Generator + SEO + Export (src/generator, src/seo, src/export)     │
│   htmlEmitter · cssEmitter · jsEmitter → SEO inject → axe gate →  │
│   minify → sitemap/robots → ZIP                       Ibrahim     │
└───────────────┬───────────────────────────────────────────────────┘
                │ emits vanilla snippets into output (opt-in only)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Runtime (src/runtime/)                Ibrahim                      │
│   themeToggle · scrollSpy · smoothScroll · mobileNav ·            │
│   navOnScroll · reveals · animationGating · terminalTyping        │
└───────────────────────────────────────────────────────────────────┘

         Main process (src/main/, src/preload/, src/shared/)  Ibrahim
         Electron lifecycle · IPC · native file ops · sharp pipeline
```

## 3. Data flow is one-directional

**UI → Store → Document Model → Generator.**

1. The UI never mutates a node. It dispatches an `Operation` (a discriminated
   union with a `kind` tag — see §6, C3) into the store.
2. The store applies the operation to an immer draft via `produceWithPatches`,
   capturing forward + inverse patches. That patch pair is what `historyStore`
   replays for undo/redo — operations themselves know nothing about history.
3. The canvas re-renders from the new document. For live render it resolves
   token references through `resolveToken` (C9); the generator does **not** —
   it emits `var(--name)` instead so output stays token-driven.
4. The generator (`generate(document): Promise<{ html, css, js }>`) walks the
   tree top-down and emits strings. Same input tree → byte-identical output
   (no timestamps, no random IDs).

The `.dtw` file format is exactly `JSON.stringify(document)` — nothing else.
Load path is **Zod → migrations → Zod again** (validate at the boundary,
trust internal types after).

## 4. Process boundaries

| Process  | Responsibility                                                                  | Hardening                                                                                               |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Main     | App lifecycle, `BrowserWindow`, native file ops, `sharp` image pipeline         | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP via `onHeadersReceived` |
| Preload  | `contextBridge.exposeInMainWorld('electronAPI', { ... })` — typed wrappers only | No raw `ipcRenderer` reachable from the renderer                                                        |
| Renderer | All business logic: UI, store, document model, generator, export orchestration  | Touches Node only via the typed preload bridge                                                          |

The renderer holds the business logic by design — the generator and export
pipeline run in-renderer. The main process is native-OS-only: it writes the
ZIP buffer the renderer hands it (it does not build it), runs `sharp`, and
manages dialogs / recent files / the `.dtw` file watcher. Every IPC handler
validates its input (path sanitization, 50 MB cap, MIME sniff).

## 5. The export pipeline

`exportProject(document, options)` (C12) runs a 9-stage pipeline, emitting a
structured progress event before each stage:

```
validate → generate → inject-seo → a11y-gate → optimize-images
        → minify → sitemap-robots → bundle → save
```

- **validate** — `validateDocument(doc)` (C8). Any `error` (not warning/info)
  blocks the export before a single byte is produced.
- **a11y-gate** — lazy `axe-core` inside `jsdom` on the SEO-enriched HTML. Any
  `critical` or `serious` violation blocks export and returns the report.
- **minify** — `lightningcss` + `html-minifier-terser` + `terser`, run in
  parallel; skipped when `options.minify === false`.
- **save** — the renderer hands the ZIP `ArrayBuffer` to the main process over
  IPC; main does the `fs.writeFile`.

A `dryRun: true` short-circuit returns `{ html, css, js, validation }` without
writing files (powers the Code Preview panel, budget < 500 ms).

## 6. Cross-owner contracts (C1–C12)

These are the sharp interfaces between the three engineers. A breaking change
to any of them requires a PR labeled `contract-change` and review from the
named downstream consumer (see `docs/0.2.0v/plan.md` Section 6).

| #   | Surface                                                    | Producer file                   | Consumers      |
| --- | ---------------------------------------------------------- | ------------------------------- | -------------- |
| C1  | `Document` / `ElementNode` / `Tokens` / … types            | `src/document/types.ts`         | LuF8y, Yousef  |
| C2  | `documentSchema` (Zod, `z.infer` lockstep with C1)         | `src/document/schemas.ts`       | Yousef         |
| C3  | `Operation` union + immer mutators                         | `src/document/operations.ts`    | Yousef         |
| C4  | `electronAPI` typed surface                                | `src/shared/electronAPI.d.ts`   | LuF8y, Yousef  |
| C5  | `useDocumentStore` / `useHistoryStore` / `useSessionStore` | `src/store/*`                   | Ibrahim, LuF8y |
| C6  | `generate(document): { html, css, js }`                    | `src/generator/index.ts`        | export (self)  |
| C7  | `presetsRegistry`                                          | `src/document/presets/index.ts` | LuF8y, Yousef  |
| C8  | `validateDocument(doc): ValidationReport`                  | `src/document/validation.ts`    | LuF8y, export  |
| C9  | `resolveToken(tokens, ref, theme): string`                 | `src/document/tokens.ts`        | LuF8y          |
| C10 | `inferSemantics` (tree → semantic-role hints)              | LuF8y                           | generator      |
| C11 | Image upload IPC (buffer → srcset manifest)                | `src/main/ipc.ts` + preload     | LuF8y          |
| C12 | `exportProject(document, options)`                         | `src/export/index.ts`           | LuF8y          |

Producers C1–C9, C11, C12 are owned by Ibrahim; C5 by Yousef; C10 by LuF8y.

## 7. Invariants the architecture guarantees

These are enforced by tests (regex guards + snapshots) and the a11y gate:

1. **Document is the only source of truth.** Canvas renders it; generator
   walks it; no bespoke per-preset components.
2. **Output is HTML5 + CSS3 + opt-in vetted JS.** Every runtime behavior is an
   independent flag in `document.runtime`; all-off → zero `<script>` tags.
3. **No `position: absolute` anywhere in output.** Layout is Grid + Flexbox +
   `clamp()` only. Regex-guarded in `tests/`.
4. **Tokens-driven output.** Generator emits `:root { --token: value }` +
   `:root[data-theme="dark"]` overrides; element CSS uses `var(--name)`.
5. **Responsive-aware.** Every visual property carries `base` / `tablet` /
   `mobile` / `small`; the generator emits media queries on override only.
6. **Accessibility is a hard gate.** Exactly one `<h1>`, no heading skips,
   `alt` on every `<img>`, ARIA on icon-only buttons, `prefers-reduced-motion`
   honored. `critical`/`serious` axe violations block export.
7. **Deterministic output.** Same input tree → byte-equal HTML/CSS/JS.

## 8. Module ownership

| Module                                                                        | Owner   |
| ----------------------------------------------------------------------------- | ------- |
| `src/main/`, `src/preload/`, `src/shared/`                                    | Ibrahim |
| `src/document/`                                                               | Ibrahim |
| `src/generator/`, `src/runtime/`, `src/seo/`, `src/export/`, `src/templates/` | Ibrahim |
| `src/store/`                                                                  | Yousef  |
| `src/ui/`                                                                     | LuF8y   |
| `electron-builder.yml`, `.github/workflows/`                                  | Ibrahim |

```

```
