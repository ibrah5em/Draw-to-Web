---
description: Run the full pre-merge battery for a milestone graduation (M1–M5) — sweep matrix + integration tests + contract verification + tag suggestion. Use when `/phase-status` shows a milestone is fully green, or when the user asks to "ship M2 / cut v0.2.0 / graduate to M3".
invocation: user
---

## Context

`CLAUDE.md` and `docs/0.2.0v/plan.md` Section 17 define five milestones, each unlocked when its listed task IDs are complete. Tags map: `v0.1.0` (shipped), `v0.2.0` (M4 / Runtime + Output Hardening), `v0.3.0` (M5 polish), `v1.0.0` (sprint demo cut).

Graduation is a heavier ritual than per-PR sweeps because integration regressions are catastrophic — they cost a re-do of the demo prep. This skill is the gate that runs every relevant per-PR sweep at once and verifies the cross-cutting invariants.

## Instructions

1. **Confirm the target milestone.** Ask if not given. Read `CLAUDE.md` / `CLAUDE.local.md` "Milestone Gates" to load the gating task IDs.
2. **Run `/phase-status` first.** If any gating task is `- [ ]` or stale `- [~]`, abort and surface the gap. Graduation is only meaningful from a green base.
3. **Per-milestone sweep matrix.** The relevant skill set per milestone (per the table in CLAUDE.local.md "Per-PR Skill Sweep" + Section 17):

   | Milestone | Sweeps to run |
   | --- | --- |
   | M1 Foundation | `/preflight` |
   | M2 Tokens + Themes | `/token-validate`, `/accessibility-audit`, `/preflight` |
   | M3 Composition + Responsive | `/token-validate`, `/accessibility-audit`, `/preflight` |
   | M4 Runtime + Hardening | `/runtime-audit`, `/accessibility-audit`, `/seo-check`, `/export-test`, `/token-validate`, `/preflight` |
   | M5 Polish + Demo | All of the above + Lighthouse measurement on portfolio + landing templates |

   Run them in sequence (not parallel — failures are easier to triage one at a time). Capture each verdict.

4. **Integration test matrix.** `npm run lint && npm run typecheck && npx tsc -p tsconfig.web.json --noEmit && npm run test && npm run test:a11y && npm run build`. The web typecheck is the one that's missing from the husky pre-push hook (per `.claude/rules/preflight.md`) — do not skip it.
5. **Contract surface verification.** Walk every C1–C12 contract: does the producer file exist, does the typed surface match what `CLAUDE.local.md` documents, are downstream consumers wired to the latest shape? Use `/contract-change` semantics — but here we're verifying *steady state*, not a diff.
6. **Determinism + Invariant-5.4 spot check.** Run the relevant determinism tests explicitly: `npx vitest tests/generator/determinism.test.ts`. M3+ adds `tests/templates/presets.test.ts`, `tests/templates/portfolio.test.ts`, `tests/templates/landing.test.ts`, `tests/templates/resume.test.ts`.
7. **Bundle budget check.** Per `docs/0.2.0v/plan.md` Section 14:
   - Export of portfolio template < 10s wall clock. Measure with the latest version of `tests/export/e2e-example.test.ts`.
   - Generated CSS gzip size — confirm against the Section 14 budget.
   - Runtime JS bundle (all-flags-on) gzip size — confirm against the Section 14 budget.
8. **Scope-cut trigger audit.** Read `docs/0.2.0v/plan.md` Section 18. For each trigger, confirm it is NOT firing. Triggers that fire mean we cut scope and re-graduate, not ship.
9. **Documentation owe-back.** Per CLAUDE.local.md "Documentation deliverables":
   - M1: README refresh.
   - M2: `docs/0.2.0v/architecture.md`, `docs/0.2.0v/element-model.md`.
   - M5: `docs/0.2.0v/supervisor-report.md`, README final, JSDoc coverage on every exported function in owned dirs.
   Confirm the milestone's owe-backs are landed.
10. **Tag suggestion.** If steps 2–9 all pass:
    - Suggest the tag (`v0.2.0` for M4, `v0.3.0` for M5, `v1.0.0` for M5 demo cut).
    - Show the `git tag -a` + `git push` commands, **do not run them**.
    - Remind the user that `.github/workflows/release.yml` (I-BLD-03) fires on `v*` tag push — confirm that workflow is wired before tagging, or the artifact won't build.

## Output Format

A single graduation report:

```
# Milestone <M_> Graduation Report

## Phase Status      [PASS|FAIL]
## Sweep Matrix       [N/N PASS]
  - /runtime-audit:     PASS
  - /accessibility:     PASS
  - ...
## Integration Tests  [PASS|FAIL]
## Contract Surface   [PASS|FAIL]
## Determinism        [PASS|FAIL]
## Bundle Budgets     [PASS|FAIL]  details: ...
## Scope-Cut Triggers [NONE FIRING|<list>]
## Documentation      [COMPLETE|<missing>]

## Verdict
READY TO TAG: v0.X.0
  $ git tag -a v0.X.0 -m "...."
  $ git push origin v0.X.0

(OR)

BLOCKED — fix the following before re-running this skill:
  - <specific blocker 1>
  - <specific blocker 2>
```

Never tag on behalf of the user. Always print the commands and let them run.
