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
  BackgroundLayer,
  BorderRadius,
  BorderSpec,
  BreakpointKey,
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
}`

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

  return sections.join('\n\n') + '\n'
}

// Re-export internals used by tests; treat as private-to-package.
export const __internal__ = {
  collectTokens,
  renderValue,
  styleBlockDecls,
  walkResponsive: <T>(rp: ResponsiveProperties<T>): T => rp.base,
}
