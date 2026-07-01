/**
 * The vocabulary the agent is allowed to use — element types, grid geometry,
 * breakpoints, and states. Surfaced as a read resource so the agent can
 * discover the legal inputs instead of guessing, and reused as the source of
 * truth for the tool input enums (single definition, no drift).
 */

import { z } from 'zod'

import type { BreakpointKey } from '../src/document/types'

/** Element types an MCP tool accepts (document primitives + convenience aliases). */
export const ELEMENT_TYPES = [
  'section',
  'group',
  'card',
  'container',
  'heading',
  'text',
  'image',
  'button',
  'link',
  'icon',
  'list',
  'divider',
] as const

export type McpElementType = (typeof ELEMENT_TYPES)[number]

/** Zod enum for the element-type field on insert/update tools. */
export const elementTypeEnum = z.enum(ELEMENT_TYPES)

/** Heading/text tags an agent may set explicitly. */
export const TEXT_TAGS = [
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
] as const

/** The four editor breakpoints; `base` is desktop. */
export const BREAKPOINTS: ReadonlyArray<BreakpointKey> = ['base', 'tablet', 'mobile', 'small']

/** Number of columns in the page grid (matches the editor's 12-col overlay). */
export const PAGE_COLUMNS = 12

/**
 * The full vocabulary document returned by the `dtw://vocabulary` resource.
 * Plain data so it serialises straight to JSON for the agent.
 */
export const VOCABULARY = {
  elementTypes: [
    { type: 'section', maps: 'container', note: 'Landmark <section>, defaults to a 12-col grid.' },
    { type: 'group', maps: 'container', note: 'Plain grouping <div> (flex column).' },
    { type: 'card', maps: 'container', note: 'Padded, bordered, rounded container.' },
    { type: 'container', maps: 'container', note: 'Bare flex-column container.' },
    { type: 'heading', maps: 'text', note: 'Heading text; tag auto-picks h1 (if none) else h2.' },
    { type: 'text', maps: 'text', note: 'Paragraph text (<p> by default).' },
    { type: 'image', maps: 'image', note: 'Image; alt required ("" allowed for decorative).' },
    { type: 'button', maps: 'button', note: 'Native <button>.' },
    { type: 'link', maps: 'link', note: 'Anchor <a>; needs href.' },
    { type: 'icon', maps: 'icon', note: 'Inline-SVG icon by logical name.' },
    { type: 'list', maps: 'list', note: 'Ordered/unordered list of items.' },
    { type: 'divider', maps: 'divider', note: 'Horizontal/vertical separator.' },
  ],
  grid: {
    columns: PAGE_COLUMNS,
    placement:
      'Provide gridColumnStart (1-based) and gridColumnSpan; the element is stored as ' +
      'a CSS "grid-column: <start> / span <span>". Never pixels or absolute positions. ' +
      'A child snaps to its parent container’s column count (12 for the page).',
    breakpoints: BREAKPOINTS,
  },
  states: ['hover', 'focus-visible', 'active'],
  textTags: TEXT_TAGS,
  invariants: [
    'Layout is CSS Grid + Flexbox + clamp() only — no position: absolute.',
    'Exactly one <h1> per page; no heading-level skips.',
    'Every <img> needs alt (empty string allowed for decorative).',
    'Output is deterministic and gated by axe-core before export.',
  ],
} as const
