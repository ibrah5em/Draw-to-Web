# Changelog

All notable changes to Draw-to-Web are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-01

The sprint demo cut. v1.0.0 lands three new authoring capabilities on top of the
v0.3.0 tokens-driven, responsive, opt-in-JS builder — all three pure/headless at
the core and reusing the existing Document Model operations and export pipeline
(no new element primitives, no new store ownership).

### Added

- **Draw to create (`src/draw/`)** — draw a rectangle on the canvas to spawn an
  element. `interpretRectangle` guesses the element kind (ranked alternatives +
  confidence + explainer hint); `snapToGrid` resolves the drawn box to a grid
  placement (column start/span + insertion index, pure math — never pixels); the
  canvas builds the node with the existing `createPrimitive` factory and
  dispatches an ordinary `insertElement` op. Drawn pixels never touch the store.
  UI: `DrawSurface` + `DrawTypePicker` wired into the canvas.
- **Match my layout (`src/match/`)** — match a rough drawn layout to a bundled
  professional design. `extractSignature` builds a deterministic structural
  fingerprint of a document tree (never pixels); `matchLayout` does a ranked,
  best-first comparison with a per-dimension breakdown; six bundled pages
  (agency, docs-article, gallery-media, landing-saas, portfolio-split,
  resume-minimal), each shipping a build-time precomputed signature; `adopt.ts`
  hydrates the chosen page through the same entry point a `.dtw` load uses.
  UI: `MatchButton` + `MatchLayout` dialog.
- **Headless MCP server (`mcp/`)** — a stdio Model Context Protocol server
  exposing ~20 tools over the document / perception / mutation / export
  pipeline (`create_document`, `insert_element`, `insert_preset`, `apply_template`,
  `set_tokens`, `set_theme`, `set_runtime`, `set_seo`, `match_layout`,
  `preview_html`, `export_site`, …). Runs without Electron via an `fs`-backed
  export shim; every tool is a thin adapter over existing operations (C3) and the
  generate / a11y / export entry points — no logic reimplemented. Scripts:
  `npm run mcp`, `npm run build:mcp`, `npm run start:mcp`,
  `npm run generate:match-signatures`.

### Changed

- CI runners bumped to Node 24; `windows-2025` pinned in the release matrix.
- Wall-clock export/perf budgets moved to a dedicated lane
  (`vitest.perf.config.ts`, `npm run test:perf`) so a loaded machine can't flake
  the default suite; aliases shared via `vitest.shared.ts`.
- `@draw` / `@match` path aliases added across the Vite / Vitest / tsconfig
  configs.
- Test suite grew to **1042 tests** across 110 files (from 871 / 93) with the new
  `tests/draw/`, `tests/match/`, and `tests/mcp/` suites.

### Notes

- Landing the draw/match features expands the previously Tier-2 "editor
  experience" scope into v1.0.0 — see `DECISIONS.md` **D-03**.
- The `X-09` demo rehearsal and `Y-PRF-04` render-layer perf sign-off remain the
  top post-release items, still waived — see `DECISIONS.md` **D-02** / **D-04**.

## [0.3.0] — 2026-06-03

M5 polish cut. Final supervisor report + `DECISIONS.md` log; export ships
minifiers as runtime deps; image preview in the editor; landmark inference gated
on content signals; active pseudo-state indicator; layers eye/lock toggles wired
to canvas. Shipped with a conscious waiver of the `X-09` rehearsal and
render-layer perf sign-off (`DECISIONS.md` D-02).

## [0.2.0] — M4: Runtime + Output Hardening

Full opt-in runtime snippets, SEO + JSON-LD, validation console, the axe-core
hard gate that blocks export, and the portfolio / landing / resume templates.

## [0.1.0] — Initial prototype

Six-stage, zero-JS export pipeline driven by a flat element store (archived in
`docs/0.1.0v/`).

[1.0.0]: https://github.com/ibrah5em/Draw-to-Web/releases/tag/v1.0.0
[0.3.0]: https://github.com/ibrah5em/Draw-to-Web/releases/tag/v0.3.0
[0.2.0]: https://github.com/ibrah5em/Draw-to-Web/releases/tag/v0.2.0
[0.1.0]: https://github.com/ibrah5em/Draw-to-Web/releases/tag/v0.1.0
