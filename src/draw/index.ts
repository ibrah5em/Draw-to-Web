/**
 * "Draw to create elements" — public surface.
 *
 * Two isolated, pure pieces plus thin node-mapping helpers:
 *
 *   - `interpret.ts` — `interpretRectangle(shape)`: guess the element kind a
 *     drawn rectangle represents, with ranked alternatives, a confidence
 *     score, and an explainer hint.
 *   - `snap.ts` — `snapToGrid(bounds, gridConfig, breakpoint)`: convert the
 *     normalised rectangle to a grid placement (column start/span + insertion
 *     index). Pure math; never pixels.
 *   - `node.ts` — map a guess + placement onto the document model so the canvas
 *     can hand an ordinary node to the existing `insertElement` operation.
 *
 * The high-level flow: the user drags a rectangle on the canvas; the canvas
 * normalises it to the target container's box; `interpretRectangle` guesses
 * the kind and `snapToGrid` resolves the placement; the canvas builds the node
 * with the existing `createPrimitive` factory, decorates + places it, and
 * dispatches a normal `insertElement` op. The drawn pixels never touch the
 * store.
 *
 * No store, no React, no DOM imports — importable from any process.
 */

export type {
  DrawnElementKind,
  ElementTypeGuess,
  GuessableKind,
  InterpretThresholds,
  RectangleShape,
} from './interpret'
export { DEFAULT_INTERPRET_THRESHOLDS, interpretRectangle, KIND_ORDER } from './interpret'

export type { GridConfig, GridPlacement, NormalizedRect, ResponsiveColumns } from './snap'
export { columnsFromTemplate, DEFAULT_GRID_COLUMNS, gridColumnValue, snapToGrid } from './snap'

export { decorateDrawnNode, drawnKindToElementType, headingTagFor, withGridPlacement } from './node'
