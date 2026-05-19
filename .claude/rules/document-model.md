---
paths:
  - 'src/document/**'
  - 'src/shared/**'
---

# Document Model Rules

The document is the central abstraction. Every layer of the app depends on it. Treat changes here as schema-breaking by default. The cross-owner contracts that hang off this module are **C1–C9** in `docs/0.2.0v/plan.md` Section 6; any breaking shape change requires a PR labeled `contract-change` and downstream-consumer review.

- Types live in `src/document/types.ts` (C1). The matching Zod schemas live in `src/document/schemas.ts` (C2) and are kept in lock-step via `type X = z.infer<typeof xSchema>`. If a TypeScript type changes, the Zod schema changes in the same commit.
- The document has a `version` field. Any breaking type change requires a migration in `src/document/migrations.ts` (I-DOC-07). Files load through Zod → migrations → Zod again.
- IDs come from `nanoid` and are stable across sessions. Never re-generate IDs on save / load — undo history and token references depend on them.
- Mutations happen through **operations** in `src/document/operations.ts` (C3). Each operation is an `(draft: Document, op: Op) => void` immer mutator applying one logical change. UI never mutates a node directly.
- Tokens (`document.tokens`) are first-class. `renameToken` / `deleteToken` walk the tree rewriting every binding inside one draft so history records a single entry. `deleteToken` converts bound props to free values with the resolved value frozen in (and surfaces a validation warning).
- `document.runtime: RuntimeFlags` gates output JS per behavior (theme toggle, scroll-spy, nav-on-scroll, mobile menu, reveals, animation gating, terminal typing). Defaults are `false` everywhere — opting in is explicit.
- `document.variables: Record<string, string>` (I-DOC-08) supports `{{var}}` interpolation in text + attributes at generation time. Editing a variable updates every occurrence on next emit.
- Per-breakpoint and per-state values live on the element (`element.responsive.tablet.fontSize`, `element.states.hover.color`). Operations write to the active slot; they never silently overwrite the base value.
- Presets in `src/document/presets/` are pure factories `(args) => ElementNode` registered in `presetsRegistry` (C7 — `src/document/presets/index.ts`). They compose primitives — they never define new element types. Adding a preset = adding a registry entry; no UI changes required.
- `validateDocument` in `src/document/validation.ts` (C8) is a pure function returning `{ errors, warnings, infos }`, each with `{ message, nodeId?, fix? }`. UI surfaces all three; export gates on `errors` only. Contrast checks use `chroma-js` against the bound surface token; WCAG level is AA by default with AAA toggleable in Document Settings.
- `resolveToken(tokens, ref, theme)` (C9) is the single token-to-CSS-value resolver and is theme-aware. The canvas calls it for live render; the generator does not (it emits `var(--name)` instead).
- The Document Model has no React, no Zustand, no DOM imports. It must be importable from any process (renderer, main, future Node tooling).
