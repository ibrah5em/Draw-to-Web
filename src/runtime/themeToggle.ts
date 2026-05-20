/**
 * Theme toggle runtime (I-RUN-01).
 *
 * Two snippet strings consumed by the JS emitter (`RUNTIME_SNIPPETS`) and
 * the generator's `<head>` composer:
 *
 *   - `THEME_TOGGLE_FOUC_GUARD` — runs inline in `<head>` *before* any
 *     stylesheet is applied. Reads `localStorage['dtw-theme']` and stamps
 *     `<html data-theme="...">` synchronously so a reload in dark mode
 *     does not flash a light first frame. Kept ES5 (`var`, function
 *     expressions, no arrow / template / optional chaining) so it runs
 *     in any browser that reaches it before our main bundle.
 *
 *   - `THEME_TOGGLE_SNIPPET` — body-level wiring registered against
 *     `document.runtime.themeToggle`. Finds every `[data-dtw-theme-toggle]`
 *     button, mirrors current state into `aria-pressed`, and on click
 *     flips between `'dark'` and `'light'`, persists to `localStorage`,
 *     and re-stamps `<html data-theme>`. Wrapped in its own IIFE so its
 *     internal names (`KEY`, `root`, …) cannot collide with sibling
 *     snippets when the JS emitter concatenates them.
 *
 * Both snippets are passive, idempotent, and degrade silently when
 * `localStorage` access throws (private browsing, sandboxed iframes).
 * When no theme is stored, `prefers-color-scheme` decides the initial
 * `aria-pressed` value, matching the generator's
 * `:root:not([data-theme])` OS-preference rule (I-GEN-06).
 */

/** Key under which the chosen theme is persisted. */
export const THEME_STORAGE_KEY = 'dtw-theme'

/**
 * Inline `<head>` script body (no surrounding `<script>` tag). The
 * generator wraps this string only when `document.runtime.themeToggle`
 * is true.
 */
export const THEME_TOGGLE_FOUC_GUARD = `try {
  var t = localStorage.getItem('${THEME_STORAGE_KEY}');
  if (t === 'dark' || t === 'light') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch {}`

/**
 * Body-level runtime snippet. Registered in `RUNTIME_SNIPPETS.themeToggle`
 * and concatenated into the page's main IIFE by the JS emitter.
 */
export const THEME_TOGGLE_SNIPPET = `(function () {
  var KEY = '${THEME_STORAGE_KEY}';
  var root = document.documentElement;
  var toggles = Array.prototype.slice.call(
    document.querySelectorAll('[data-dtw-theme-toggle]')
  );
  function readStored() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  function writeStored(v) {
    try {
      if (v === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch {}
  }
  function effective() {
    var s = readStored();
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  function syncPressed() {
    var pressed = effective() === 'dark' ? 'true' : 'false';
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-pressed', pressed);
    }
  }
  function apply(theme) {
    if (theme === 'dark' || theme === 'light') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
    syncPressed();
  }
  syncPressed();
  for (var j = 0; j < toggles.length; j++) {
    toggles[j].addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      writeStored(next);
      apply(next);
    });
  }
})();`
