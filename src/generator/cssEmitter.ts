import type { SemanticElement } from '../engine'
import type { ElementProps } from '../store/elementStore'

/** Minimal modern CSS reset included at the top of every generated stylesheet. */
const CSS_RESET = `\
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  line-height: 1.5;
}

img,
picture {
  display: block;
  max-width: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
}`

/** Root grid container that maps to the 12-column canvas grid. */
const ROOT_GRID = `\
.dtw-canvas {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  width: 100%;
  max-width: 1440px;
  margin-inline: auto;
}`

/** Safely reads a string value from the element props bag. */
function strProp(props: ElementProps, key: keyof ElementProps): string | undefined {
  const v = props[key]
  return typeof v === 'string' ? v : undefined
}

/** Safely reads a number value from the element props bag. */
function numProp(props: ElementProps, key: keyof ElementProps): number | undefined {
  const v = props[key]
  return typeof v === 'number' ? v : undefined
}

/**
 * Produces a responsive font-size declaration using clamp().
 * Scales between 75% and 125% of the base size across viewport widths.
 */
function fontSizeClamp(px: number): string {
  const min = Math.max(Math.round(px * 0.75), 10)
  const max = Math.round(px * 1.25)
  const rem = (px / 16).toFixed(3)
  return `clamp(${min}px, ${rem}rem + 1vw, ${max}px)`
}

function emitElementCss(el: SemanticElement): string {
  const selector = `.dtw-el-${el.id}`
  const rules: string[] = []

  // Grid placement — columns are 1-indexed in CSS
  rules.push(`  grid-column: ${el.x + 1} / span ${el.width};`)
  rules.push(`  min-height: ${el.height}px;`)
  if (el.y > 0) {
    rules.push(`  margin-top: ${el.y}px;`)
  }

  // Container layout
  const children = el.children ?? []
  if (children.length > 0) {
    if (el.semanticTag === 'nav') {
      rules.push(`  display: flex;`)
      rules.push(`  align-items: center;`)
      rules.push(`  gap: 1rem;`)
    } else {
      rules.push(`  display: grid;`)
      rules.push(`  grid-template-columns: repeat(12, 1fr);`)
    }
  }

  // Button base
  if (el.semanticTag === 'button') {
    rules.push(`  display: inline-flex;`)
    rules.push(`  align-items: center;`)
    rules.push(`  justify-content: center;`)
    rules.push(`  padding: 0.5em 1em;`)
    rules.push(`  border: none;`)
    rules.push(`  cursor: pointer;`)
  }

  // Props → CSS declarations
  const bg = strProp(el.props, 'background')
  if (bg) rules.push(`  background-color: ${bg};`)

  const color = strProp(el.props, 'color')
  if (color) rules.push(`  color: ${color};`)

  const fontSize = numProp(el.props, 'fontSize')
  if (fontSize) rules.push(`  font-size: ${fontSizeClamp(fontSize)};`)

  const fontFamily = strProp(el.props, 'fontFamily')
  if (fontFamily) rules.push(`  font-family: ${fontFamily};`)

  const borderRadius = numProp(el.props, 'borderRadius')
  if (borderRadius) rules.push(`  border-radius: ${borderRadius}px;`)

  const block = `${selector} {\n${rules.join('\n')}\n}`

  const childBlocks = children.map(emitElementCss)
  return [block, ...childBlocks].join('\n\n')
}

/**
 * Emits a complete CSS stylesheet from a semantic element tree.
 * Includes a reset, root grid, and scoped per-element rules.
 * @param elements - Root-level semantic elements
 */
export function emitCss(elements: SemanticElement[]): string {
  const elementBlocks = elements.map(emitElementCss).join('\n\n')
  return [CSS_RESET, ROOT_GRID, elementBlocks].join('\n\n')
}
