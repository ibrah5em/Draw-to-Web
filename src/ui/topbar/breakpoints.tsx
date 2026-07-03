/**
 * Shared breakpoint metadata for the editor.
 *
 * Pixel widths match the generator's `@media (max-width: ...)` thresholds
 * (`src/generator/cssEmitter.ts`) so the canvas preview reflects the exported
 * HTML. The active breakpoint drives `sessionStore.activeBreakpoint`; when it is
 * non-`base` the canvas viewport caps to that width and per-breakpoint edits
 * route into `element.responsive[bp]` (L-PRP-09).
 *
 * Consumed by the Canvas viewport sizing, the Properties per-breakpoint badge,
 * and the View ▸ Canvas Size menu (L-TOP-02).
 */

import { Monitor, Smartphone, Tablet } from 'lucide-react'
import type { JSX } from 'react'

import type { BreakpointKey } from '@document/types'

/** Editor pixel widths used to size the canvas viewport per breakpoint. */
export const BREAKPOINT_WIDTH_PX: Readonly<Record<BreakpointKey, number>> = {
  base: 1280,
  tablet: 1024,
  mobile: 768,
  small: 480,
}

/** A selectable canvas breakpoint with its display label and icon. */
export interface BreakpointOption {
  readonly value: BreakpointKey
  readonly label: string
  /** Renders the lucide icon for this breakpoint at the given pixel size. */
  readonly icon: (size: number) => JSX.Element
}

/** The four canvas breakpoints, ordered widest → narrowest. */
export const BREAKPOINT_OPTIONS: ReadonlyArray<BreakpointOption> = [
  { value: 'base', label: 'Desktop', icon: (size) => <Monitor size={size} /> },
  { value: 'tablet', label: 'Tablet', icon: (size) => <Tablet size={size} /> },
  { value: 'mobile', label: 'Mobile', icon: (size) => <Smartphone size={size} /> },
  { value: 'small', label: 'Small', icon: (size) => <Smartphone size={size} /> },
]
