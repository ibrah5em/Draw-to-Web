(function () {
  /* themeToggle */
  (function () {
    var KEY = "dtw-theme";
    var root = document.documentElement;
    var toggles = Array.prototype.slice.call(document.querySelectorAll("[data-dtw-theme-toggle]"));
    function readStored() {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    }
    function writeStored(v) {
      try {
        if (v === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, v);
      } catch {}
    }
    function effective() {
      var s = readStored();
      if (s === "dark" || s === "light") return s;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    function syncPressed() {
      var pressed = effective() === "dark" ? "true" : "false";
      for (var i = 0; i < toggles.length; i++) {
        toggles[i].setAttribute("aria-pressed", pressed);
      }
    }
    function apply(theme) {
      if (theme === "dark" || theme === "light") {
        root.setAttribute("data-theme", theme);
      } else {
        root.removeAttribute("data-theme");
      }
      syncPressed();
    }
    syncPressed();
    function commit(next) {
      writeStored(next);
      apply(next);
    }
    function flip() {
      var next = effective() === "dark" ? "light" : "dark";
      // Progressive enhancement (I-GEN-14): when the View Transitions
      // API is available, wrap the swap so supporting browsers cross-fade
      // the root. Fallback is a synchronous swap, which matches the
      // pre-view-transition behaviour exactly.
      if (typeof document.startViewTransition === "function") {
        document.startViewTransition(function () {
          commit(next);
        });
      } else {
        commit(next);
      }
    }
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].addEventListener("click", flip);
    }
  })();

  /* scrollSpy */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('nav a[href^="#"]'));
    if (links.length === 0) return;

    var pairs = [];
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute("href") || "";
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
        p.link.classList.toggle("is-active", on);
        if (on) p.link.setAttribute("aria-current", "location");
        else p.link.removeAttribute("aria-current");
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

    if (typeof IntersectionObserver === "function") {
      var observer = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var id = entry.target.id;
            if (!id) continue;
            if (entry.isIntersecting) visible[id] = true;
            else delete visible[id];
          }
          chooseCurrent();
        },
        {
          rootMargin: "-30% 0px -60% 0px",
          threshold: 0,
        }
      );
      for (var j = 0; j < pairs.length; j++) {
        observer.observe(pairs[j].section);
      }
    }

    for (var k = 0; k < pairs.length; k++) {
      (function (p) {
        p.link.addEventListener("click", function () {
          setActive(p.id);
        });
      })(pairs[k]);
    }
  })();

  /* smoothScroll */
  (function () {
    var nav = document.querySelector("nav");
    if (!nav) return;
    var root = document.documentElement;
    var rafId = 0;
    function update() {
      rafId = 0;
      var h = nav.getBoundingClientRect().height;
      root.style.setProperty("--dtw-nav-pad", h + "px");
    }
    function schedule() {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(update);
    }
    update();
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(schedule).observe(nav);
    } else {
      window.addEventListener("resize", schedule, { passive: true });
    }
  })();

  /* mobileNav */
  (function () {
    var toggles = Array.prototype.slice.call(
      document.querySelectorAll("button[data-dtw-mobile-nav-toggle]")
    );
    var panel = document.querySelector("[data-dtw-mobile-nav-panel]");
    if (toggles.length === 0 || !panel) return;

    var FOCUSABLE = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    var isOpen = false;
    var lastFocus = null;

    function focusable() {
      return Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE));
    }

    function setExpanded(v) {
      var s = v ? "true" : "false";
      for (var i = 0; i < toggles.length; i++) {
        toggles[i].setAttribute("aria-expanded", s);
      }
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      panel.classList.add("is-open");
      setExpanded(true);
      var f = focusable();
      if (f.length > 0) f[0].focus();
      document.addEventListener("keydown", onKey);
      document.addEventListener("click", onDocClick, true);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      panel.classList.remove("is-open");
      setExpanded(false);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick, true);
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
    }

    function onKey(e) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
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
      if (!target || typeof target.closest !== "function") return;
      // Toggle button click: handled by the per-toggle listener; do not
      // re-handle here or we double-flip.
      for (var i = 0; i < toggles.length; i++) {
        if (toggles[i].contains(target)) return;
      }
      if (panel.contains(target)) {
        // Link click inside the panel: let navigation proceed, but
        // collapse the overlay first.
        if (target.closest("a")) close();
        return;
      }
      // Click outside both the panel and every toggle: close.
      close();
    }

    setExpanded(false);
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].addEventListener("click", function () {
        if (isOpen) close();
        else open();
      });
    }
  })();

  /* navOnScroll */
  (function () {
    var nav = document.querySelector("nav");
    if (!nav) return;
    if (typeof IntersectionObserver !== "function") return;
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.setAttribute("data-dtw-scroll-sentinel", "");
    sentinel.style.cssText = "height:1px;margin-bottom:-1px;pointer-events:none";
    document.body.insertBefore(sentinel, document.body.firstChild);
    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          nav.classList.toggle("scrolled", !entries[i].isIntersecting);
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
  })();

  /* reveals */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-dtw-reveal]"));
    if (els.length === 0) return;

    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}

    if (reduce || typeof IntersectionObserver !== "function") {
      for (var i = 0; i < els.length; i++) {
        els[i].classList.add("visible");
      }
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 }
    );

    for (var j = 0; j < els.length; j++) {
      observer.observe(els[j]);
    }
  })();

  /* animationGating */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-dtw-gate-anim]"));
    if (els.length === 0) return;

    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}

    function runAll() {
      for (var i = 0; i < els.length; i++) {
        els[i].style.animationPlayState = "running";
      }
    }

    if (reduce || typeof IntersectionObserver !== "function") {
      runAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = "running";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 }
    );

    for (var j = 0; j < els.length; j++) {
      observer.observe(els[j]);
    }
  })();

  /* terminalTyping */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-dtw-terminal-type]"));
    if (els.length === 0) return;

    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}

    function runAll() {
      for (var i = 0; i < els.length; i++) {
        els[i].style.animationPlayState = "running";
      }
    }

    if (reduce || typeof IntersectionObserver !== "function") {
      runAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = "running";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.5 }
    );

    for (var j = 0; j < els.length; j++) {
      observer.observe(els[j]);
    }
  })();
})();
