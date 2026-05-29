/**
 * Mobile nav runtime (I-RUN-04).
 *
 * Body-level snippet registered against `document.runtime.mobileNav`.
 * Manages the open/closed state of a single hamburger-style nav panel:
 * any number of toggle buttons (`button[data-dtw-mobile-nav-toggle]`)
 * flip the panel (`[data-dtw-mobile-nav-panel]`) between closed and
 * open. While open the snippet:
 *
 *   - Mirrors `aria-expanded` on every toggle button to the current
 *     state. (Multiple buttons supported — e.g. a hamburger at the top
 *     of the page and a close-X inside the panel.)
 *   - Adds an `is-open` class to the panel so author CSS can reveal it.
 *     CSS responsibility — the snippet does not touch `display`/`hidden`.
 *   - Moves keyboard focus into the first focusable inside the panel.
 *   - Traps Tab / Shift+Tab cycling so focus stays inside the panel.
 *   - Closes on `Escape`, on a click on any `<a>` inside the panel
 *     (so anchor jumps still navigate), on a click outside the panel
 *     that is not on a toggle, and on a click on any toggle.
 *   - Restores focus to the element that triggered the open when the
 *     panel closes (typically the hamburger button).
 *
 * Design notes:
 *
 *   - Opt-in via the runtime flag. No per-link `data-dtw-*` markup
 *     required beyond the two hook attributes named above. This keeps
 *     the contract narrow and matches the convention established by
 *     scroll-spy and theme-toggle.
 *
 *   - Single-panel-per-page assumption. The plan's mobile-nav use
 *     case is a hamburger overlay; multiple simultaneous overlays
 *     would require a per-toggle `aria-controls` pairing dance that
 *     pays no real dividend here.
 *
 *   - Focus trap implemented via Tab/Shift+Tab on keydown. A
 *     `focusin` rescue handler was considered but skipped:
 *     screen-reader landmark jumps are legitimate and should not be
 *     fought.
 *
 *   - Outside-click detection uses capture-phase so a click on a
 *     scrim/backdrop closes before any underlying handler runs. A
 *     link click inside the panel still completes its default
 *     navigation — the snippet closes the panel synchronously and the
 *     browser then follows the href.
 *
 *   - ES2019 (`var`, `function`, optional `catch`), passive, wrapped
 *     in its own inner IIFE so identifiers cannot collide with
 *     sibling snippets in the concatenated bundle.
 */

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.mobileNav`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const MOBILE_NAV_SNIPPET = `(function () {
  var toggles = Array.prototype.slice.call(
    document.querySelectorAll('button[data-dtw-mobile-nav-toggle]')
  );
  var panel = document.querySelector('[data-dtw-mobile-nav-panel]');
  if (toggles.length === 0 || !panel) return;

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  var isOpen = false;
  var lastFocus = null;

  function focusable() {
    return Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE));
  }

  function setExpanded(v) {
    var s = v ? 'true' : 'false';
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-expanded', s);
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    panel.classList.add('is-open');
    setExpanded(true);
    var f = focusable();
    if (f.length > 0) f[0].focus();
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick, true);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    setExpanded(false);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onDocClick, true);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var f = focusable();
    if (f.length === 0) {
      e.preventDefault();
      return;
    }
    var first = f[0];
    var last = f[f.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onDocClick(e) {
    if (!isOpen) return;
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    // Toggle button click: handled by the per-toggle listener; do not
    // re-handle here or we double-flip.
    for (var i = 0; i < toggles.length; i++) {
      if (toggles[i].contains(target)) return;
    }
    if (panel.contains(target)) {
      // Link click inside the panel: let navigation proceed, but
      // collapse the overlay first.
      if (target.closest('a')) close();
      return;
    }
    // Click outside both the panel and every toggle: close.
    close();
  }

  setExpanded(false);
  for (var j = 0; j < toggles.length; j++) {
    toggles[j].addEventListener('click', function () {
      if (isOpen) close();
      else open();
    });
  }
})();`
