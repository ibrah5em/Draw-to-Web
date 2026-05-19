---
description: Check project progress against the milestone gates defined in docs/0.2.0v/plan.md Section 17. Use when user asks about progress, what's left, milestone status, or sprint status.
invocation: user
---

## Model

Draw-to-Web is **task-driven, not time-boxed** (`docs/0.2.0v/plan.md` Section 1). Progress is gated by **milestones**, each unlocked when its listed task IDs are complete (Section 17):

- **M1 — Foundation** — `I-DOC-01..03`, `I-DOC-05`, `Y-STR-01..03`, `Y-PER-01..02`, `L-CAN-01..05`, `L-LYR-01`, `I-ELE-01..04`, `I-GEN-01..03`, `I-EXP-01` (minus minify + a11y gate). Demo: create container + text, layers tree, selection, save/load, undo/redo, export valid HTML/CSS.
- **M2 — Tokens + Themes + Auto-Layout** — `I-DOC-06`, `I-GEN-04..08`, `I-RUN-01`, `Y-STR-05..07`, `L-PRP-02..04`, `L-TKN-01..04`, `L-TKN-06`, `L-TOP-01`. Demo: token panel, theme toggle, auto-layout, `:root` block + `var()` references in output.
- **M3 — Composition + Responsive + States** — `I-DOC-04`, `I-TPL-01..02`, `I-TPL-05`, `I-GEN-09..12`, `Y-STR-04`, `L-SBR-01..04`, `L-CAN-06..07`, `L-CAN-12..13`, `L-TOP-02`, `L-PRP-05..09`, `I-ELE-05`, `L-DLG-01`. Demo: 6+ presets, hover/focus, breakpoint switcher, multi-select, image upload + srcset.
- **M4 — Runtime + Output Hardening** — `I-GEN-13..20`, `I-RUN-02..08`, `I-SEO-01..07`, `I-EXP-02..03`, `I-DOC-07..08`, `L-VAL-01..03`, `L-DLG-02..03`, `L-DLG-05`, `L-TOP-04..05`, `I-TPL-03..04`. Demo: validation console blocks export, full runtime + SEO + 3 templates working.
- **M5 — Polish + Demo** — `L-CAN-10..11`, `L-LYR-03..04`, `L-PRP-10`, `L-TKN-05`, `L-VAL-04`, `L-DLG-04`, `L-DLG-06..08`, `I-RUN-07..08`, `I-EXP-04..05`, `Y-PRF-04`, `I-BLD-01..05`, `X-09`. Demo: rehearsed end-to-end 3×, budgets met (Section 14), release artifact published.

## Instructions

1. Read `docs/0.2.0v/plan.md` Sections 10 (task list with IDs + `DoD:`), 11 (Tier 1 feature checklist), 17 (milestone gates), 18 (scope-cut triggers).
2. Scan the codebase for evidence of completion:
   - `src/document/` — `types.ts`, `schemas.ts`, `operations.ts`, `tokens.ts`, `validation.ts`, `migrations.ts`, `presets/index.ts`, `presets/*.ts`. Map to `I-DOC-*`.
   - `src/store/` — `documentStore.ts`, `historyStore.ts`, `sessionStore.ts`. Map to `Y-STR-*`, `Y-HST-*`, `Y-PER-*`, `Y-PRF-*`.
   - `src/ui/` — `canvas/`, `panels/`, `sidebar/`, `topbar/`, `layers/`, `dialogs/`. Map to `L-CAN-*`, `L-LYR-*`, `L-SBR-*`, `L-PRP-*`, `L-TOP-*`, `L-TKN-*`, `L-VAL-*`, `L-DLG-*`.
   - `src/generator/` — `index.ts`, `htmlEmitter.ts`, `cssEmitter.ts`, `jsEmitter.ts`. Map to `I-GEN-*`.
   - `src/runtime/` — one file per snippet. Map to `I-RUN-*`.
   - `src/seo/` — `head.ts`, `og.ts`, `jsonld.ts`, `sitemap.ts`, `robots.ts`. Map to `I-SEO-*`.
   - `src/export/` — `index.ts`, `axeGate.ts`, `minify.ts`, `bundle.ts`. Map to `I-EXP-*`.
   - `src/main/`, `src/preload/`, `src/shared/` — Map to `I-ELE-*`.
   - `src/templates/` — Map to `I-TPL-*`.
   - `electron-builder.yml`, `.github/workflows/` — Map to `I-BLD-*`.
3. Verify each contract from Section 6 has its producer file in place (C1–C12).
4. Produce two outputs:
   - **Per-milestone table:** `Milestone | Task ID | Owner | Status (Done / In Progress / Not Started) | Evidence (file path or "missing")`.
   - **Per-milestone percentage:** count Done / total tasks in the gate.
5. Flag any scope-cut trigger from Section 18 that is firing (e.g., recursive canvas not rendering in real Flex, 100-element drag <45 fps, axe gate >5 s).
6. End with a one-paragraph honest read: which milestone are we on, are we tracking, and what's the single biggest blocker.
