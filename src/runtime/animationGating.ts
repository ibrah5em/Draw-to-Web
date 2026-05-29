/**
 * Animation play-state gating runtime (I-RUN-07).
 *
 * Body-level snippet registered against `document.runtime.animationGating`.
 * Pairs with the I-GEN-11 generator behavior:
 *
 *   - For every animated element whose spec has `gateOnView: true`,
 *     `cssEmitter` emits `animation-play-state: paused` so the
 *     animation does not run until the element enters the viewport.
 *   - The HTML emitter stamps `data-dtw-gate-anim` on the same
 *     element so this snippet can find it from the DOM.
 *
 * The snippet observes each gated element with `IntersectionObserver`
 * at `threshold: 0.1` and flips `animation-play-state` to `running` the
 * first time it intersects — then `unobserve()`s. One-shot: scrolling
 * back up does not re-pause the animation.
 *
 * Reduced-motion handling:
 *
 *   - I-GEN-11 already emits `@media (prefers-reduced-motion: reduce)
 *     { animation: none }` for every decorative animation, so the
 *     paused/running flip is functionally a no-op for those users.
 *   - To keep the runtime contract uniform with reveals (I-RUN-06),
 *     the snippet still skips the observer and flips every gated
 *     element to `running` immediately when reduced motion is on.
 *     Author CSS that reads inline `animation-play-state` for any
 *     non-decorative state still resolves.
 *
 *   - When `IntersectionObserver` is unavailable the snippet takes
 *     the same immediate-run path. Old browsers see the animation as
 *     un-gated, which is better than silently dead UI.
 *
 *   - ES2019, passive, wrapped in its own inner IIFE so identifiers
 *     cannot collide with sibling snippets in the concatenated bundle.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.animationGating`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const ANIMATION_GATING_SNIPPET = `(function () {
  var els = Array.prototype.slice.call(
    document.querySelectorAll('[data-dtw-gate-anim]')
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
  }, { threshold: 0.1 });

  for (var j = 0; j < els.length; j++) {
    observer.observe(els[j]);
  }
})();`
