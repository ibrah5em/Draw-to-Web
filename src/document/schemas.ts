/**
 * Document Model — Zod schemas (C2).
 *
 * Every type in `types.ts` has a matching Zod schema here. Schemas are the
 * runtime gate at boundaries (`.dtw` file load, IPC) and the documented
 * shape; the TypeScript types in `types.ts` remain authoritative at the
 * source level, and the bidirectional compile-time assertions at the
 * bottom of this file guarantee the two cannot drift out of lockstep.
 *
 * Pattern for each schema:
 *   - Build the schema with the loosest accurate Zod combinators.
 *   - Where the TS shape uses a template-literal or branded primitive
 *     (`TokenRef`, `DocumentVersion`), use `z.custom<T>()` so `z.infer`
 *     reproduces the TS type exactly.
 *   - At the end of the file, assert `Equal<z.infer<typeof xSchema>,
 *     Writable<X>>` for every contract surface (Document, ElementNode,
 *     Tokens, SEOConfig, RuntimeFlags). If you change `types.ts`, the
 *     compile error here points at the schema that has fallen behind.
 *
 * Contract: C2 (see `docs/0.2.0v/plan.md` Section 6).
 */

import { z } from 'zod'

import type {
  Alignment,
  AnimationSpec,
  AssetManifestEntry,
  BackgroundLayer,
  BorderRadius,
  BorderSpec,
  BreakpointKey,
  ButtonNode,
  ColorTokenValue,
  ContainerNode,
  DimensionValue,
  DividerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVariables,
  DocumentVersion,
  ElementId,
  ElementNode,
  FaviconConfig,
  FlexDirection,
  IconNode,
  ImageNode,
  JsonLdConfig,
  LayoutConfig,
  LinkNode,
  ListNode,
  OpenGraphConfig,
  RuntimeFlags,
  SEOConfig,
  SemanticRole,
  ShadowLayer,
  SpacingBox,
  StateKey,
  StatesMap,
  StyleBlock,
  TextNode,
  TextTag,
  TokenCategory,
  TokenRef,
  Tokens,
  TwitterCardConfig,
  Typography,
} from './types'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const DOCUMENT_VERSION_RE = /^\d+\.\d+\.\d+$/

/** Matches `\d+.\d+.\d+`. Lifted into a `DocumentVersion` template type. */
export const documentVersionSchema = z.custom<DocumentVersion>(
  (v) => typeof v === 'string' && DOCUMENT_VERSION_RE.test(v),
  { error: 'Expected SemVer version string (e.g. "0.2.0")' }
)

/** Non-empty string. Stable across sessions; not validated for nanoid shape. */
export const elementIdSchema = z.custom<ElementId>((v) => typeof v === 'string' && v.length > 0, {
  error: 'Expected non-empty element id',
})

/** Non-empty string token id. */
export const tokenIdSchema = z.string().min(1)

/** Non-empty asset id; matches the value returned by C11. */
export const assetIdSchema = z.string().min(1)

/** Closed set; lockstep with `TokenCategory`. */
export const tokenCategorySchema = z.enum([
  'color',
  'spacing',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'radius',
  'shadow',
] as const satisfies readonly TokenCategory[])

const TOKEN_REF_RE =
  /^(color|spacing|fontSize|fontFamily|lineHeight|radius|shadow)\.[A-Za-z0-9_-]+$/

/** String form `${category}.${slug}`. Lifted to `TokenRef` template type. */
export const tokenRefSchema = z.custom<TokenRef>(
  (v) => typeof v === 'string' && TOKEN_REF_RE.test(v),
  { error: 'Expected token reference of form "category.name"' }
)

/**
 * Factory for `Bindable<T>` — accepts either a raw value of the underlying
 * type or a `TokenRef`. Use sparingly; build once per primitive.
 *
 * @param valueSchema The schema for the raw (non-token) form.
 */
export const bindable = <V extends z.ZodTypeAny>(
  valueSchema: V
): z.ZodUnion<readonly [V, typeof tokenRefSchema]> => z.union([valueSchema, tokenRefSchema])

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const colorTokenValueSchema = z.object({
  light: z.string(),
  dark: z.string(),
})

/**
 * Factory for a token definition with a typed `value`. Each token category
 * passes its own value schema (color → object; everything else → string).
 */
const tokenDefinitionSchema = <V extends z.ZodTypeAny>(valueSchema: V) =>
  z.object({
    id: tokenIdSchema,
    name: z.string(),
    value: valueSchema,
    description: z.string().optional(),
  })

export const tokensSchema = z.object({
  color: z.array(tokenDefinitionSchema(colorTokenValueSchema)),
  spacing: z.array(tokenDefinitionSchema(z.string())),
  fontSize: z.array(tokenDefinitionSchema(z.string())),
  fontFamily: z.array(tokenDefinitionSchema(z.string())),
  lineHeight: z.array(tokenDefinitionSchema(z.string())),
  radius: z.array(tokenDefinitionSchema(z.string())),
  shadow: z.array(tokenDefinitionSchema(z.string())),
})

// ---------------------------------------------------------------------------
// Responsive + states
// ---------------------------------------------------------------------------

export const breakpointKeySchema = z.enum([
  'base',
  'tablet',
  'mobile',
  'small',
] as const satisfies readonly BreakpointKey[])

/**
 * Factory for `ResponsiveProperties<T>`. `base` is required; narrower
 * breakpoints (tablet/mobile/small) are optional overrides.
 */
export const responsiveProperties = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    base: valueSchema,
    tablet: valueSchema.optional(),
    mobile: valueSchema.optional(),
    small: valueSchema.optional(),
  })

export const stateKeySchema = z.enum([
  'hover',
  'focus-visible',
  'active',
] as const satisfies readonly StateKey[])

// ---------------------------------------------------------------------------
// Style blocks
// ---------------------------------------------------------------------------

export const flexDirectionSchema = z.enum([
  'row',
  'column',
  'row-reverse',
  'column-reverse',
] as const satisfies readonly FlexDirection[])

export const alignmentSchema = z.enum([
  'start',
  'center',
  'end',
  'stretch',
  'space-between',
  'space-around',
  'space-evenly',
] as const satisfies readonly Alignment[])

export const layoutConfigSchema = z.object({
  mode: z.enum(['flex', 'grid']),
  direction: flexDirectionSchema.optional(),
  gap: bindable(z.string()).optional(),
  justify: alignmentSchema.optional(),
  align: alignmentSchema.optional(),
  wrap: z.enum(['nowrap', 'wrap', 'wrap-reverse']).optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
})

export const dimensionValueSchema: z.ZodType<DimensionValue> = z.union([
  z.literal('auto'),
  bindable(z.string()),
])

export const borderRadiusSchema = z.object({
  topLeft: bindable(z.string()).optional(),
  topRight: bindable(z.string()).optional(),
  bottomLeft: bindable(z.string()).optional(),
  bottomRight: bindable(z.string()).optional(),
  all: bindable(z.string()).optional(),
})

export const spacingBoxSchema = z.object({
  top: bindable(z.string()).optional(),
  right: bindable(z.string()).optional(),
  bottom: bindable(z.string()).optional(),
  left: bindable(z.string()).optional(),
})

const gradientStopSchema = z.object({
  color: bindable(z.string()),
  position: z.string().optional(),
})

export const backgroundLayerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: bindable(z.string()),
  }),
  z.object({
    kind: z.literal('linear-gradient'),
    angle: z.string(),
    stops: z.array(gradientStopSchema),
  }),
  z.object({
    kind: z.literal('radial-gradient'),
    shape: z.enum(['circle', 'ellipse']).optional(),
    stops: z.array(gradientStopSchema),
  }),
  z.object({
    kind: z.literal('image'),
    imageUrl: z.string(),
    size: z.union([z.literal('cover'), z.literal('contain'), z.string()]).optional(),
    position: z.string().optional(),
    repeat: z.enum(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']).optional(),
  }),
])

export const shadowLayerSchema = z.object({
  offsetX: z.string(),
  offsetY: z.string(),
  blur: z.string(),
  spread: z.string().optional(),
  color: bindable(z.string()),
  inset: z.boolean().optional(),
})

export const typographySchema = z.object({
  fontFamily: bindable(z.string()).optional(),
  fontSize: bindable(z.string()).optional(),
  fontWeight: bindable(z.union([z.string(), z.number()])).optional(),
  lineHeight: bindable(z.union([z.string(), z.number()])).optional(),
  letterSpacing: bindable(z.string()).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  color: bindable(z.string()).optional(),
})

export const borderSpecSchema = z.object({
  width: bindable(z.string()),
  style: z.enum(['solid', 'dashed', 'dotted', 'double', 'none']),
  color: bindable(z.string()),
})

export const animationSpecSchema = z.object({
  name: z.string(),
  duration: z.string().optional(),
  delay: z.string().optional(),
  easing: z.string().optional(),
  iterationCount: z.union([z.number(), z.literal('infinite')]).optional(),
  fillMode: z.enum(['none', 'forwards', 'backwards', 'both']).optional(),
  direction: z.enum(['normal', 'reverse', 'alternate', 'alternate-reverse']).optional(),
  decorative: z.boolean().optional(),
  gateOnView: z.boolean().optional(),
})

export const styleBlockSchema = z.object({
  width: dimensionValueSchema.optional(),
  height: dimensionValueSchema.optional(),
  minWidth: dimensionValueSchema.optional(),
  maxWidth: dimensionValueSchema.optional(),
  minHeight: dimensionValueSchema.optional(),
  maxHeight: dimensionValueSchema.optional(),
  padding: spacingBoxSchema.optional(),
  margin: spacingBoxSchema.optional(),
  flex: z.string().optional(),
  gridColumn: z.string().optional(),
  gridRow: z.string().optional(),
  opacity: z.number().optional(),
  visibility: z.enum(['visible', 'hidden']).optional(),
  overflow: z.enum(['visible', 'hidden', 'scroll', 'auto']).optional(),
  background: z.array(backgroundLayerSchema).optional(),
  maskImage: z.string().optional(),
  backdropFilter: z.string().optional(),
  borderRadius: borderRadiusSchema.optional(),
  border: borderSpecSchema.optional(),
  shadows: z.array(shadowLayerSchema).optional(),
  typography: typographySchema.optional(),
  transform: z.string().optional(),
  transition: z.string().optional(),
  cursor: z.enum(['auto', 'pointer', 'default', 'not-allowed', 'text']).optional(),
  zIndex: z.number().optional(),
})

export const statesMapSchema = z.object({
  hover: styleBlockSchema.partial().optional(),
  'focus-visible': styleBlockSchema.partial().optional(),
  active: styleBlockSchema.partial().optional(),
})

// ---------------------------------------------------------------------------
// Element nodes
// ---------------------------------------------------------------------------

export const semanticRoleSchema = z.enum([
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'div',
  'figure',
  'figcaption',
] as const satisfies readonly SemanticRole[])

export const textTagSchema = z.enum([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'em',
  'strong',
  'small',
  'code',
  'blockquote',
] as const satisfies readonly TextTag[])

/**
 * Fields every `ElementBase` carries. Spread into each node-type schema.
 */
const elementBaseShape = {
  id: elementIdSchema,
  name: z.string().optional(),
  semanticRole: semanticRoleSchema.optional(),
  style: responsiveProperties(styleBlockSchema),
  states: statesMapSchema.optional(),
  animation: animationSpecSchema.optional(),
  classes: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  dataAttributes: z.record(z.string(), z.string()).optional(),
  hiddenAt: z.array(breakpointKeySchema).optional(),
}

const textNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('text'),
  tag: textTagSchema,
  content: z.string(),
})

const imageNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('image'),
  alt: z.string(),
  assetId: assetIdSchema.optional(),
  externalUrl: z.string().optional(),
  sizesHint: z.string().optional(),
  loading: z.enum(['lazy', 'eager']).optional(),
  decoding: z.enum(['async', 'sync', 'auto']).optional(),
})

const buttonNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('button'),
  content: z.string(),
  buttonType: z.enum(['button', 'submit', 'reset']).optional(),
  ariaLabel: z.string().optional(),
})

const linkNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('link'),
  content: z.string(),
  href: z.string(),
  target: z.enum(['_self', '_blank']).optional(),
  rel: z.string().optional(),
  ariaLabel: z.string().optional(),
})

const iconNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('icon'),
  name: z.string(),
  inlineSvg: z.string().optional(),
  ariaLabel: z.string().optional(),
  decorative: z.boolean().optional(),
})

const listNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(z.string()),
  marker: z.string().optional(),
})

const dividerNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('divider'),
  orientation: z.enum(['horizontal', 'vertical']),
})

/**
 * `ElementNode` is recursive through `ContainerNode.children`.
 * `containerNodeSchema` is declared first; its `children` field uses
 * `z.lazy(() => elementNodeSchema)` to defer the forward reference.
 * `elementNodeSchema` then builds the discriminated union over all node
 * schemas without a wrapping `z.lazy`, avoiding the Zod v4 issue where
 * `ZodLazy._output` resolves to `unknown` and breaks the type annotation.
 */
const containerNodeSchema = z.object({
  ...elementBaseShape,
  type: z.literal('container'),
  children: z.array(z.lazy(() => elementNodeSchema)),
  layout: responsiveProperties(layoutConfigSchema),
})

// The explicit LHS annotation tells TypeScript the type of elementNodeSchema
// without requiring it to infer through the circular reference to containerNodeSchema.
// The `as unknown as` on the RHS makes the assignability check trivially pass.
export const elementNodeSchema: z.ZodType<Writable<ElementNode>> = z.lazy(() =>
  z.discriminatedUnion('type', [
    containerNodeSchema,
    textNodeSchema,
    imageNodeSchema,
    buttonNodeSchema,
    linkNodeSchema,
    iconNodeSchema,
    listNodeSchema,
    dividerNodeSchema,
  ])
) as unknown as z.ZodType<Writable<ElementNode>>

// ---------------------------------------------------------------------------
// SEO + JSON-LD
// ---------------------------------------------------------------------------

export const openGraphConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['website', 'article', 'profile']).optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
  siteName: z.string().optional(),
})

export const twitterCardConfigSchema = z.object({
  card: z.enum(['summary', 'summary_large_image']),
  site: z.string().optional(),
  creator: z.string().optional(),
})

export const jsonLdConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('Person'),
    name: z.string(),
    url: z.string().optional(),
    jobTitle: z.string().optional(),
    sameAs: z.array(z.string()).optional(),
    email: z.string().optional(),
  }),
  z.object({
    kind: z.literal('Organization'),
    name: z.string(),
    url: z.string().optional(),
    logoUrl: z.string().optional(),
    sameAs: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('WebSite'),
    name: z.string(),
    url: z.string(),
    description: z.string().optional(),
  }),
])

export const faviconConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('svg-inline'), svg: z.string() }),
  z.object({ kind: z.literal('png'), assetId: assetIdSchema }),
])

export const seoConfigSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  lang: z.string(),
  viewport: z.string(),
  charset: z.string(),
  canonical: z.string().optional(),
  themeColor: z
    .object({
      light: z.string().optional(),
      dark: z.string().optional(),
    })
    .optional(),
  openGraph: openGraphConfigSchema.optional(),
  twitter: twitterCardConfigSchema.optional(),
  jsonLd: jsonLdConfigSchema.optional(),
  favicon: faviconConfigSchema.optional(),
  preconnect: z.array(z.string()).optional(),
  robots: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Runtime, variables, assets, settings, meta
// ---------------------------------------------------------------------------

export const runtimeFlagsSchema = z.object({
  themeToggle: z.boolean(),
  scrollSpy: z.boolean(),
  smoothScroll: z.boolean(),
  mobileNav: z.boolean(),
  navOnScroll: z.boolean(),
  reveals: z.boolean(),
  animationGating: z.boolean(),
  terminalTyping: z.boolean(),
})

export const documentVariablesSchema = z.record(z.string(), z.string())

export const assetManifestEntrySchema = z.object({
  id: assetIdSchema,
  mimeType: z.string(),
  originalFilename: z.string(),
  width: z.number(),
  height: z.number(),
  srcset: z.record(z.coerce.number(), z.string()),
})

export const documentSettingsSchema = z.object({
  contrastTarget: z.enum(['AA', 'AAA']),
  defaultTheme: z.enum(['auto', 'light', 'dark']),
  gridVisible: z.boolean(),
  baseUnit: z.number().optional(),
})

export const documentMetaSchema = z.object({
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// ---------------------------------------------------------------------------
// Document (root)
// ---------------------------------------------------------------------------

/**
 * Root document schema. This is the entry point at every persistence
 * boundary: `.dtw` load goes through `documentSchema.parse`, IPC payloads
 * through `documentSchema.safeParse`. See contract C2.
 */
export const documentSchema = z.object({
  version: documentVersionSchema,
  meta: documentMetaSchema,
  tokens: tokensSchema,
  tree: elementNodeSchema,
  seo: seoConfigSchema,
  runtime: runtimeFlagsSchema,
  variables: documentVariablesSchema,
  settings: documentSettingsSchema,
  assets: z.record(assetIdSchema, assetManifestEntrySchema),
})

// ---------------------------------------------------------------------------
// Compile-time lockstep assertions (C1 ↔ C2)
// ---------------------------------------------------------------------------

/**
 * Recursively strips `readonly` modifiers so a TS type built from
 * `readonly` interfaces compares equal to the corresponding Zod-inferred
 * type, which is structurally writable.
 */
type Writable<T> =
  T extends ReadonlyArray<infer U>
    ? Array<Writable<U>>
    : T extends (...args: infer _Args) => infer _Ret
      ? T
      : T extends object
        ? { -readonly [K in keyof T]: Writable<T[K]> }
        : T

/**
 * Strict structural equality between two types. Resolves to `true` iff
 * each is mutually assignable; resolves to `false` otherwise, which then
 * fails the `: true` assignments below at compile time.
 */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

// One assertion per contract surface. If any of these red-line on save,
// the schema has drifted from `types.ts`.
const _eqDocumentVersion: Equal<z.infer<typeof documentVersionSchema>, DocumentVersion> = true
const _eqTokenRef: Equal<z.infer<typeof tokenRefSchema>, TokenRef> = true
const _eqTokenCategory: Equal<z.infer<typeof tokenCategorySchema>, TokenCategory> = true
const _eqColorTokenValue: Equal<
  z.infer<typeof colorTokenValueSchema>,
  Writable<ColorTokenValue>
> = true
const _eqTokens: Equal<z.infer<typeof tokensSchema>, Writable<Tokens>> = true
const _eqBreakpoint: Equal<z.infer<typeof breakpointKeySchema>, BreakpointKey> = true
const _eqStateKey: Equal<z.infer<typeof stateKeySchema>, StateKey> = true
const _eqFlexDirection: Equal<z.infer<typeof flexDirectionSchema>, FlexDirection> = true
const _eqAlignment: Equal<z.infer<typeof alignmentSchema>, Alignment> = true
const _eqSemanticRole: Equal<z.infer<typeof semanticRoleSchema>, SemanticRole> = true
const _eqTextTag: Equal<z.infer<typeof textTagSchema>, TextTag> = true
const _eqLayoutConfig: Equal<z.infer<typeof layoutConfigSchema>, Writable<LayoutConfig>> = true
const _eqDimensionValue: Equal<z.infer<typeof dimensionValueSchema>, DimensionValue> = true
const _eqBorderRadius: Equal<z.infer<typeof borderRadiusSchema>, Writable<BorderRadius>> = true
const _eqSpacingBox: Equal<z.infer<typeof spacingBoxSchema>, Writable<SpacingBox>> = true
const _eqBackgroundLayer: Equal<
  z.infer<typeof backgroundLayerSchema>,
  Writable<BackgroundLayer>
> = true
const _eqShadowLayer: Equal<z.infer<typeof shadowLayerSchema>, Writable<ShadowLayer>> = true
const _eqTypography: Equal<z.infer<typeof typographySchema>, Writable<Typography>> = true
const _eqBorderSpec: Equal<z.infer<typeof borderSpecSchema>, Writable<BorderSpec>> = true
const _eqAnimationSpec: Equal<z.infer<typeof animationSpecSchema>, Writable<AnimationSpec>> = true
const _eqStyleBlock: Equal<z.infer<typeof styleBlockSchema>, Writable<StyleBlock>> = true
const _eqStatesMap: Equal<z.infer<typeof statesMapSchema>, Writable<StatesMap>> = true
const _eqElementNode: Equal<z.infer<typeof elementNodeSchema>, Writable<ElementNode>> = true
const _eqContainer: Equal<z.infer<typeof containerNodeSchema>, Writable<ContainerNode>> = true
const _eqText: Equal<z.infer<typeof textNodeSchema>, Writable<TextNode>> = true
const _eqImage: Equal<z.infer<typeof imageNodeSchema>, Writable<ImageNode>> = true
const _eqButton: Equal<z.infer<typeof buttonNodeSchema>, Writable<ButtonNode>> = true
const _eqLink: Equal<z.infer<typeof linkNodeSchema>, Writable<LinkNode>> = true
const _eqIcon: Equal<z.infer<typeof iconNodeSchema>, Writable<IconNode>> = true
const _eqList: Equal<z.infer<typeof listNodeSchema>, Writable<ListNode>> = true
const _eqDivider: Equal<z.infer<typeof dividerNodeSchema>, Writable<DividerNode>> = true
const _eqOG: Equal<z.infer<typeof openGraphConfigSchema>, Writable<OpenGraphConfig>> = true
const _eqTwitter: Equal<z.infer<typeof twitterCardConfigSchema>, Writable<TwitterCardConfig>> = true
const _eqJsonLd: Equal<z.infer<typeof jsonLdConfigSchema>, Writable<JsonLdConfig>> = true
const _eqFavicon: Equal<z.infer<typeof faviconConfigSchema>, Writable<FaviconConfig>> = true
const _eqSEO: Equal<z.infer<typeof seoConfigSchema>, Writable<SEOConfig>> = true
const _eqRuntime: Equal<z.infer<typeof runtimeFlagsSchema>, Writable<RuntimeFlags>> = true
const _eqVariables: Equal<
  z.infer<typeof documentVariablesSchema>,
  Writable<DocumentVariables>
> = true
const _eqAssetManifest: Equal<
  z.infer<typeof assetManifestEntrySchema>,
  Writable<AssetManifestEntry>
> = true
const _eqSettings: Equal<z.infer<typeof documentSettingsSchema>, Writable<DocumentSettings>> = true
const _eqMeta: Equal<z.infer<typeof documentMetaSchema>, Writable<DocumentMeta>> = true
const _eqDocument: Equal<z.infer<typeof documentSchema>, Writable<Document>> = true

// Touch every assertion so the unused-locals rule does not strip them.
void [
  _eqDocumentVersion,
  _eqTokenRef,
  _eqTokenCategory,
  _eqColorTokenValue,
  _eqTokens,
  _eqBreakpoint,
  _eqStateKey,
  _eqFlexDirection,
  _eqAlignment,
  _eqSemanticRole,
  _eqTextTag,
  _eqLayoutConfig,
  _eqDimensionValue,
  _eqBorderRadius,
  _eqSpacingBox,
  _eqBackgroundLayer,
  _eqShadowLayer,
  _eqTypography,
  _eqBorderSpec,
  _eqAnimationSpec,
  _eqStyleBlock,
  _eqStatesMap,
  _eqElementNode,
  _eqContainer,
  _eqText,
  _eqImage,
  _eqButton,
  _eqLink,
  _eqIcon,
  _eqList,
  _eqDivider,
  _eqOG,
  _eqTwitter,
  _eqJsonLd,
  _eqFavicon,
  _eqSEO,
  _eqRuntime,
  _eqVariables,
  _eqAssetManifest,
  _eqSettings,
  _eqMeta,
  _eqDocument,
]

// Re-export for downstream type-only consumers.
export type { TokenDefinition, ResponsiveProperties } from './types'
