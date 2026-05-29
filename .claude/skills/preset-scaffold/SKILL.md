---
description: Scaffold a new preset entry following the I-DOC-04 template — factory file + registry wiring + Zod round-trip test + axe-gate test. Use when adding to `src/document/presets/`.
invocation: user
---

## Context

Per `CLAUDE.md` "Composition over enumeration": **presets are pure factories that emit primitive subtrees**, not new element types. The 8 presets shipped in I-DOC-04 (`hero-centered`, `hero-split`, `cards-grid-3col`, `card-basic`, `cta-banner`, `footer-simple`, `footer-columns`, `nav-fixed`) all follow the same shape, enforced by `presetsRegistry` in `src/document/presets/index.ts` (C7) and the suite in `tests/templates/presets.test.ts`.

## Inputs

Ask the user (or infer from the user's message) before scaffolding:

1. **Preset id** — kebab-case, scoped (e.g. `testimonial-quote`, `pricing-3tier`, `faq-accordion`).
2. **Semantic root** — `<section>`, `<aside>`, `<nav>`, or `<footer>`. Drives `semanticRole` on the root container.
3. **Composition** — primitives it spawns (containers, text, image, button, link, icon, list, divider). No new element types.
4. **Token references** — which tokens its style blocks bind to. Must be a subset of the blank starter's token registry, or you owe an addition to that registry.
5. **Optional factory parameters** — e.g. `cards-grid-3col` takes `cardCount?: number`. Default-on if you can't articulate a use-case for the param.

## Instructions

1. **Read the closest analogue.** If the new preset is a hero-variant, read `src/document/presets/heroCentered.ts`. If it's a footer-variant, read `footerSimple.ts`. Match its shape: named factory export, `(ctx: PresetContext) => ElementNode`, fresh `nanoid()` ids per call, deterministic given the same `ctx.idSeed` (so generator snapshot tests stay green).
2. **Create the factory file.** Path: `src/document/presets/<idCamel>.ts`. Required exports:
   - `export const <idCamel>Preset: PresetDefinition = { id: '<kebab-id>', label: '<Human Label>', factory: create<IdPascal>, defaultProps?: {...} }`.
   - `export function create<IdPascal>(ctx: PresetContext, params?: {...}): ElementNode`.
   - JSDoc on both (required by CLAUDE.md for `src/document/`).
3. **Register the preset.** Add the import + entry to `src/document/presets/index.ts`. Keep the registry alphabetically sorted by `id` so diffs stay clean.
4. **Update the blank starter token registry if needed.** If the new preset references a token not in `src/templates/blank.ts`'s registry, add it there — `tests/templates/blank.test.ts` has a drift-guard that materializes every preset and asserts the starter token set is a superset. Tests will fail otherwise.
5. **Test the preset.** Append two assertions to `tests/templates/presets.test.ts` (the file already loops over `presetsRegistry`, so a registry add will pick up new entries automatically — verify by running the suite). Manual verification:
   - `documentSchema.safeParse` succeeds against `{ ...blankDoc, tree: { ...mainRoot, children: [headingIfNeeded, factoryOutput] } }`.
   - `runAxeGate(generate(doc))` returns zero `critical`/`serious` violations.
6. **Run the relevant skill sweep** before committing:
   - `/accessibility-audit` against a synthetic document that wraps the preset.
   - `/token-validate` if you added or rebound any token.
7. **Commit.** `feat(document): add <kebab-id> preset` with `I-DOC-04` in the body (presets share one task ID).

## Output Format

After scaffolding, print:

- File paths created or modified.
- The exact `presetsRegistry` diff.
- A 1-line summary of token additions to `src/templates/blank.ts` (or "none").
- The command to run the targeted test: `npx vitest tests/templates/presets.test.ts`.

Do not commit on the user's behalf unless asked.
