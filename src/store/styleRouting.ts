/**
 * Active-slot style routing (Y-STR-06, Y-STR-07).
 *
 * Style writes always go through `dispatch`, but the Properties panel
 * (L-PRP-*) and the Canvas (L-CAN-*) don't know — and shouldn't need to
 * know — which slot the value should land in. The user picks the slot
 * implicitly by switching `sessionStore.activeBreakpoint` and
 * `sessionStore.activeState`; this module reads that session state and
 * builds the right C3 op.
 *
 * Slot precedence (most specific wins):
 *
 *   1. `activeState !== 'default'` → `updateNodeState` writes to
 *      `element.states[active]`. The `StatesMap` is non-responsive by
 *      design (I-DOC-01), so the breakpoint dimension is dropped: a
 *      hover edit applies across every viewport.
 *   2. otherwise → `updateNodeStyle` writes to `element.style[bp]`
 *      where `bp` is `activeBreakpoint`. `bp === 'base'` mutates the
 *      desktop default; narrower breakpoints leave `base` untouched.
 *
 * The matching reader `resolveStyleProperty` walks the same precedence
 * in reverse for live canvas rendering — state override first, then
 * active breakpoint, then the `base` fallback. That fall-through is
 * the inheritance behaviour Y-STR-07's DoD calls out ("inheritance
 * correctly resolves when reading").
 */

import type { PropertyPath } from '@document/operations'
import type { BreakpointKey, ElementId, ElementNode, StateKey, StyleBlock } from '@document/types'

import { dispatch } from './dispatch'
import { type ActiveState, useSessionStore } from './sessionStore'

/**
 * Dispatch a style write at the slot implied by the current session.
 *
 * Reads `useSessionStore` at call time, builds either an
 * `updateNodeStyle` or `updateNodeState` op, and hands it to
 * `dispatch` so the change records to history and bumps the dirty
 * flag like any other operation.
 *
 * The Y-STR-06 DoD ("editing in hover mode does not mutate default
 * state") and Y-STR-07 DoD ("writes route to `element.responsive[bp]`")
 * both fall out of the slot precedence above.
 */
export function writeActiveStyle(elementId: ElementId, path: PropertyPath, value: unknown): void {
  const { activeBreakpoint, activeState } = useSessionStore.getState()

  if (activeState !== 'default') {
    // `activeState !== 'default'` narrows to `StateKey`.
    const state: StateKey = activeState
    dispatch({
      kind: 'updateNodeState',
      id: elementId,
      state,
      path,
      value,
    })
    return
  }

  dispatch({
    kind: 'updateNodeStyle',
    id: elementId,
    breakpoint: activeBreakpoint,
    path,
    value,
  })
}

/**
 * Read a deeply-nested value out of a `StyleBlock`-like object.
 *
 * Returns `undefined` when any segment of the path is missing or
 * the cursor reaches a non-object before the path is consumed — the
 * caller treats `undefined` as "not set at this slot" and falls back
 * to the next-broader slot.
 */
function pickAtPath(target: unknown, path: PropertyPath): unknown {
  let cursor: unknown = target
  for (const key of path) {
    if (cursor === undefined || cursor === null || typeof cursor !== 'object') {
      return undefined
    }
    cursor = (cursor as Record<string | number, unknown>)[key]
  }
  return cursor
}

/**
 * Resolve the effective value of a style property at a given
 * `(breakpoint, state)` slot, walking the inheritance chain.
 *
 * Lookup order, returning the first defined value:
 *
 *   1. State override at `state` — `element.states[state][path]`.
 *      Skipped when `state === 'default'`.
 *   2. Breakpoint override at `breakpoint` — `element.style[breakpoint][path]`.
 *      Skipped when `breakpoint === 'base'` (handled in step 3).
 *   3. Base style — `element.style.base[path]`.
 *
 * Returns `undefined` when no slot defines the property; the canvas
 * treats that as "use the browser default" and emits no CSS for it.
 *
 * Note this returns the *raw* author value, which may be a `TokenRef`
 * string. Token resolution happens separately via `resolveToken` (C9),
 * because the active theme is not a property of the document.
 */
export function resolveStyleProperty(
  element: ElementNode,
  path: PropertyPath,
  breakpoint: BreakpointKey,
  state: ActiveState = 'default'
): unknown {
  if (state !== 'default') {
    const stateBlock: Partial<StyleBlock> | undefined = element.states?.[state]
    if (stateBlock !== undefined) {
      const v = pickAtPath(stateBlock, path)
      if (v !== undefined) return v
    }
  }

  if (breakpoint !== 'base') {
    const bpBlock: StyleBlock | undefined = element.style[breakpoint]
    if (bpBlock !== undefined) {
      const v = pickAtPath(bpBlock, path)
      if (v !== undefined) return v
    }
  }

  return pickAtPath(element.style.base, path)
}
