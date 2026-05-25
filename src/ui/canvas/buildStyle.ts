/**
 * Canvas style mapping (L-CAN-02).
 *
 * Pure functions that turn an `ElementNode`'s document-model style + layout
 * into a React `CSSProperties` object for the recursive canvas renderer.
 *
 * Token-bound values are resolved through an injected {@link StyleResolver}.
 * L-CAN-02 ships the {@link rawResolver} (raw values through, token refs
 * dropped); L-CAN-03 swaps in a `resolveToken`-backed resolver so bound
 * values paint live. No React, no DOM — importable from tests directly.
 */

import type { CSSProperties } from 'react'

import { isTokenRef } from '@document/tokens'
import type {
  Alignment,
  BackgroundLayer,
  Bindable,
  BorderRadius,
  BorderSpec,
  DimensionValue,
  ElementNode,
  LayoutConfig,
  ShadowLayer,
  SpacingBox,
  StyleBlock,
  Typography,
} from '@document/types'

/**
 * Resolves a bindable style value to a concrete CSS string, or `undefined`
 * when it cannot be resolved (e.g. an unresolved token reference).
 */
export type StyleResolver = (value: Bindable<string>) => string | undefined

/**
 * L-CAN-02 resolver: passes raw values straight through and drops token
 * references. Replaced by a theme-aware `resolveToken` resolver in L-CAN-03.
 */
export const rawResolver: StyleResolver = (value) => (isTokenRef(value) ? undefined : value)

/** Map document alignment to its flex `justify-content` / `align-items` value. */
const FLEX_ALIGNMENT: Record<Alignment, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
}

function layoutToStyle(layout: LayoutConfig, resolve: StyleResolver): CSSProperties {
  const style: CSSProperties = { display: layout.mode }
  if (layout.mode === 'flex') {
    if (layout.direction) style.flexDirection = layout.direction
    if (layout.justify) style.justifyContent = FLEX_ALIGNMENT[layout.justify]
    if (layout.align) style.alignItems = FLEX_ALIGNMENT[layout.align]
    if (layout.wrap) style.flexWrap = layout.wrap
  } else {
    if (layout.gridTemplateColumns) style.gridTemplateColumns = layout.gridTemplateColumns
    if (layout.gridTemplateRows) style.gridTemplateRows = layout.gridTemplateRows
    if (layout.justify) style.justifyContent = layout.justify
    if (layout.align) style.alignItems = layout.align
  }
  if (layout.gap) {
    const gap = resolve(layout.gap)
    if (gap) style.gap = gap
  }
  return style
}

function dimension(value: DimensionValue | undefined, resolve: StyleResolver): string | undefined {
  if (value === undefined) return undefined
  return resolve(value)
}

function boxShorthand(box: SpacingBox, resolve: StyleResolver): string | undefined {
  const side = (v?: Bindable<string>): string | undefined =>
    v === undefined ? undefined : resolve(v)
  const top = side(box.top)
  const right = side(box.right)
  const bottom = side(box.bottom)
  const left = side(box.left)
  if (top === undefined && right === undefined && bottom === undefined && left === undefined) {
    return undefined
  }
  return `${top ?? '0'} ${right ?? '0'} ${bottom ?? '0'} ${left ?? '0'}`
}

function radiusToStyle(radius: BorderRadius, resolve: StyleResolver): CSSProperties {
  if (radius.all !== undefined) {
    const all = resolve(radius.all)
    return all ? { borderRadius: all } : {}
  }
  const style: CSSProperties = {}
  if (radius.topLeft) style.borderTopLeftRadius = resolve(radius.topLeft)
  if (radius.topRight) style.borderTopRightRadius = resolve(radius.topRight)
  if (radius.bottomRight) style.borderBottomRightRadius = resolve(radius.bottomRight)
  if (radius.bottomLeft) style.borderBottomLeftRadius = resolve(radius.bottomLeft)
  return style
}

function borderToStyle(border: BorderSpec, resolve: StyleResolver): CSSProperties {
  if (border.style === 'none') return { border: 'none' }
  const width = resolve(border.width)
  const color = resolve(border.color)
  if (!width || !color) return {}
  return { border: `${width} ${border.style} ${color}` }
}

function gradientStops(
  stops: ReadonlyArray<{ readonly color: Bindable<string>; readonly position?: string }>,
  resolve: StyleResolver
): string[] {
  return stops
    .map((stop) => {
      const color = resolve(stop.color)
      if (!color) return null
      return stop.position ? `${color} ${stop.position}` : color
    })
    .filter((value): value is string => value !== null)
}

function backgroundToStyle(
  layers: ReadonlyArray<BackgroundLayer>,
  resolve: StyleResolver
): CSSProperties {
  const images: string[] = []
  let color: string | undefined
  for (const layer of layers) {
    switch (layer.kind) {
      case 'solid': {
        const resolved = resolve(layer.color)
        if (resolved) color = resolved
        break
      }
      case 'linear-gradient': {
        const stops = gradientStops(layer.stops, resolve)
        if (stops.length > 0) images.push(`linear-gradient(${layer.angle}, ${stops.join(', ')})`)
        break
      }
      case 'radial-gradient': {
        const stops = gradientStops(layer.stops, resolve)
        if (stops.length > 0) {
          images.push(`radial-gradient(${layer.shape ?? 'circle'}, ${stops.join(', ')})`)
        }
        break
      }
      case 'image': {
        images.push(`url("${layer.imageUrl}")`)
        break
      }
    }
  }
  const style: CSSProperties = {}
  if (color) style.backgroundColor = color
  if (images.length > 0) style.backgroundImage = images.join(', ')
  return style
}

function shadowsToString(
  shadows: ReadonlyArray<ShadowLayer>,
  resolve: StyleResolver
): string | undefined {
  const parts = shadows
    .map((shadow) => {
      const color = resolve(shadow.color)
      if (!color) return null
      const spread = shadow.spread ? ` ${shadow.spread}` : ''
      const inset = shadow.inset ? 'inset ' : ''
      return `${inset}${shadow.offsetX} ${shadow.offsetY} ${shadow.blur}${spread} ${color}`
    })
    .filter((value): value is string => value !== null)
  return parts.length > 0 ? parts.join(', ') : undefined
}

function typographyToStyle(typography: Typography, resolve: StyleResolver): CSSProperties {
  const style: CSSProperties = {}
  if (typography.fontFamily) style.fontFamily = resolve(typography.fontFamily)
  if (typography.fontSize) style.fontSize = resolve(typography.fontSize)
  if (typography.fontWeight !== undefined) {
    style.fontWeight =
      typeof typography.fontWeight === 'number'
        ? typography.fontWeight
        : resolve(typography.fontWeight)
  }
  if (typography.lineHeight !== undefined) {
    style.lineHeight =
      typeof typography.lineHeight === 'number'
        ? typography.lineHeight
        : resolve(typography.lineHeight)
  }
  if (typography.letterSpacing) style.letterSpacing = resolve(typography.letterSpacing)
  if (typography.textTransform) style.textTransform = typography.textTransform
  if (typography.textAlign) style.textAlign = typography.textAlign
  if (typography.textDecoration) style.textDecoration = typography.textDecoration
  if (typography.fontStyle) style.fontStyle = typography.fontStyle
  if (typography.color) style.color = resolve(typography.color)
  return style
}

function applyBlock(style: CSSProperties, block: StyleBlock, resolve: StyleResolver): void {
  const width = dimension(block.width, resolve)
  const height = dimension(block.height, resolve)
  const minWidth = dimension(block.minWidth, resolve)
  const maxWidth = dimension(block.maxWidth, resolve)
  const minHeight = dimension(block.minHeight, resolve)
  const maxHeight = dimension(block.maxHeight, resolve)
  if (width) style.width = width
  if (height) style.height = height
  if (minWidth) style.minWidth = minWidth
  if (maxWidth) style.maxWidth = maxWidth
  if (minHeight) style.minHeight = minHeight
  if (maxHeight) style.maxHeight = maxHeight

  if (block.padding) {
    const padding = boxShorthand(block.padding, resolve)
    if (padding) style.padding = padding
  }
  if (block.margin) {
    const margin = boxShorthand(block.margin, resolve)
    if (margin) style.margin = margin
  }

  if (block.flex) style.flex = block.flex
  if (block.gridColumn) style.gridColumn = block.gridColumn
  if (block.gridRow) style.gridRow = block.gridRow
  if (block.opacity !== undefined) style.opacity = block.opacity
  if (block.visibility) style.visibility = block.visibility
  if (block.overflow) style.overflow = block.overflow
  if (block.cursor) style.cursor = block.cursor
  if (block.zIndex !== undefined) style.zIndex = block.zIndex
  if (block.transform) style.transform = block.transform
  if (block.transition) style.transition = block.transition
  if (block.maskImage) style.maskImage = block.maskImage
  if (block.backdropFilter) style.backdropFilter = block.backdropFilter

  if (block.background) Object.assign(style, backgroundToStyle(block.background, resolve))
  if (block.borderRadius) Object.assign(style, radiusToStyle(block.borderRadius, resolve))
  if (block.border) Object.assign(style, borderToStyle(block.border, resolve))
  if (block.shadows) {
    const boxShadow = shadowsToString(block.shadows, resolve)
    if (boxShadow) style.boxShadow = boxShadow
  }
  if (block.typography) Object.assign(style, typographyToStyle(block.typography, resolve))
}

/**
 * Build the inline `CSSProperties` for a node at its base breakpoint.
 *
 * Containers get their auto-layout (flex/grid) applied first, then every
 * node's base `StyleBlock` is layered on top. Per-breakpoint and per-state
 * overrides are handled by later tasks (L-TOP-02, L-PRP-05/09).
 *
 * @param node - The element to style.
 * @param resolve - Bindable-value resolver (see {@link StyleResolver}).
 */
export function nodeStyle(node: ElementNode, resolve: StyleResolver): CSSProperties {
  const style: CSSProperties = {}
  if (node.type === 'container') Object.assign(style, layoutToStyle(node.layout.base, resolve))
  applyBlock(style, node.style.base, resolve)
  return style
}
