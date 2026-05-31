# Draw-to-Web — Element Model (v0.2.0)

> Companion to `docs/0.2.0v/architecture.md`. This document describes the shape
> of a document tree: the element types, how style / responsive / state data
> hangs off each node, how tokens bind, and how presets compose primitives.
> The authoritative source is `src/document/types.ts` (C1) and its Zod mirror
> `src/document/schemas.ts` (C2); this doc is the prose explanation.

## 1. The document root

A whole project is a single `Document` object. The `.dtw` file is exactly
`JSON.stringify(document)`.

```ts
interface Document {
  version: DocumentVersion // SemVer; bumped on schema-breaking changes
  meta: DocumentMeta // name + ISO-8601 createdAt / updatedAt
  tokens: Tokens // the design-token registry
  tree: ElementNode // the single root element (the page)
  seo: SEOConfig // head / OG / Twitter / JSON-LD / favicon
  runtime: RuntimeFlags // opt-in output-JS toggles (all default false)
  variables: DocumentVariables // {{var}} substitutions
  settings: DocumentSettings // contrast target, default theme, backdrop
  assets: Record<AssetId, AssetManifestEntry> // sharp image manifest
}
```

`tree` is a **single** root node, not an array — the page is one element with
children. Validation enforces document-wide invariants against the tree:
exactly one `<h1>`, no heading-level skips, `alt` on every image, every
`TokenRef` resolves, and no duplicate `ElementId`s.

## 2. Element types — composition over enumeration

There are **eight primitive node types**, discriminated by `type`:

| `type`      | Emits                             | Notes                                             |
| ----------- | --------------------------------- | ------------------------------------------------- |
| `container` | `<div>` (or semantic role)        | The **only** node that owns `children` + `layout` |
| `text`      | `<h1>`…`<h6>`, `<p>`, `<span>`, … | `tag` field drives heading hierarchy              |
| `image`     | `<img>`                           | `srcset` from the asset manifest; `alt` required  |
| `button`    | `<button>`                        | `ariaLabel` required when icon-only               |
| `link`      | `<a>`                             | auto `rel="noopener noreferrer"` on `_blank`      |
| `icon`      | inline `<svg>` (default)          | `decorative` → `aria-hidden`; else `ariaLabel`    |
| `list`      | `<ul>` / `<ol>` + `<li>`          | `ordered` flag                                    |
| `divider`   | `<hr>` / styled `<div>`           | horizontal or vertical                            |

**Complex shapes are not new types.** Hero, Cards Grid, Nav, Footer, CTA are
**presets** (§6) — factories that emit subtrees of these eight primitives.
There is no `<HeroNode>`. This is the central design rule: composition over
enumeration.

### Semantic role vs. node type

`type` decides _what kind of thing_ an element is; `semanticRole` (on
containers) and `tag` (on text) decide _which HTML tag_ is emitted. A
`container` becomes `<section>` / `<header>` / `<nav>` / `<footer>` because the
author inserted that preset and `inferSemantics` (C10) decorated the node —
**never** because of spatial position on the canvas.

## 3. Style: per-breakpoint, per-state

Every node carries `style: ResponsiveProperties<StyleBlock>`. A `StyleBlock`
is a bag of optional box/layout/paint properties (width, padding, background
layers, border, shadows, typography, transform, …). The generator emits CSS
only for set fields.

### Responsive

```ts
interface ResponsiveProperties<T> {
  base: T // desktop default (≥ 1280) — required
  tablet?: T // ≤ 1024
  mobile?: T // ≤ 768
  small?: T // ≤ 480
}
```

`base` lives in the unqualified CSS block. Each narrower key emits an
`@media (max-width: …)` block containing **only the properties it overrides** —
not a full copy. Containers carry `layout: ResponsiveProperties<LayoutConfig>`
the same way, so layout can reflow per breakpoint.

### States

```ts
type StatesMap = { [K in 'hover' | 'focus-visible' | 'active']?: Partial<StyleBlock> }
```

Each state is a partial override emitted as a pseudo-class block in LVHA
order, again carrying only changed properties (I-GEN-07).

## 4. Tokens and binding

`document.tokens` is a categorized registry — `color`, `spacing`, `fontSize`,
`fontFamily`, `lineHeight`, `radius`, `shadow`. Color tokens carry both a
`light` and a `dark` value; the generator emits `light` in `:root` and `dark`
in `:root[data-theme="dark"]`.

Any bindable property is typed `Bindable<T> = T | TokenRef`, where a `TokenRef`
is a string like `"color.accent"` or `"spacing.md"`. Two consumers, two
behaviors:

- **Canvas (live render):** calls `resolveToken(tokens, ref, theme)` (C9) to
  get the concrete CSS value for the current theme.
- **Generator (output):** emits `var(--color-accent)` — it never resolves the
  value, so output stays token-driven. Raw values are emitted only for unbound
  (free-value) properties.

Token ids are stable slugs. Renaming a token changes the display label only;
`renameToken` / `deleteToken` walk the entire tree rewriting bindings inside a
single immer draft so undo records one history entry. `deleteToken` converts
bound props to free values with the resolved value frozen in.

## 5. Mutation: operations (C3)

The UI never mutates a node. It dispatches an `Operation` — a discriminated
union (`kind` tag) — into the store, which applies it to an immer draft. The
thirteen operation kinds:

```
insertElement · deleteElement · reorder · updateNode ·
updateNodeStyle · updateNodeState · wrapInGroup · unwrapGroup ·
addToken · updateToken · deleteToken · renameToken · insertPreset
```

Each is a pure `(draft, op) => void` mutator. `updateNodeStyle` /
`updateNodeState` write into the named breakpoint or state slot and never
silently overwrite `base`. IDs are stable — operations never regenerate them
(undo history and token bindings depend on it).

## 6. Presets (C7)

A preset is a pure factory `(args, ctx) => ElementNode` registered in
`presetsRegistry`. It returns a subtree composed entirely of the eight
primitives — no special behavior, no new types. The eight v0.2.0 presets:

```
hero-centered · hero-split · cards-grid-3col · card-basic
cta-banner · footer-simple · footer-columns · nav-fixed
```

`ctx` supplies a `generateId()` (production uses `nanoid`; tests inject a
deterministic counter so snapshots reproduce). Adding a preset = adding a
factory + one registry entry. No UI changes required — the Insert sidebar and
the `insertPreset` operation call every preset through the uniform signature.

## 7. Variables, assets, runtime, settings

- **`variables`** — `Record<string, string>`. `{{name}}` tokens in text
  content and string attribute values are interpolated at emit time (I-DOC-08).
  Editing a variable updates every occurrence on the next generate.
- **`assets`** — `Record<AssetId, AssetManifestEntry>`, produced by the sharp
  upload pipeline (C11). Each entry carries intrinsic `width`/`height` and a
  `srcset` map (intrinsic width → relative path). `ImageNode.assetId` resolves
  against this; `externalUrl` is the escape hatch for a remote image.
- **`runtime`** — `RuntimeFlags`, one boolean per opt-in behavior
  (themeToggle, scrollSpy, smoothScroll, mobileNav, navOnScroll, reveals,
  animationGating, terminalTyping). All default `false`; an all-false document
  emits zero `<script>` tags.
- **`settings`** — `contrastTarget` (AA/AAA, enforced by validation),
  `defaultTheme`, `gridVisible` (canvas-only, never emitted), optional
  `decorativeBackdrop` (`body::before` / `body::after` layers, I-GEN-09).

## 8. Migrations

`document.version` is SemVer. Any schema-breaking type change ships with a
migration in `src/document/migrations.ts` (`migrate(doc, from, to)`), and the
file-load path runs **Zod → migrate → Zod** so a stale `.dtw` is upgraded and
re-validated before it ever reaches the store. An unknown version throws a
structured error rather than loading partial state.

```

```
