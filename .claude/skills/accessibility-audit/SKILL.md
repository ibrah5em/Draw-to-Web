---
description: Run an accessibility audit on generated HTML output. Use when the user mentions a11y, accessibility, axe-core, or WCAG.
---

## Scope

Maps to the export-gate task `I-EXP-02` in `docs/0.2.0v/plan.md` Section 10.6, the validation rules in `I-DOC-05`, and the WCAG AA/AAA toggle in `L-PRP-04` + `L-DLG-02`.

## Instructions

1. Find the most recent generated HTML (export folder, `tests/fixtures/output/`, or a snapshot test).
2. Run axe-core against it (`npm run test:a11y`, or programmatically via lazy-loaded `axe-core` in `jsdom` per `src/export/axeGate.ts`).
3. Manually verify, in addition to axe:
   - **Skip-to-content link** (I-GEN-19) is the first child of `<body>`, visually hidden but focusable.
   - Every `<img>` has `alt` (empty string allowed only for decorative).
   - `<html lang="...">` set.
   - Exactly one `<h1>`; logical heading order.
   - Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<footer>` where appropriate.
   - Icon-only `<button>` elements carry `aria-label`.
   - Mobile nav: focus trap while open, `aria-expanded` reflects state (I-RUN-04).
   - Visible focus indicators in the stylesheet (`:focus-visible`).
   - Color contrast with `chroma-js` against token values — **WCAG AA** (4.5:1 body, 3:1 large) by default, **AAA** (7:1 / 4.5:1) if `document.settings.wcagLevel === 'AAA'`.
   - `@media (prefers-reduced-motion: reduce)` present whenever any animated element is in the tree, and disables non-essential animations (I-GEN-11). Runtime reveals still add the `.visible` class so dependent styles work (I-RUN-06).
   - Every `<a target="_blank">` carries `rel="noopener noreferrer"` (I-GEN-17).
4. Output a summary: total issues grouped by severity (`critical` / `serious` / `moderate` / `minor`).
5. For each issue: file path, what failed, the specific fix (cite the task ID — e.g. "missing alt → I-DOC-05 + Properties panel L-PRP-08").
6. End with the **gate verdict**: PASS / BLOCK. Any `critical` or `serious` violation means BLOCK — export must not proceed (I-EXP-02).
7. Budget: the full gate run should complete in <2 s on the portfolio template (Section 14). Flag if it took longer — this is risk R06 in the register.
