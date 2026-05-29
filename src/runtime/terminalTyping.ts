/**
 * Terminal typing runtime (I-RUN-08).
 *
 * Body-level snippet registered against `document.runtime.terminalTyping`.
 * Companion to the CSS half (`TERMINAL_TYPING_BLOCK`) which keeps every
 * `[data-dtw-terminal-type]` line paused at frame 0 until this snippet
 * flips its `animation-play-state` to `running` on viewport entry.
 *
 * Why a separate flag from animation gating (I-RUN-07)?
 *
 *   - Different selector. Authors mark *terminal* lines with
 *     `[data-dtw-terminal-type]` specifically. They might want
 *     terminal typing on while leaving other animations un-gated, or
 *     vice versa — separate flags give that knob.
 *   - Different threshold. Terminal heroes look best when the line
 *     starts typing only when comfortably in view (50%), not the
 *     moment a sliver enters (10%). Hence `threshold: 0.5`.
 *   - The cursor blink is sequenced via author CSS `animation-delay`
 *     matching the typing duration — no JS sequencing required,
 *     keeping with the project rule that JS does nothing but flip
 *     play-state.
 *
 * Reduced motion + no-IO fallback both take the same immediate-run
 * path so author CSS that depends on `animation-play-state: running`
 * still resolves. The blanket `@media (prefers-reduced-motion: reduce)
 * { animation: none }` rule from I-GEN-11 still wins visually for any
 * keyframes flagged decorative.
 *
 * ES2019, passive, wrapped in its own inner IIFE so identifiers cannot
 * collide with sibling snippets in the concatenated bundle.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.terminalTyping`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const TERMINAL_TYPING_SNIPPET = `(function () {
  var els = Array.prototype.slice.call(
    document.querySelectorAll('[data-dtw-terminal-type]')
  );
  if (els.length === 0) return;

  var reduce = false;
  try {
    reduce = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {}

  function runAll() {
    for (var i = 0; i < els.length; i++) {
      els[i].style.animationPlayState = 'running';
    }
  }

  if (reduce || typeof IntersectionObserver !== 'function') {
    runAll();
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.5 });

  for (var j = 0; j < els.length; j++) {
    observer.observe(els[j]);
  }
})();`
