/**
 * CSS emitter (I-GEN-03..08).
 *
 * Walks a `Document` and produces a stylesheet that:
 *
 *   - opens with a minimal modern reset.
 *   - emits `:root { --token: value; }` for every token in `document.tokens`
 *     (I-GEN-04) and a `:root[data-theme="dark"] { ... }` override block for
 *     colour tokens (the only category that themes).
 *   - emits `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ... } }`
 *     so the OS preference wins until the user toggles a stored theme
 *     (I-GEN-06).
 *   - scopes every element rule to `.dtw-el-{id}` and references tokens via
 *     `var(--name)` (I-GEN-05) — raw values are only emitted for unbound
 *     properties.
 *   - emits one `@media (max-width: ...)` block per breakpoint key with the
 *     element rules whose `responsive[bp]` carries an override (I-GEN-08).
 *   - emits `:hover` / `:focus-visible` / `:active` rule blocks containing
 *     only the properties each state overrides (I-GEN-07).
 *
 * Layout is Flex / Grid / clamp() only — no `position: absolute` (Invariant
 * 5.4 in plan.md). A regex guard in `tests/generator/determinism.test.ts`
 * enforces the no-`position: absolute` rule on every generated stylesheet.
 */

import type {
  AnimationSpec,
  BackgroundLayer,
  BorderRadius,
  BorderSpec,
  BreakpointKey,
  DecorativePseudoElement,
  Document,
  ElementNode,
  LayoutConfig,
  ResponsiveProperties,
  ShadowLayer,
  SpacingBox,
  StateKey,
  StyleBlock,
  TokenCategory,
  Tokens,
  Typography,
} from '../document/types'
import { isTokenRef } from '../document/tokens'

const INDENT = '  '

/** Order in which breakpoint blocks are emitted. Wider queries first per CSS specificity rules. */
const BREAKPOINT_ORDER: ReadonlyArray<Exclude<BreakpointKey, 'base'>> = [
  'tablet',
  'mobile',
  'small',
]

/**
 * Order in which state pseudo-class blocks are emitted. Fixed so the
 * generator stays deterministic — `:active` last matches the LVHA
 * convention (interactive states cascade in that order).
 */
const STATE_ORDER: ReadonlyArray<StateKey> = ['hover', 'focus-visible', 'active']

/** Max-width pixel threshold for each breakpoint (matches I-DOC type docs). */
const BREAKPOINT_MAX_WIDTH: Readonly<Record<Exclude<BreakpointKey, 'base'>, number>> = {
  tablet: 1024,
  mobile: 768,
  small: 480,
}

/** CSS custom-property prefix per token category. */
const TOKEN_PREFIX: Readonly<Record<TokenCategory, string>> = {
  color: 'color',
  spacing: 'space',
  fontSize: 'font-size',
  fontFamily: 'font-family',
  lineHeight: 'line-height',
  radius: 'radius',
  shadow: 'shadow',
}

const CSS_RESET = `*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  text-size-adjust: 100%;
}

body {
  min-height: 100vh;
  line-height: 1.5;
  font-family: var(--font-family-body, system-ui, sans-serif);
}

img,
picture,
svg,
video {
  display: block;
  max-width: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

a {
  color: inherit;
}

.dtw-skip-link {
  position: fixed;
  top: 0;
  left: 0;
  padding: 8px 12px;
  background: #000;
  color: #fff;
  text-decoration: none;
  z-index: 9999;
  transform: translateY(-200%);
  transition: transform 120ms ease;
}

.dtw-skip-link:focus {
  transform: translateY(0);
}`

// ---------------------------------------------------------------------------
// Keyframe library (I-GEN-11)
// ---------------------------------------------------------------------------

/**
 * Built-in keyframe library. The generator owns these so authors only
 * reference an animation by name on `element.animation` and the runtime
 * concerns (timing, decoration flag, gate-on-view) flow through one
 * place. Order is stable — entries are emitted in array order so the
 * output stays deterministic regardless of which animations the document
 * happens to use.
 *
 * `defaultDecorative` controls the default classification of each
 * animation when the author has not explicitly set `decorative` on the
 * `AnimationSpec`. Anything decorative is disabled under
 * `prefers-reduced-motion: reduce`. Truly essential motion (e.g. focus
 * affordances) should opt out by setting `decorative: false`.
 */
interface KeyframeDef {
  readonly name: string
  readonly body: string
  readonly defaultDecorative: boolean
}

const KEYFRAME_LIBRARY: ReadonlyArray<KeyframeDef> = [
  {
    name: 'fadeUp',
    defaultDecorative: true,
    body: `from {
  opacity: 0;
  transform: translateY(16px);
}
to {
  opacity: 1;
  transform: translateY(0);
}`,
  },
  {
    name: 'pulse-dot',
    defaultDecorative: true,
    body: `0%,
100% {
  transform: scale(1);
  opacity: 1;
}
50% {
  transform: scale(1.08);
  opacity: 0.85;
}`,
  },
  {
    name: 'blink-cursor',
    defaultDecorative: true,
    body: `0%,
100% {
  opacity: 1;
}
50% {
  opacity: 0;
}`,
  },
  {
    name: 'typing-line',
    defaultDecorative: true,
    body: `from {
  width: 0;
}
to {
  width: 100%;
}`,
  },
  {
    name: 'shimmer',
    defaultDecorative: true,
    body: `from {
  background-position: 200% 0;
}
to {
  background-position: -200% 0;
}`,
  },
  {
    name: 'accent-glow',
    defaultDecorative: true,
    body: `0%,
100% {
  box-shadow: 0 0 0 0 var(--color-accent, currentColor);
}
50% {
  box-shadow: 0 0 24px 4px var(--color-accent, currentColor);
}`,
  },
]

/** Lookup keyed by name for fast `isDecorative` resolution. */
const KEYFRAME_BY_NAME: ReadonlyMap<string, KeyframeDef> = new Map(
  KEYFRAME_LIBRARY.map((k) => [k.name, k])
)

// ---------------------------------------------------------------------------
// Helpers — token-aware value rendering
// ---------------------------------------------------------------------------

/**
 * Render a value that may be either a literal string/number or a token
 * reference. Token refs become `var(--<prefix>-<id>)`; literals are
 * returned verbatim.
 */
function renderValue<T extends string | number>(value: T): string {
  if (typeof value === 'string' && isTokenRef(value)) {
    const dot = value.indexOf('.')
    const category = value.slice(0, dot) as TokenCategory
    const id = value.slice(dot + 1)
    return `var(--${TOKEN_PREFIX[category]}-${id})`
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// Tokens block (I-GEN-04, I-GEN-05, I-GEN-06)
// ---------------------------------------------------------------------------

interface TokenSlot {
  readonly name: string
  readonly light: string
  /** Only colour tokens have a separate dark value. */
  readonly dark?: string
}

function collectTokens(tokens: Tokens): readonly TokenSlot[] {
  const slots: TokenSlot[] = []
  for (const t of tokens.color) {
    slots.push({
      name: `--${TOKEN_PREFIX.color}-${t.id}`,
      light: t.value.light,
      dark: t.value.dark,
    })
  }
  for (const [category, list] of [
    ['spacing', tokens.spacing],
    ['fontSize', tokens.fontSize],
    ['fontFamily', tokens.fontFamily],
    ['lineHeight', tokens.lineHeight],
    ['radius', tokens.radius],
    ['shadow', tokens.shadow],
  ] as const) {
    for (const t of list) {
      slots.push({ name: `--${TOKEN_PREFIX[category as TokenCategory]}-${t.id}`, light: t.value })
    }
  }
  return slots
}

function emitTokensBlock(tokens: Tokens): string {
  const slots = collectTokens(tokens)
  if (slots.length === 0) return ''

  const lightLines = slots.map((s) => `${INDENT}${s.name}: ${s.light};`)
  const root = `:root {\n${lightLines.join('\n')}\n}`

  const darkSlots = slots.filter((s) => s.dark !== undefined)
  if (darkSlots.length === 0) return root

  const darkLines = darkSlots.map((s) => `${INDENT}${s.name}: ${s.dark!};`)
  const explicitDark = `:root[data-theme="dark"] {\n${darkLines.join('\n')}\n}`
  // OS-preference fallback (I-GEN-06): only applies when no explicit theme
  // is set, so a user toggle always wins.
  const osDark = `@media (prefers-color-scheme: dark) {\n${INDENT}:root:not([data-theme]) {\n${darkLines.map((l) => INDENT + l).join('\n')}\n${INDENT}}\n}`

  return [root, explicitDark, osDark].join('\n\n')
}

// ---------------------------------------------------------------------------
// Per-element style emission
// ---------------------------------------------------------------------------

type Declaration = { readonly prop: string; readonly value: string }

function spacingDecls(prop: 'padding' | 'margin', box: SpacingBox): Declaration[] {
  const out: Declaration[] = []
  if (box.top !== undefined) out.push({ prop: `${prop}-top`, value: renderValue(box.top) })
  if (box.right !== undefined) out.push({ prop: `${prop}-right`, value: renderValue(box.right) })
  if (box.bottom !== undefined) out.push({ prop: `${prop}-bottom`, value: renderValue(box.bottom) })
  if (box.left !== undefined) out.push({ prop: `${prop}-left`, value: renderValue(box.left) })
  return out
}

function radiusDecls(r: BorderRadius): Declaration[] {
  if (r.all !== undefined) return [{ prop: 'border-radius', value: renderValue(r.all) }]
  const out: Declaration[] = []
  if (r.topLeft !== undefined)
    out.push({ prop: 'border-top-left-radius', value: renderValue(r.topLeft) })
  if (r.topRight !== undefined)
    out.push({ prop: 'border-top-right-radius', value: renderValue(r.topRight) })
  if (r.bottomLeft !== undefined)
    out.push({ prop: 'border-bottom-left-radius', value: renderValue(r.bottomLeft) })
  if (r.bottomRight !== undefined)
    out.push({ prop: 'border-bottom-right-radius', value: renderValue(r.bottomRight) })
  return out
}

function borderDecls(b: BorderSpec): Declaration[] {
  if (b.style === 'none') return [{ prop: 'border', value: 'none' }]
  return [
    {
      prop: 'border',
      value: `${renderValue(b.width)} ${b.style} ${renderValue(b.color)}`,
    },
  ]
}

/**
 * Render an `AnimationSpec` as `animation` shorthand declarations.
 * Includes `animation-play-state: paused` when `gateOnView` is true so
 * the runtime (I-RUN-07) only has to flip it to `running` once the
 * element scrolls into view.
 */
function animationDecls(spec: AnimationSpec): Declaration[] {
  const duration = spec.duration ?? '600ms'
  const easing = spec.easing ?? 'ease'
  const delay = spec.delay ?? '0ms'
  const iter = spec.iterationCount === undefined ? '1' : String(spec.iterationCount)
  const fill = spec.fillMode ?? 'both'
  const direction = spec.direction ?? 'normal'
  const out: Declaration[] = [
    {
      prop: 'animation',
      value: `${spec.name} ${duration} ${easing} ${delay} ${iter} ${direction} ${fill}`,
    },
  ]
  if (spec.gateOnView === true) {
    out.push({ prop: 'animation-play-state', value: 'paused' })
  }
  return out
}

/**
 * True when this animation should be disabled under
 * `prefers-reduced-motion: reduce`. The author's explicit `decorative`
 * flag wins; otherwise we defer to the keyframe library's default.
 * Unknown keyframe names are treated as decorative (conservative — if
 * the animation isn't ours, assume removing it is safer than running it
 * for motion-sensitive users).
 */
function isAnimationDecorative(spec: AnimationSpec): boolean {
  if (spec.decorative !== undefined) return spec.decorative
  return KEYFRAME_BY_NAME.get(spec.name)?.defaultDecorative ?? true
}

function shadowDecls(layers: ReadonlyArray<ShadowLayer>): Declaration[] {
  if (layers.length === 0) return []
  const parts = layers.map((l) => {
    const insetPrefix = l.inset ? 'inset ' : ''
    const spread = l.spread ?? '0'
    return `${insetPrefix}${l.offsetX} ${l.offsetY} ${l.blur} ${spread} ${renderValue(l.color)}`
  })
  return [{ prop: 'box-shadow', value: parts.join(', ') }]
}

function backgroundDecls(layers: ReadonlyArray<BackgroundLayer>): Declaration[] {
  if (layers.length === 0) return []
  // Single-layer solid colours collapse to the cleaner `background-color`.
  if (layers.length === 1 && layers[0].kind === 'solid') {
    return [{ prop: 'background-color', value: renderValue(layers[0].color) }]
  }
  const parts = layers.map((layer): string => {
    switch (layer.kind) {
      case 'solid':
        return renderValue(layer.color)
      case 'linear-gradient': {
        const stops = layer.stops.map((s) =>
          s.position ? `${renderValue(s.color)} ${s.position}` : renderValue(s.color)
        )
        return `linear-gradient(${layer.angle}, ${stops.join(', ')})`
      }
      case 'radial-gradient': {
        const stops = layer.stops.map((s) =>
          s.position ? `${renderValue(s.color)} ${s.position}` : renderValue(s.color)
        )
        const shape = layer.shape ?? 'ellipse'
        return `radial-gradient(${shape}, ${stops.join(', ')})`
      }
      case 'image': {
        const size = layer.size ? ` / ${layer.size}` : ''
        const position = layer.position ?? '0 0'
        const repeat = layer.repeat ?? 'no-repeat'
        return `url("${layer.imageUrl}") ${position}${size} ${repeat}`
      }
    }
  })
  return [{ prop: 'background', value: parts.join(', ') }]
}

function typographyDecls(t: Typography): Declaration[] {
  const out: Declaration[] = []
  if (t.fontFamily !== undefined)
    out.push({ prop: 'font-family', value: renderValue(t.fontFamily) })
  if (t.fontSize !== undefined) out.push({ prop: 'font-size', value: renderValue(t.fontSize) })
  if (t.fontWeight !== undefined)
    out.push({ prop: 'font-weight', value: renderValue(t.fontWeight) })
  if (t.lineHeight !== undefined)
    out.push({ prop: 'line-height', value: renderValue(t.lineHeight) })
  if (t.letterSpacing !== undefined)
    out.push({ prop: 'letter-spacing', value: renderValue(t.letterSpacing) })
  if (t.textTransform !== undefined) out.push({ prop: 'text-transform', value: t.textTransform })
  if (t.textAlign !== undefined) out.push({ prop: 'text-align', value: t.textAlign })
  if (t.textDecoration !== undefined) out.push({ prop: 'text-decoration', value: t.textDecoration })
  if (t.fontStyle !== undefined) out.push({ prop: 'font-style', value: t.fontStyle })
  if (t.color !== undefined) out.push({ prop: 'color', value: renderValue(t.color) })
  return out
}

function layoutDecls(layout: LayoutConfig): Declaration[] {
  const out: Declaration[] = []
  if (layout.mode === 'flex') {
    out.push({ prop: 'display', value: 'flex' })
    if (layout.direction !== undefined)
      out.push({ prop: 'flex-direction', value: layout.direction })
    if (layout.wrap !== undefined) out.push({ prop: 'flex-wrap', value: layout.wrap })
  } else {
    out.push({ prop: 'display', value: 'grid' })
    if (layout.gridTemplateColumns !== undefined)
      out.push({ prop: 'grid-template-columns', value: layout.gridTemplateColumns })
    if (layout.gridTemplateRows !== undefined)
      out.push({ prop: 'grid-template-rows', value: layout.gridTemplateRows })
  }
  if (layout.gap !== undefined) out.push({ prop: 'gap', value: renderValue(layout.gap) })
  if (layout.justify !== undefined)
    out.push({ prop: 'justify-content', value: mapAlignment(layout.justify) })
  if (layout.align !== undefined)
    out.push({ prop: 'align-items', value: mapAlignment(layout.align) })
  return out
}

/** CSS-spec values for `start`/`end` differ from our type, so map explicitly. */
function mapAlignment(a: string): string {
  switch (a) {
    case 'start':
      return 'flex-start'
    case 'end':
      return 'flex-end'
    default:
      return a
  }
}

function styleBlockDecls(block: StyleBlock, layout?: LayoutConfig): Declaration[] {
  const out: Declaration[] = []
  if (layout) out.push(...layoutDecls(layout))

  if (block.width !== undefined) out.push({ prop: 'width', value: renderValue(block.width) })
  if (block.height !== undefined) out.push({ prop: 'height', value: renderValue(block.height) })
  if (block.minWidth !== undefined)
    out.push({ prop: 'min-width', value: renderValue(block.minWidth) })
  if (block.maxWidth !== undefined)
    out.push({ prop: 'max-width', value: renderValue(block.maxWidth) })
  if (block.minHeight !== undefined)
    out.push({ prop: 'min-height', value: renderValue(block.minHeight) })
  if (block.maxHeight !== undefined)
    out.push({ prop: 'max-height', value: renderValue(block.maxHeight) })

  if (block.padding) out.push(...spacingDecls('padding', block.padding))
  if (block.margin) out.push(...spacingDecls('margin', block.margin))

  if (block.flex !== undefined) out.push({ prop: 'flex', value: block.flex })
  if (block.gridColumn !== undefined) out.push({ prop: 'grid-column', value: block.gridColumn })
  if (block.gridRow !== undefined) out.push({ prop: 'grid-row', value: block.gridRow })

  if (block.opacity !== undefined) out.push({ prop: 'opacity', value: String(block.opacity) })
  if (block.visibility !== undefined) out.push({ prop: 'visibility', value: block.visibility })
  if (block.overflow !== undefined) out.push({ prop: 'overflow', value: block.overflow })

  if (block.background) out.push(...backgroundDecls(block.background))
  if (block.maskImage !== undefined) out.push({ prop: 'mask-image', value: block.maskImage })
  if (block.backdropFilter !== undefined)
    out.push({ prop: 'backdrop-filter', value: block.backdropFilter })

  if (block.borderRadius) out.push(...radiusDecls(block.borderRadius))
  if (block.border) out.push(...borderDecls(block.border))
  if (block.shadows) out.push(...shadowDecls(block.shadows))
  if (block.typography) out.push(...typographyDecls(block.typography))

  if (block.transform !== undefined) out.push({ prop: 'transform', value: block.transform })
  if (block.transition !== undefined) out.push({ prop: 'transition', value: block.transition })
  if (block.cursor !== undefined) out.push({ prop: 'cursor', value: block.cursor })
  if (block.zIndex !== undefined) out.push({ prop: 'z-index', value: String(block.zIndex) })

  return out
}

function formatRule(selector: string, decls: ReadonlyArray<Declaration>, indent = ''): string {
  if (decls.length === 0) return ''
  const lines = decls.map((d) => `${indent}${INDENT}${d.prop}: ${d.value};`)
  return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`
}

// ---------------------------------------------------------------------------
// Element traversal
// ---------------------------------------------------------------------------

function selectorFor(id: string): string {
  return `.dtw-el-${id}`
}

function emitElementBase(el: ElementNode): string {
  const layout = el.type === 'container' ? el.layout.base : undefined
  const decls = styleBlockDecls(el.style.base, layout)
  // `hiddenAt: ['base']` would mean "hide on desktop"; we honour it by
  // emitting `display: none` in the base rule.
  if (el.hiddenAt?.includes('base')) {
    decls.push({ prop: 'display', value: 'none' })
  }
  // Animation shorthand (I-GEN-11). The reduced-motion override is
  // emitted from `emitReducedMotionBlock`, not here, so the base rule
  // stays a single self-contained declaration.
  if (el.animation) {
    decls.push(...animationDecls(el.animation))
  }
  return formatRule(selectorFor(el.id), decls)
}

function emitElementStates(el: ElementNode): string {
  if (!el.states) return ''
  const blocks: string[] = []
  for (const state of STATE_ORDER) {
    const override = el.states[state]
    if (!override) continue
    // Every StyleBlock field is optional, so a state's Partial<StyleBlock>
    // is structurally identical — we pass it through unchanged. Layout is
    // container-only at base/breakpoint level, never on a state override.
    const decls = styleBlockDecls(override)
    if (decls.length === 0) continue
    blocks.push(formatRule(`${selectorFor(el.id)}:${state}`, decls))
  }
  return blocks.join('\n\n')
}

function emitElementBreakpoint(el: ElementNode, bp: Exclude<BreakpointKey, 'base'>): string {
  const styleOverride = el.style[bp]
  const layoutOverride = el.type === 'container' ? el.layout[bp] : undefined
  const hidden = el.hiddenAt?.includes(bp) ?? false
  if (!styleOverride && !layoutOverride && !hidden) return ''
  const decls = styleBlockDecls(styleOverride ?? {}, layoutOverride)
  if (hidden) decls.push({ prop: 'display', value: 'none' })
  return formatRule(selectorFor(el.id), decls, INDENT)
}

/**
 * Walk the tree and return the element ids whose animation is decorative
 * (i.e. should be disabled under `prefers-reduced-motion: reduce`).
 * Order matches walk order so emitted rules stay deterministic.
 */
function collectDecorativeAnimatedIds(root: ElementNode): readonly string[] {
  const ids: string[] = []
  const stack: ElementNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.animation && isAnimationDecorative(node.animation)) ids.push(node.id)
    if (node.type === 'container') {
      for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push(node.children[i])
    }
  }
  return ids
}

/**
 * Collect the set of keyframe names referenced by any element animation
 * in the tree. Preserves library order so the emitted `@keyframes` blocks
 * are deterministic. Unknown names (the document references an
 * animation the generator does not own) are dropped silently — the
 * resulting CSS will fall back to no animation rather than break.
 */
function collectKeyframeNames(root: ElementNode): readonly string[] {
  const referenced = new Set<string>()
  const stack: ElementNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.animation && KEYFRAME_BY_NAME.has(node.animation.name)) {
      referenced.add(node.animation.name)
    }
    if (node.type === 'container') {
      for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push(node.children[i])
    }
  }
  return KEYFRAME_LIBRARY.filter((k) => referenced.has(k.name)).map((k) => k.name)
}

function emitKeyframesBlock(names: ReadonlyArray<string>): string {
  if (names.length === 0) return ''
  return names
    .map((name) => {
      const def = KEYFRAME_BY_NAME.get(name)!
      const body = def.body
        .split('\n')
        .map((line) => (line.length === 0 ? line : INDENT + line))
        .join('\n')
      return `@keyframes ${name} {\n${body}\n}`
    })
    .join('\n\n')
}

/**
 * Emit decorative `body::before` / `body::after` pseudo-element rules
 * (I-GEN-09). Both pseudos are fixed-position, full-bleed, behind page
 * content (`z-index: -1`), and pointer-events: none — purely cosmetic
 * layers (grid overlays, noise textures, animated gradients) that
 * cannot interfere with focus or hit-testing.
 *
 * `content: ""` is required for any pseudo-element to render. Other
 * declarations are layered in only when the author has set them, so
 * the rules stay minimal.
 */
function pseudoDecls(spec: DecorativePseudoElement): Declaration[] {
  const out: Declaration[] = [
    { prop: 'content', value: '""' },
    { prop: 'position', value: 'fixed' },
    { prop: 'inset', value: '0' },
    { prop: 'pointer-events', value: 'none' },
    { prop: 'z-index', value: '-1' },
  ]
  if (spec.background) out.push(...backgroundDecls(spec.background))
  if (spec.opacity !== undefined) out.push({ prop: 'opacity', value: String(spec.opacity) })
  if (spec.mixBlendMode !== undefined)
    out.push({ prop: 'mix-blend-mode', value: spec.mixBlendMode })
  if (spec.maskImage !== undefined) out.push({ prop: 'mask-image', value: spec.maskImage })
  if (spec.filter !== undefined) out.push({ prop: 'filter', value: spec.filter })
  return out
}

function emitDecorativeBackdrop(doc: Document): string {
  const cfg = doc.settings.decorativeBackdrop
  if (!cfg) return ''
  const blocks: string[] = []
  if (cfg.before) blocks.push(formatRule('body::before', pseudoDecls(cfg.before)))
  if (cfg.after) blocks.push(formatRule('body::after', pseudoDecls(cfg.after)))
  return blocks.filter((b) => b.length > 0).join('\n\n')
}

function emitReducedMotionBlock(ids: ReadonlyArray<string>): string {
  if (ids.length === 0) return ''
  const inner = ids
    .map((id) => `${INDENT}${selectorFor(id)} {\n${INDENT}${INDENT}animation: none;\n${INDENT}}`)
    .join('\n')
  return `@media (prefers-reduced-motion: reduce) {\n${inner}\n}`
}

function walkElements<T>(root: ElementNode, visit: (node: ElementNode) => T): T[] {
  const out: T[] = []
  const stack: ElementNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    out.push(visit(node))
    if (node.type === 'container') {
      // Push in reverse so traversal is depth-first left-to-right.
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i])
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emits a deterministic CSS stylesheet for the given document. The output
 * is structured (reset → tokens → :root tree → per-element rules → per
 * breakpoint blocks) and stable across runs given the same document.
 *
 * Token references in element styles become `var(--<prefix>-<id>)`; the
 * generator never substitutes the resolved value (theme flipping is a
 * runtime concern).
 */
export function emitCss(doc: Document): string {
  const sections: string[] = [CSS_RESET]

  const tokensBlock = emitTokensBlock(doc.tokens)
  if (tokensBlock.length > 0) sections.push(tokensBlock)

  // Decorative `body::before` / `body::after` pseudo-elements (I-GEN-09).
  // Sit between tokens and element rules so authors reading the CSS
  // see them as a page-level concern, not an element override.
  const backdrop = emitDecorativeBackdrop(doc)
  if (backdrop.length > 0) sections.push(backdrop)

  // Keyframe library (I-GEN-11). Only emit the keyframes the document
  // actually references; an animation-free document leaves the
  // stylesheet keyframe-free.
  const keyframeNames = collectKeyframeNames(doc.tree)
  const keyframesBlock = emitKeyframesBlock(keyframeNames)
  if (keyframesBlock.length > 0) sections.push(keyframesBlock)

  // Root element rule + descendants.
  const baseRules = walkElements(doc.tree, emitElementBase).filter((s) => s.length > 0)
  if (baseRules.length > 0) sections.push(baseRules.join('\n\n'))

  // State pseudo-class rules (`:hover`, `:focus-visible`, `:active`).
  // Emitted after base rules so they take precedence at equal specificity;
  // only properties the state actually overrides are emitted (I-GEN-07).
  const stateRules = walkElements(doc.tree, emitElementStates).filter((s) => s.length > 0)
  if (stateRules.length > 0) sections.push(stateRules.join('\n\n'))

  // One @media block per breakpoint. Skip the block entirely when no
  // element has an override at that breakpoint.
  for (const bp of BREAKPOINT_ORDER) {
    const rules = walkElements(doc.tree, (el) => emitElementBreakpoint(el, bp)).filter(
      (s) => s.length > 0
    )
    if (rules.length === 0) continue
    const inner = rules.join('\n\n')
    sections.push(`@media (max-width: ${BREAKPOINT_MAX_WIDTH[bp]}px) {\n${inner}\n}`)
  }

  // Reduced-motion override (I-GEN-11). Disables every decorative
  // animation; essential motion (`decorative: false`) is kept.
  const decorativeIds = collectDecorativeAnimatedIds(doc.tree)
  const reducedMotion = emitReducedMotionBlock(decorativeIds)
  if (reducedMotion.length > 0) sections.push(reducedMotion)

  // View transitions for theme toggle (I-GEN-14). Progressive-
  // enhancement only — browsers that do not implement the View
  // Transitions API ignore the rules entirely. Emitted only when the
  // theme toggle runtime is enabled, since that is the only place we
  // currently call `document.startViewTransition()`.
  if (doc.runtime.themeToggle) sections.push(VIEW_TRANSITION_BLOCK)

  // Smooth scroll + scroll-padding-top offset (I-RUN-03). CSS owns the
  // smoothness; the matching runtime snippet writes `--dtw-nav-pad` so
  // anchor jumps land flush below a fixed nav. `prefers-reduced-motion`
  // demotes scroll-behavior to `auto` so users who opted out of motion
  // do not get an unexpected animated jump.
  if (doc.runtime.smoothScroll) sections.push(SMOOTH_SCROLL_BLOCK)

  // Terminal typing paused-by-default rule (I-RUN-08). Without this,
  // typing-line animations would briefly run before the runtime
  // snippet runs (defer-loaded) and visibly snap. Pausing in CSS keeps
  // the animation parked at frame 0 until the snippet flips
  // animation-play-state to `running` on viewport entry.
  if (doc.runtime.terminalTyping) sections.push(TERMINAL_TYPING_BLOCK)

  // Print stylesheet (I-GEN-13). Forces background printing, hides
  // navigation chrome and decorative pseudo-elements, collapses the
  // page to a single column, and adds the URL after links (helpful on
  // paper since you can't click them).
  sections.push(PRINT_STYLESHEET)

  return sections.join('\n\n') + '\n'
}

// ---------------------------------------------------------------------------
// View transitions (I-GEN-14)
// ---------------------------------------------------------------------------

const VIEW_TRANSITION_BLOCK = `::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
  animation-timing-function: ease;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 1ms;
  }
}`

// ---------------------------------------------------------------------------
// Smooth scroll + scroll-padding-top (I-RUN-03)
// ---------------------------------------------------------------------------

/**
 * CSS half of the smooth-scroll runtime. The `--dtw-nav-pad` custom
 * property is set by the matching JS snippet (`SMOOTH_SCROLL_SNIPPET`)
 * to the rendered height of the page's first `<nav>`; the fallback `0px`
 * keeps the rule safe before the snippet runs (or when no nav exists).
 *
 * `scroll-behavior: smooth` lives on `html` so it applies to every
 * in-page anchor jump; the reduced-motion media query demotes it to
 * `auto` so users with motion sensitivity get an instant jump.
 */
const SMOOTH_SCROLL_BLOCK = `html {
  scroll-behavior: smooth;
  scroll-padding-top: var(--dtw-nav-pad, 0px);
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}`

// ---------------------------------------------------------------------------
// Terminal typing paused-by-default (I-RUN-08)
// ---------------------------------------------------------------------------

/**
 * CSS half of the terminal-typing runtime. Pauses every typing line
 * up front so the deferred runtime snippet can flip
 * `animation-play-state` to `running` once the line enters the
 * viewport, without a one-frame visible "rewind" caused by the
 * animation kicking off before the script runs.
 */
const TERMINAL_TYPING_BLOCK = `[data-dtw-terminal-type] {
  animation-play-state: paused;
}`

// ---------------------------------------------------------------------------
// Print stylesheet (I-GEN-13)
// ---------------------------------------------------------------------------

const PRINT_STYLESHEET = `@media print {
  @page {
    margin: 12mm;
  }
  *,
  *::before,
  *::after {
    color-adjust: exact;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  nav,
  footer,
  .dtw-skip-link {
    display: none !important;
  }
  body::before,
  body::after {
    display: none !important;
  }
  body {
    background: #fff !important;
    color: #000 !important;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    break-after: avoid;
    break-inside: avoid;
  }
  img,
  figure,
  table {
    break-inside: avoid;
  }
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 0.85em;
    color: #555;
  }
}`

// Re-export internals used by tests; treat as private-to-package.
export const __internal__ = {
  collectTokens,
  renderValue,
  styleBlockDecls,
  walkResponsive: <T>(rp: ResponsiveProperties<T>): T => rp.base,
}
