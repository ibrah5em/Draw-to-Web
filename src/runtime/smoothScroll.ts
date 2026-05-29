/**
 * Smooth scroll runtime (I-RUN-03).
 *
 * Body-level snippet registered against `document.runtime.smoothScroll`.
 * The CSS half of this behavior (`scroll-behavior: smooth` +
 * `scroll-padding-top: var(--dtw-nav-pad, 0px)`) lives in the generator's
 * `SMOOTH_SCROLL_BLOCK`. The JS half exists for one reason: to write the
 * actual rendered height of the page's first `<nav>` into the
 * `--dtw-nav-pad` custom property so anchor jumps land flush below it.
 *
 * Design notes:
 *
 *   - The opt-in is the runtime flag itself. The snippet does not
 *     require a per-nav `data-dtw-*` attribute — the first `<nav>`
 *     element wins. This matches scroll-spy (I-RUN-02), which uses the
 *     same convention.
 *
 *   - Padding is recomputed on nav resize, not on window scroll. A
 *     `ResizeObserver` is preferred (passive, only fires on real size
 *     changes); a passive `window.resize` listener is the fallback.
 *     The rule from `code-generator.md` forbids raw scroll listeners,
 *     not raw resize listeners — but we use the lighter path when
 *     available regardless.
 *
 *   - `requestAnimationFrame` debounces the writes so a rapid burst of
 *     resize events (e.g. while the user drags the window edge)
 *     collapses to a single style mutation per frame.
 *
 *   - `prefers-reduced-motion` is handled entirely in CSS — the
 *     padding offset still applies (jump-to-anchor should land in the
 *     right place even without animation), only the smoothness goes.
 *
 *   - ES2019, passive, wrapped in its own inner IIFE so concatenated
 *     sibling snippets cannot collide on `nav`, `root`, `rafId`, etc.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.smoothScroll`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const SMOOTH_SCROLL_SNIPPET = `(function () {
  var nav = document.querySelector('nav');
  if (!nav) return;
  var root = document.documentElement;
  var rafId = 0;
  function update() {
    rafId = 0;
    var h = nav.getBoundingClientRect().height;
    root.style.setProperty('--dtw-nav-pad', h + 'px');
  }
  function schedule() {
    if (rafId !== 0) return;
    rafId = window.requestAnimationFrame(update);
  }
  update();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(schedule).observe(nav);
  } else {
    window.addEventListener('resize', schedule, { passive: true });
  }
})();`
