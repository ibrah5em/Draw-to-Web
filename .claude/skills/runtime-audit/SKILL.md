---
description: Audit the runtime JS snippets in generated output (opt-in gating, passivity, prefers-reduced-motion, FOUC guard, focus trap). Use when the user mentions runtime, runtime snippets, output JS, theme toggle, scroll-spy, mobile menu, or reveals.
---

## Context

Per `docs/0.2.0v/plan.md` Section 3, zero-JS output is relaxed: the generator may emit small, vetted, **opt-in** runtime snippets. This skill verifies the gating works and the emitted JS is well-behaved.

The runtime snippets and their owning tasks (Section 10.4):

1. **Theme toggle + persistence** (I-RUN-01) — requires an inline `<script>` in `<head>` reading `localStorage` before render (FOUC guard).
2. **Scroll-spy** (I-RUN-02) — `IntersectionObserver` on sections, `.is-active` on matching nav link.
3. **Smooth scroll + `scroll-padding-top`** (I-RUN-03) — CSS handles smoothness; JS only computes nav padding.
4. **Mobile nav** (I-RUN-04) — toggle button, **focus trap while open**, `aria-expanded` reflects state, closes on link click.
5. **Nav-on-scroll style change** (I-RUN-05) — `.scrolled` class via `requestAnimationFrame`, not scroll spam.
6. **IntersectionObserver reveals** (I-RUN-06) — `.visible` on entry; respects `prefers-reduced-motion` (skips animation, still adds the class).
7. **Animation play-state gating** (I-RUN-07) — pauses CSS animations until in view; no CPU spent off-screen.
8. **Terminal typing** (I-RUN-08) — CSS keyframes only; JS flips `animation-play-state`. No `setTimeout` loops.

## Instructions

1. Find the most recent generated output (export folder or `tests/fixtures/output/`).
2. Read the source document used to generate it (so you know which `document.runtime.*` flags are true).
3. **Gating check** — for each runtime flag:
   - If `document.runtime.themeToggle === true` → the theme-toggle code is present **and** the FOUC guard inline `<script>` is in `<head>` before any stylesheet.
   - If `false` (or absent) → that code is NOT present (and the FOUC guard is absent unless another flag requires it).
   - **If every runtime flag is `false`, the output must contain no `<script>` block at all.** This is the zero-JS-by-default guarantee.
4. **Snippet quality** for every emitted snippet:
   - Passive (no blocking sync work on load).
   - Debounced or `requestAnimationFrame`'d where it observes scroll / resize.
   - Idempotent (re-running the snippet doesn't break state).
   - Works in isolation — disabling siblings doesn't break it.
   - Does not access `document` at top level outside `DOMContentLoaded` (or uses `defer`).
5. **Lint** — confirm the emitted script passes `eslint --no-unused-vars` after templating.
6. **prefers-reduced-motion** — reveal-on-scroll, animation gating, and terminal typing must respect `window.matchMedia('(prefers-reduced-motion: reduce)')` and skip animations accordingly. Reveals must still add the `.visible` class so dependent styles work.
7. **Mobile nav accessibility** — open state has focus trap, focusable elements cycle inside, `Esc` closes, `aria-expanded` toggles, link click closes.
8. **Inline vs external** — verify `options.inlineJS` choice (inline `<script>` at end of `<body>` vs external `script.js`) is honored.
9. **Determinism** — generate twice; the runtime block must be byte-identical.

## Output Format

Markdown table: **Snippet | Flag | Emitted? | Expected? | Quality issues**.
End with verdict: `PASS` / `FAIL`. Failure = either a gating mismatch, a missing FOUC guard when theme toggle is on, missing focus trap on mobile nav, missing reduced-motion handling, or any "Quality issues" entry.
