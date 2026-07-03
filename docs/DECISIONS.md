# DECISIONS

> Project decision log (ritual **X-02**). Append-only; newest at the bottom.
> Each entry: ID · date · decision · rationale · consequences.

---

## D-01 — Cancel code signing (I-BLD-05), permanently

- **Date:** 2026-06-03
- **Decision:** `I-BLD-05` (Windows Authenticode + macOS notarization) is **cut
  from scope permanently**, not deferred. Builds ship **unsigned** for the
  foreseeable life of the project.
- **Rationale:** no Authenticode certificate and no Apple Developer ID, and the
  team has decided not to acquire them (cost + identity-verification overhead not
  justified for this project).
- **Consequences:**
  - Dropped from the M5 / `v0.3.0` gate — the build gate is now `I-BLD-01..04`.
  - Windows users hit a SmartScreen "Unknown publisher" warning → bypass via
    "More info → Run anyway". macOS users hit Gatekeeper → right-click → Open or
    `xattr -d com.apple.quarantine`. Bypass steps documented in the README under
    "Installing the unsigned builds".
  - If ever revisited: a single electron-builder config block + a `signtool` /
    `notarytool` step in `release.yml`. No architectural work; the release matrix
    already runs natively per OS.

---

## D-02 — Ship `v0.3.0` without the X-09 rehearsal (conscious waiver)

- **Date:** 2026-06-03
- **Decision:** Tag and release **`v0.3.0`** **without** holding `X-09` (the
  sacred demo rehearsal) and **without** the `Y-PRF-04` render-layer perf
  sign-off. This is a deliberate, documented waiver — not a claim that the gate
  was met.
- **Rationale:** the code is green — lint, both typechecks, 871/871 tests,
  compile, determinism, contracts, and the data-layer + export performance
  budgets all pass — so the build is shippable on the automated suite. The
  outstanding items are _manual_ rituals (a presenter running the packaged build
  3× on demo hardware) and an _empirical_ profiler run, neither of which is a
  code defect, and the team opted to ship now rather than block on them.
- **Consequences / accepted risk:**
  - **R13 is live:** a packaged-build or demo-hardware bug could surface in a
    live demo with no rehearsal having caught it.
  - The six render-layer budgets (drag 100/500, theme toggle, breakpoint switch,
    layers scroll, cold-start) are **NOT measured**; `perf-baseline.md` keeps
    them as pending.
  - **Owed before any live demo:** run `docs/0.2.0v/x-09-rehearsal.md` (3× clean)
    and capture the six numbers. `X-09` + `Y-PRF-04` render rows stay **open**,
    tracked as the top post-`v0.3.0` item.
  - Supervisor report §9 documents this waiver; §7 / §12 reflect the open perf
    risk.

---

## D-03 — Land draw / match / MCP (PR #92) in `v1.0.0`, overriding its "do not merge" note and the Tier-2 scope line

- **Date:** 2026-07-01
- **Decision:** Merge PR #92 (`feat/draw-match-mcp` — `src/draw/` draw-to-create,
  `src/match/` match-layout, and the headless `mcp/` server) into `main` and ship
  it as the headline of **`v1.0.0`**, the sprint demo cut. This consciously
  overrides two flags on the PR: (a) its own description said _"Not for merge yet
  — review only,"_ and (b) draw/match are Tier-2 "editor experience" that
  `CLAUDE.md` marks out-of-scope for the v0.2.0 sprint.
- **Rationale:** the branch is green — lint, both typechecks, 1042/1042 tests,
  compile, the a11y gate, and the export/perf lanes all pass in CI and locally.
  The three features are the most demo-able capabilities in the product and this
  is the presentable milestone (2-day demo deadline). The lead (Ibrahim)
  authorized the merge; the "do not merge" note is treated as stale. The core of
  all three pieces is pure/headless and reuses existing document operations (C3)
  and the export pipeline — no new element primitives, no new store ownership, and
  **no C1–C12 contract file touched** (verified before merge), so no
  `contract-change` ritual was required.
- **Consequences:**
  - **Scope line moves:** Tier-2 authoring is now _partially_ in-scope as of
    `v1.0.0`. `CLAUDE.md`'s "Tier 2 ❌ out of scope" note is superseded for these
    three features specifically; the rest of `future-authoring.md` stays out.
  - The MCP server is a new headless surface that mutates/exports documents. It
    reuses existing ops so risk is contained, but it sits **outside** the sprint's
    axe/export hard-gate story and the C1–C12 contract set — treat it as
    un-gated tooling until formally brought under a contract.
  - draw/match/mcp are new task areas not tracked in the `CLAUDE.local.md` task
    sheet (Yousef's lane, authored by yousefdeeb-112004). Recorded here rather
    than back-filled into the I-\* task IDs.
  - If Yousef had unfinished work on the branch, it landed as-is; follow-ups go
    through new PRs off `main`.

---

## D-04 — Cut `v1.0.0` with `X-09` + `Y-PRF-04` render sign-off still waived

- **Date:** 2026-07-01
- **Decision:** Tag and release **`v1.0.0`** carrying D-02's open items forward:
  the `X-09` demo rehearsal and the `Y-PRF-04` render-layer perf sign-off are
  **still not done**, and `v1.0.0` ships without them — a continued, documented
  waiver, not a claim the gate was met.
- **Rationale:** identical to D-02 — the automated suite is green (now 1042
  tests), so the build is shippable on the strength of CI; the outstanding items
  are a _manual_ rehearsal on demo hardware and an _empirical_ profiler run,
  neither a code defect. With a 2-day demo deadline the team ships now and folds
  the rehearsal into demo-day prep on the actual demo machine.
- **Consequences / accepted risk:**
  - R13 stays live: a packaged-build or demo-hardware bug, or a render-layer
    budget miss, could surface in the live demo un-caught. **Owed before the
    demo:** run `docs/0.2.0v/x-09-rehearsal.md` (3× clean) on demo hardware and
    capture the six render-layer numbers.
  - `docs/1.0.0v/supervisor-report.md` §9 / §7 / §12 carry the waiver forward and
    still list `X-09` + `Y-PRF-04` render rows as the top open item.
