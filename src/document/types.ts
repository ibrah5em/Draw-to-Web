/**
 * Document Model — core types.
 *
 * This module is the only source of truth for the shape of a Draw-to-Web
 * document. Every other owner reads from these types:
 *
 *   - `src/store/*`         (Yousef)  consumes Document + Operation
 *   - `src/ui/*`            (LuF8y)   consumes Document for rendering + edits
 *   - `src/generator/*`     (Ibrahim) walks the tree to emit HTML/CSS/JS
 *   - `src/export/*`        (Ibrahim) feeds the same tree into validation
 *
 * The types here describe **persisted, immutable** state. Mutations always
 * happen inside an immer draft (see `operations.ts`), so values exposed at
 * the boundary are `readonly`.
 *
 * Contract: C1 (see `docs/0.2.0v/plan.md` Section 6).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * SemVer document version string. Bumped on schema changes that require a
 * migration (see `migrations.ts`).
 */
export type DocumentVersion = `${number}.${number}.${number}`

/**
 * Stable element identifier. Generated with `nanoid` and immutable across
 * the lifetime of an element. Used as the React key, as the scoped CSS
 * class suffix (`.dtw-el-{id}`), and as the operation target.
 */
export type ElementId = string

/**
 * Stable token identifier within its category. Authors edit the human name
 * in the UI; the slug here is derived once and stays put so token bindings
 * survive renames (rename = change the display label, not the id).
 */
export type TokenId = string

/**
 * Stable asset identifier returned by the image upload pipeline (C11).
 */
export type AssetId = string

// ---------------------------------------------------------------------------
// Token system (C9 input)
// ---------------------------------------------------------------------------

/**
 * The five token categories the editor surfaces. Each maps to a CSS custom
 * property namespace in generated output (`--color-*`, `--space-*`, etc.).
 */
export type TokenCategory =
  | 'color'
  | 'spacing'
  | 'fontSize'
  | 'fontFamily'
  | 'lineHeight'
  | 'radius'
  | 'shadow'

/**
 * String-shaped reference to a token, of the form `"color.accent"` or
 * `"spacing.md"`. This is the on-disk wire format and the value that
 * appears anywhere a property accepts either a raw value or a token.
 *
 * Resolved by `resolveToken(tokens, ref, theme)` (C9).
 */
export type TokenRef = `${TokenCategory}.${string}`

/**
 * A value bound to a token reference, or expressed as a raw value of the
 * underlying type. Generator and UI distinguish the two cases by checking
 * the runtime shape (typeof === 'string' && includes('.') — see helpers in
 * `tokens.ts`).
 */
export type Bindable<T> = T | TokenRef

/**
 * Color tokens carry both light- and dark-theme values. The generator
 * emits the `light` value in `:root` and the `dark` value in
 * `:root[data-theme="dark"]`.
 */
export interface ColorTokenValue {
  readonly light: string
  readonly dark: string
}

/**
 * A single token definition. Display name is what the user sees in the
 * Tokens panel; `id` is the slug used by every `TokenRef` and the emitted
 * CSS custom property.
 */
export interface TokenDefinition<TValue> {
  readonly id: TokenId
  readonly name: string
  readonly value: TValue
  /** Optional human description, surfaced in the Tokens panel tooltip. */
  readonly description?: string
}

/** Categorised token registry persisted on every document. */
export interface Tokens {
  readonly color: ReadonlyArray<TokenDefinition<ColorTokenValue>>
  readonly spacing: ReadonlyArray<TokenDefinition<string>>
  readonly fontSize: ReadonlyArray<TokenDefinition<string>>
  readonly fontFamily: ReadonlyArray<TokenDefinition<string>>
  readonly lineHeight: ReadonlyArray<TokenDefinition<string>>
  readonly radius: ReadonlyArray<TokenDefinition<string>>
  readonly shadow: ReadonlyArray<TokenDefinition<string>>
}

// ---------------------------------------------------------------------------
// Responsive + states
// ---------------------------------------------------------------------------

/**
 * Editor breakpoint keys. `base` is the desktop default; the others emit
 * `@media (max-width: ...)` rules in the order tablet → mobile → small.
 *
 * Pixel thresholds (max-width): tablet ≤ 1024, mobile ≤ 768, small ≤ 480.
 */
export type BreakpointKey = 'base' | 'tablet' | 'mobile' | 'small'

/**
 * A property whose value can vary per breakpoint. `base` is required; the
 * narrower keys override only what they specify.
 */
export interface ResponsiveProperties<T> {
  readonly base: T
  readonly tablet?: T
  readonly mobile?: T
  readonly small?: T
}

/**
 * Interactive states surfaced in the Properties panel and emitted as
 * pseudo-class blocks. Each state is a partial override on top of the
 * element's base style; only the changed properties are emitted (I-GEN-07).
 */
export type StateKey = 'hover' | 'focus-visible' | 'active'

/**
 * Map of state overrides. Each entry is a partial `StyleBlock`; absent
 * keys inherit from `base`.
 */
export type StatesMap = {
  readonly [K in StateKey]?: Partial<StyleBlock>
}

// ---------------------------------------------------------------------------
// Style blocks
// ---------------------------------------------------------------------------

/** Container layout direction; maps to `flex-direction`. */
export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'

/** Axis alignment; maps to `align-items` / `justify-content`. */
export type Alignment =
  | 'start'
  | 'center'
  | 'end'
  | 'stretch'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'

/**
 * Container-only auto-layout configuration. Containers in v0.2.0 always
 * use Flexbox or Grid — never `position: absolute` (Invariant 5.4).
 */
export interface LayoutConfig {
  readonly mode: 'flex' | 'grid'
  readonly direction?: FlexDirection
  readonly gap?: Bindable<string>
  readonly justify?: Alignment
  readonly align?: Alignment
  readonly wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
  /** Grid template columns / rows expressions (e.g. `'repeat(3, 1fr)'`). */
  readonly gridTemplateColumns?: string
  readonly gridTemplateRows?: string
}

/** Width / height value. `auto`, fixed length, or a fluid `clamp()` expression. */
export type DimensionValue = 'auto' | Bindable<string>

/** Per-corner radius or a single value applied to all four corners. */
export interface BorderRadius {
  readonly topLeft?: Bindable<string>
  readonly topRight?: Bindable<string>
  readonly bottomLeft?: Bindable<string>
  readonly bottomRight?: Bindable<string>
  /** Shortcut: when set, overrides every per-corner field. */
  readonly all?: Bindable<string>
}

/** Spacing block applied as padding or margin. */
export interface SpacingBox {
  readonly top?: Bindable<string>
  readonly right?: Bindable<string>
  readonly bottom?: Bindable<string>
  readonly left?: Bindable<string>
}

/**
 * Background layer — solid, gradient, or image. Multiple layers are
 * emitted top-to-bottom (I-GEN-09). `imageUrl` may reference a local
 * asset (`asset:<id>`) or an external URL.
 */
export type BackgroundLayer =
  | { readonly kind: 'solid'; readonly color: Bindable<string> }
  | {
      readonly kind: 'linear-gradient'
      readonly angle: string
      readonly stops: ReadonlyArray<{
        readonly color: Bindable<string>
        readonly position?: string
      }>
    }
  | {
      readonly kind: 'radial-gradient'
      readonly shape?: 'circle' | 'ellipse'
      readonly stops: ReadonlyArray<{
        readonly color: Bindable<string>
        readonly position?: string
      }>
    }
  | {
      readonly kind: 'image'
      readonly imageUrl: string
      readonly size?: 'cover' | 'contain' | string
      readonly position?: string
      readonly repeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'
    }

/** Single shadow specification. Multiple shadows compose into the final declaration. */
export interface ShadowLayer {
  readonly offsetX: string
  readonly offsetY: string
  readonly blur: string
  readonly spread?: string
  readonly color: Bindable<string>
  readonly inset?: boolean
}

/** Typography settings for text-bearing elements. */
export interface Typography {
  readonly fontFamily?: Bindable<string>
  readonly fontSize?: Bindable<string>
  readonly fontWeight?: Bindable<string | number>
  readonly lineHeight?: Bindable<string | number>
  readonly letterSpacing?: Bindable<string>
  readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  readonly textAlign?: 'left' | 'center' | 'right' | 'justify'
  readonly textDecoration?: 'none' | 'underline' | 'line-through'
  readonly fontStyle?: 'normal' | 'italic'
  readonly color?: Bindable<string>
}

/** Border specification — width, style, colour. */
export interface BorderSpec {
  readonly width: Bindable<string>
  readonly style: 'solid' | 'dashed' | 'dotted' | 'double' | 'none'
  readonly color: Bindable<string>
}

/**
 * Animation reference. The generator owns the keyframe library (I-GEN-11);
 * elements just pick a name and tune timing. Non-essential animations are
 * disabled under `prefers-reduced-motion`.
 */
export interface AnimationSpec {
  /** Keyframe name from the generator library (`fadeUp`, `pulse-dot`, etc.). */
  readonly name: string
  readonly duration?: string
  readonly delay?: string
  readonly easing?: string
  readonly iterationCount?: number | 'infinite'
  readonly fillMode?: 'none' | 'forwards' | 'backwards' | 'both'
  readonly direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  /**
   * If true, the animation is considered decorative and is removed under
   * `prefers-reduced-motion`. Defaults to `true` in the generator.
   */
  readonly decorative?: boolean
  /** If true, animation play-state is gated until in view (I-RUN-07). */
  readonly gateOnView?: boolean
}

/**
 * Box / layout / paint properties for a single breakpoint. Every field is
 * optional; the generator emits CSS only for set values.
 */
export interface StyleBlock {
  readonly width?: DimensionValue
  readonly height?: DimensionValue
  readonly minWidth?: DimensionValue
  readonly maxWidth?: DimensionValue
  readonly minHeight?: DimensionValue
  readonly maxHeight?: DimensionValue
  readonly padding?: SpacingBox
  readonly margin?: SpacingBox
  readonly flex?: string
  readonly gridColumn?: string
  readonly gridRow?: string
  readonly opacity?: number
  readonly visibility?: 'visible' | 'hidden'
  readonly overflow?: 'visible' | 'hidden' | 'scroll' | 'auto'
  readonly background?: ReadonlyArray<BackgroundLayer>
  readonly maskImage?: string
  readonly backdropFilter?: string
  readonly borderRadius?: BorderRadius
  readonly border?: BorderSpec
  readonly shadows?: ReadonlyArray<ShadowLayer>
  readonly typography?: Typography
  readonly transform?: string
  readonly transition?: string
  readonly cursor?: 'auto' | 'pointer' | 'default' | 'not-allowed' | 'text'
  readonly zIndex?: number
}

// ---------------------------------------------------------------------------
// Semantic role hints (consumed from C10)
// ---------------------------------------------------------------------------

/**
 * Semantic HTML tag to emit for an element. When unset the generator falls
 * back to a sensible default per node `type` (e.g. container → `<div>`).
 * `inferSemantics` (C10, LuF8y) walks the tree and decorates nodes with
 * the upgraded role before generation.
 */
export type SemanticRole =
  | 'header'
  | 'nav'
  | 'main'
  | 'section'
  | 'article'
  | 'aside'
  | 'footer'
  | 'div'
  | 'figure'
  | 'figcaption'

/**
 * Tag override for text nodes. Determines the rendered HTML element and is
 * how authors create heading hierarchy. Validation enforces single-`<h1>`
 * and no-skip rules against this field (I-DOC-05).
 */
export type TextTag =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'em'
  | 'strong'
  | 'small'
  | 'code'
  | 'blockquote'

// ---------------------------------------------------------------------------
// Element nodes (discriminated union by `type`)
// ---------------------------------------------------------------------------

/** Properties carried by every element regardless of `type`. */
interface ElementBase {
  readonly id: ElementId
  /** Author-visible label in the Layers panel; falls back to `type`. */
  readonly name?: string
  /** Optional semantic HTML override (see `SemanticRole`). */
  readonly semanticRole?: SemanticRole
  /** Per-breakpoint visual style. `base` is required by callers. */
  readonly style: ResponsiveProperties<StyleBlock>
  /** Interactive state overrides. */
  readonly states?: StatesMap
  /** Optional animation; respected per `prefers-reduced-motion`. */
  readonly animation?: AnimationSpec
  /** Additional HTML classes; merged with the generator's `dtw-el-{id}`. */
  readonly classes?: ReadonlyArray<string>
  /** Raw HTML attributes (id, role, aria-*, etc.). Avoid `class`/`style`. */
  readonly attributes?: Readonly<Record<string, string>>
  /** `data-*` attributes. Keys must NOT include the `data-` prefix. */
  readonly dataAttributes?: Readonly<Record<string, string>>
  /**
   * Hide this element at specific breakpoints. Emitted as
   * `@media (max-width: ...) { display: none }` blocks.
   */
  readonly hiddenAt?: ReadonlyArray<BreakpointKey>
}

/** Container element — the only node type that owns children. */
export interface ContainerNode extends ElementBase {
  readonly type: 'container'
  readonly children: ReadonlyArray<ElementNode>
  /** Auto-layout configuration; applied to `base` and overridable per breakpoint. */
  readonly layout: ResponsiveProperties<LayoutConfig>
}

/**
 * Text element. `content` is the raw author string; `{{variable}}` tokens
 * are interpolated at emit time (I-DOC-08) against `document.variables`.
 */
export interface TextNode extends ElementBase {
  readonly type: 'text'
  readonly tag: TextTag
  readonly content: string
}

/**
 * Image element. `assetId` points to a uploaded asset (C11) and resolves
 * to a `srcset` at emit time; `externalUrl` is the escape hatch for an
 * author-supplied remote URL.
 */
export interface ImageNode extends ElementBase {
  readonly type: 'image'
  /** Empty string allowed for decorative images (validation rule). */
  readonly alt: string
  readonly assetId?: AssetId
  readonly externalUrl?: string
  /** Hint for `<img sizes>`; e.g. `'(max-width: 768px) 100vw, 50vw'`. */
  readonly sizesHint?: string
  readonly loading?: 'lazy' | 'eager'
  readonly decoding?: 'async' | 'sync' | 'auto'
}

/**
 * Button element. Always emits `<button>`; for links styled as buttons,
 * use `LinkNode` with button styling.
 */
export interface ButtonNode extends ElementBase {
  readonly type: 'button'
  readonly content: string
  readonly buttonType?: 'button' | 'submit' | 'reset'
  /** ARIA label for icon-only buttons (validation hard requirement). */
  readonly ariaLabel?: string
}

/** Link element — emits `<a>`. */
export interface LinkNode extends ElementBase {
  readonly type: 'link'
  readonly content: string
  readonly href: string
  readonly target?: '_self' | '_blank'
  /** Generator auto-adds `noopener noreferrer` for `target="_blank"` (I-GEN-17). */
  readonly rel?: string
  readonly ariaLabel?: string
}

/** Icon element. Inline SVG is the default; CDN font is an opt-in escape hatch. */
export interface IconNode extends ElementBase {
  readonly type: 'icon'
  /** Logical icon name (e.g. `'arrow-right'`); resolved against the icon set. */
  readonly name: string
  /** When set, emits this raw SVG markup inline (preferred). */
  readonly inlineSvg?: string
  /** Required for non-decorative icons; ignored when `decorative` is true. */
  readonly ariaLabel?: string
  /** Decorative icons are `aria-hidden="true"` and need no label. */
  readonly decorative?: boolean
}

/** List element — emits `<ul>` or `<ol>` with `<li>` children. */
export interface ListNode extends ElementBase {
  readonly type: 'list'
  readonly ordered: boolean
  readonly items: ReadonlyArray<string>
  /** CSS `list-style-type`; defaults to `disc`/`decimal`. */
  readonly marker?: string
}

/** Divider element — emits a semantic `<hr>` or styled `<div>` separator. */
export interface DividerNode extends ElementBase {
  readonly type: 'divider'
  readonly orientation: 'horizontal' | 'vertical'
}

/** Discriminated union of every renderable element. */
export type ElementNode =
  | ContainerNode
  | TextNode
  | ImageNode
  | ButtonNode
  | LinkNode
  | IconNode
  | ListNode
  | DividerNode

/** String literal union of every `ElementNode['type']`. */
export type ElementType = ElementNode['type']

// ---------------------------------------------------------------------------
// SEO + JSON-LD
// ---------------------------------------------------------------------------

/** Open Graph metadata; rendered as `<meta property="og:...">`. */
export interface OpenGraphConfig {
  readonly title?: string
  readonly description?: string
  readonly type?: 'website' | 'article' | 'profile'
  readonly imageUrl?: string
  readonly url?: string
  readonly siteName?: string
}

/** Twitter card metadata; rendered as `<meta name="twitter:...">`. */
export interface TwitterCardConfig {
  readonly card: 'summary' | 'summary_large_image'
  readonly site?: string
  readonly creator?: string
}

/**
 * JSON-LD subset surfaced in the editor. Each variant maps to a single
 * Schema.org type; the generator wraps it in `<script type="application/ld+json">`.
 */
export type JsonLdConfig =
  | {
      readonly kind: 'Person'
      readonly name: string
      readonly url?: string
      readonly jobTitle?: string
      readonly sameAs?: ReadonlyArray<string>
      readonly email?: string
    }
  | {
      readonly kind: 'Organization'
      readonly name: string
      readonly url?: string
      readonly logoUrl?: string
      readonly sameAs?: ReadonlyArray<string>
    }
  | {
      readonly kind: 'WebSite'
      readonly name: string
      readonly url: string
      readonly description?: string
    }

/** Favicon source. Inline SVG is default; PNG is an uploaded asset. */
export type FaviconConfig =
  | { readonly kind: 'svg-inline'; readonly svg: string }
  | { readonly kind: 'png'; readonly assetId: AssetId }

/** Whole-page SEO configuration. */
export interface SEOConfig {
  readonly title: string
  readonly description: string
  readonly keywords?: ReadonlyArray<string>
  readonly author?: string
  readonly lang: string
  readonly viewport: string
  readonly charset: string
  readonly canonical?: string
  readonly themeColor?: { readonly light?: string; readonly dark?: string }
  readonly openGraph?: OpenGraphConfig
  readonly twitter?: TwitterCardConfig
  readonly jsonLd?: JsonLdConfig
  readonly favicon?: FaviconConfig
  /** External origins to `preconnect` / `dns-prefetch` (I-SEO-05). */
  readonly preconnect?: ReadonlyArray<string>
  /** Robots directive (e.g. `'index, follow'`). */
  readonly robots?: string
  /**
   * Content-Security-Policy emitted as a `<meta http-equiv>` (I-GEN-20).
   * `undefined` → emit the generator's default strict policy.
   * `false` → omit the meta tag entirely.
   * `string` → emit verbatim as the policy value.
   */
  readonly csp?: false | string
}

// ---------------------------------------------------------------------------
// Runtime flags
// ---------------------------------------------------------------------------

/**
 * Toggles for the opt-in runtime snippets emitted into output. Every flag
 * defaults to `false`; an all-false document produces zero `<script>` tags
 * (I-GEN-15 DoD).
 */
export interface RuntimeFlags {
  readonly themeToggle: boolean
  readonly scrollSpy: boolean
  readonly smoothScroll: boolean
  readonly mobileNav: boolean
  readonly navOnScroll: boolean
  readonly reveals: boolean
  readonly animationGating: boolean
  readonly terminalTyping: boolean
}

// ---------------------------------------------------------------------------
// Variables, assets, settings
// ---------------------------------------------------------------------------

/**
 * Author-defined `{{variable}}` substitutions (I-DOC-08). Interpolated in
 * text content and string attribute values at emit time.
 */
export type DocumentVariables = Readonly<Record<string, string>>

/**
 * Manifest entry produced by the image upload pipeline (C11). The
 * generator consumes this to emit `srcset` + `width`/`height` on `<img>`.
 */
export interface AssetManifestEntry {
  readonly id: AssetId
  readonly mimeType: string
  readonly originalFilename: string
  readonly width: number
  readonly height: number
  /** Map of intrinsic width → relative path (e.g. `400 → 'assets/foo-400.webp'`). */
  readonly srcset: Readonly<Record<number, string>>
}

/**
 * Single decorative pseudo-element. Emitted by the generator as either
 * `body::before` or `body::after` (I-GEN-09) when the author has opted
 * in via `DocumentSettings.decorativeBackdrop`. The element is full-
 * bleed, pointer-events: none, and lives behind page content
 * (`z-index: -1`), so it cannot interfere with focus or hit-testing.
 *
 * Designed for grid overlays, noise textures, animated gradients,
 * subtle vignettes — anything that should sit behind the page without
 * needing a real DOM element.
 */
export interface DecorativePseudoElement {
  /** Background layers — same shape as element-level backgrounds (I-GEN-09). */
  readonly background?: ReadonlyArray<BackgroundLayer>
  /** Optional opacity override (0..1). */
  readonly opacity?: number
  /** CSS `mix-blend-mode` (useful for noise textures). */
  readonly mixBlendMode?: string
  /** Optional `mask-image` for cut-out effects. */
  readonly maskImage?: string
  /** Optional `filter` (e.g. `blur(40px)`). */
  readonly filter?: string
}

/** Per-document author settings; mostly editor-facing toggles. */
export interface DocumentSettings {
  /** WCAG contrast target enforced by validation (I-DOC-05). */
  readonly contrastTarget: 'AA' | 'AAA'
  /** Initial theme when no `data-theme` is present in the output. */
  readonly defaultTheme: 'auto' | 'light' | 'dark'
  /** Show the canvas grid overlay; non-emitted. */
  readonly gridVisible: boolean
  /** Spacing scale base unit; informational. */
  readonly baseUnit?: number
  /**
   * Optional decorative `body::before` / `body::after` pseudo-elements
   * (I-GEN-09). Both omitted → no pseudo-element rules emitted.
   */
  readonly decorativeBackdrop?: {
    readonly before?: DecorativePseudoElement
    readonly after?: DecorativePseudoElement
  }
}

/** Document-level metadata. Timestamps are ISO-8601 UTC strings. */
export interface DocumentMeta {
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ---------------------------------------------------------------------------
// Document — the root persisted shape
// ---------------------------------------------------------------------------

/**
 * Root document. This is the entire persistable state of a project; the
 * `.dtw` file is `JSON.stringify(document)` and nothing else.
 *
 * Invariants enforced by validation (I-DOC-05):
 *   - Exactly one `<h1>` reachable from `tree`.
 *   - Every `ImageNode.alt` is present (empty string allowed).
 *   - Every `TokenRef` resolves against `tokens`.
 *   - No duplicate `ElementId` values.
 */
export interface Document {
  readonly version: DocumentVersion
  readonly meta: DocumentMeta
  readonly tokens: Tokens
  readonly tree: ElementNode
  readonly seo: SEOConfig
  readonly runtime: RuntimeFlags
  readonly variables: DocumentVariables
  readonly settings: DocumentSettings
  readonly assets: Readonly<Record<AssetId, AssetManifestEntry>>
}
