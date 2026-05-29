/**
 * Scroll-spy runtime (I-RUN-02).
 *
 * Body-level snippet registered against `document.runtime.scrollSpy`.
 * Observes every section pointed at by an in-page nav link
 * (`nav a[href^="#"]`) with an `IntersectionObserver`; toggles
 * `.is-active` and `aria-current="location"` on the link whose section
 * is currently nearest the top of the viewport. A click on a nav link
 * activates it immediately so the highlight doesn't lag behind smooth
 * scrolling.
 *
 * Design notes:
 *
 *   - The opt-in is the runtime flag itself; the snippet does not
 *     require a per-link `data-dtw-*` attribute. Any `<a>` inside a
 *     `<nav>` whose `href` starts with `#` and resolves to a section
 *     on the page participates. This mirrors the "convention over
 *     configuration" stance of the generator's semantic-role mapping.
 *
 *   - `rootMargin: '-30% 0px -60% 0px'` defines the "active band" as
 *     roughly the top third of the viewport: a section becomes
 *     current when its top crosses ~30 % down from the top, and
 *     stops being current when its bottom rises ~60 % up from the
 *     bottom. This matches the rhythm authors expect from typical
 *     scroll-spy implementations.
 *
 *   - On every callback we pick the first intersecting section in
 *     document order and activate its link. If nothing is
 *     intersecting (e.g. the user has scrolled past the last section
 *     into the footer) the previously-active link stays active so
 *     there is no flicker.
 *
 *   - `IntersectionObserver` fires once per observed target shortly
 *     after `observe()` with the current state, so the initial
 *     highlight is established without us computing positions
 *     ourselves.
 *
 *   - The snippet is passive (no scroll / resize listeners), ES2019
 *     (`var`, `function`, optional `catch`) to match the theme-toggle
 *     baseline, and wrapped in an inner IIFE so concatenated sibling
 *     snippets can't collide on its local identifiers.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.scrollSpy`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const SCROLL_SPY_SNIPPET = `(function () {
  var links = Array.prototype.slice.call(
    document.querySelectorAll('nav a[href^="#"]')
  );
  if (links.length === 0) return;

  var pairs = [];
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var href = link.getAttribute('href') || '';
    if (href.length < 2) continue;
    var section = document.getElementById(href.slice(1));
    if (!section) continue;
    pairs.push({ link: link, section: section, id: href.slice(1) });
  }
  if (pairs.length === 0) return;

  var visible = Object.create(null);
  var current = null;

  function setActive(id) {
    if (id === current) return;
    current = id;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var on = p.id === id;
      p.link.classList.toggle('is-active', on);
      if (on) p.link.setAttribute('aria-current', 'location');
      else p.link.removeAttribute('aria-current');
    }
  }

  function chooseCurrent() {
    for (var i = 0; i < pairs.length; i++) {
      if (visible[pairs[i].id]) {
        setActive(pairs[i].id);
        return;
      }
    }
  }

  if (typeof IntersectionObserver === 'function') {
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var id = entry.target.id;
        if (!id) continue;
        if (entry.isIntersecting) visible[id] = true;
        else delete visible[id];
      }
      chooseCurrent();
    }, {
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0,
    });
    for (var j = 0; j < pairs.length; j++) {
      observer.observe(pairs[j].section);
    }
  }

  for (var k = 0; k < pairs.length; k++) {
    (function (p) {
      p.link.addEventListener('click', function () {
        setActive(p.id);
      });
    })(pairs[k]);
  }
})();`
