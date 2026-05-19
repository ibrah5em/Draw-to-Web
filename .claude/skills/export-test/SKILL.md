---
description: Test the full export pipeline end-to-end. Use when the user asks to test export, validate output, or check the ZIP bundle.
---

## Scope

Maps to `I-EXP-01..05` in `docs/0.2.0v/plan.md` Section 10.6 and contract `C12` (`exportProject(document, options): Promise<ExportResult>`).

## Instructions

1. Pick a fixture in `tests/fixtures/` (prefer the most complex one with tokens, themes, presets, states, responsive — the portfolio template is ideal).
2. Run the pipeline programmatically in `exportProject` order:
   1. **Validate** the document via `validateDocument` (I-DOC-05): heading hierarchy, alt text, token references, duplicate IDs, color contrast. **Errors block — gate stops here.**
   2. **Generate** HTML / CSS / JS via `generate(document)` (I-GEN-01 / C6).
   3. **Inject SEO** + JSON-LD (I-SEO-01..05).
   4. **Run axe-core** on the resulting HTML inside `jsdom` (I-EXP-02). Any `critical` or `serious` blocks.
   5. **Optimize images** via `sharp` (WebP + srcset, I-ELE-05). Skip if no images.
   6. **Minify** with `lightningcss` + `html-minifier-terser` (skipped if `options.minify === false`).
   7. **Emit sitemap.xml + robots.txt** (I-SEO-06, I-SEO-07).
   8. **Build ZIP** with `jszip` (in-memory, I-EXP-01 step 7).
   9. (skip in test) IPC → `fs.writeFile`.
3. Test `dryRun: true` mode (I-EXP-04): returns `{ html, css, js }` strings without writing. Budget <500 ms on portfolio template.
4. Validate the final outputs:
   - HTML is well-formed HTML5.
   - Every class referenced in HTML exists in the stylesheet.
   - No `position: absolute` in CSS (regex guard).
   - `:root` block + `var(--token)` references present.
   - `:root[data-theme="..."]` overrides present if both palettes defined.
   - `@media (prefers-color-scheme: dark)` present.
   - Runtime `<script>` is present **iff** any runtime flag is true; absent otherwise. FOUC inline script in `<head>` iff theme toggle is on.
   - Skip-to-content link is first child of `<body>`.
   - CSP `<meta>` present.
   - axe-core reports zero `critical` or `serious` violations.
   - ZIP contains `index.html`, `styles.css`, `sitemap.xml`, `robots.txt`, plus conditional `script.js`, `assets/`, `favicon.svg`, optional `assets/fonts/` (if `selfHostFonts: true`).
5. **Determinism**: run the full pipeline twice on the same document; bundle bytes must match.
6. **Budgets** (Section 14): portfolio export end-to-end <10 s; per-image WebP <1 s; axe gate <2 s.
7. **Structured progress events**: confirm `exportProject` emits `(stage, progress) => void` for each pipeline step (I-EXP-01).
8. Report as a table: **Stage | Check | Status | Budget | Details**.
9. End with: `PASS` / `FAIL` and the list of any blockers, each mapped to its `I-EXP-NN` / `I-GEN-NN` task ID.
