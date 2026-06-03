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
