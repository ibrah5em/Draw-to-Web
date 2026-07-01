# Y-PRF-04 — Render-Layer Perf Capture Checklist

> Copy-paste steps to capture the six render-layer numbers that are still
> `_pending instrumented run_` in `docs/0.2.0v/perf-baseline.md`. Run these on
> the **demo machine** (R13) — they need a GUI + the React DevTools profiler and
> cannot be read by the headless harness. The data-layer and export budgets are
> already green in `npm run test:perf`; only the six below are open.
>
> When done, transcribe the numbers into the run-sheet §3
> ([`demo-runsheet.md`](demo-runsheet.md)) and the `perf-baseline.md` table.

## Setup (once)

1. Install and launch the **packaged v1.0.0 build** (not `npm run dev` — the dev
   build's timings are not sign-off-grade). Cold-start timing (step 6) must be
   the first launch, so note the time before you open anything else.
2. Install the **React Developer Tools** browser extension is _not_ available in
   the packaged Electron app; instead use the built-in profiler:
   - Launch with the devtools open (View → Toggle Developer Tools, or the app's
     dev-tools shortcut), switch to the **⚛️ Profiler** tab.
   - If the Profiler tab is missing, the packaged build may ship without the
     React DevTools hook — fall back to `dev` for the FPS/timing shape and note
     that the absolute numbers are indicative, not sign-off-grade.
3. Open the **Portfolio** template, then switch the canvas to the **500-element
   stress fixture** (the fixture the run-sheet §0 lists).

## Capture — six metrics

For each interaction: click **Record** in the Profiler, do the interaction once,
click **Stop**, read the value, repeat 3× and take the median.

- [ ] **1. Element drag (100 el)** — with a 100-element doc, drag one element
      across the canvas. Read committed-frames FPS. **Budget: 60 fps.**
- [ ] **2. Element drag (500 el)** — same on the 500-element stress fixture.
      **Budget: ≥ 45 fps.** (Held by `React.memo` on `CanvasNode` + stable
      selectors + structural sharing of semantic subtrees.)
- [ ] **3. Theme toggle on canvas** — toggle dark/light; time the `data-theme`
      flip → repaint (Profiler commit duration). **Budget: < 100 ms.**
- [ ] **4. Breakpoint switch** — switch desktop → mobile; time the canvas reflow.
      **Budget: < 200 ms.**
- [ ] **5. Layers tree scroll (500 nodes)** — scroll the layers tree fast on the
      500-node fixture; confirm `react-arborist` windowing holds FPS.
      **Budget: 60 fps.**
- [ ] **6. Cold-start to interactive** — from launch (first paint) to the canvas
      being interactive. **Budget: < 3 s.** Measure with a stopwatch/screen
      recording, not the profiler.

## Record

| Metric                         | Budget   | Measured | Pass? |
| ------------------------------ | -------- | -------- | ----- |
| Element drag (100 el)          | 60 fps   |          | ☐     |
| Element drag (500 el)          | ≥ 45 fps |          | ☐     |
| Theme toggle on canvas         | < 100 ms |          | ☐     |
| Breakpoint switch              | < 200 ms |          | ☐     |
| Layers tree scroll (500 nodes) | 60 fps   |          | ☐     |
| Cold-start to interactive      | < 3 s    |          | ☐     |

Machine: `____________________` · Build: `v1.0.0` · Date: `__________`

## If a budget misses

The architectural levers are already in place (Y-PRF-01 memo, Y-PRF-02 stable
selectors, Y-PRF-03 arborist windowing). A miss is a Yousef-lane investigation
(render layer), **not** a generator/export issue — file it against `src/ui/` /
`src/store/` and re-measure after the fix. Do not block the demo on a marginal
miss; note it and use the backup recording (run-sheet §0).
