---
paths:
  - 'tests/**'
---

# Testing Standards

Source of truth: `docs/0.2.0v/plan.md` Section 13 (testing strategy) and Section 14 (performance budgets).

## Stack

- **Unit / integration / a11y:** Vitest + `@vitest/coverage-v8`.
- **E2E:** `@playwright/test` driving the packaged Electron app (demo path on Linux + Windows, tagged-release only).
- **A11y gate:** `axe-core` lazy-loaded inside `jsdom`.

## Coverage targets

| Layer               | Target                                              |
| ------------------- | --------------------------------------------------- |
| `src/document/`     | 95 %                                                |
| Generator + presets | every preset and every template round-trips         |
| Store ops           | every op has insert + undo + redo test              |
| UI primitives       | smoke per panel                                     |
| Export pipeline     | portfolio template ZIPs in <10 s end-to-end         |
| IPC round-trip      | every handler hits a real temp dir                  |
| A11y gate           | every template exports without `critical`/`serious` |

## Conventions

- Document fixtures live in `tests/fixtures/` as JSON files matching the Zod document schema.
- Golden HTML/CSS outputs live in `tests/fixtures/` alongside the source; snapshot diff is byte-equal (determinism is a hard rule).
- Tests live next to the module (`tests/<module>/`) and run in isolation from the UI.
- File naming: `<module>.test.ts`.
- Runtime snippets are tested in isolation (jsdom): theme toggle flips `data-theme`; mobile nav toggles a class + traps focus; IntersectionObserver mock adds `visible`; reduced-motion mock skips animation but still applies the class.
- SEO tests verify: required `<head>` tags, OG + Twitter Card, JSON-LD shape (parses as valid JSON), single `<h1>`, `<html lang>`, canonical, `theme-color` per scheme, preconnect for every external origin, sitemap.xml + robots.txt validity.
- Validation tests cover every rule in I-DOC-05: heading hierarchy, alt text, token reference validity, duplicate IDs, color contrast (AA + AAA modes), unused tokens.
- IPC round-trip test: renderer calls `electronAPI.exportZip(buffer, name)` → main writes file → assert file exists with expected bytes.
- Determinism check: run `generate(doc)` twice on the same document; assert byte-identical output.

## CI matrix

- **Every PR:** lint + typecheck + unit + integration + a11y.
- **`main` push:** build matrix (Windows + Linux).
- **Tagged release:** full matrix + E2E.

## Performance harness (Y-PRF-04)

- Vitest harness writes measured numbers to `docs/0.2.0v/perf-baseline.md`.
- Editor budgets: drag (100 el) 60 fps; undo/redo <16 ms; theme toggle <100 ms; breakpoint switch <200 ms; project save <500 ms; project open <1.5 s; cold-start <3 s.
- Output budgets: HTML <12 KB gz; CSS <14 KB gz; JS (all flags on) <4 KB gz; largest WebP <200 KB; Lighthouse Perf ≥95, A11y 100, SEO ≥95, FCP <1.5 s, CLS <0.05.
- Export budgets: portfolio export <10 s; per-image WebP <1 s; axe-core gate <2 s.

## Skill rituals (X-08)

Before merging a feature, run the relevant skill and document any failure in the PR description:

- `/accessibility-audit` — anything touching generator or runtime.
- `/runtime-audit` — anything touching `src/runtime/`.
- `/seo-check` — anything touching `src/seo/`.
- `/token-validate` — anything touching tokens.
- `/export-test` — anything touching `src/export/`.
- `/phase-status` — to confirm milestone progress.

## Contract-change protocol (X-07)

Any change to a Section 6 contract (C1–C12) requires:

1. PR labeled `contract-change`.
2. Test coverage for both producer and downstream consumer.
3. Review from the consumer named in that contract row.
