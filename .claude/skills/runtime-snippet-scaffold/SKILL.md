---
description: Scaffold a new I-RUN-* runtime snippet — file under `src/runtime/`, registration in `jsEmitter.RUNTIME_SNIPPETS`, optional CSS half in `cssEmitter`, jsdom test suite, and jsEmitter ordering test. Use when adding to `src/runtime/`.
invocation: user
---

## Context

Runtime snippets are **opt-in per `document.runtime` flag**. `.claude/rules/code-generator.md` and the `/runtime-audit` skill enforce the shape: ES2019, passive (no scroll/resize spam — `IntersectionObserver` or `ResizeObserver` preferred), `requestAnimationFrame`-debounced when a listener is unavoidable, wrapped in its own inner IIFE so sibling snippets can't collide on top-level names, respects `prefers-reduced-motion` for any animation-driven behavior, no-op when its required DOM hooks are missing.

CLAUDE.local.md I-RUN-01..08 are the reference implementations — every new snippet should look like one of these.

## Inputs

Before scaffolding, get:

1. **Snippet name** — `camelCase` (e.g. `lazyVideo`, `copyButton`, `tableOfContents`). Matches the file name and the `runtime.<name>` flag.
2. **Runtime flag** — must be added to `RuntimeFlags` in `src/document/types.ts` and `src/document/schemas.ts` (C1+C2 contract change — see `/contract-change`). Confirm with the user that this is acceptable scope.
3. **DOM contract** — which `data-dtw-*` attributes the snippet looks for, and what state it manages (class names, ARIA attributes, inline styles). Keep names tight: `data-dtw-<purpose>` for hooks, `.<state>` or `aria-<x>` for state.
4. **CSS half needed?** — e.g. I-RUN-03 needs `scroll-behavior: smooth`; I-RUN-08 needs `animation-play-state: paused` initially. If yes, plan the `<NAME>_BLOCK` constant in `cssEmitter.ts`.
5. **Gating** — what flag gates it, what `<data-dtw-*>` attribute the htmlEmitter must stamp (if any), and what falls back when `IntersectionObserver` / `ResizeObserver` / `matchMedia` is unavailable.

## Instructions

1. **Read the closest analogue first.** Pick the I-RUN-\* snippet with the most similar mechanism:
   - Click-driven state toggle → `themeToggle.ts` or `mobileNav.ts`.
   - `IntersectionObserver` one-shot → `reveals.ts` or `animationGating.ts`.
   - `IntersectionObserver` sticky + bidirectional → `scrollSpy.ts` or `navOnScroll.ts` (sentinel pattern).
   - `ResizeObserver` for layout-derived CSS variable → `smoothScroll.ts`.
     Copy its IIFE wrapper, error-handling style (`try { ... } catch {}` without binding the err var), and reduced-motion handling.
2. **Create the snippet file.** Path: `src/runtime/<name>.ts`. Required export:
   - `export const <NAME_UPPER>_SNIPPET = \`(() => { ... })();\`;`
   - Optional: `export const <NAME_UPPER>_FOUC_GUARD` if a head-injected pre-render script is needed (only `themeToggle` has this so far).
   - JSDoc on every export.
3. **Register the snippet.** In `src/generator/jsEmitter.ts`, add the import and an entry to `RUNTIME_SNIPPETS` keyed by the flag name. Snippet ordering is observable in tests, so insert in the canonical order (matches `RuntimeFlags` field order in `src/document/types.ts`).
4. **If a flag was added, do the contract dance.** Update `src/document/types.ts` `RuntimeFlags` + `src/document/schemas.ts` `runtimeFlagsSchema`. Default the new flag to `false` so existing documents are unaffected. Migrations: if you bump the document version, register a migration in `src/document/migrations.ts`. Run `/contract-change` to flag the C1/C2 break.
5. **If CSS half is needed.** Add a `<NAME_UPPER>_BLOCK` const to `src/generator/cssEmitter.ts`, emit it conditionally on the runtime flag, slot it in the existing emission order. Include a `prefers-reduced-motion` override when applicable.
6. **If htmlEmitter must stamp an attribute.** Extend `htmlEmitter.ts:mergedAttrs` (or equivalent) to stamp `data-dtw-<hook>=""` on the right elements. Reference how `animationGating` (I-RUN-07) wires `data-dtw-gate-anim`.
7. **Write jsdom tests.** Path: `tests/runtime/<name>.test.ts`. Required coverage (mirror `tests/runtime/reveals.test.ts` for shape):
   - Happy path: snippet wires up state on the documented DOM contract.
   - Idempotency: calling the snippet's effects twice doesn't double-bind.
   - Reduced-motion path (if animation-driven).
   - `IntersectionObserver` / `ResizeObserver` absent fallback.
   - `matchMedia` throws → still works.
   - No-op when DOM hooks are missing.
   - State stickiness / one-shot semantics as appropriate.
8. **Update jsEmitter tests.** In `tests/generator/jsEmitter.test.ts`:
   - Add a "snippet emits under flag" case.
   - Add an ordering assertion (snippet appears after the previous canonical-order snippet).
   - Update the "all flags on → stable-ordered bundle" guard if present.
9. **Run sweeps.** Before committing: `/runtime-audit` against a synthetic document that opts the snippet in; `/accessibility-audit` if the snippet manages ARIA / focus.
10. **Commit.** `feat(runtime): add <name> snippet` with the task ID (`I-RUN-XX`) in the body.

## Output Format

Print:

- File paths created or modified (snippet, types, schemas, jsEmitter, cssEmitter, htmlEmitter, migrations, tests).
- Whether a contract change was triggered (C1/C2) — if yes, remind the user to run `/contract-change` and label the PR.
- The targeted test command: `npx vitest tests/runtime/<name>.test.ts tests/generator/jsEmitter.test.ts`.

Do not commit on the user's behalf unless asked.
