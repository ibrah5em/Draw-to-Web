/**
 * Grid snapper (`snapToGrid` / `gridColumnValue`) — pure snapping math:
 * column start/span resolution, vertical insertion index, edge cases, and
 * determinism. No store, no DOM.
 */

import { describe, expect, it } from 'vitest'

import {
  columnsFromTemplate,
  DEFAULT_GRID_COLUMNS,
  gridColumnValue,
  snapToGrid,
  type GridConfig,
  type NormalizedRect,
} from '@draw/snap'

// A 12-column grid with no existing siblings unless a test says otherwise.
const empty = (columns = DEFAULT_GRID_COLUMNS, siblingCenters: number[] = []): GridConfig => ({
  columns,
  siblingCenters,
})

const rect = (x: number, y: number, width: number, height: number): NormalizedRect => ({
  x,
  y,
  width,
  height,
})

describe('snapToGrid — column placement', () => {
  it('snaps a left-half rectangle to columns 1..6 on a 12-col grid', () => {
    const placement = snapToGrid(rect(0, 0, 0.5, 0.2), empty(), 'base')
    expect(placement.columnStart).toBe(1)
    expect(placement.columnSpan).toBe(6)
  })

  it('snaps a right-half rectangle to columns 7..12', () => {
    const placement = snapToGrid(rect(0.5, 0, 0.5, 0.2), empty(), 'base')
    expect(placement.columnStart).toBe(7)
    expect(placement.columnSpan).toBe(6)
  })

  it('snaps a centred third to a middle column band', () => {
    // x in [1/3, 2/3] over 12 cols → start line 4, end line 8 → start 5, span 4.
    const placement = snapToGrid(rect(1 / 3, 0, 1 / 3, 0.2), empty(), 'base')
    expect(placement.columnStart).toBe(5)
    expect(placement.columnSpan).toBe(4)
  })

  it('spans the full width when the rectangle covers the page', () => {
    const placement = snapToGrid(rect(0, 0, 1, 0.4), empty(), 'base')
    expect(placement.columnStart).toBe(1)
    expect(placement.columnSpan).toBe(12)
  })

  it('rounds a near-edge rectangle to the nearest grid lines', () => {
    // x≈0.02 rounds to line 0; right edge 0.52 over 12 → 6.24 → line 6.
    const placement = snapToGrid(rect(0.02, 0, 0.5, 0.2), empty(), 'base')
    expect(placement.columnStart).toBe(1)
    expect(placement.columnSpan).toBe(6)
  })
})

describe('snapToGrid — edge cases', () => {
  it('gives a tiny rectangle a minimum span of one column', () => {
    const placement = snapToGrid(rect(0.5, 0.5, 0.001, 0.001), empty(), 'base')
    expect(placement.columnSpan).toBe(1)
    expect(placement.columnStart).toBeGreaterThanOrEqual(1)
    expect(placement.columnStart).toBeLessThanOrEqual(12)
  })

  it('never lets the span overflow the grid', () => {
    // A rectangle pushed past the right edge still clamps inside 12 columns.
    const placement = snapToGrid(rect(0.95, 0, 0.5, 0.2), empty(), 'base')
    expect(placement.columnStart + placement.columnSpan - 1).toBeLessThanOrEqual(12)
    expect(placement.columnSpan).toBeGreaterThanOrEqual(1)
  })

  it('uses the breakpoint-specific column geometry', () => {
    const columns = { base: 12, tablet: 8, mobile: 4, small: 2 }
    // Right half on a 4-column mobile grid → start line 2 → start 3, span 2.
    const placement = snapToGrid(rect(0.5, 0, 0.5, 0.2), empty(columns), 'mobile')
    expect(placement.columnStart).toBe(3)
    expect(placement.columnSpan).toBe(2)
  })
})

describe('snapToGrid — vertical insertion index', () => {
  it('returns index 0 when there are no siblings', () => {
    const placement = snapToGrid(rect(0, 0.4, 1, 0.2), empty(), 'base')
    expect(placement.insertionIndex).toBe(0)
  })

  it('lands above every sibling when drawn at the top', () => {
    const cfg = empty(DEFAULT_GRID_COLUMNS, [0.3, 0.6, 0.9])
    const placement = snapToGrid(rect(0, 0, 1, 0.1), cfg, 'base')
    expect(placement.insertionIndex).toBe(0)
  })

  it('lands below every sibling when drawn at the bottom', () => {
    const cfg = empty(DEFAULT_GRID_COLUMNS, [0.1, 0.4, 0.7])
    const placement = snapToGrid(rect(0, 0.9, 1, 0.1), cfg, 'base')
    expect(placement.insertionIndex).toBe(3)
  })

  it('lands between rows by comparing the drawn centre to sibling centres', () => {
    const cfg = empty(DEFAULT_GRID_COLUMNS, [0.2, 0.8])
    // centre = 0.45 + 0.05 = 0.5 → one sibling (0.2) above it.
    const placement = snapToGrid(rect(0, 0.45, 1, 0.1), cfg, 'base')
    expect(placement.insertionIndex).toBe(1)
  })
})

describe('gridColumnValue + determinism', () => {
  it('formats the placement as the CSS grid-column shorthand', () => {
    const placement = snapToGrid(rect(0.5, 0, 0.5, 0.2), empty(), 'base')
    expect(gridColumnValue(placement)).toBe('7 / span 6')
  })

  it('is deterministic: identical input yields an identical placement', () => {
    const bounds = rect(0.25, 0.3, 0.4, 0.15)
    const cfg = empty(DEFAULT_GRID_COLUMNS, [0.1, 0.5, 0.9])
    expect(snapToGrid(bounds, cfg, 'base')).toEqual(snapToGrid(bounds, cfg, 'base'))
  })
})

describe('columnsFromTemplate — snap to a container’s own grid', () => {
  it('parses a repeat() column count', () => {
    expect(columnsFromTemplate('repeat(3, 1fr)')).toBe(3)
    expect(columnsFromTemplate('repeat( 12 , minmax(0, 1fr) )')).toBe(12)
  })

  it('counts a space-separated track list', () => {
    expect(columnsFromTemplate('1fr 1fr')).toBe(2)
    expect(columnsFromTemplate('200px 1fr auto')).toBe(3)
  })

  it('ignores bracketed line names when counting tracks', () => {
    expect(columnsFromTemplate('[full-start] 1fr [main] 1fr [full-end]')).toBe(2)
  })

  it('returns null for an absent or unparseable value so the caller can default', () => {
    expect(columnsFromTemplate(undefined)).toBeNull()
    expect(columnsFromTemplate('')).toBeNull()
  })
})
