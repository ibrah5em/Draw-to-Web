---
paths:
  - 'src/generator/**'
  - 'src/runtime/**'
  - 'src/seo/**'
  - 'src/export/**'
---

# Generator, Runtime, SEO & Export Rules

Source of truth: `docs/0.2.0v/plan.md` Sections 10.3–10.6 (tasks `I-GEN-*`, `I-RUN-*`, `I-SEO-*`, `I-EXP-*`) and the contracts `C6` (`generate`), `C10` (`inferSemantics`), `C12` (`exportProject`).

## Generator

- Deterministic compiler: walk `document.tree` → emit HTML + CSS + JS strings. Same input always produces byte-identical output (no random IDs, no timestamps).
- Tag selection is driven by `element.semanticRole` from the document (preserved by `inferSemantics`, C10), **not** by spatial heuristics. A `<section>` is emitted because the author inserted a Section / Hero preset, not because of position.
- CSS classes are programmatic and scoped per element (`dtw-el-{stableId}`) to avoid collisions.
- Emit `:root { --token: value; }` for every token in `document.tokens` (I-GEN-04) and `:root[data-theme="dark"] { ... }` overrides. Token-bound properties reference `var(--name)`, never the resolved value (I-GEN-05).
- Emit `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ... } }` so the OS preference wins until the user toggles (I-GEN-06).
- Layout: CSS Grid + Flexbox + `clamp()`. **Never `position: absolute`.** A regex guard in tests enforces this.
- Responsive: per-breakpoint property values become `@media (max-width: 1024px | 768px | 480px)` blocks (I-GEN-08). Desktop value sits in the base block; mobile lives only in its query.
- States: `:hover`, `:focus-visible`, `:active` blocks emit only the overridden properties (I-GEN-07).
- Backgrounds & surfaces: solid + gradient + multi-layer, `mask-image`, `backdrop-filter`, decorative `body::before`/`body::after` for grid + noise (I-GEN-09).
- Borders / radii / shadows: per-corner radius, multi-layer box-shadow, accent-token glow (I-GEN-10).
- Animations: keyframe library (`fadeUp`, `pulse-dot`, `blink-cursor`, `typing-line`, `shimmer`); per-element delay + duration. Whenever any animated element is in the tree, emit `@media (prefers-reduced-motion: reduce) { ... }` to disable non-essential motion (I-GEN-11).
- Images: `<img>` references sharp-generated WebP variants via `srcset` + `sizes`; `loading="lazy"`, `decoding="async"`, `width` + `height` to prevent CLS (I-GEN-12).
- Required emits regardless of presets: skip-to-content link as first child of `<body>` (I-GEN-19); `rel="noopener noreferrer"` on every `<a target="_blank">` (I-GEN-17); strict CSP `<meta http-equiv>` in output, relaxed only when CDN fonts/icons are enabled (I-GEN-20).
- Document variables: `{{name}}` in text + attribute values is interpolated from `document.variables` at emit (I-DOC-08).
- View transitions (I-GEN-14) + print stylesheet (I-GEN-13) are P2 — progressive enhancement, must degrade cleanly.
- Mailto helper (I-GEN-18) URL-encodes `{ to, subject?, body? }`; never string-concat.
- Run `prettier` on HTML + CSS before they leave the generator (I-GEN-16); minification happens in the export pipeline only.

## Runtime

- Opt-in per behavior, gated by `document.runtime` flags. If every flag is `false`, the JS emitter produces no `<script>` tag at all (I-GEN-15).
- Theme toggle (I-RUN-01) requires an inline `<script>` in `<head>` that reads `localStorage` before render — no flash of wrong theme on reload.
- Mobile nav (I-RUN-04): focus trap while open, `aria-expanded` reflects state, closes on link click.
- Scroll-spy (I-RUN-02), nav-on-scroll style change (I-RUN-05): `IntersectionObserver` / `requestAnimationFrame` only — never raw scroll listeners.
- Smooth scroll lives in CSS; JS only computes `scroll-padding-top` to match nav height (I-RUN-03).
- IO reveals (I-RUN-06) and animation gating (I-RUN-07) must check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and skip animation while still adding any dependent state class.
- Terminal typing (I-RUN-08) is driven by CSS keyframes; JS only flips `animation-play-state`. No `setTimeout` typewriter loops.
- Every snippet is passive, idempotent, works in isolation, and passes `eslint --no-unused-vars` after templating.

## SEO

- Required head content (I-SEO-01): `<title>`, `<meta name="description">`, `keywords`, `author`, `<html lang>`, viewport, charset, `<meta name="theme-color">` per scheme, canonical.
- Open Graph + Twitter Card (I-SEO-02): `og:title|description|type|image|url`, `twitter:card=summary_large_image`.
- JSON-LD (I-SEO-03): `Person` / `Organization` / `WebSite`; emit via `JSON.stringify`, never string concat.
- Favicon (I-SEO-04): inline SVG data URI by default; SVG uses `prefers-color-scheme` for dark/light.
- `preconnect` + `dns-prefetch` for every external origin (I-SEO-05).
- `sitemap.xml` (I-SEO-06) + `robots.txt` (I-SEO-07) emitted into the export bundle.

## Export

- Pipeline order (`exportProject`, C12 / I-EXP-01): validate → generate HTML/CSS/JS → inject SEO + JSON-LD → optimize images (sharp manifest already produced) → minify (`lightningcss` + `html-minifier-terser`) → emit sitemap + robots → ZIP (`jszip`) → IPC → `fs.writeFile`. Emit structured progress events `(stage, progress) => void`.
- Validation gate runs first (I-EXP-02): lazy-load `axe-core` in `src/export/axeGate.ts`, run on generated HTML inside `jsdom`. Any `critical` or `serious` violation blocks export with a `ValidationReport`.
- Export options (I-EXP-03): `{ minify, inlineJS, selfHostFonts, includeSourceComments, theme: 'auto' | 'dark' | 'light' }`. Self-host-fonts fetches woff2 files into `assets/fonts/` and rewrites `@font-face` (I-EXP-05).
- Dry-run mode (I-EXP-04): `exportProject(doc, { dryRun: true })` returns `{ html, css, js }` strings without writing — used by the Code Preview panel; budget <500 ms for the portfolio template.
- The renderer builds the ZIP buffer; the main process only writes it. IPC contract is C11 / I-ELE-04.

## Tests

- Every generator mapping needs a fixture in `tests/fixtures/` and a Vitest snapshot.
- The portfolio template (I-TPL-02) must export within <10 s and pass the axe gate.
- Performance budgets in Section 14 are hard numbers — misses tracked in `Y-PRF-04` and `docs/0.2.0v/perf-baseline.md`.
