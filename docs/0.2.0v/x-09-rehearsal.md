# X-09 — Demo Rehearsal Run-Sheet (sacred)

> **Gate:** the final M5 item before `v0.3.0` (`plan.md` §17, §19). When this is
> done, fill `supervisor-report.md` §9 + the §7/§12 perf rows, flip the M5
> checkboxes, and tag `v0.3.0`.
>
> **Rules (sacred day):** full demo end-to-end **3×**; **bug-squash only; no new
> feature commits.** If a run hits a bug, fix it, then **restart the count** —
> three _clean consecutive_ runs is the bar.
>
> **R13 — run on the _demo machine_, not a dev box.** Numbers and pass/fail
> recorded here must come from the hardware (and the **packaged build**, not
> `npm run dev`) you will actually present on. WSL2/dev-box figures are not
> sign-off-grade.

---

## 0. Pre-flight (once, before Run 1)

- [ ] Packaged build installed from the release matrix (`I-BLD-01`): Windows NSIS
      / Linux AppImage or .deb / macOS dmg. **Not** the dev server.
- [ ] Unsigned-build bypass rehearsed (`I-BLD-05` is cancelled — builds ship
      unsigned forever): Windows "More info → Run anyway"; macOS right-click →
      Open or `xattr -d com.apple.quarantine`.
- [ ] **Backup recording** captured: a full-path screen capture as fallback if
      the live demo hits a packaged-build bug (§19 "Backup demo").
- [ ] Portfolio template + the 500-element stress fixture both on hand.
- [ ] Demo machine specs noted below (for the perf rows + R13 trail).

```
Demo machine: __________________________  OS/version: __________________
CPU / RAM: ____________________________   Build artifact + version: ____
```

---

## 1. Demo script (the path, from §19 — ~15–20 min)

Run this top-to-bottom each time. Tick every step; any failure → log in §4, fix, restart the count.

| #   | Step (§19)                                                                                                                                                                              | Expected                            | R1  | R2  | R3  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --- | --- | --- |
| 1   | **Intro** — tool, team, what's different (tokens-first, a11y-gated, semantic)                                                                                                           | —                                   | ☐   | ☐   | ☐   |
| 2   | **Welcome → open Portfolio** — cold boot, recent files, open template                                                                                                                   | boots clean                         | ☐   | ☐   | ☐   |
| 3   | **Edit + theme** — change accent in Tokens (whole site updates live, contrast follows); toggle dark/light; inline-edit hero text                                                        | live propagation, one history entry | ☐   | ☐   | ☐   |
| 4   | **Build a section** — drag Cards Grid from Insert; reorder a card in Layers; adjust padding/gap; add a hover state; bind colors to tokens                                               | subtree inserts, reorder works      | ☐   | ☐   | ☐   |
| 5   | **Responsive** — switch to Mobile; change a mobile font-size (📱 badge); grid collapses to a column                                                                                     | per-breakpoint override             | ☐   | ☐   | ☐   |
| 6   | **Code Preview** — open panel; clean formatted HTML/CSS/JS matches canvas                                                                                                               | output matches                      | ☐   | ☐   | ☐   |
| 7   | **Validation + Export** — run validation; axe-core green; Export Options; export ZIP; open `index.html` in browser; dark toggle / scroll reveals / mobile menu / smooth scroll all work | export passes gate; output works    | ☐   | ☐   | ☐   |
| 8   | **Q&A**                                                                                                                                                                                 | —                                   | ☐   | ☐   | ☐   |

---

## 2. Three clean consecutive runs

| Run | Date / time | Clean?          | Wall time | Notes |
| --- | ----------- | --------------- | --------- | ----- |
| 1   |             | ☐ pass / ☐ fail |           |       |
| 2   |             | ☐ pass / ☐ fail |           |       |
| 3   |             | ☐ pass / ☐ fail |           |       |

> A `fail` on any run resets the streak. Three consecutive passes = X-09 done.

---

## 3. Performance capture (folds into Y-PRF-04 + §7 of the report)

Capture on the **demo machine** during/around the rehearsal. The data-layer +
export budgets are already green headlessly (`editorPerf.test.ts`, e2e export);
the six **render-layer** rows below are the open ones — these replace the
`_pending instrumented run_` cells in `perf-baseline.md`.

**Render layer** (load Portfolio → switch to 500-element stress fixture):

| Metric                         | Budget   | Measured | Pass? |
| ------------------------------ | -------- | -------- | ----- |
| Element drag (100 el)          | 60 fps   |          | ☐     |
| Element drag (500 el)          | ≥ 45 fps |          | ☐     |
| Theme toggle on canvas         | < 100 ms |          | ☐     |
| Breakpoint switch              | < 200 ms |          | ☐     |
| Layers tree scroll (500 nodes) | 60 fps   |          | ☐     |
| Cold-start to interactive      | < 3 s    |          | ☐     |

**Output budgets** (§14, from the exported Portfolio ZIP + Lighthouse mobile):

| Metric                   | Budget  | Measured | Pass? |
| ------------------------ | ------- | -------- | ----- |
| HTML (min+gzip)          | < 12 KB |          | ☐     |
| CSS (min+gzip)           | < 14 KB |          | ☐     |
| JS all-flags (min+gzip)  | < 4 KB  |          | ☐     |
| Lighthouse Perf (mobile) | ≥ 95    |          | ☐     |
| Lighthouse A11y          | 100     |          | ☐     |
| Lighthouse SEO           | ≥ 95    |          | ☐     |

> Capture method: the **manual React DevTools profiler procedure** in
> `perf-baseline.md` §"In-app (render layer)" (automated harness deferred to
> post-`v0.3.0`). Load Portfolio → switch to the 500-element stress fixture →
> record each interaction in the profiler and read committed-frames FPS / timing.

---

## 4. Bug-squash log (sacred day = fixes only, no features)

| #   | Run found | Symptom | Fix (commit) | Re-verified |
| --- | --------- | ------- | ------------ | ----------- |
|     |           |         |              | ☐           |

---

## 5. Sign-off → release

Once §1–§3 are green and §4 is empty (or all re-verified):

- [ ] Paste the §2 run outcomes + §3 numbers into `supervisor-report.md` **§9**
      (Demo readiness) and the **§7 / §12** perf rows; flip the report `- [~]` → `- [x]`.
- [ ] Flip **`Y-PRF-04`** and **`X-09`** to done in the task sheet.
- [ ] Fold the held-back code-signing-cancellation edit into the same finalization commit.
- [ ] Tag the release:

```bash
git tag -a v0.3.0 -m "M5 — Polish + Demo"
git push origin v0.3.0   # fires .github/workflows/release.yml → per-OS matrix → GitHub Release
```
