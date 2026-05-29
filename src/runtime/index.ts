/**
 * Runtime snippet registry.
 *
 * Every behavior toggled by `document.runtime` (theme toggle, scroll spy,
 * mobile nav, reveals, etc.) ships as a self-contained, passive JS snippet
 * that runs once at page load. The generator's JS emitter (I-GEN-15) walks
 * `document.runtime`, pulls the matching string from this registry, and
 * concatenates the enabled snippets into a single IIFE.
 *
 * Snippets land per-task:
 *   - I-RUN-01 → themeToggle
 *   - I-RUN-02 → scrollSpy
 *   - I-RUN-03 → smoothScroll
 *   - I-RUN-04 → mobileNav
 *   - I-RUN-05 → navOnScroll
 *   - I-RUN-06 → reveals
 *   - I-RUN-07 → animationGating
 *   - I-RUN-08 → terminalTyping
 *
 * Until the corresponding I-RUN-* task lands the registry entry is absent
 * and the emitter silently omits the snippet (callers see the flag as a
 * no-op, never as a runtime crash). The `runtime-audit` skill is the
 * source of truth for what each snippet must do.
 */

import type { RuntimeFlags } from '../document/types'
import { SCROLL_SPY_SNIPPET } from './scrollSpy'
import { SMOOTH_SCROLL_SNIPPET } from './smoothScroll'
import { THEME_TOGGLE_FOUC_GUARD, THEME_TOGGLE_SNIPPET } from './themeToggle'

/**
 * Source code of each runtime snippet keyed by its flag name. Entries are
 * raw JS strings (no `<script>` wrapper) that run inside one shared IIFE.
 */
export const RUNTIME_SNIPPETS: Partial<Record<keyof RuntimeFlags, string>> = {
  themeToggle: THEME_TOGGLE_SNIPPET,
  scrollSpy: SCROLL_SPY_SNIPPET,
  smoothScroll: SMOOTH_SCROLL_SNIPPET,
}

/**
 * Inline `<head>` script for the theme toggle's FOUC guard (I-RUN-01).
 * Runs *before* the body renders so the saved theme is applied without a
 * flash. Raw JS body, not a `<script>` tag — the generator wraps it.
 *
 * Re-exported here so the generator can resolve it through one runtime
 * entry point rather than reaching into individual snippet files.
 */
export { THEME_TOGGLE_FOUC_GUARD }
