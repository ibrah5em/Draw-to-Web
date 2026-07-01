# v1.0.0 — Demo Run-Sheet (sacred)

> **Purpose:** the presentable-in-two-days rehearsal for the `v1.0.0` sprint demo
> cut. Supersedes `docs/0.2.0v/x-09-rehearsal.md` for the live demo — it keeps
> that run-sheet's core builder path and adds the three v1.0.0 headline surfaces
> (draw-to-create, match-layout, headless MCP).
>
> **This closes the waived `X-09` + `Y-PRF-04` items** (`DECISIONS.md` D-02 /
> D-04). When §2 is three-clean and §3 is filled, paste the outcomes into
> `docs/1.0.0v/supervisor-report.md` §9 / §7 / §12.
>
> **Rules (sacred day):** full demo end-to-end **3×**; **bug-squash only, no new
> feature commits.** A bug on any run → fix, then **restart the count.** Three
> _clean consecutive_ runs is the bar.
>
> **R13 — run on the _demo machine_, not a dev box.** Every number and pass/fail
> must come from the **packaged build** (`.exe` / `.AppImage` / `.dmg` off the
> [v1.0.0 release](https://github.com/ibrah5em/Draw-to-Web/releases/tag/v1.0.0)),
> on the hardware you will present on. WSL2 / `npm run dev` figures are not
> sign-off-grade.

---

## 0. Pre-flight (once, before Run 1)

- [ ] Packaged v1.0.0 build installed from the release matrix — **not** the dev
      server. Windows NSIS `draw-to-web-1.0.0-setup.exe` / Linux
      `draw-to-web-1.0.0-x86_64.AppImage` or `_1.0.0_amd64.deb` / macOS
      `draw-to-web-1.0.0-*.dmg`.
- [ ] Unsigned-build bypass rehearsed (builds ship unsigned — `DECISIONS.md`
      D-01): Windows "More info → Run anyway"; macOS right-click → Open or
      `xattr -d com.apple.quarantine "/Applications/Draw to Web.app"`.
- [ ] **Backup screen recording** of a full clean run captured as fallback.
- [ ] Portfolio template + the 500-element stress fixture on hand (for §3 perf).
- [ ] MCP cameo prepared: a terminal with `npm run mcp` ready to start (see §1a).
- [ ] Demo machine specs noted below (for the §3 perf rows + R13 trail).

```
Demo machine: __________________________  OS/version: __________________
CPU / RAM: ____________________________   Build artifact + version: v1.0.0
```

---

## 1. Demo script (~18–22 min) — run top-to-bottom each time

Tick every step; any failure → log in §4, fix, restart the count.

| #   | Step                                                                                                                                                                  | Expected                                   | R1  | R2  | R3  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --- | --- | --- |
| 1   | **Intro** — tool, team, what's different (tokens-first, a11y-gated, semantic output) — and what's new in v1.0.0 (draw / match / MCP)                                  | —                                          | ☐   | ☐   | ☐   |
| 2   | **Welcome → open Portfolio** — cold boot, recent files, open template                                                                                                 | boots clean                                | ☐   | ☐   | ☐   |
| 3   | **Edit + theme** — change accent in Tokens (whole site updates live, contrast follows); toggle dark/light; inline-edit hero text                                      | live propagation, one history entry        | ☐   | ☐   | ☐   |
| 4   | ⭐ **Draw to create** — pick a container; drag a rectangle on the canvas; the type picker shows the ranked guess + confidence; accept                                 | rectangle → placed element, one history op | ☐   | ☐   | ☐   |
| 5   | **Build a section** — drag Cards Grid from Insert; reorder a card in Layers; adjust padding/gap; add a hover state; bind colors to tokens                             | subtree inserts, reorder works             | ☐   | ☐   | ☐   |
| 6   | ⭐ **Match my layout** — open Match; from the rough draft it ranks the 6 bundled pages with a per-dimension breakdown; adopt one                                      | best-first ranking, chosen page hydrates   | ☐   | ☐   | ☐   |
| 7   | **Responsive** — switch to Mobile; change a mobile font-size (📱 badge); grid collapses to a column                                                                   | per-breakpoint override                    | ☐   | ☐   | ☐   |
| 8   | **Code Preview** — open panel; clean formatted HTML/CSS/JS matches canvas                                                                                             | output matches                             | ☐   | ☐   | ☐   |
| 9   | **Validation + Export** — run validation; axe-core green; Export Options; export ZIP; open `index.html`; dark toggle / reveals / mobile menu / smooth scroll all work | export passes gate; output works           | ☐   | ☐   | ☐   |
| 10  | ⭐ **MCP cameo** (§1a) — show the same pipeline driven headlessly over stdio                                                                                          | server lists 20 tools; export runs         | ☐   | ☐   | ☐   |
| 11  | **Q&A**                                                                                                                                                               | —                                          | ☐   | ☐   | ☐   |

### 1a. MCP cameo (optional but high-impact)

Show that the builder is not just a GUI — the whole document / generate / export
pipeline is scriptable, headless, with the **same axe-core gate**.

```bash
npm run mcp        # stdio server; prints "draw-to-web MCP server ready" on stderr
```

Talking point: ~20 tools — `create_document`, `insert_preset`, `apply_template`,
`set_tokens` / `set_theme` / `set_runtime`, `match_layout`, `run_a11y_check`,
`preview_html`, `export_site` — every one a thin adapter over the exact
operations the canvas uses. An MCP-capable client (or an agent) can build and
export a site with no Electron. Exports land under `DTW_MCP_DIR` (default
`.dtw-mcp/`). If wiring a live client is risky on stage, play a pre-recorded
clip instead.

---

## 2. Three clean consecutive runs

| Run | Date / time | Clean?          | Wall time | Notes |
| --- | ----------- | --------------- | --------- | ----- |
| 1   |             | ☐ pass / ☐ fail |           |       |
| 2   |             | ☐ pass / ☐ fail |           |       |
| 3   |             | ☐ pass / ☐ fail |           |       |

> A `fail` on any run resets the streak. Three consecutive passes = demo signed off.

---

## 3. Performance capture (closes `Y-PRF-04`)

Capture on the **demo machine** during/around the rehearsal, using the
copy-paste procedure in [`perf-capture-checklist.md`](perf-capture-checklist.md).
The data-layer + export budgets are already green headlessly; the six
**render-layer** rows below are the open ones and replace the
`_pending instrumented run_` cells in `docs/0.2.0v/perf-baseline.md`.

**Render layer** (load Portfolio → switch to the 500-element stress fixture):

| Metric                         | Budget   | Measured | Pass? |
| ------------------------------ | -------- | -------- | ----- |
| Element drag (100 el)          | 60 fps   |          | ☐     |
| Element drag (500 el)          | ≥ 45 fps |          | ☐     |
| Theme toggle on canvas         | < 100 ms |          | ☐     |
| Breakpoint switch              | < 200 ms |          | ☐     |
| Layers tree scroll (500 nodes) | 60 fps   |          | ☐     |
| Cold-start to interactive      | < 3 s    |          | ☐     |

**Output budgets** (from the exported Portfolio ZIP + Lighthouse mobile):

| Metric                   | Budget  | Measured | Pass? |
| ------------------------ | ------- | -------- | ----- |
| HTML (min+gzip)          | < 12 KB |          | ☐     |
| CSS (min+gzip)           | < 14 KB |          | ☐     |
| JS all-flags (min+gzip)  | < 4 KB  |          | ☐     |
| Lighthouse Perf (mobile) | ≥ 95    |          | ☐     |
| Lighthouse A11y          | 100     |          | ☐     |
| Lighthouse SEO           | ≥ 95    |          | ☐     |

---

## 4. Bug-squash log (sacred day = fixes only, no features)

| #   | Run found | Symptom | Fix (commit) | Re-verified |
| --- | --------- | ------- | ------------ | ----------- |
|     |           |         |              | ☐           |

---

## 5. Sign-off

Once §1–§3 are green and §4 is empty (or all re-verified):

- [ ] Paste the §2 run outcomes + §3 numbers into
      `docs/1.0.0v/supervisor-report.md` **§9** (Demo readiness) and the
      **§7 / §12** perf rows.
- [ ] Update `docs/0.2.0v/perf-baseline.md` render-layer rows with the measured
      figures (they replace `_pending instrumented run_`).
- [ ] Close the `X-09` / `Y-PRF-04` tracking issue.
- [ ] Add a closing note to `DECISIONS.md` D-04 recording the waiver is retired.

> v1.0.0 is already tagged and released — this run-sheet is the **post-release
> sign-off** of the two waived items, not a release gate. It exists so the live
> demo is rehearsed and the perf rows are real before you present.
