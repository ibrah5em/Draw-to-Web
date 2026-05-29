/**
 * Nav-on-scroll runtime (I-RUN-05).
 *
 * Body-level snippet registered against `document.runtime.navOnScroll`.
 * Toggles a `.scrolled` class on the page's first `<nav>` once the
 * user has scrolled past the top of the document. Author CSS picks up
 * the class (e.g. a darker background, a stronger shadow, a tighter
 * vertical padding) — the snippet is purely about the state hook.
 *
 * Design notes:
 *
 *   - The code-generator rule forbids raw scroll listeners for this
 *     task; only `IntersectionObserver` / `requestAnimationFrame` are
 *     allowed. The pattern used here is the *sentinel*: inject an
 *     invisible 1px-tall element as the first child of `<body>` and
 *     observe its intersection with the viewport. When it intersects,
 *     the user is at the top of the page. When it stops intersecting,
 *     the user has scrolled. This works for both static and
 *     `position: fixed` navs because the observer tracks geometric
 *     intersection with the viewport, not visual cover.
 *
 *   - The sentinel is `height: 1px; margin-bottom: -1px` so it
 *     consumes one pixel of layout and immediately reclaims it via
 *     negative margin — net zero displacement. `pointer-events: none`
 *     and `aria-hidden="true"` keep it out of mouse and AT trees.
 *
 *   - Convention over configuration: the runtime flag is the opt-in;
 *     the snippet does not require a per-nav `data-dtw-*` attribute.
 *     First `<nav>` wins, matching scroll-spy (I-RUN-02) and
 *     smooth-scroll (I-RUN-03).
 *
 *   - Graceful degradation: when `IntersectionObserver` is absent, the
 *     snippet does nothing — the nav simply never receives `.scrolled`,
 *     which is purely a cosmetic loss.
 *
 *   - ES2019, passive, wrapped in its own inner IIFE so identifiers
 *     cannot collide with sibling snippets in the concatenated bundle.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.navOnScroll`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const NAV_ON_SCROLL_SNIPPET = `(function () {
  var nav = document.querySelector('nav');
  if (!nav) return;
  if (typeof IntersectionObserver !== 'function') return;
  var sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.setAttribute('data-dtw-scroll-sentinel', '');
  sentinel.style.cssText = 'height:1px;margin-bottom:-1px;pointer-events:none';
  document.body.insertBefore(sentinel, document.body.firstChild);
  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      nav.classList.toggle('scrolled', !entries[i].isIntersecting);
    }
  }, { threshold: 0 });
  observer.observe(sentinel);
})();`
