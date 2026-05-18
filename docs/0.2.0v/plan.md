# Draw-to-Web — Execution Plan v0.2.0

> **Replaces:** `docs/0.1.0v/*` (the shipped v0.1.0 architecture, element model, roles, supervisor report).
> **Date:** May 2026
> **Team:** Ibrahim Haski (Electron + Document Model + Generator + Export), LuF8y (UI), Yousef (Store + History + Persistence)
> **Primary tool:** Claude Code
> **Shape:** task-driven, not time-boxed. Every task has an owner, a priority, and explicit dependencies. Milestones are gated by task completion, not by calendar weeks.
>
> This document is the single source of truth for v0.2.0. If a task isn't listed in Section 10 or Section 12, it isn't in this release.

---

## Table of Contents

1. [North Star](#1-north-star)
2. [Scope Tiers](#2-scope-tiers)
3. [Relaxed Rules from v0.1.0](#3-relaxed-rules-from-v010)
4. [Guiding Principles](#4-guiding-principles)
5. [Architecture](#5-architecture)
6. [Cross-Owner Contracts](#6-cross-owner-contracts)
7. [Day 0 — Setup](#7-day-0--setup)
8. [Settled Decisions](#8-settled-decisions)
9. [Library-to-Feature Map](#9-library-to-feature-map)
10. [Tasks](#10-tasks)
    - [10.1 Ibrahim — Electron Shell](#101-ibrahim--electron-shell-i-ele)
    - [10.2 Ibrahim — Document Model](#102-ibrahim--document-model-i-doc)
    - [10.3 Ibrahim — Generator](#103-ibrahim--generator-i-gen)
    - [10.4 Ibrahim — Runtime Snippets](#104-ibrahim--runtime-snippets-i-run)
    - [10.5 Ibrahim — SEO](#105-ibrahim--seo-i-seo)
    - [10.6 Ibrahim — Export Pipeline](#106-ibrahim--export-pipeline-i-exp)
    - [10.7 Ibrahim — Templates](#107-ibrahim--templates-i-tpl)
    - [10.8 Ibrahim — Build & CI](#108-ibrahim--build--ci-i-bld)
    - [10.9 LuF8y — App Shell & Canvas](#109-luf8y--app-shell--canvas-l-can)
    - [10.10 LuF8y — Layers Panel](#1010-luf8y--layers-panel-l-lyr)
    - [10.11 LuF8y — Insert Sidebar](#1011-luf8y--insert-sidebar-l-sbr)
    - [10.12 LuF8y — Properties Panel](#1012-luf8y--properties-panel-l-prp)
    - [10.13 LuF8y — Topbar](#1013-luf8y--topbar-l-top)
    - [10.14 LuF8y — Tokens Panel](#1014-luf8y--tokens-panel-l-tkn)
    - [10.15 LuF8y — Validation Console](#1015-luf8y--validation-console-l-val)
    - [10.16 LuF8y — Dialogs, Shortcuts, Polish](#1016-luf8y--dialogs-shortcuts-polish-l-dlg)
    - [10.17 Yousef — Document Store](#1017-yousef--document-store-y-str)
    - [10.18 Yousef — History](#1018-yousef--history-y-hst)
    - [10.19 Yousef — Persistence & Recovery](#1019-yousef--persistence--recovery-y-per)
    - [10.20 Yousef — Performance](#1020-yousef--performance-y-prf)
    - [10.21 Cross-Cutting Rituals](#1021-cross-cutting-rituals-x)
11. [Tier 1 Feature Checklist](#11-tier-1-feature-checklist)
12. [Additional In-Scope Features](#12-additional-in-scope-features)
13. [Testing Strategy](#13-testing-strategy)
14. [Performance Budgets](#14-performance-budgets)
15. [Security & Hardening](#15-security--hardening)
16. [Risk Register](#16-risk-register)
17. [Milestones & Definition of Done](#17-milestones--definition-of-done)
18. [Scope-Cut Triggers](#18-scope-cut-triggers)
19. [Demo Plan](#19-demo-plan)
20. [Release & Distribution](#20-release--distribution)
21. [Documentation Deliverables](#21-documentation-deliverables)
22. [Out of Scope — Tier 2 / Tier 3](#22-out-of-scope--tier-2--tier-3)
23. [Honest Summary](#23-honest-summary)
24. [Appendix A — Install List](#appendix-a--install-list)
25. [Appendix B — Using Claude Code](#appendix-b--using-claude-code)
26. [Appendix C — File Glossary](#appendix-c--file-glossary)

---

## 1. North Star

The target output is `draft/Template/index.html` — a modern single-page portfolio with:

- Dark + light theme with toggle and `prefers-color-scheme` default.
- Fixed blurred navigation with scroll-spy, scroll-position style change, and mobile hamburger.
- Full-viewport hero, About / Projects / Stack / Connect sections, semantic footer.
- Tokens-driven design (CSS custom properties on `:root`, theme overrides on `[data-theme="..."]`).
- Smooth scroll, IntersectionObserver reveals, animated terminal card.
- Responsive without media-query gymnastics (`clamp()`, auto-fit grid, container queries where it pays).

**The app must let a user author that page without writing code.** Anything that doesn't move us toward that demo is out of scope.

---

## 2. Scope Tiers

| Tier       | Source                                                                           | What it covers                            | In this release? |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------- | ---------------- |
| **Tier 1** | [`draft/Features/features.md`](../../draft/Features/features.md)                 | Output capabilities to match the template | ✅ Yes           |
| **Tier 2** | [`draft/Features/future-authoring.md`](../../draft/Features/future-authoring.md) | Editor experience to replace hand-coding  | ❌ Post-release  |
| **Tier 3** | [`draft/Features/future-product.md`](../../draft/Features/future-product.md)     | Cloud, accounts, collaboration, billing   | ❌ Years out     |

The explicit cliff between Tier 1 and Tier 2/3 is in [Section 22](#22-out-of-scope--tier-2--tier-3).

---

## 3. Relaxed Rules from v0.1.0

Two v0.1.0 rules are dropped because they make the target template impossible:

1. **Zero-JS output is dropped.** The generator may emit small, vetted, **opt-in** runtime snippets (theme toggle, scroll-spy, nav-on-scroll, mobile menu, IntersectionObserver reveals, animation play-state gating, terminal typing). Each is independently toggleable; if all are off, output ships zero JS.
2. **Self-contained output is dropped.** The generator may emit `<link>` tags to font (Google Fonts) and icon CDNs with `preconnect` and `dns-prefetch` hints. A "self-host fonts" export option remains for offline use.

Everything else carries forward — 12-column grid, no absolute positioning, semantic correctness, axe-core hard gate.

---

## 4. Guiding Principles

1. **Document Model is the only source of truth.** Canvas, properties panel, layers tree, generator all read/write the same tree. The canvas is a _rendering_ of the document, never the model.
2. **Tokens-driven design.** Properties bind to named tokens; no raw hex outside the explicit "free value" escape hatch.
3. **Composition over enumeration.** Card / Hero / Nav are presets composed from primitives, not new element types.
4. **Semantic correctness by construction.** A hero is a `<section>` because it was inserted as a Hero preset, not because we heuristically guessed.
5. **Responsive-aware from the start.** Every visual property supports `base` / `tablet` / `mobile` / `small` values.
6. **Validation as a gate.** Errors block export; warnings inform.
7. **Process boundaries are sharp.** Main process is native-OS-only; renderer holds business logic; preload exposes typed wrappers only.
8. **Validate at the edge, trust inside.** Zod at IPC and file-load boundaries; pure TypeScript types between modules.
9. **No `any`.** `unknown` + type guards or Zod parses. Enforced by ESLint.
10. **Determinism.** Same document tree → byte-identical HTML/CSS output (no random IDs, no timestamps).

---

## 5. Architecture

### 5.1 Layers

```
UI                  → Canvas, Sidebar (Insert), Properties, Layers, Topbar, Tokens, Validation
Document Model      → Types, Operations, Tokens, Validation, Migrations, Presets
Element Store       → Zustand stores (document, history) + persistence (.dtw)
Generator + Export  → HTML/CSS/JS emission → SEO → Validation → ZIP
Runtime             → Vanilla JS injected into output (opt-in snippets only)
Main Process        → Electron lifecycle, IPC, native file ops, sharp pipeline
```

### 5.2 Project Structure

```
src/
  main/             Electron lifecycle, BrowserWindow, app menu, file ops
  preload/          contextBridge typed electronAPI
  shared/           Types shared across processes (electronAPI.d.ts, ipc-channels.ts)
  document/         Document Model core
    types.ts
    schemas.ts        (Zod, lockstep with types.ts)
    tokens.ts
    operations.ts
    validation.ts
    migrations.ts
    presets/          (hero-centered, hero-split, cards-grid-3col, card-basic,
                       cta-banner, footer-simple, footer-columns, nav-fixed)
  store/
    documentStore.ts
    historyStore.ts
    sessionStore.ts   (UI state: selection, breakpoint, active state, panel sizes)
  ui/
    canvas/
    panels/           (properties, tokens, validation, document-settings, assets, code-preview)
    sidebar/          (insert: sections / components / elements)
    topbar/           (breakpoint switcher, theme toggle, export, grid overlay)
    layers/           (react-arborist tree)
    dialogs/          (welcome, export-options, document-settings)
  generator/
    htmlEmitter.ts
    cssEmitter.ts
    jsEmitter.ts
    index.ts
  runtime/            (vanilla JS snippets injected into output)
    themeToggle.ts
    scrollSpy.ts
    navOnScroll.ts
    mobileNav.ts
    reveals.ts
    animationGating.ts
    terminalTyping.ts
  seo/                (head, OG, JSON-LD, sitemap, robots)
  export/             (validation gate → pipeline → ZIP)
  templates/          (portfolio.ts, landing.ts, resume.ts, blank.ts)
tests/
  fixtures/           (sample document trees, golden HTML/CSS outputs)
  unit/
  integration/
  e2e/
```

### 5.3 Module Ownership

| Module                                                                                         | Owner   |
| ---------------------------------------------------------------------------------------------- | ------- |
| `src/main/`, `src/preload/`, `src/shared/`                                                     | Ibrahim |
| `src/document/`, `src/generator/`, `src/runtime/`, `src/seo/`, `src/export/`, `src/templates/` | Ibrahim |
| `src/store/`                                                                                   | Yousef  |
| `src/ui/`                                                                                      | LuF8y   |
| `electron-builder.yml`, `.github/workflows/`                                                   | Ibrahim |

### 5.4 Invariants

- The document tree is the only source of truth.
- Main process holds no business logic.
- Generated CSS uses CSS Grid + Flexbox + `clamp()`; no `position: absolute`.
- Runtime JS is opt-in per behavior; default = off.
- Tokens emit as CSS custom properties on `:root`; element CSS references them via `var()`.
- Export is blocked on any `critical` or `serious` axe-core violation.
- Same document → byte-identical output bundle.

### 5.5 Data Flow

```
[ User input ]
     │
     ▼
[ UI component ] ──dispatch(op)──▶ [ documentStore ]
                                          │
              ┌───────── subscribes ──────┼──────── subscribes ────────┐
              ▼                           ▼                            ▼
       [ Canvas renderer ]        [ Layers tree ]            [ Properties panel ]
                                          │
                              on export ──┘
                                          │
                                          ▼
                                  [ generator/ ] ──▶ HTML / CSS / JS
                                          │
                                          ▼
                                  [ seo/ ] ──▶ head injected
                                          │
                                          ▼
                                  [ export/ validation gate ] ──axe-core──▶ pass/fail
                                          │
                                          ▼
                                  [ jszip ] ──IPC──▶ [ main fs.writeFile ]
```

One direction. UI never reads from the generator; the generator never reads from the UI.

---

## 6. Cross-Owner Contracts

These are the exact types and functions one engineer **produces** that another **consumes**. If any of these slip, the dependent owner is blocked. Every contract has a producer, a consumer, a file path, and a `Needed by` task ID.

| #   | Contract                                                                                                                   | Producer             | Consumer(s)                | File                                       | Needed by                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------- | ------------------------------------------ | ------------------------------------------- |
| C1  | `Document`, `ElementNode`, `Tokens`, `StatesMap`, `ResponsiveProperties`, `SEOConfig`, `RuntimeFlags` types                | Ibrahim (`I-DOC-01`) | LuF8y, Yousef              | `src/document/types.ts`                    | `Y-STR-01`, `L-CAN-02`, all generator tasks |
| C2  | `documentSchema` (Zod) lockstep with C1                                                                                    | Ibrahim (`I-DOC-02`) | Yousef                     | `src/document/schemas.ts`                  | `Y-PER-02`                                  |
| C3  | `Operation` union + `applyOperation(draft, op)`                                                                            | Ibrahim (`I-DOC-03`) | Yousef                     | `src/document/operations.ts`               | `Y-STR-02`                                  |
| C4  | `electronAPI` typed surface (saveZip, openProject, saveProject, showSaveDialog, uploadImage, getAppVersion, onFileChanged) | Ibrahim (`I-ELE-03`) | LuF8y, Yousef              | `src/shared/electronAPI.d.ts`              | `L-DLG-04`, `Y-PER-01`                      |
| C5  | `useDocumentStore`, `useHistoryStore`, `useSessionStore` hooks                                                             | Yousef (`Y-STR-01`)  | LuF8y                      | `src/store/*.ts`                           | every L-\* task                             |
| C6  | `generate(document): { html, css, js }`                                                                                    | Ibrahim (`I-GEN-01`) | Ibrahim (export)           | `src/generator/index.ts`                   | `I-EXP-01`                                  |
| C7  | `presetsRegistry` (id → preset factory)                                                                                    | Ibrahim (`I-DOC-04`) | LuF8y, Yousef              | `src/document/presets/index.ts`            | `L-SBR-02`, `Y-STR-04`                      |
| C8  | `validateDocument(doc): ValidationReport`                                                                                  | Ibrahim (`I-DOC-05`) | LuF8y, Ibrahim (export)    | `src/document/validation.ts`               | `L-VAL-01`, `I-EXP-02`                      |
| C9  | `resolveToken(tokens, ref, theme): string`                                                                                 | Ibrahim (`I-DOC-06`) | LuF8y (canvas live render) | `src/document/tokens.ts`                   | `L-CAN-03`, `L-TKN-03`                      |
| C10 | `inferSemantics(tree): tree'` (preserved through ops)                                                                      | LuF8y (`L-CAN-04`)   | Ibrahim (generator)        | `src/ui/canvas/inferSemantics.ts`          | `I-GEN-02`                                  |
| C11 | Image upload IPC contract (buffer in, manifest of `{ id, srcset, width, height }` out)                                     | Ibrahim (`I-ELE-05`) | LuF8y                      | `src/main/ipc.ts` + `src/preload/index.ts` | `L-PRP-08`                                  |
| C12 | `exportProject(document, options): Promise<ExportResult>`                                                                  | Ibrahim (`I-EXP-01`) | LuF8y (export button)      | `src/export/index.ts`                      | `L-TOP-04`                                  |

**Rule:** any change to a contract requires a Slack notice + a PR labeled `contract-change`. Reviewer must be the downstream consumer.

---

## 7. Day 0 — Setup

Spend one full day on Day 0 before tasks begin. Every hour spent here saves two later.

### Morning (3 h) — Founding meeting (all three)

1. Read this plan end-to-end together.
2. Walk Section 6 line by line — every owner agrees they can produce/consume their contracts.
3. Confirm the settled decisions in Section 8; record any new ones in `DECISIONS.md`.
4. Agree communication channel for the 15-minute daily standup.
5. Agree Git workflow: feature branches off `main`, squash-merge, PR review SLA 24 h, weekly integration ritual (Section 10.21), no force-push to `main`.

### Afternoon (4 h) — Technical setup

Each engineer on their own branch installs their dependency block (Appendix A) and lands the folder skeleton (Section 5.2) with empty `index.ts` stubs.

### Evening (1 h) — Board + first contracts

- Open the GitHub Project Board with columns: **Backlog / In Progress / Review / Done**.
- Seed every task ID from Section 10 as a card with owner + priority + depends labels.
- Ibrahim merges `src/document/types.ts` and `src/document/schemas.ts` skeletons (just empty interfaces and a passing zod parse) so Yousef and LuF8y can start consuming them on Day 1.

---

## 8. Settled Decisions

These are decided. Do not re-litigate. Any change requires a `DECISIONS.md` entry and a team-wide ack.

| #   | Decision                 | Choice                                                                                                             | Rationale                                                                                    |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| D1  | Tree library             | `react-arborist`                                                                                                   | Built-in dnd, virtualization; if it conflicts with `dnd-kit` in practice, swap (3-day cost). |
| D2  | UI animation library     | `motion` (deferred until polish window)                                                                            | CSS transitions cover 95% of needs; motion only if time remains.                             |
| D3  | Undo/Redo strategy       | `immer` patches (not `zundo` snapshots)                                                                            | Per-op patches give precise history entries; snapshots would balloon memory.                 |
| D4  | Tailwind                 | v3                                                                                                                 | v4 is too fresh; v3 ecosystem is solid.                                                      |
| D5  | Tokens in output         | CSS custom properties on `:root` + `[data-theme="..."]` overrides, referenced via `var()`                          | Best browser support, smallest payload, themeable at runtime.                                |
| D6  | Icons in output          | Inline SVG sprite by default; CDN `<link>` only if author opts in per project                                      | Offline-safe default; CDN as opt-in escape hatch.                                            |
| D7  | State management         | Zustand + immer                                                                                                    | Lighter than Redux; immer integrates cleanly with patches for undo.                          |
| D8  | Validation               | Zod                                                                                                                | Same schema for types + runtime parse at boundaries.                                         |
| D9  | Image pipeline           | `sharp` in main process, IPC to renderer                                                                           | sharp is native; can't run in renderer with sandbox.                                         |
| D10 | Document file extension  | `.dtw` (Draw-to-Web)                                                                                               | Self-explanatory; future MIME/OS association is feasible.                                    |
| D11 | Output bundle layout     | `index.html` + `styles.css` + optional `script.js` + `assets/` + optional `sitemap.xml`/`robots.txt`/`favicon.svg` | Matches what static hosts expect.                                                            |
| D12 | Output CSS minification  | `lightningcss` (not cssnano)                                                                                       | Faster, smaller, modern syntax support.                                                      |
| D13 | Output HTML minification | `html-minifier-terser`                                                                                             | Aggressive but safe defaults.                                                                |
| D14 | A11y gate location       | Renderer process (lazy-loaded axe-core in jsdom)                                                                   | Keeps main process minimal.                                                                  |
| D15 | Versioning               | SemVer; `v0.2.0` first ship, `v1.0.0` at demo                                                                      | Aligns with CLAUDE.md.                                                                       |

---

## 9. Library-to-Feature Map

### Document Model

| Feature                       | Library     | Owner                            |
| ----------------------------- | ----------- | -------------------------------- |
| Immutable updates             | `immer`     | Ibrahim                          |
| Schema validation             | `zod`       | Ibrahim                          |
| Unique IDs                    | `nanoid`    | Ibrahim                          |
| Color manipulation + contrast | `chroma-js` | Ibrahim (generator) + LuF8y (UI) |

### Store

| Feature             | Library                        | Owner  |
| ------------------- | ------------------------------ | ------ |
| Document state      | `zustand`                      | Yousef |
| Mutation ergonomics | `use-immer`                    | Yousef |
| Undo/Redo           | `immer` patches (manual stack) | Yousef |

### UI

| Feature                                                                | Library                   | Owner |
| ---------------------------------------------------------------------- | ------------------------- | ----- |
| Tabs, dropdown, popover, dialog, context menu, switch, slider, tooltip | `@radix-ui/react-*`       | LuF8y |
| Split panels                                                           | `react-resizable-panels`  | LuF8y |
| Color picker                                                           | `react-colorful`          | LuF8y |
| Layers tree                                                            | `react-arborist`          | LuF8y |
| Icons in editor                                                        | `lucide-react`            | All   |
| Class merging                                                          | `clsx` + `tailwind-merge` | All   |
| Keyboard shortcuts                                                     | `react-hotkeys-hook`      | LuF8y |
| Error boundaries                                                       | `react-error-boundary`    | LuF8y |
| UI animations _(polish only)_                                          | `motion`                  | LuF8y |

### Drag & Drop

| Feature                   | Library                     | Owner |
| ------------------------- | --------------------------- | ----- |
| Sidebar → Canvas          | `@dnd-kit/core`             | LuF8y |
| Reorder inside containers | `@dnd-kit/sortable`         | LuF8y |
| Drag inside layers tree   | `react-arborist` (built-in) | LuF8y |
| DnD utilities             | `@dnd-kit/utilities`        | LuF8y |

### Generator + Export

| Feature              | Library                           | Owner   |
| -------------------- | --------------------------------- | ------- |
| HTML/CSS/JS emission | in-house                          | Ibrahim |
| Pretty printing      | `prettier`                        | Ibrahim |
| CSS minification     | `lightningcss`                    | Ibrahim |
| HTML minification    | `html-minifier-terser`            | Ibrahim |
| ZIP packaging        | `jszip`                           | Ibrahim |
| Image optimization   | `sharp` (main process)            | Ibrahim |
| SVG optimization     | `svgo`                            | Ibrahim |
| Accessibility gate   | `axe-core` (lazy-loaded in jsdom) | Ibrahim |

### Helpers

| Feature                              | Library                         | Owner   |
| ------------------------------------ | ------------------------------- | ------- |
| Debounce / throttle / deep utilities | `radash`                        | All     |
| jsdom for axe-core                   | `jsdom`                         | Ibrahim |
| Testing                              | `vitest`, `@vitest/coverage-v8` | All     |
| E2E                                  | `@playwright/test`              | Ibrahim |

---

## 10. Tasks

**Task ID convention:** `<I|L|Y>-<AREA>-NN` where AREA is the module (`DOC`, `GEN`, `RUN`, `SEO`, `EXP`, `ELE`, `TPL`, `BLD`, `CAN`, `LYR`, `SBR`, `PRP`, `TOP`, `TKN`, `VAL`, `DLG`, `STR`, `HST`, `PER`, `PRF`). `X-NN` for cross-cutting rituals.

**Priority:** `P0` blocks the demo path. `P1` is a Tier 1 listed feature. `P2` is polish or an additional in-scope feature (Section 12).

**Each task carries:** ID — **title** — short description. `Depends:` upstream IDs. `Blocks:` downstream IDs. `DoD:` what makes it done. Owner is implied by the area prefix.

---

### 10.1 Ibrahim — Electron Shell (`I-ELE`)

- **I-ELE-01** — **Electron main process** [P0] — `app.whenReady` → `createWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; min size, title, icon; `window-all-closed` (quit non-mac) + `activate` (re-create on dock click); dev-tools toggle dev-only. `DoD:` window opens, devtools work in dev, sandbox confirmed via `process.sandboxed === true` check.
- **I-ELE-02** — **App menu** [P1] — File → New / Open / Save / Save As / Export / Recent; Edit → Undo / Redo / Cut / Copy / Paste; View → Toggle Grid / Toggle Theme; Help → About. `DoD:` every item dispatches an IPC or no-op stub.
- **I-ELE-03** — **Preload bridge typed surface** [P0] — `contextBridge.exposeInMainWorld('electronAPI', { ... })`: `exportZip`, `showSaveDialog`, `getAppVersion`, `saveProject`, `openProject`, `uploadImage`, `onFileChanged`. Update `src/shared/electronAPI.d.ts` lockstep. `DoD:` C4 satisfied; no raw `ipcRenderer` reachable from renderer.
- **I-ELE-04** — **IPC handlers** [P0] — `export:save-zip` (buffer + suggested name → fs.writeFile), `dialog:save`, `project:save`, `project:open`, `image:upload`, `recent:list`, `recent:add`. Input validation: path sanitization, buffer size cap (50 MB), MIME sniff on image upload. Structured `{ success, error? }` return. `DoD:` every handler has a Vitest test that hits a real temp dir.
- **I-ELE-05** — **Image upload pipeline (IPC + sharp)** [P0] — receive buffer, write original to `assets/<id>-orig.<ext>`, generate WebP at 400/800/1200/1600 widths, return `{ id, srcset, width, height, alt: '' }` manifest. `DoD:` round-trip with a 4 MB PNG produces all four WebP variants; satisfies C11.
- **I-ELE-06** — **File watcher for `.dtw` external changes** [P2] — `chokidar` on the open project file; if it changes outside the app, fire `onFileChanged` to renderer with a `{ mtime, size }` payload. `DoD:` editing the file in another editor triggers a reload prompt.
- **I-ELE-07** — **Recent files persistence** [P2] — store last 10 in `app.getPath('userData')/recent.json`; expose via `electronAPI.getRecent()`. `DoD:` reopening the app surfaces the list in the Welcome dialog.
- **I-ELE-08** — **CSP for renderer** [P1] — strict `Content-Security-Policy` header in dev + prod (no `unsafe-eval` outside dev HMR, `default-src 'self'`). `DoD:` axe + manual check confirm CSP holds in prod build.

### 10.2 Ibrahim — Document Model (`I-DOC`)

- **I-DOC-01** — **`src/document/types.ts`** [P0] — define `Document`, `ElementNode`, `Tokens`, `TokenRef`, `StatesMap`, `ResponsiveProperties`, `SEOConfig`, `RuntimeFlags`, `DocumentVariables`. **Top-priority — blocks everything else.** `DoD:` C1 satisfied; lands behind a stub `schemas.ts` so consumers can `import` from Day 1.
- **I-DOC-02** — **`src/document/schemas.ts`** [P0] — Zod schema for every type in `types.ts`. Use `z.infer` to assert lockstep at compile time (`type X = z.infer<typeof xSchema>`). `DoD:` C2 satisfied; round-tripping a sample document through `parse` + `safeParse` succeeds.
- **I-DOC-03** — **`src/document/operations.ts`** [P0] — `Operation` discriminated union covering `insertElement`, `updateProperty`, `deleteElement`, `reorder`, `wrapInGroup`, `unwrapGroup`, `addToken`, `updateToken`, `deleteToken`, `renameToken`, `insertPreset`. Each is an `(draft: Document, op: Op) => void` immer mutator. `DoD:` C3 satisfied; round-trip insert→undo equals pristine.
- **I-DOC-04** — **Presets registry** [P0] — 8 presets in `src/document/presets/` (see I-TPL-01 list). Each `(args) => ElementNode` builder that composes primitives. Single registry `presetsRegistry: Record<string, PresetFactory>`. `DoD:` C7 satisfied; each preset materializes a tree that round-trips through Zod.
- **I-DOC-05** — **`src/document/validation.ts`** [P0] — pure function rules:
  - Single `<h1>` per page (error).
  - No heading-level skips (warning).
  - Required `alt` on every `<img>` — empty string allowed (error).
  - Valid token references (error).
  - Duplicate IDs (error).
  - Color contrast via `chroma-js` against the bound surface token (warning, WCAG AA default; AAA toggleable in Document Settings).
  - Unused tokens (info).
    `DoD:` C8 satisfied; returns `{ errors, warnings, infos }` arrays each with `{ message, nodeId?, fix? }`.
- **I-DOC-06** — **`src/document/tokens.ts`** [P0] — `resolveToken(tokens, ref, theme): string` for color / spacing / fontSize / shadow / radius. `DoD:` C9 satisfied; theme-aware (returns dark-vs-light depending on active theme).
- **I-DOC-07** — **Migrations walker** [P1] — `migrate(doc, fromVersion, toVersion): Document` with a registry of step functions. Initial migrations: `0.1.0 → 0.2.0` is a no-op; `0.2.0 → 0.2.1` is a stub to prove the path. `DoD:` test asserts unknown future versions throw a structured error.
- **I-DOC-08** — **Document variables** [P2] — `document.variables: Record<string, string>` (e.g. `{ year: '2026', email: 'me@example.com' }`); generator interpolates `{{var}}` in text + attributes. `DoD:` editing `year` updates every `{{year}}` occurrence on next emit.

### 10.3 Ibrahim — Generator (`I-GEN`)

- **I-GEN-01** — **Recursive tree walker** [P0] — `generate(document): { html, css, js }` walks `document.tree` depth-first, dispatches to HTML/CSS/JS emitters. `DoD:` C6 satisfied; produces a valid HTML5 doc for an empty document.
- **I-GEN-02** — **HTML emitter** [P0] — semantic tags by `element.semanticRole` (`header`, `nav`, `main`, `section`, `article`, `footer`, `aside`); `<img>`/`<button>`/`<a>` for media + interactive primitives; scoped class names `dtw-el-{stableId}`; consumes `inferSemantics` hints from C10. `DoD:` snapshot test against `tests/fixtures/portfolio.json` matches `tests/fixtures/portfolio.html`.
- **I-GEN-03** — **CSS emitter — base** [P0] — Flex auto-layout per container (`direction`, `gap`, `padding`, alignment); element dimensions; `clamp()` for fluid sizes; CSS reset at top. No raw hex outside the "free value" escape hatch. `DoD:` zero `position: absolute` anywhere; passes a regex guard in tests.
- **I-GEN-04** — **CSS emitter — tokens block** [P0] — emits `:root { --token: value; }` for every token in `document.tokens` + `:root[data-theme="dark"] { /* overrides */ }`. `DoD:` snapshot test confirms order + dedup.
- **I-GEN-05** — **CSS emitter — `var()` references** [P0] — token-bound properties emit `var(--name)`, not the resolved value. `DoD:` fixture document with a token-bound color produces `color: var(--accent)`.
- **I-GEN-06** — **CSS emitter — `prefers-color-scheme` default** [P0] — `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { /* dark vars */ } }`. `DoD:` output passes Lighthouse "respects prefers-color-scheme" check.
- **I-GEN-07** — **CSS emitter — states** [P1] — `:hover`, `:focus-visible`, `:active` blocks from `StatesMap`; only overridden properties. `DoD:` test confirms unchanged props don't leak into state blocks.
- **I-GEN-08** — **CSS emitter — media queries** [P0] — `@media (max-width: 1024px)`, `(max-width: 768px)`, `(max-width: 480px)` per `ResponsiveProperties`. `DoD:` desktop value present in base block, mobile value present in mobile media query only.
- **I-GEN-09** — **CSS emitter — backgrounds & surfaces** [P1] — solid + gradient + multi-layer; `mask-image`; `backdrop-filter`; decorative `body::before` / `body::after` for grid + noise (matches template). `DoD:` portfolio template snapshot matches `draft/Template/index.html` for these features.
- **I-GEN-10** — **CSS emitter — borders / radii / shadows** [P1] — per-corner radius; multi-layer box-shadow; accent-token glow. `DoD:` card preset emits expected shadow stack.
- **I-GEN-11** — **CSS emitter — animations** [P1] — keyframe library (`fadeUp`, `pulse-dot`, `blink-cursor`, `typing-line`, `shimmer`); per-element delay + duration; `@media (prefers-reduced-motion: reduce)` disables non-essential. `DoD:` reduced-motion query present whenever any animated element is in the tree.
- **I-GEN-12** — **CSS emitter — `srcset` + `sizes`** [P1] — `<img>` references sharp-generated variants; `loading="lazy"`, `decoding="async"`, `width`/`height` set to prevent CLS. `DoD:` Lighthouse "properly sized images" passes.
- **I-GEN-13** — **CSS emitter — print stylesheet** [P2] — `@media print { ... }` hides nav/footer interactive bits, removes background images, ensures readable colors. `DoD:` browser Print Preview is legible.
- **I-GEN-14** — **CSS emitter — view transitions for theme toggle** [P2] — emit `view-transition-name` on `<html>` and a `::view-transition` rule for a smooth crossfade when the theme runtime is enabled. Progressive enhancement; older browsers see the instant flip. `DoD:` Chromium shows the crossfade; Firefox unaffected.
- **I-GEN-15** — **JS emitter** [P0] — concatenates only the enabled runtime snippets (from `RuntimeFlags`); wraps in an IIFE; minifies via `terser` in prod. `DoD:` all-flags-off produces no `<script>` tag at all.
- **I-GEN-16** — **`prettier` integration** [P0] — format HTML + CSS before they leave the generator; minify only in export pipeline. `DoD:` generated CSS is human-readable in dev preview.
- **I-GEN-17** — **Smart `rel` on external links** [P1] — any `<a target="_blank">` gets `rel="noopener noreferrer"` automatically. `DoD:` Lighthouse "Links to cross-origin destinations are safe" passes.
- **I-GEN-18** — **Mailto helper** [P2] — `<a href="mailto:...">` builder takes `{ to, subject?, body? }`; generator URL-encodes correctly. `DoD:` clicking the connect button opens the OS mail client with subject prefilled.
- **I-GEN-19** — **Skip-to-content link** [P1] — generator inserts a visually-hidden-but-focusable `<a href="#main">Skip to main content</a>` as the first child of `<body>`. `DoD:` axe passes "bypass" rule.
- **I-GEN-20** — **CSP `<meta>` in output** [P2] — emit a strict `<meta http-equiv="Content-Security-Policy">` for the static site (defensible defaults; relaxed when CDN fonts/icons are enabled). `DoD:` deployed page passes `csp-evaluator`.

### 10.4 Ibrahim — Runtime Snippets (`I-RUN`)

All snippets must be passive, debounced/`requestAnimationFrame`'d where appropriate, work without breaking if disabled, and pass `eslint --no-unused-vars` after templating. The `.claude/skills/runtime-audit` skill is the source of truth.

- **I-RUN-01** — **Theme toggle** [P0] — flips `data-theme` on `<html>`, persists to `localStorage`, restores on load with FOUC guard (inline `<script>` in `<head>` reads localStorage before render). `DoD:` no flash of wrong theme on reload.
- **I-RUN-02** — **Scroll-spy** [P0] — `IntersectionObserver` on sections; toggles `.is-active` on the matching nav link. `DoD:` correct link highlights as I scroll; manual click also updates immediately.
- **I-RUN-03** — **Smooth scroll + `scroll-padding-top`** [P1] — CSS handles smoothness; JS only computes the padding at runtime to match nav height. `DoD:` clicking a nav link lands the section flush below the nav.
- **I-RUN-04** — **Mobile nav** [P0] — toggle button shows/hides nav; closes on link click; **focus trap while open**; `aria-expanded` reflects state. `DoD:` keyboard-only navigation works end-to-end.
- **I-RUN-05** — **Nav-on-scroll style change** [P1] — adds `.scrolled` to `<nav>` when `window.scrollY > threshold`; uses `requestAnimationFrame` not scroll spam. `DoD:` no jank at 60 fps.
- **I-RUN-06** — **IntersectionObserver reveals** [P1] — observes elements with `data-reveal`; adds `.visible` on entry; **respects `prefers-reduced-motion`** (skips animation, still adds the class for any dependent styles). `DoD:` reduced-motion users see instant-state final result.
- **I-RUN-07** — **Animation play-state gating** [P2] — pauses CSS animations until in view (terminal card). `DoD:` opening the page off-screen does not consume CPU on the terminal animation.
- **I-RUN-08** — **Terminal typing animation** [P2] — driven by CSS keyframes; JS only triggers `animation-play-state: running`. `DoD:` no `setTimeout` typewriter loops.

### 10.5 Ibrahim — SEO (`I-SEO`)

- **I-SEO-01** — **Head injector** [P0] — title, description, keywords, author, `<html lang>`, viewport, charset, theme-color (one per scheme), canonical. `DoD:` Lighthouse SEO ≥ 95.
- **I-SEO-02** — **Open Graph + Twitter Card** [P1] — `og:title`, `og:description`, `og:type`, `og:image`, `og:url`; Twitter `summary_large_image`. `DoD:` opengraph.xyz preview renders correctly.
- **I-SEO-03** — **JSON-LD** [P1] — `Person` / `Organization` / `WebSite` schema; author picks type, fills fields, generator emits well-formed JSON-LD. `DoD:` Google Rich Results test passes.
- **I-SEO-04** — **Favicon** [P1] — inline SVG data URI by default; optional uploaded PNG. `DoD:` favicon renders dark/light correctly using `prefers-color-scheme` in the SVG.
- **I-SEO-05** — **Preconnect / dns-prefetch hints** [P1] — emitted for every external origin (fonts, icons). `DoD:` Network panel shows preconnect TTFB win.
- **I-SEO-06** — **`sitemap.xml`** [P2] — single URL for now; structure supports multi-page later. `DoD:` validates against sitemaps.org schema.
- **I-SEO-07** — **`robots.txt`** [P2] — sensible default (allow all, point to sitemap). `DoD:` validates against robots-validator.

### 10.6 Ibrahim — Export Pipeline (`I-EXP`)

- **I-EXP-01** — **`exportProject(document, options)` orchestrator** [P0] — pipeline:
  1. Validate (gate on errors).
  2. Generate HTML / CSS / JS.
  3. Inject SEO + JSON-LD.
  4. Optimize images via sharp (already produced; re-confirm manifest).
  5. Minify with `lightningcss` + `html-minifier-terser` (skipped if `options.minify === false`).
  6. Emit `sitemap.xml` + `robots.txt`.
  7. ZIP via `jszip`.
  8. IPC → `fs.writeFile`.
     Structured progress events `(stage, progress) => void`. `DoD:` C12 satisfied; portfolio template exports in <10 s on a clean run.
- **I-EXP-02** — **axe-core hard gate** [P0] — lazy-load `axe-core` in `src/export/`; run on generated HTML inside `jsdom`; any `critical` or `serious` blocks export and returns a `ValidationReport`. `DoD:` deliberately-broken sample (missing alt) blocks export with a helpful message.
- **I-EXP-03** — **Export options** [P1] — `{ minify, inlineJS, selfHostFonts, includeSourceComments, theme: 'auto' | 'dark' | 'light' }`. Surfaced in Export Options dialog (L-DLG-03). `DoD:` self-host-fonts option downloads woff2 files into `assets/fonts/` and rewrites the `@font-face` block.
- **I-EXP-04** — **Code preview** [P2] — `exportProject` can run in `dryRun: true` mode that returns `{ html, css, js }` strings without writing files; used by the in-app Code Preview panel. `DoD:` dry-run is <500 ms for the portfolio template.
- **I-EXP-05** — **Self-host fonts** [P2] — when enabled, fetch Google Font woff2 files at export time via `axios`/`fetch`, write to `assets/fonts/`, rewrite the stylesheet. `DoD:` exported bundle works offline (verified by serving over a denylisted host).

### 10.7 Ibrahim — Templates (`I-TPL`)

- **I-TPL-01** — **8 presets** [P0] — `hero-centered`, `hero-split`, `cards-grid-3col`, `card-basic`, `cta-banner`, `footer-simple`, `footer-columns`, `nav-fixed`. Each a pure factory `(args) => ElementNode`. `DoD:` each preset round-trips through Zod and exports without axe violations.
- **I-TPL-02** — **Portfolio template** [P0] — `src/templates/portfolio.ts` matches `draft/Template/index.html` as closely as practical. **Priority template — demo path.** `DoD:` exported HTML is visually within 5 % of the hand-coded template.
- **I-TPL-03** — **Landing template** [P1] — `src/templates/landing.ts` — hero + features + CTA + footer. `DoD:` Lighthouse Performance ≥ 95.
- **I-TPL-04** — **Resume template** [P1] — `src/templates/resume.ts` — simplest of the three; uses primitives + presets that already exist. Yousef helps. `DoD:` prints to one page on A4 (P-GEN-13 print stylesheet).
- **I-TPL-05** — **Blank starter** [P0] — empty document with sensible default tokens + a single hero placeholder. `DoD:` selectable from Welcome dialog.

### 10.8 Ibrahim — Build & CI (`I-BLD`)

- **I-BLD-01** — **`electron-builder.yml`** [P0] — Windows (`.exe` NSIS), Linux (`.AppImage` + `.deb`), macOS optional; `asarUnpack` for `sharp` and `svgo`; app metadata + icon. `DoD:` artifacts boot on clean VMs for each target.
- **I-BLD-02** — **`.github/workflows/ci.yml`** [P0] — push + PR triggers; jobs: `lint`, `typecheck`, `test`, `test:a11y`, `build`; cache `node_modules`; fail on any. `DoD:` PR can't merge with a red check.
- **I-BLD-03** — **Release workflow** [P1] — tag push (`v*`) triggers `electron-builder` matrix build; uploads artifacts to GitHub Releases; auto-generates changelog from conventional commits. `DoD:` `git tag v0.2.0 && git push --tags` produces a downloadable Release.
- **I-BLD-04** — **Pre-push gate** [P0] — `.claude/skills/preflight` runs `lint` + `typecheck` + `test` locally before every push to `main`. `DoD:` documented in CLAUDE.md, enforced by team convention.
- **I-BLD-05** — **Code signing** [P2] — Windows Authenticode + macOS notarization (if Apple cert available). `DoD:` SmartScreen does not warn on Windows.

---

### 10.9 LuF8y — App Shell & Canvas (`L-CAN`)

- **L-CAN-01** — **App shell** [P0] — `react-resizable-panels` three-column layout (Sidebar / Canvas / Properties); persist sizes to localStorage. `DoD:` panel sizes restore across reloads.
- **L-CAN-02** — **Recursive Canvas renderer** [P0] — `src/ui/canvas/CanvasNode.tsx` reads `document.tree`, renders nested divs with real CSS Flex/Grid. **No Konva. No absolute positioning.** Depends C1, C5. `DoD:` snapshot test renders portfolio fixture without errors.
- **L-CAN-03** — **Live token resolution** [P0] — canvas styles call `resolveToken` (C9) so token edits reflect immediately. `DoD:` editing `--accent` updates every bound element in <100 ms.
- **L-CAN-04** — **`inferSemantics` adapter** [P0] — walks the tree post-mutation, attaches `semanticRole` hints. Satisfies C10. `DoD:` Hero preset always renders with `role="banner"` hint preserved through copy/paste.
- **L-CAN-05** — **Element selection** [P0] — click to select; selected element highlighted; selection in `sessionStore`. `DoD:` click → properties panel reflects within one frame.
- **L-CAN-06** — **Multi-select** [P1] — shift-click adds; marquee/rubber-band drag-select on empty canvas; group moves apply atomically. `DoD:` undo of a group move is one history entry.
- **L-CAN-07** — **Inline text editing** [P1] — double-click text → `contentEditable` → blur dispatches `updateProperty`. `DoD:` round-trip preserves whitespace and special characters.
- **L-CAN-08** — **Z-order controls** [P1] — bring forward / send back via context menu + `]` / `[` shortcuts. `DoD:` order matches Layers tree at all times.
- **L-CAN-09** — **`React.ErrorBoundary` per element** [P1] — a single node throwing replaces itself with a small error UI; the rest of the canvas keeps rendering. `DoD:` injecting a deliberate render error in one node leaves the rest interactive.
- **L-CAN-10** — **Grid overlay toggle** [P2] — topbar switch shows the 12-column grid as a semi-transparent overlay. `DoD:` toggle persists per project.
- **L-CAN-11** — **Smart snapping** [P2] — drag shows alignment guides to other elements' edges, centers, consistent spacing. `DoD:` snaps within ±4 px.
- **L-CAN-12** — **DnD from sidebar** [P0] — `@dnd-kit/core` with DragOverlay showing preset preview; drop inserts the preset subtree at cursor's container. Depends C7. `DoD:` dropping a Card into a Grid lands in the correct parent.
- **L-CAN-13** — **Reorder inside containers** [P1] — `@dnd-kit/sortable` for sibling reorder. `DoD:` reorder dispatches one `reorder` op, undoable.

### 10.10 LuF8y — Layers Panel (`L-LYR`)

- **L-LYR-01** — **`react-arborist` tree** [P0] — reads from store; click selects (matches canvas); shows element type icon + name + visibility/lock toggles. `DoD:` selection bidirectional with canvas.
- **L-LYR-02** — **Drag-reorder in tree** [P1] — uses built-in drag; dispatches `reorder` and `move` ops. `DoD:` moving across containers updates `parentId` correctly.
- **L-LYR-03** — **Rename in place** [P2] — double-click element name to rename; persists to `element.name`. `DoD:` rename is one history entry.
- **L-LYR-04** — **Virtualization** [P2] — kicks in at >200 nodes; coordinate with Yousef on perf. `DoD:` scroll stays 60 fps at 500 nodes.

### 10.11 LuF8y — Insert Sidebar (`L-SBR`)

- **L-SBR-01** — **Three-tab layout** [P0] — Radix Tabs: Sections / Components / Elements; lucide icon per preset/primitive. `DoD:` keyboard navigable.
- **L-SBR-02** — **Preset cards** [P0] — read from `presetsRegistry` (C7); thumbnail + name + tooltip. `DoD:` adding a preset to the registry surfaces a card with no UI changes.
- **L-SBR-03** — **Search** [P2] — fuzzy search across presets + primitives. `DoD:` "her" matches both Hero presets.
- **L-SBR-04** — **Drag handle** [P0] — each card is a dnd-kit `useDraggable`. `DoD:` drag preview matches dropped element.

### 10.12 LuF8y — Properties Panel (`L-PRP`)

- **L-PRP-01** — **Tab shell** [P0] — Radix Tabs: Design / Layout / States / Animation / Advanced. `DoD:` tabs persist per element-type.
- **L-PRP-02** — **Layout controls** [P0] — direction (row/column) toggle; gap (token-bindable); padding box (4-value or unified); sizing (Hug / Fill / Fixed); main + cross alignment. `DoD:` editing reflows canvas live.
- **L-PRP-03** — **Token-binding 🔗 button** [P0] — next to every color/spacing/font-size control; Radix Popover with searchable token list. `DoD:` binding/unlinking is one history entry.
- **L-PRP-04** — **Color picker** [P0] — `react-colorful` for free-value mode; `chroma-js` shows contrast against bound surface token (WCAG AA badge; AAA mode toggleable). `DoD:` failing contrast shows red badge with target ratio.
- **L-PRP-05** — **States editor** [P1] — Radix Tabs: Default / Hover / Focus / Active; non-default states show only overridden properties. `DoD:` writes route to `element.states[stateName]`.
- **L-PRP-06** — **Animation controls** [P1] — keyframe preset picker (`fadeUp`, `fadeIn`, `scaleIn`, `slideLeft`, `pulse`, `blink-cursor`, `shimmer`); delay + duration. `DoD:` per-element setting persists.
- **L-PRP-07** — **Reveal-on-scroll switch** [P1] — sets `element.runtime.reveal = true`; generator emits `data-reveal`. `DoD:` runtime snippet picks it up.
- **L-PRP-08** — **Image upload control** [P1] — file input + drag-drop; calls `electronAPI.uploadImage` (C11); shows manifest preview. `DoD:` alt-text input is required to mark image complete.
- **L-PRP-09** — **Per-breakpoint badge** [P1] — when non-base breakpoint is active, edits write to `element.responsive.<bp>`; UI shows 📱/💻 badge on overridden values; inherited values dim with "(inherited)" tooltip. `DoD:` switching breakpoints surfaces overrides correctly.
- **L-PRP-10** — **Free-value escape hatch** [P2] — every token-bound field has an "unlink" button revealing the underlying value editor. `DoD:` free values do not appear in the `:root` block.

### 10.13 LuF8y — Topbar (`L-TOP`)

- **L-TOP-01** — **Theme toggle** [P0] — Radix Switch sets `data-theme` on the canvas root. `DoD:` canvas re-renders with the alternate palette.
- **L-TOP-02** — **Breakpoint switcher** [P0] — Desktop 1280 / Tablet 1024 / Mobile 768 / Small 480; resizes canvas viewport. `DoD:` matches generator media-query breakpoints.
- **L-TOP-03** — **Hover-preview toggle** [P2] — Radix Switch; when on, canvas renders elements in their hover state. `DoD:` toggling does not mutate the document.
- **L-TOP-04** — **Export button** [P0] — opens Export Options dialog (L-DLG-03), then calls `exportProject` (C12). Disabled while validation errors exist. `DoD:` shows progress events.
- **L-TOP-05** — **Save / unsaved indicator** [P1] — dot or asterisk when dirty; Ctrl+S also triggers. `DoD:` dirty state clears on save.
- **L-TOP-06** — **Grid overlay toggle** [P2] — re: L-CAN-10. `DoD:` matches.

### 10.14 LuF8y — Tokens Panel (`L-TKN`)

- **L-TKN-01** — **Bottom-bar panel** [P0] — collapsible; Radix Tabs: Colors / Spacing / Typography / Shadows / Radii. `DoD:` panel sizes persist.
- **L-TKN-02** — **Token row UI** [P0] — swatch + name + value editor + delete; uses `react-colorful` for colors. `DoD:` editing dispatches `updateToken` op.
- **L-TKN-03** — **Contrast indicator** [P1] — `chroma-js` shows ratio vs `--bg-primary`; pass/fail badge vs WCAG AA threshold. `DoD:` updates live.
- **L-TKN-04** — **Add / rename / delete** [P0] — buttons map to ops `addToken` / `renameToken` / `deleteToken`. `DoD:` rename rewrites references in one history entry.
- **L-TKN-05** — **Token import / export** [P2] — JSON export of `document.tokens`; JSON import (Zod-validated). `DoD:` round-trips through file system.
- **L-TKN-06** — **Theme switcher inside panel** [P0] — dark/light toggle that re-renders the panel and the canvas using the alternate palette. `DoD:` matches L-TOP-01.

### 10.15 LuF8y — Validation Console (`L-VAL`)

- **L-VAL-01** — **Bottom-bar tab alongside Tokens** [P0] — runs `validateDocument` (C8) live; lists errors / warnings / infos. `DoD:` updates within 200 ms of any mutation.
- **L-VAL-02** — **Jump-to-element** [P0] — click an error → selects the offending element and scrolls canvas to it. `DoD:` works for every error type.
- **L-VAL-03** — **Export-block indicator** [P0] — disables the topbar Export button while errors exist, with a tooltip explaining why. `DoD:` clearing errors re-enables.
- **L-VAL-04** — **Quick-fix actions** [P2] — for errors that have a `fix` field, show a button that dispatches the corresponding op. `DoD:` "add alt=''" fix works on an alt-missing error.

### 10.16 LuF8y — Dialogs, Shortcuts, Polish (`L-DLG`)

- **L-DLG-01** — **Welcome screen** [P1] — on app launch with no open project: New / Open / Recent / Templates (Portfolio / Landing / Resume / Blank). `DoD:` Recent list pulls from electronAPI (`I-ELE-07`).
- **L-DLG-02** — **Document Settings dialog** [P1] — meta (title, description, lang, author); OG image upload; Schema.org type + fields; runtime feature toggles; WCAG level (AA / AAA); document variables. `DoD:` writes round-trip through Zod.
- **L-DLG-03** — **Export Options dialog** [P1] — toggles for `minify` / `inlineJS` / `selfHostFonts` / `includeSourceComments` / theme; output filename. `DoD:` matches I-EXP-03 surface.
- **L-DLG-04** — **File-change conflict dialog** [P2] — on `onFileChanged` IPC (C4 + I-ELE-06): "Reload from disk / Keep my changes / Diff". `DoD:` reload preserves undo history? — decide: no, history clears with explicit user ack.
- **L-DLG-05** — **Keyboard shortcuts** [P1] — `react-hotkeys-hook`:
  - Ctrl+Z / Ctrl+Shift+Z — undo / redo
  - Ctrl+S — save
  - Ctrl+Shift+S — save as
  - Ctrl+E — export
  - Ctrl+C / Ctrl+V / Ctrl+D — copy / paste / duplicate
  - Delete / Backspace — delete selection
  - Arrow keys — nudge 1 px (Shift = 10 px)
  - Ctrl+A — select all in current section
  - `]` / `[` — z-order
  - Ctrl+G — group; Ctrl+Shift+G — ungroup
    `DoD:` every shortcut listed in a Help panel and tested.
- **L-DLG-06** — **Assets panel** [P2] — browsable list of uploaded images with thumbnails + alt-text editor + replace + delete. `DoD:` deleting an asset surfaces a warning if it's referenced.
- **L-DLG-07** — **Code Preview panel** [P2] — read-only tabs (HTML / CSS / JS) showing what `exportProject` would emit (dry-run, I-EXP-04). Updates debounced 300 ms. `DoD:` syntax-highlighted via `prismjs` or `shiki`.
- **L-DLG-08** — **Motion polish** [P2] — if time, `motion` library for panel slide-in transitions and dialog enter/exit. **Skip if scope-cut triggered.** `DoD:` no animation breaks reduced-motion mode.

---

### 10.17 Yousef — Document Store (`Y-STR`)

- **Y-STR-01** — **`documentStore`** [P0] — Zustand store wrapping the document; `useImmer` for mutations; holds `document`, `isDirty`. Satisfies C5. `DoD:` selector hooks for tree, tokens, settings all reactive.
- **Y-STR-02** — **`sessionStore`** [P0] — selection (`selectedIds`), `activeBreakpoint`, `activeState`, panel sizes, theme toggle state. Separate from document so it doesn't dirty the file. `DoD:` selecting an element does not mark the document dirty.
- **Y-STR-03** — **Operation dispatcher** [P0] — `dispatch(op: Operation)` runs `produceWithPatches`; records `{ patches, inversePatches, label, timestamp }` to history. `DoD:` round-trips for every op in `I-DOC-03`.
- **Y-STR-04** — **Preset insertion as one history entry** [P0] — `insertPreset(presetId, args, parentId)` materializes the preset subtree inside a single `produceWithPatches` call. `DoD:` undo removes the whole subtree in one step.
- **Y-STR-05** — **Token ops** [P0] — `addToken`, `updateToken`, `deleteToken`, `renameToken`. `renameToken` walks the tree rewriting all bindings inside one draft. `deleteToken` converts bound props to free values with the resolved value frozen in and surfaces a validation warning. `DoD:` each is one history entry; all covered by Vitest.
- **Y-STR-06** — **`StatesMap` routing** [P0] — when `sessionStore.activeState !== 'default'`, property writes route to `element.states[active]`. `DoD:` editing in hover mode does not mutate default state.
- **Y-STR-07** — **`ResponsiveProperties` routing** [P0] — when `sessionStore.activeBreakpoint !== 'base'`, writes route to `element.responsive[bp]`. `DoD:` inheritance correctly resolves when reading.
- **Y-STR-08** — **Subscriber API for canvas** [P1] — fine-grained selectors so the canvas only re-renders affected nodes. `DoD:` editing a leaf does not re-render siblings.

### 10.18 Yousef — History (`Y-HST`)

- **Y-HST-01** — **`historyStore`** [P0] — `past` + `future` stacks; `undo()` and `redo()` apply patches via `applyPatches`; cap at 200 entries to bound memory. `DoD:` 201st entry evicts the oldest.
- **Y-HST-02** — **Coalescing** [P1] — sequential same-label edits within 500 ms merge into one entry (e.g., typing into a text field). `DoD:` typing "hello" is one undo, not five.
- **Y-HST-03** — **Multi-select group ops** [P1] — group move / group delete are single history entries. `DoD:` test covers atomicity.
- **Y-HST-04** — **Regression suite** [P0] — Vitest covers: insert, delete, update, token rename, preset insert, breakpoint edit, state edit, multi-select group move. `DoD:` every op has at least one undo test.

### 10.19 Yousef — Persistence & Recovery (`Y-PER`)

- **Y-PER-01** — **`.dtw` save** [P0] — `saveProject(path)` serializes document to JSON, writes via `electronAPI.saveProject`. `DoD:` round-trip preserves byte-equal document.
- **Y-PER-02** — **`.dtw` load + validate + migrate** [P0] — `openProject(path)` reads → Zod parses → migrates → hydrates store. Structured error on parse fail. Satisfies C2 consumer. `DoD:` opening a v0.1.x file migrates and succeeds.
- **Y-PER-03** — **Autosave** [P1] — `radash` debounce, 5 s after last edit; writes to `<project>.dtw.autosave`. `DoD:` killing the process loses ≤5 s of work.
- **Y-PER-04** — **Crash recovery** [P1] — on launch, if `<project>.dtw.autosave` is newer than `<project>.dtw`, prompt to restore. `DoD:` declining restore deletes the autosave file.
- **Y-PER-05** — **File-change reload** [P2] — handle `onFileChanged` IPC; coordinate with L-DLG-04. `DoD:` accept-reload re-loads, decline keeps in-memory state.
- **Y-PER-06** — **Dirty flag** [P0] — `document.isDirty` set by dispatcher; cleared by save. `DoD:` topbar indicator (L-TOP-05) matches.

### 10.20 Yousef — Performance (`Y-PRF`)

- **Y-PRF-01** — **`React.memo` on canvas leaf nodes** [P1] — measure with React DevTools profiler. `DoD:` 100-element drag stays 60 fps.
- **Y-PRF-02** — **Selector memoization** [P1] — `useDocumentStore` selectors return stable references. `DoD:` editing token does not re-render unbound elements.
- **Y-PRF-03** — **Tree virtualization at >200 nodes** [P2] — wraps `react-arborist`. `DoD:` 500-node tree scrolls 60 fps.
- **Y-PRF-04** — **Final pass** [P1] — measure: drag, undo, breakpoint switch, theme toggle, save. Each must stay under the budget in Section 14. `DoD:` numbers recorded in `docs/0.2.0v/perf-baseline.md`.

---

### 10.21 Cross-Cutting Rituals (`X`)

- **X-01** — **Founding meeting (Day 0)** — see Section 7. All three.
- **X-02** — **`DECISIONS.md`** — every Section 8 entry + every later decision lands here.
- **X-03** — **GitHub Project Board** — Backlog / In Progress / Review / Done. Every task ID seeded.
- **X-04** — **Daily 15-min standup** — yesterday / today / blockers. Skip on integration day.
- **X-05** — **Weekly Integration Ritual** — pick one day per week (suggest Friday); merge all open feature branches, run full test matrix, hold a 30-min debrief, no new commits that day. Apply scope-cut triggers (Section 18) as needed.
- **X-06** — **PR review SLA: 24 h** — never block a teammate longer.
- **X-07** — **Contract-change protocol** — any edit to a contract in Section 6 requires `contract-change` label + downstream-consumer review.
- **X-08** — **Per-skill checks** — before merging a feature, run the relevant `.claude/skills/` skill: `accessibility-audit`, `runtime-audit`, `seo-check`, `token-validate`, `export-test`. Document any failures in the PR.
- **X-09** — **Demo rehearsal — sacred** — final integration day: full demo end-to-end 3×; bug-squash only; no new commits.

---

## 11. Tier 1 Feature Checklist

Distilled from `draft/Features/features.md`. Every item must be true before the demo. Owner column points to the responsible engineer; task IDs reference Section 10.

### Element Types

- [ ] Container / Section — `I-DOC-01`, `L-CAN-02`
- [ ] Text — `I-DOC-01`, `L-CAN-07`
- [ ] Image with upload + alt + WebP + lazy — `I-ELE-05`, `L-PRP-08`, `I-GEN-12`
- [ ] Button — `I-DOC-01`, `L-CAN-02`
- [ ] Link with smart `rel` — `I-DOC-01`, `I-GEN-17`
- [ ] Icon — lucide in editor, inline SVG in output — `L-SBR-01`, `I-GEN-02`
- [ ] List (ol / ul) — `I-DOC-01`, `L-CAN-02`
- [ ] Group — `Y-STR-03` (`wrapInGroup`), `L-CAN-06`
- [ ] Card (preset) — `I-TPL-01`
- [ ] Tag / Badge — `I-DOC-01`
- [ ] Avatar / image-frame (preset) — `I-TPL-01`
- [ ] Code / Terminal block — `I-DOC-01`, `I-RUN-08`
- [ ] Divider — `I-DOC-01`

### Page Structure

- [ ] Multi-section single page — `I-TPL-01`, `L-SBR-02`
- [ ] Fixed / sticky nav + backdrop blur — `I-TPL-01`, `I-GEN-09`, `I-RUN-05`
- [ ] Full-viewport hero — `I-TPL-01`
- [ ] Footer — `I-TPL-01`
- [ ] Max-width content lane — `I-GEN-03`

### Layout

- [ ] CSS Grid auto-fit + named templates + span — `I-GEN-03`
- [ ] Flexbox rows — `I-GEN-03`
- [ ] Asymmetric layouts — `I-GEN-03`
- [ ] Configurable gap — `I-GEN-03`, `L-PRP-02`
- [ ] Fluid sizing via `clamp()` — `I-GEN-03`

### Typography

- [ ] Web font picker — `L-DLG-02`, `I-SEO-05`
- [ ] Per-element family / weight / size / line-height / letter-spacing — `L-PRP-01`, `I-GEN-03`
- [ ] Fluid font sizes — `I-GEN-03`
- [ ] Text color via tokens — `I-GEN-05`, `L-PRP-03`

### Color, Theming, Tokens

- [ ] `:root` custom properties — `I-GEN-04`
- [ ] Dark + light palettes + overrides — `I-GEN-04`
- [ ] Theme toggle + persistence + `prefers-color-scheme` default — `I-RUN-01`, `I-GEN-06`
- [ ] Token-bound color picker — `L-PRP-04`, `L-TKN-02`
- [ ] Contrast indicator — `L-PRP-04`, `L-TKN-03`

### Backgrounds & Surfaces

- [ ] Solid / gradient / layered — `I-GEN-09`
- [ ] Decorative page backgrounds — `I-GEN-09`
- [ ] `mask-image` radial fade — `I-GEN-09`
- [ ] `backdrop-filter: blur()` — `I-GEN-09`

### Borders / Radii / Shadows

- [ ] Border — `I-GEN-10`, `L-PRP-01`
- [ ] Per-corner radius — `I-GEN-10`, `L-PRP-01`
- [ ] Multi-layer box-shadow — `I-GEN-10`
- [ ] Accent-token glow — `I-GEN-10`

### Interaction & States

- [ ] Hover styles — `I-GEN-07`, `L-PRP-05`
- [ ] Transitions + named easings — `I-GEN-07`
- [ ] Cursor pointer — `I-GEN-03`
- [ ] Visible focus ring — `I-GEN-07`

### Animations

- [ ] Keyframe library — `I-GEN-11`, `L-PRP-06`
- [ ] Per-element delay + duration — `L-PRP-06`
- [ ] Scroll-triggered reveals — `I-RUN-06`, `L-PRP-07`
- [ ] `prefers-reduced-motion` honored — `I-GEN-11`, `I-RUN-06`
- [ ] Animation play-state gating — `I-RUN-07`

### Navigation Behaviors

- [ ] Anchor links to sections — `I-GEN-02`
- [ ] Smooth scroll + `scroll-padding-top` — `I-RUN-03`
- [ ] Scroll-spy — `I-RUN-02`
- [ ] Nav-on-scroll style change — `I-RUN-05`
- [ ] Mobile hamburger — `I-RUN-04`

### Icons

- [ ] lucide in editor — all
- [ ] Inline SVG default / CDN `<link>` opt-in — `I-GEN-02`, `D6`
- [ ] Icon picker UI — `L-SBR-01`
- [ ] Inline icons in text — `L-PRP-01`

### Images

- [ ] Upload / paste / replace — `I-ELE-05`, `L-PRP-08`
- [ ] `object-fit`, dims, lazy, async decode — `I-GEN-12`
- [ ] Overlays (gradient / color) — `I-GEN-09`
- [ ] Alt text required — `I-DOC-05`

### Responsive

- [ ] Breakpoints — `I-GEN-08`, `L-TOP-02`
- [ ] Per-breakpoint overrides — `Y-STR-07`, `L-PRP-09`
- [ ] Safe-area insets — `I-GEN-03`
- [ ] No fixed-pixel positioning (rule) — `I-GEN-03`

### Accessibility

- [ ] Semantic tags by role — `I-GEN-02`
- [ ] ARIA on icon-only buttons — `I-GEN-02`, `L-PRP-01`
- [ ] Heading hierarchy — `I-DOC-05`
- [ ] Focus indicators — `I-GEN-07`
- [ ] Alt text required — `I-DOC-05`
- [ ] axe-core hard gate — `I-EXP-02`
- [ ] `prefers-reduced-motion` — `I-GEN-11`, `I-RUN-06`
- [ ] Skip-to-content link — `I-GEN-19`

### SEO

- [ ] Title / description / keywords / author — `I-SEO-01`
- [ ] OG + Twitter Card — `I-SEO-02`
- [ ] `theme-color` per scheme — `I-SEO-01`
- [ ] Canonical URL — `I-SEO-01`
- [ ] JSON-LD — `I-SEO-03`
- [ ] Favicon — `I-SEO-04`
- [ ] Preconnect / dns-prefetch — `I-SEO-05`
- [ ] `<html lang>` — `I-SEO-01`

### Runtime (opt-in)

- [ ] Theme toggle + persistence — `I-RUN-01`
- [ ] Mobile nav — `I-RUN-04`
- [ ] Scroll-spy — `I-RUN-02`
- [ ] Scroll-position nav style — `I-RUN-05`
- [ ] IO reveals — `I-RUN-06`
- [ ] Animation gating _(optional)_ — `I-RUN-07`
- [ ] Terminal typing _(optional)_ — `I-RUN-08`

### Bundle

- [ ] `index.html` + `styles.css` — `I-EXP-01`
- [ ] `assets/` for uploaded images — `I-EXP-01`
- [ ] Conditional `script.js` — `I-EXP-01`, `I-GEN-15`
- [ ] Conditional `favicon.svg` — `I-SEO-04`
- [ ] `sitemap.xml` + `robots.txt` — `I-SEO-06`, `I-SEO-07`

---

## 12. Additional In-Scope Features

These are features I'm recommending be added to Tier 1 because they're cheap, demo-relevant, or close gaps that would surface immediately in real use. Each has a task ID in Section 10.

| #   | Feature                                              | Why it's worth adding                                                                  | Task                                 |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| A1  | **Welcome screen** (New / Open / Recent / Templates) | First-launch UX; otherwise the app opens to a blank window with no guidance            | `L-DLG-01` + `I-ELE-07`              |
| A2  | **Code Preview panel**                               | Lets the user inspect what the generator will emit; powerful demo moment               | `L-DLG-07` + `I-EXP-04`              |
| A3  | **Export Options dialog**                            | Minify on/off, inline-vs-external JS, self-host fonts — these are not toggleable today | `L-DLG-03` + `I-EXP-03`              |
| A4  | **Assets panel**                                     | Uploaded images otherwise have no UI; users will ask "where did my image go"           | `L-DLG-06`                           |
| A5  | **CSP `<meta>` in output**                           | Defense in depth for end users of exported sites; one line of work                     | `I-GEN-20`                           |
| A6  | **View transitions theme toggle**                    | Progressive-enhancement crossfade; striking demo moment, no cost on older browsers     | `I-GEN-14`                           |
| A7  | **Print stylesheet**                                 | Resume template is unusable without it                                                 | `I-GEN-13`                           |
| A8  | **Mailto helper**                                    | Connect section in portfolio uses one; today is hand-rolled                            | `I-GEN-18`                           |
| A9  | **Skip-to-content link**                             | axe rule; trivial to emit; bumps a11y score                                            | `I-GEN-19`                           |
| A10 | **Smart `rel="noopener noreferrer"`**                | One regex; Lighthouse + security win                                                   | `I-GEN-17`                           |
| A11 | **Document variables** (`{{year}}` etc.)             | Author can avoid editing 12 footer copies for date changes                             | `I-DOC-08`                           |
| A12 | **File-watcher conflict dialog**                     | Prevents data loss when editing the .dtw outside the app                               | `I-ELE-06` + `L-DLG-04` + `Y-PER-05` |
| A13 | **WCAG AA/AAA contrast toggle**                      | Surfaced in Document Settings; lets author target strict accessibility                 | `L-PRP-04` + `L-DLG-02`              |
| A14 | **Token import/export (JSON)**                       | Share design systems across projects                                                   | `L-TKN-05`                           |
| A15 | **Grid overlay toggle**                              | Author confidence in alignment; one-line CSS                                           | `L-CAN-10` + `L-TOP-06`              |
| A16 | **Quick-fix actions in Validation Console**          | Lowers friction on common errors (missing alt, broken token ref)                       | `L-VAL-04`                           |
| A17 | **Self-host fonts at export**                        | Makes exports truly offline-capable; works with the relaxed-rule note                  | `I-EXP-05`                           |

---

## 13. Testing Strategy

| Layer                         | Tool                                                            | Coverage target                                     | Owner   |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------- | ------- |
| Unit — document model         | Vitest                                                          | 95 % of `src/document/`                             | Ibrahim |
| Unit — generator              | Vitest snapshot                                                 | every preset + 3 templates round-trip               | Ibrahim |
| Unit — store ops              | Vitest                                                          | every op has insert + undo + redo test              | Yousef  |
| Unit — UI primitives          | Vitest + Testing Library                                        | smoke per panel                                     | LuF8y   |
| Integration — export pipeline | Vitest                                                          | portfolio template exports to a valid ZIP in <10 s  | Ibrahim |
| Integration — IPC round-trip  | Vitest + electron-mocha                                         | every IPC handler hits a real temp dir              | Ibrahim |
| A11y gate                     | axe-core + jsdom                                                | every template exports without `critical`/`serious` | Ibrahim |
| E2E                           | `@playwright/test` driving the packaged app                     | demo path works on Linux + Windows                  | Ibrahim |
| Performance                   | custom Vitest harness writing to `docs/0.2.0v/perf-baseline.md` | budgets in Section 14                               | Yousef  |
| Visual regression _(stretch)_ | Playwright screenshots vs `tests/golden/`                       | portfolio template within 1 % pixel diff            | Ibrahim |

**Skill commands** (`.claude/skills/`) wrap the runs that touch generated output: `accessibility-audit`, `seo-check`, `token-validate`, `runtime-audit`, `export-test`. Run them in CI and locally before opening any PR that changes the generator or runtime.

**CI matrix:** lint + typecheck + unit + integration + a11y on every PR; build matrix on `main`; E2E on tagged releases.

---

## 14. Performance Budgets

These are hard numbers. Misses are tracked in Y-PRF-04 and surfaced as risks in Section 16.

### Editor

| Metric                                                  | Budget   |
| ------------------------------------------------------- | -------- |
| Element drag (100 elements)                             | 60 fps   |
| Element drag (500 elements)                             | ≥ 45 fps |
| Undo / Redo round-trip                                  | < 16 ms  |
| Theme toggle on canvas                                  | < 100 ms |
| Breakpoint switch                                       | < 200 ms |
| Project save (`.dtw`, 500 elements)                     | < 500 ms |
| Project open (`.dtw`, 500 elements, validate + migrate) | < 1.5 s  |
| Initial app cold-start to interactive                   | < 3 s    |

### Output

| Metric                                                               | Budget   |
| -------------------------------------------------------------------- | -------- |
| Portfolio template HTML size (minified, gzipped)                     | < 12 KB  |
| Portfolio template CSS size (minified, gzipped)                      | < 14 KB  |
| Portfolio template JS size (all runtime flags on, minified, gzipped) | < 4 KB   |
| Largest image (WebP)                                                 | < 200 KB |
| Lighthouse Performance (mobile sim)                                  | ≥ 95     |
| Lighthouse Accessibility                                             | 100      |
| Lighthouse SEO                                                       | ≥ 95     |
| Lighthouse Best Practices                                            | ≥ 95     |
| First Contentful Paint (mobile sim)                                  | < 1.5 s  |
| Cumulative Layout Shift                                              | < 0.05   |

### Export

| Metric                                           | Budget |
| ------------------------------------------------ | ------ |
| Portfolio template export end-to-end             | < 10 s |
| Image WebP variant generation (per source image) | < 1 s  |
| axe-core gate run                                | < 2 s  |

---

## 15. Security & Hardening

### Electron threat model

1. **Renderer is untrusted-input territory** even though we wrote it. User-loaded `.dtw` files are untrusted: parse with Zod, never `eval`, never `dangerouslySetInnerHTML` user-supplied strings without sanitization.
2. **Main process is the privileged boundary.** Sandbox the renderer (`sandbox: true`), disable Node integration (`nodeIntegration: false`), enable context isolation (`contextIsolation: true`). No exceptions.
3. **IPC validates every input.** Path sanitization (no `..`, no absolute traversal outside chosen dir), buffer size caps, MIME sniffing on image upload.
4. **No remote URL loading in the renderer** beyond declared CSP origins. No `<webview>` to user-supplied URLs.

### CSP (renderer, prod)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';   /* Tailwind injects */
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
```

### Output security

- Emit `rel="noopener noreferrer"` on every `target="_blank"` link (I-GEN-17).
- Emit a strict CSP `<meta>` in output by default (I-GEN-20); relax automatically when CDN fonts/icons are enabled.
- Image alts default to `""` only if author marks decorative — never silently empty.
- JSON-LD generated via JSON.stringify, never string concatenation.

### File system

- `electronAPI.saveProject` writes to a user-chosen path only; never overwrites a directory.
- `.dtw.autosave` lives next to `.dtw` and is cleared on clean exit.
- Temp dirs (image processing) live under `app.getPath('temp')` and clear on app quit.

### Dependency hygiene

- `npm audit` in CI; PRs blocked on `high`/`critical` advisories.
- Dependabot enabled on `main`.
- Lockfile committed.

---

## 16. Risk Register

Probability × Impact, with mitigation. Two High-risk items firing in the same week triggers an emergency meeting + scope-cut review.

| ID  | Risk                                                    | P   | I   | Mitigation                                                                           | Trigger to escalate                           |
| --- | ------------------------------------------------------- | --- | --- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| R01 | `I-DOC-01` types slip past Day 1, blocking everyone     | M   | H   | Ibrahim's first task; LuF8y and Yousef can scaffold against stubs                    | Types not merged by end of Day 1              |
| R02 | `react-arborist` × `dnd-kit` interop fights             | M   | M   | Decision D1 has a 3-day swap plan                                                    | Layers tree drag breaks Canvas drag           |
| R03 | Recursive canvas perf collapses past 100 elements       | M   | H   | `React.memo` + selector memoization (Y-PRF-01, Y-PRF-02); virtualization as fallback | <45 fps drag at 100 elements                  |
| R04 | Token rename inconsistency between store and references | M   | H   | Single-draft rewrite (Y-STR-05); Vitest covers atomicity                             | Any rename leaves a stale `var(--old)`        |
| R05 | Generator non-determinism (nanoid leaking into output)  | L   | H   | Stable IDs from document; tests assert byte equality                                 | Two consecutive exports differ                |
| R06 | axe-core gate too slow (>5 s)                           | M   | M   | Lazy-load + jsdom warm pool; fall back to manual rules (drop-it: I-EXP-02)           | Gate runs >5 s on portfolio template          |
| R07 | sharp native dep breaks on package build                | M   | H   | `asarUnpack` in electron-builder; clean-VM smoke test as part of I-BLD-01            | Built app fails to import sharp               |
| R08 | Image upload OOMs on large files                        | L   | M   | 50 MB cap in IPC validator; renderer warns before send                               | OOM observed                                  |
| R09 | Theme toggle FOUC                                       | M   | L   | Inline `<script>` in `<head>` reads localStorage before render (I-RUN-01)            | Flash visible on slow CPUs                    |
| R10 | Three engineers diverge on contracts                    | M   | H   | Section 6 + contract-change protocol (X-07)                                          | Mid-week build breaks twice                   |
| R11 | Scope creep — "small" feature added mid-stream          | H   | M   | Anything not in Section 10 or 12 goes to v0.3.0 backlog                              | Two off-plan PRs in one week                  |
| R12 | CI flakiness from sharp/jsdom in headless               | M   | M   | Containerized CI; pin Node version; cache deps                                       | >2 flaky runs in a row                        |
| R13 | Demo machine differs from dev machine                   | L   | H   | Demo on a packaged build (I-BLD-01), rehearsed 3× (X-09)                             | Rehearsal fails on demo hardware              |
| R14 | A11y gate blocks a template we ship                     | M   | M   | Author each template against the gate from day one; quick-fix actions (L-VAL-04)     | Gate blocks portfolio template in integration |

---

## 17. Milestones & Definition of Done

Milestones are gated by task completion, not by calendar. Each milestone gives a clear "what works end-to-end" demo.

### M1 — Foundation

**Gate:** `I-DOC-01..03`, `I-DOC-05`, `Y-STR-01..03`, `Y-PER-01..02`, `L-CAN-01..05`, `L-LYR-01`, `I-ELE-01..04`, `I-GEN-01..03`, `I-EXP-01` (without minification + a11y gate).
**Demo:** user creates a container, puts text inside; tree visible in layers; selection matches; save→load round-trips; undo/redo works on insert/delete/update; export produces a valid HTML/CSS file.

### M2 — Tokens + Themes + Auto-Layout

**Gate:** `I-DOC-06`, `I-GEN-04..08`, `I-RUN-01`, `Y-STR-05..07`, `L-PRP-02..04`, `L-TKN-01..04`, `L-TKN-06`, `L-TOP-01`.
**Demo:** tokens panel works; bind color → change token → canvas updates everywhere as one history entry; theme toggle on canvas + output; auto-layout reflows on edit; output CSS has `:root` block + `var()` references.

### M3 — Composition + Responsive + States

**Gate:** `I-DOC-04`, `I-TPL-01..02`, `I-TPL-05`, `I-GEN-09..12`, `Y-STR-04`, `L-SBR-01..04`, `L-CAN-12..13`, `L-CAN-06..07`, `L-TOP-02`, `L-PRP-05..09`, `Y-STR-04..07`, `I-ELE-05`, `L-DLG-01`.
**Demo:** 6+ presets in Insert sidebar; drag inserts a preset subtree; hover state edits work; breakpoint switcher works; multi-select works; image upload pipeline → WebP via sharp → generator emits srcset; output: states → `:hover`, responsive → media queries.

### M4 — Runtime + Output Hardening

**Gate:** `I-GEN-13..20`, `I-RUN-02..08`, `I-SEO-01..07`, `I-EXP-02..03`, `I-DOC-07..08`, `L-VAL-01..03`, `L-DLG-02..03`, `L-DLG-05`, `L-TOP-04..05`, `I-TPL-03..04`.
**Demo:** validation console works; errors block export; reveal-on-scroll runs in output; theme toggle / smooth scroll / mobile menu all run; 3 templates ready (Portfolio + Landing + Resume); exported ZIP opens in a browser and works.

### M5 — Polish + Demo

**Gate:** `L-CAN-10..11`, `L-LYR-03..04`, `L-PRP-10`, `L-TKN-05`, `L-VAL-04`, `L-DLG-04`, `L-DLG-06..08`, `I-RUN-07..08`, `I-EXP-04..05`, `Y-PRF-04`, `I-BLD-01..05`, `X-09`.
**Demo:** rehearsed end-to-end 3× without errors; budgets in Section 14 met; release artifact published.

---

## 18. Scope-Cut Triggers

When a milestone is at risk, apply the cut **the same day** the trigger fires. No negotiation.

| Trigger                                      | Cut                                                               |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Recursive canvas doesn't render in real Flex | Cut to absolute positioning _(violates principles — last resort)_ |
| Store / history too slow                     | Drop patches; snapshot strategy (1× memory cost)                  |
| Token binding implementation complex         | Make binding optional; tokens resolved at export only             |
| Theme switch >1 s on canvas                  | Dark mode in output only, not in live preview                     |
| Presets hard to author                       | Cut to 3 (Hero, Card, Footer)                                     |
| Per-breakpoint responsive complex            | Mobile-only override; Tablet = Desktop                            |
| Multi-select introduces history bugs         | Single-select only; multi-delete still works via Layers tree      |
| Animation system flaky                       | CSS-only in output, no UI picker                                  |
| axe-core gate too slow                       | Manual rules only (custom validators in I-DOC-05)                 |
| 3 templates infeasible                       | Ship Portfolio only                                               |
| `motion` polish not landing                  | Drop entirely; CSS transitions only                               |
| Self-host fonts (I-EXP-05) breaks export     | Drop; CDN-only                                                    |
| Code preview pane (L-DLG-07) drags scope     | Drop; ship without                                                |
| Asset panel (L-DLG-06) drags scope           | Drop; uploaded images live only in Properties panel               |
| View transitions (I-GEN-14) cause regression | Drop; flag re-add for v0.3.0                                      |

---

## 19. Demo Plan

Total: 15–20 min.

1. **Intro (2 min)** — what the tool is, who built it, what makes it different (tokens-first, a11y-gated, semantic by construction).
2. **Welcome → Open Portfolio template (1 min)** — boot from cold, show recent files, open Portfolio.
3. **Edit + theme (4 min)** — change accent color from Tokens panel (whole site updates live, contrast indicator follows); toggle dark/light; edit hero text inline.
4. **Build a section from scratch (4 min)** — drag Cards Grid from Insert sidebar; reorder a card in Layers tree; adjust padding/gap; add a hover state; bind colors to tokens.
5. **Responsive (2 min)** — switch to Mobile; change a font-size for mobile (📱 badge appears); show grid collapsing to a column.
6. **Code Preview (1 min)** — open Code Preview panel; show clean, formatted HTML/CSS/JS that matches the canvas.
7. **Validation + Export (3 min)** — run validation; axe-core green; open Export Options; export ZIP; open `index.html` in a browser; dark-mode toggle / scroll reveals / mobile menu / smooth scroll all working.
8. **Q&A (2 min)**.

**Strengths to emphasize:** tokens-driven design, semantic HTML by construction, auto-layout, axe-core hard gate, schema migration, live theme, optimized output (WebP + minified), type-safe document (Zod), opt-in JS (output is JS-free if author wants).

**Backup demo:** pre-recorded screen capture of the full path, in case live demo hits a packaged-build bug.

---

## 20. Release & Distribution

### Versioning

SemVer. `v0.2.0` is the first ship of this plan. `v0.3.0` is for post-release Tier-1 polish. `v1.0.0` is the sprint demo cut.

### Build matrix

| Target            | Format                  | Owner   | Notes                                               |
| ----------------- | ----------------------- | ------- | --------------------------------------------------- |
| Windows x64       | `.exe` (NSIS installer) | Ibrahim | Authenticode signing if cert available (I-BLD-05)   |
| Linux x64         | `.AppImage`             | Ibrahim | Self-contained; works without install               |
| Linux x64         | `.deb`                  | Ibrahim | For Debian/Ubuntu apt                               |
| macOS arm64 + x64 | `.dmg`                  | Ibrahim | Optional; only if Apple developer account available |

### Release process

1. All tasks for the target milestone merged to `main` via squash PR.
2. `npm run lint && npm run typecheck && npm run test && npm run test:a11y && npm run build` all green.
3. Tag `git tag v0.2.0 -a -m "v0.2.0"`; push tag.
4. GitHub Actions release workflow (I-BLD-03) builds all targets, generates changelog from conventional commits, uploads artifacts to GitHub Releases.
5. Smoke-test artifacts on a clean VM per target.
6. Update README with download links.

### Distribution channels (v0.2.0 scope)

- GitHub Releases (primary).
- README + repo landing page.

Cloud distribution, auto-updater, code-signing infrastructure, and a marketing site are Tier 3.

---

## 21. Documentation Deliverables

| Doc                                                                                                                                                  | Owner   | When          | Audience                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- | -------------------------------------- |
| `README.md`                                                                                                                                          | Ibrahim | M1 + final    | repo visitors                          |
| `CLAUDE.md` (refresh)                                                                                                                                | Ibrahim | per milestone | future Claude sessions                 |
| `docs/0.2.0v/plan.md` (this file)                                                                                                                    | Ibrahim | living        | team                                   |
| `DECISIONS.md`                                                                                                                                       | all     | living        | team                                   |
| `docs/0.2.0v/architecture.md`                                                                                                                        | Ibrahim | M2            | supervisor + future maintainers        |
| `docs/0.2.0v/element-model.md`                                                                                                                       | Ibrahim | M2            | future maintainers                     |
| `docs/0.2.0v/perf-baseline.md`                                                                                                                       | Yousef  | M5            | release notes                          |
| `docs/0.2.0v/supervisor-report.md`                                                                                                                   | Ibrahim | M5            | academic submission                    |
| Inline JSDoc on every exported function in `src/document/`, `src/generator/`, `src/seo/`, `src/export/`, `src/runtime/`, `src/main/`, `src/preload/` | Ibrahim | continuous    | future maintainers (rule in CLAUDE.md) |
| User-facing onboarding tour _(stretch)_                                                                                                              | LuF8y   | M5            | end users                              |

---

## 22. Out of Scope — Tier 2 / Tier 3

### Tier 2 — Future Authoring (post-release, ~2–3 months)

See `draft/Features/future-authoring.md`. Major gaps from this release: robust multi-select & group/ungroup with constraints, snap+align+distribute tools, components & instances with variants, real layers panel with cross-container drag/filter/rename, direct-manipulation handles, history panel with named undos, multi-page projects, image cropping in-editor, onboarding tour, smart-text resize.

### Tier 3 — Future Product (years)

See `draft/Features/future-product.md`. Major gaps: template gallery + marketplace, one-click publish (Netlify/Vercel/GH Pages), multi-user editing, accounts + cloud sync, forms / CMS / dynamic content, Lighthouse-100 hard gate in CI, analytics dashboard, auto-updater + code-signed installers + crash reporting, support docs + billing, editor accessibility (the editor itself meeting WCAG), RTL output, i18n, marketing site.

**Framing for the supervisor:** ship Tier 1 well; document Tier 2 + Tier 3 as the scope cliff that separates an academic deliverable from a commercial product.

---

## 23. Honest Summary

The math:

- The Tier-1 surface in this plan is large.
- The team is three engineers, mostly part-time.
- Library choices are coherent and known-good.
- Without dedicated time-boxing, the risk is drift; with this plan, the risk is overcommit.

What makes success possible

1. Clear ownership — every task in Section 10 has exactly one owner.
2. Hard contracts — Section 6 prevents the worst kind of integration failure.
3. Hard cuts — Section 18 lets us protect the demo from any single feature.
4. Claude Code as a productivity multiplier when fed real context (Appendix B).

What makes success uncertain

1. Three-way integration across 4 layers (document, store, UI, generator).
2. Library learning curve, especially `dnd-kit` interop.
3. Native dependency packaging (sharp) on the build matrix.

Absolute conditions for success

1. Day 0 cannot be skipped.
2. Daily 15-min standup.
3. Weekly integration ritual is sacred.
4. PR review SLA: 24 h.
5. Scope-cut triggers applied the same day a signal fires.
6. No off-plan features. Anything "lightweight" goes to v0.3.0.
7. Give Claude Code real context — libraries, types, patterns. Don't ask it to invent.

A thesis is judged on **what works in the demo**, not on **what was planned**. Focus on the demo path first, everything else second.

---

## Appendix A — Install List

### Ibrahim

```bash
npm install immer zod nanoid
npm install jszip prettier lightningcss html-minifier-terser sharp svgo axe-core jsdom chokidar
npm install --save-dev @playwright/test
```

### Yousef

```bash
npm install zustand use-immer
# immer / zod / nanoid installed by Ibrahim
```

### LuF8y

```bash
npm install \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  clsx tailwind-merge radash \
  @radix-ui/react-tabs @radix-ui/react-dropdown-menu \
  @radix-ui/react-popover @radix-ui/react-dialog \
  @radix-ui/react-context-menu @radix-ui/react-switch \
  @radix-ui/react-slider @radix-ui/react-tooltip \
  react-resizable-panels react-arborist \
  react-colorful chroma-js \
  lucide-react react-hotkeys-hook react-error-boundary
npm install --save-dev @types/chroma-js
# Polish window only
npm install motion
# Code-preview syntax highlight
npm install shiki
```

---

## Appendix B — Using Claude Code

Prepend this context to every non-trivial Claude Code request:

```
Project: Draw-to-Web (Electron + React, desktop website builder).
Libraries:
- State: Zustand + immer (patches for undo/redo)
- UI: Radix UI + Tailwind CSS v3
- DnD: dnd-kit (canvas) + react-arborist (tree)
- Icons: lucide-react in editor; inline SVG in output
- Color: react-colorful + chroma-js
- Validation: Zod
- Export: prettier + lightningcss + html-minifier-terser + sharp + jszip + axe-core

Structure:
- src/document/   Document Model (types, ops, tokens, validation, migrations, presets)
- src/store/      Zustand stores
- src/ui/         React components
- src/generator/  HTML/CSS/JS emission
- src/runtime/    vanilla JS injected into output
- src/seo/        SEO + JSON-LD
- src/export/     validation gate + pipeline + ZIP
- src/main/       Electron main + IPC
- src/preload/    contextBridge typed API

Rules:
- No `any`; use unknown + type guards or Zod at boundaries.
- Recursive React renderer; no Konva.
- No `position: absolute`; CSS Grid + Flexbox + clamp().
- Runtime JS is opt-in per behavior; default = off.
- axe-core hard gate before export.
- Commits do not mention AI / Claude.

Task ID: <from docs/0.2.0v/plan.md Section 10>
Contract refs: <from Section 6 if relevant>
Request: [feature here]
```

After landing the change, run the relevant skill before opening a PR:

- `/accessibility-audit` — anything touching generator or runtime
- `/runtime-audit` — anything touching `src/runtime/`
- `/seo-check` — anything touching `src/seo/`
- `/token-validate` — anything touching tokens
- `/export-test` — anything touching `src/export/`
- `/phase-status` — to check what milestone we're on

---

## Appendix C — File Glossary

One line per file. Update as files land.

### `src/main/`

- `index.ts` — Electron app lifecycle, BrowserWindow creation, app menu wiring.
- `ipc.ts` — every `ipcMain.handle()` registration; input validation lives here.

### `src/preload/`

- `index.ts` — `contextBridge.exposeInMainWorld('electronAPI', ...)`; the security boundary.

### `src/shared/`

- `electronAPI.d.ts` — typed surface for renderer consumption of `electronAPI`.
- `ipc-channels.ts` — string constants for IPC channel names (prevents typos).

### `src/document/`

- `types.ts` — every Document Model type (C1).
- `schemas.ts` — Zod schemas, lockstep with `types.ts` (C2).
- `tokens.ts` — `resolveToken` + token-related pure helpers (C9).
- `operations.ts` — `Operation` union + immer mutators (C3).
- `validation.ts` — `validateDocument` rules (C8).
- `migrations.ts` — versioned step functions (Y-PER-02 calls into this).
- `presets/index.ts` — `presetsRegistry` (C7).
- `presets/*.ts` — one preset per file.

### `src/store/`

- `documentStore.ts` — Zustand store holding the document; dispatcher (C5).
- `historyStore.ts` — past/future patch stacks; undo/redo.
- `sessionStore.ts` — UI-only state (selection, breakpoint, active state, panel sizes).

### `src/ui/`

- `canvas/CanvasNode.tsx` — recursive renderer.
- `canvas/inferSemantics.ts` — adapter producing `semanticRole` hints (C10).
- `panels/properties/*.tsx` — Properties panel + sub-components per category.
- `panels/tokens/*.tsx` — Tokens panel.
- `panels/validation/*.tsx` — Validation console.
- `panels/assets/*.tsx` — Assets panel (L-DLG-06).
- `panels/code-preview/*.tsx` — Code preview panel (L-DLG-07).
- `panels/document-settings/*.tsx` — Document Settings dialog content.
- `sidebar/*.tsx` — Insert sidebar.
- `topbar/*.tsx` — Topbar controls.
- `layers/*.tsx` — `react-arborist` tree.
- `dialogs/Welcome.tsx`, `dialogs/ExportOptions.tsx`, `dialogs/ConflictResolver.tsx`.

### `src/generator/`

- `index.ts` — `generate(document)` orchestrator (C6).
- `htmlEmitter.ts` — semantic HTML emission.
- `cssEmitter.ts` — CSS Grid/Flex/clamp; tokens; states; media queries; animations.
- `jsEmitter.ts` — concatenate enabled runtime snippets.

### `src/runtime/`

- `themeToggle.ts`, `scrollSpy.ts`, `navOnScroll.ts`, `mobileNav.ts`, `reveals.ts`, `animationGating.ts`, `terminalTyping.ts` — one file per opt-in snippet.

### `src/seo/`

- `head.ts` — meta tags.
- `og.ts` — Open Graph + Twitter.
- `jsonld.ts` — schema.org payload builder.
- `sitemap.ts`, `robots.ts` — static-file emitters.

### `src/export/`

- `index.ts` — `exportProject` orchestrator (C12).
- `axeGate.ts` — lazy axe-core + jsdom integration.
- `minify.ts` — `lightningcss` + `html-minifier-terser` wrappers.
- `bundle.ts` — `jszip` packaging.

### `src/templates/`

- `portfolio.ts`, `landing.ts`, `resume.ts`, `blank.ts` — one document factory per template.

---

_v0.2.0 plan — replaces `docs/0.1.0v/_`. Tasks owned by engineer, Section 10. Contracts in Section 6. Ready for Day 0.\*
