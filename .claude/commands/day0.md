Run the Day 0 sprint setup defined in `docs/0.2.0v/plan.md` Section 7. This is the one-day pre-sprint setup; do not skip steps.

## Step 1 — Verify the founding meeting was held

Check that `DECISIONS.md` exists at the repo root and records the 15 settled decisions in `docs/0.2.0v/plan.md` Section 8 (D1–D15):

- D1 tree library (`react-arborist`), D2 motion deferral, D3 undo/redo (`immer` patches), D4 Tailwind v3, D5 tokens in output (CSS custom properties), D6 icons in output (inline SVG default), D7 state (Zustand + immer), D8 validation (Zod), D9 image pipeline (`sharp` in main), D10 file extension (`.dtw`), D11 output bundle layout, D12 CSS minifier (`lightningcss`), D13 HTML minifier (`html-minifier-terser`), D14 a11y gate location (renderer + jsdom), D15 versioning (SemVer, v0.2.0 first ship, v1.0.0 at demo).

If `DECISIONS.md` is missing or incomplete, stop and tell the user the founding meeting must happen first.

## Step 2 — Folder skeleton

Confirm the directory tree from `docs/0.2.0v/plan.md` Section 5.2 exists:

```
src/main/, src/preload/, src/shared/,
src/document/{,presets/},
src/store/,
src/ui/{canvas,panels,sidebar,topbar,layers,dialogs},
src/generator/, src/runtime/, src/seo/, src/export/, src/templates/,
tests/{fixtures,unit,integration,e2e}/
```

Create any missing folder with an empty `index.ts` so imports compile from Day 1.

## Step 3 — Cross-owner contracts (C1–C12)

Per Section 6, the contracts that unblock teammates on Day 1 are:

- **C1** — `src/document/types.ts` (Ibrahim, `I-DOC-01`).
- **C2** — `src/document/schemas.ts` (Ibrahim, `I-DOC-02`).
- **C3** — `src/document/operations.ts` (Ibrahim, `I-DOC-03`).

Verify these files exist (even as stubs) and that LuF8y + Yousef can `import` from them. If the types are not merged by end of Day 1, escalate — this is risk R01 in Section 16 (M / H).

## Step 4 — Dependencies

Read `docs/0.2.0v/plan.md` Appendix A. Confirm each engineer's install block is in `package.json`:

- **Ibrahim:** `immer zod nanoid jszip prettier lightningcss html-minifier-terser sharp svgo axe-core jsdom chokidar` + dev `@playwright/test`.
- **Yousef:** `zustand use-immer` (immer/zod/nanoid via Ibrahim).
- **LuF8y:** `@dnd-kit/*`, `clsx`, `tailwind-merge`, `radash`, `@radix-ui/react-*` (tabs/dropdown/popover/dialog/context/switch/slider/tooltip), `react-resizable-panels`, `react-arborist`, `react-colorful`, `chroma-js`, `lucide-react`, `react-hotkeys-hook`, `react-error-boundary`; polish: `motion`, `shiki`.

List anything missing — do not install without user confirmation (these are package additions, not local changes).

## Step 5 — Board

Verify a GitHub Project Board exists with four columns (**Backlog / In Progress / Review / Done**) and that every task ID from Sections 10.1–10.20 is seeded as an issue with:

- owner (implied by prefix: `I-*` Ibrahim, `L-*` LuF8y, `Y-*` Yousef)
- priority label (`P0`, `P1`, `P2`)
- `depends:` / `blocks:` links per the task's spec

Also seed the Section 12 additional in-scope features (A1–A17) — they map to existing task IDs but should be tagged so they're not lost.

If the board is missing, list what should be added.

## Step 6 — Skill installation

Verify these skills exist under `.claude/skills/` and have current SKILL.md content:

- `phase-status` — milestone gate tracker (M1–M5).
- `accessibility-audit`, `runtime-audit`, `seo-check`, `token-validate`, `export-test` — per-skill checks for ritual X-08.
- `preflight` — pre-push gate.

## Step 7 — Report

End with a short table: **Step | Status (OK / Missing) | Action** and a one-line verdict on whether the team can start Day 1.
