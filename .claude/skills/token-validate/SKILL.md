---
description: Validate the document's design-tokens system end-to-end (definitions, bindings, theme overrides, contrast). Use when the user asks about tokens, design tokens, theming, color contrast, or "var()" references.
---

## What this checks

Tokens are central to the output (see `docs/0.2.0v/plan.md` Sections 5 + 10.2 + 10.14). This skill verifies the full chain: **definition → binding → emission → contrast**. It maps to tasks `I-DOC-06` (`resolveToken`, C9), `I-GEN-04..05` (token block + `var()` refs), `Y-STR-05` (token ops), `L-TKN-*` (Tokens panel), `L-PRP-03..04` (binding + contrast UI).

## Instructions

1. Read the document under inspection (fixture in `tests/fixtures/`, or a `.dtw` file the user points to).
2. **Definition check** — for each token in `document.tokens`:
   - Name is a valid CSS custom-property identifier (`/^[a-zA-Z][a-zA-Z0-9-]*$/`).
   - Category is one of `color | spacing | typography | shadow | radius`.
   - Value parses for its category (e.g., color tokens parse via `chroma-js`).
3. **Reference integrity** — walk every element in the tree:
   - Any property bound to a token (e.g., `element.props.background = { token: 'color-accent' }`) must reference a token that exists. Report dangling references as **errors** (deleted tokens should have been converted to free values per `Y-STR-05`).
   - Any raw hex/length that exactly matches an existing token value is a **suggestion** to bind.
   - Free-value escape hatch (`L-PRP-10`): values written via the "unlink" button are intentional — do not flag them as a binding suggestion if the element node is marked with the unlinked flag.
4. **Theme parity** — if the document defines both light and dark palettes:
   - Every color token must appear in both palettes (no orphans).
   - Token names match across palettes.
5. **Generated CSS check** — run the generator and inspect the output:
   - `:root { --token: value; }` block present and ordered deterministically (I-GEN-04).
   - `:root[data-theme="dark"]` (or `light`) overrides emitted for each color token that differs between palettes.
   - `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ... } }` block present (I-GEN-06).
   - Every bound element references `var(--token-name)`, not a raw value (I-GEN-05). Free values never appear in the `:root` block (`L-PRP-10` DoD).
6. **Contrast check** via `chroma-js` (I-DOC-05, L-PRP-04, L-TKN-03):
   - For every text-on-background pair derived from token bindings, compute WCAG contrast.
   - **AA** (default): body 4.5:1, large text 3:1, UI 3:1.
   - **AAA** (if `document.settings.wcagLevel === 'AAA'`): body 7:1, large text 4.5:1.
   - Check both palettes separately.
7. **Token-rename atomicity** (Y-STR-05): if the document history is available, verify `renameToken` left no stale `var(--old)` references — risk R04 in the register.
8. Output:
   - **Table 1** — Tokens defined: name | category | value(s) | issues.
   - **Table 2** — Bindings: element id | property | token | resolves? | contrast (if color) | AA/AAA verdict.
   - **Verdict:** `PASS` / `FAIL` with the list of errors. Suggestions are listed but don't block.
