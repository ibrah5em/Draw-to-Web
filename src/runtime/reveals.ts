/**
 * Reveal-on-scroll runtime (I-RUN-06).
 *
 * Body-level snippet registered against `document.runtime.reveals`. Adds
 * a `.visible` class to every `[data-dtw-reveal]` element once it
 * enters the viewport. Author CSS owns the actual animation (typically
 * fade + translate); the snippet is purely the state hook.
 *
 * Design notes:
 *
 *   - One-shot: each element is `unobserve()`d as soon as it reveals,
 *     so scrolling back up does not un-reveal and re-trigger.
 *
 *   - `prefers-reduced-motion: reduce` is honored at the runtime
 *     level: the snippet adds `.visible` to every target *immediately*
 *     without setting up the observer. The class is the contract for
 *     downstream styles (CTA visibility, accent glow start, etc.) —
 *     skipping animation does not mean skipping the state.
 *
 *   - When `IntersectionObserver` is unavailable, the snippet
 *     degrades to the same behavior (everything `.visible` on load).
 *     Old browsers see a static page without animations, which is
 *     correct content-fidelity behavior.
 *
 *   - `threshold: 0.1` — elements reveal when 10% intersected. Lower
 *     thresholds (e.g. 0) feel premature, especially for tall hero
 *     sections; this matches the rhythm of common reveal libraries.
 *
 *   - Convention over configuration: the opt-in is the data attribute
 *     (`data-dtw-reveal`) on each element, plus the runtime flag.
 *
 *   - ES2019, passive, wrapped in its own inner IIFE so identifiers
 *     cannot collide with sibling snippets in the concatenated bundle.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.reveals`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const REVEALS_SNIPPET = `(function () {
  var els = Array.prototype.slice.call(
    document.querySelectorAll('[data-dtw-reveal]')
  );
  if (els.length === 0) return;

  var reduce = false;
  try {
    reduce = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {}

  if (reduce || typeof IntersectionObserver !== 'function') {
    for (var i = 0; i < els.length; i++) {
      els[i].classList.add('visible');
    }
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.1 });

  for (var j = 0; j < els.length; j++) {
    observer.observe(els[j]);
  }
})();`
