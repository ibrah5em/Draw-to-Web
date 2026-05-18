/**
 * Document Model — operations (C3).
 *
 * Operations are the only legal way to mutate a `Document`. Each operation
 * is a `(draft, op) => void` immer mutator. Callers (Yousef's store) run
 * them through `produceWithPatches` to capture forward + inverse patches
 * for undo/redo; the inverse-patch round-trip is what makes the system
 * reversible without operations needing to know about history.
 *
 * Design rules:
 *
 *   - Every op carries a `kind` discriminator.
 *   - IDs are stable; operations never re-generate them.
 *   - `updateNodeStyle` / `updateNodeState` write into the named breakpoint
 *     or state slot; `base` is touched only when the caller asks for it
 *     (rules/document-model.md — "they never silently overwrite the base").
 *   - `renameToken` / `deleteToken` walk the whole tree in one mutator so
 *     history records a single entry (rules/document-model.md).
 *   - Errors are thrown with a descriptive message; the store can surface
 *     them as a toast and aborts the immer producer cleanly.
 *
 * Contract: C3 (see `docs/0.2.0v/plan.md` Section 6).
 */

import type { Draft } from 'immer'

import { defaultPresetContext, presetsRegistry } from './presets'
import type {
  BreakpointKey,
  ColorTokenValue,
  ContainerNode,
  Document,
  ElementId,
  ElementNode,
  StateKey,
  TokenCategory,
  TokenDefinition,
  TokenId,
  TokenRef,
} from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Path into a node or style block. Mixed string / number segments; numeric
 * segments index into arrays (e.g. `['style','base','background',0,'color']`).
 */
export type PropertyPath = ReadonlyArray<string | number>

/** Insert an element under an existing container. */
export interface InsertElementOp {
  readonly kind: 'insertElement'
  readonly parentId: ElementId
  readonly node: ElementNode
  /** Position among `parent.children`; appended when omitted. */
  readonly index?: number
}

/** Delete an element (and its subtree). The root element cannot be deleted. */
export interface DeleteElementOp {
  readonly kind: 'deleteElement'
  readonly id: ElementId
}

/**
 * Move an element to a new position. `toIndex` is the post-removal target
 * within `parent.children`. When `toParentId` is set, the move crosses
 * containers; otherwise it reorders within the current parent.
 */
export interface ReorderOp {
  readonly kind: 'reorder'
  readonly id: ElementId
  readonly toIndex: number
  readonly toParentId?: ElementId
}

/**
 * Write a value into `node[...path]` directly (non-style fields like
 * `tag`, `content`, `alt`, `href`, `name`, `attributes.*`, etc.).
 */
export interface UpdateNodeOp {
  readonly kind: 'updateNode'
  readonly id: ElementId
  readonly path: PropertyPath
  readonly value: unknown
}

/**
 * Write a value into `node.style[breakpoint][...path]`. The named
 * breakpoint slot is created if absent; siblings are left untouched.
 */
export interface UpdateNodeStyleOp {
  readonly kind: 'updateNodeStyle'
  readonly id: ElementId
  readonly breakpoint: BreakpointKey
  readonly path: PropertyPath
  readonly value: unknown
}

/**
 * Write a value into `node.states[state][...path]`. The state slot is
 * created if absent.
 */
export interface UpdateNodeStateOp {
  readonly kind: 'updateNodeState'
  readonly id: ElementId
  readonly state: StateKey
  readonly path: PropertyPath
  readonly value: unknown
}

/**
 * Wrap one-or-more sibling elements in a new container. The `container`
 * template's `children` is ignored — the op moves the target nodes into
 * it. The new container is inserted at the position of the first target
 * sibling in their original order.
 */
export interface WrapInGroupOp {
  readonly kind: 'wrapInGroup'
  readonly ids: ReadonlyArray<ElementId>
  readonly container: ContainerNode
}

/**
 * Replace a container with its children — children are spliced into the
 * grandparent at the container's position. The root cannot be unwrapped.
 */
export interface UnwrapGroupOp {
  readonly kind: 'unwrapGroup'
  readonly id: ElementId
}

/** Add a new token. Variant per category so `value` is typed correctly. */
export type AddTokenOp =
  | {
      readonly kind: 'addToken'
      readonly category: 'color'
      readonly definition: TokenDefinition<ColorTokenValue>
    }
  | {
      readonly kind: 'addToken'
      readonly category: Exclude<TokenCategory, 'color'>
      readonly definition: TokenDefinition<string>
    }

/** Update an existing token's value or display name (id is immutable). */
export type UpdateTokenOp =
  | {
      readonly kind: 'updateToken'
      readonly category: 'color'
      readonly id: TokenId
      readonly value?: ColorTokenValue
      readonly name?: string
      readonly description?: string
    }
  | {
      readonly kind: 'updateToken'
      readonly category: Exclude<TokenCategory, 'color'>
      readonly id: TokenId
      readonly value?: string
      readonly name?: string
      readonly description?: string
    }

/**
 * Delete a token definition. Tree bindings that referenced it are left in
 * place and surfaced as broken refs by `validateDocument` (I-DOC-05). The
 * "freeze resolved value into the tree" behavior described in
 * rules/document-model.md ships once `resolveToken` (I-DOC-06) lands.
 */
export interface DeleteTokenOp {
  readonly kind: 'deleteToken'
  readonly category: TokenCategory
  readonly id: TokenId
}

/**
 * Rename a token id. Walks the entire tree rewriting every `TokenRef`
 * matching the old slug in one pass so history records a single entry.
 */
export interface RenameTokenOp {
  readonly kind: 'renameToken'
  readonly category: TokenCategory
  readonly oldId: TokenId
  readonly newId: TokenId
}

/**
 * Insert a preset under an existing container. The preset is looked up in
 * `presetsRegistry` (C7, I-DOC-04); arguments are passed through to the
 * factory. Throws if the preset is unknown.
 */
export interface InsertPresetOp {
  readonly kind: 'insertPreset'
  readonly parentId: ElementId
  readonly presetId: string
  readonly presetArgs?: Readonly<Record<string, unknown>>
  readonly index?: number
}

/** Discriminated union of every operation. */
export type Operation =
  | InsertElementOp
  | DeleteElementOp
  | ReorderOp
  | UpdateNodeOp
  | UpdateNodeStyleOp
  | UpdateNodeStateOp
  | WrapInGroupOp
  | UnwrapGroupOp
  | AddTokenOp
  | UpdateTokenOp
  | DeleteTokenOp
  | RenameTokenOp
  | InsertPresetOp

/** String literal union of every operation `kind`. */
export type OperationKind = Operation['kind']

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

/**
 * Location of a node within the tree. `parent === null` indicates the
 * tree root; `index === -1` matches in that case.
 */
interface NodeLocation {
  readonly node: Draft<ElementNode>
  readonly parent: Draft<ContainerNode> | null
  readonly index: number
}

/**
 * Locate a node by id within an immer draft. Returns `null` when not
 * found.
 */
function locate(draft: Draft<Document>, id: ElementId): NodeLocation | null {
  if (draft.tree.id === id) {
    return { node: draft.tree, parent: null, index: -1 }
  }
  const stack: Array<Draft<ContainerNode>> = []
  if (draft.tree.type === 'container') {
    stack.push(draft.tree)
  }
  while (stack.length > 0) {
    const parent = stack.pop() as Draft<ContainerNode>
    for (let i = 0; i < parent.children.length; i += 1) {
      const child = parent.children[i]!
      if (child.id === id) {
        return { node: child, parent, index: i }
      }
      if (child.type === 'container') {
        stack.push(child)
      }
    }
  }
  return null
}

/** Locate, throwing a structured error if the id is not present. */
function locateOrThrow(draft: Draft<Document>, id: ElementId): NodeLocation {
  const found = locate(draft, id)
  if (!found) {
    throw new Error(`No element with id "${id}" in document tree`)
  }
  return found
}

/**
 * Visit every element in the tree (depth-first, root first). The visitor
 * runs against the immer draft so mutations propagate.
 */
function walkElements(node: Draft<ElementNode>, visit: (node: Draft<ElementNode>) => void): void {
  visit(node)
  if (node.type === 'container') {
    for (const child of node.children) {
      walkElements(child as Draft<ElementNode>, visit)
    }
  }
}

/**
 * Set a deeply nested value at `path`. Intermediate objects are created
 * for string segments; intermediate arrays for numeric segments. Used by
 * `updateNode`, `updateNodeStyle`, `updateNodeState`.
 */
function setAtPath(
  target: Record<string | number, unknown>,
  path: PropertyPath,
  value: unknown
): void {
  if (path.length === 0) {
    throw new Error('setAtPath requires a non-empty path')
  }
  let cursor: Record<string | number, unknown> = target
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]!
    const next = cursor[key]
    if (next === undefined || next === null) {
      const upcoming = path[i + 1]!
      cursor[key] = typeof upcoming === 'number' ? [] : {}
    }
    cursor = cursor[key] as Record<string | number, unknown>
  }
  cursor[path[path.length - 1]!] = value
}

/**
 * Walk every string field in an arbitrary value and replace any string
 * equal to `from` with `to`. Used by `renameToken` to update every
 * `TokenRef` binding in one pass.
 */
function rewriteStringValues(value: unknown, from: string, to: string): unknown {
  if (value === from) return to
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = rewriteStringValues(value[i], from, to)
    }
    return value
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      obj[key] = rewriteStringValues(obj[key], from, to)
    }
    return obj
  }
  return value
}

// ---------------------------------------------------------------------------
// Per-operation mutators
// ---------------------------------------------------------------------------

function applyInsertElement(draft: Draft<Document>, op: InsertElementOp): void {
  const location = locateOrThrow(draft, op.parentId)
  if (location.node.type !== 'container') {
    throw new Error(`Cannot insert into element "${op.parentId}" — not a container`)
  }
  const parent = location.node
  const index = op.index ?? parent.children.length
  if (index < 0 || index > parent.children.length) {
    throw new Error(`insertElement index ${index} out of range for parent "${op.parentId}"`)
  }
  parent.children.splice(index, 0, op.node as Draft<ElementNode>)
}

function applyDeleteElement(draft: Draft<Document>, op: DeleteElementOp): void {
  const location = locateOrThrow(draft, op.id)
  if (location.parent === null) {
    throw new Error('Cannot delete the root element')
  }
  location.parent.children.splice(location.index, 1)
}

function applyReorder(draft: Draft<Document>, op: ReorderOp): void {
  const location = locateOrThrow(draft, op.id)
  if (location.parent === null) {
    throw new Error('Cannot reorder the root element')
  }
  // Detach from current parent.
  const [moved] = location.parent.children.splice(location.index, 1)
  if (!moved) {
    throw new Error(`reorder failed: element "${op.id}" disappeared mid-op`)
  }

  // Resolve destination parent. Default to the original parent (intra-list
  // reorder); accept any container in the tree when `toParentId` is set.
  let destination: Draft<ContainerNode>
  if (op.toParentId === undefined) {
    destination = location.parent
  } else {
    const target = locateOrThrow(draft, op.toParentId)
    if (target.node.type !== 'container') {
      throw new Error(`reorder destination "${op.toParentId}" is not a container`)
    }
    destination = target.node
  }
  const clamped = Math.max(0, Math.min(op.toIndex, destination.children.length))
  destination.children.splice(clamped, 0, moved)
}

function applyUpdateNode(draft: Draft<Document>, op: UpdateNodeOp): void {
  const { node } = locateOrThrow(draft, op.id)
  setAtPath(node as unknown as Record<string | number, unknown>, op.path, op.value)
}

function applyUpdateNodeStyle(draft: Draft<Document>, op: UpdateNodeStyleOp): void {
  const { node } = locateOrThrow(draft, op.id)
  if (op.breakpoint === 'base') {
    setAtPath(node.style.base as unknown as Record<string | number, unknown>, op.path, op.value)
    return
  }
  // Optional breakpoints are created on demand; `base` is never silently
  // overwritten (document-model.md rule).
  if (node.style[op.breakpoint] === undefined) {
    node.style[op.breakpoint] = {}
  }
  setAtPath(
    node.style[op.breakpoint] as unknown as Record<string | number, unknown>,
    op.path,
    op.value
  )
}

function applyUpdateNodeState(draft: Draft<Document>, op: UpdateNodeStateOp): void {
  const { node } = locateOrThrow(draft, op.id)
  if (node.states === undefined) {
    node.states = {}
  }
  if (node.states[op.state] === undefined) {
    node.states[op.state] = {}
  }
  setAtPath(node.states[op.state] as unknown as Record<string | number, unknown>, op.path, op.value)
}

function applyWrapInGroup(draft: Draft<Document>, op: WrapInGroupOp): void {
  if (op.ids.length === 0) {
    throw new Error('wrapInGroup requires at least one element id')
  }

  // Locate every target and confirm a single shared parent.
  const locations = op.ids.map((id) => locateOrThrow(draft, id))
  const sharedParent = locations[0]!.parent
  if (sharedParent === null) {
    throw new Error('wrapInGroup cannot wrap the root element')
  }
  for (const loc of locations) {
    if (loc.parent !== sharedParent) {
      throw new Error('wrapInGroup requires every target to share a parent')
    }
  }

  // Stable order: original parent order, regardless of `ids` order.
  const sortedIndexes = locations.map((l) => l.index).sort((a, b) => a - b)
  const insertAt = sortedIndexes[0]!
  const moved: Array<Draft<ElementNode>> = []
  // Splice in descending index order so earlier indexes stay valid.
  for (let i = sortedIndexes.length - 1; i >= 0; i -= 1) {
    const [child] = sharedParent.children.splice(sortedIndexes[i]!, 1)
    if (child) moved.unshift(child)
  }

  const container = { ...(op.container as ContainerNode), children: moved } as Draft<ContainerNode>
  sharedParent.children.splice(insertAt, 0, container as Draft<ElementNode>)
}

function applyUnwrapGroup(draft: Draft<Document>, op: UnwrapGroupOp): void {
  const location = locateOrThrow(draft, op.id)
  if (location.parent === null) {
    throw new Error('Cannot unwrap the root element')
  }
  if (location.node.type !== 'container') {
    throw new Error(`unwrapGroup target "${op.id}" is not a container`)
  }
  const grandparent = location.parent
  const container = location.node
  grandparent.children.splice(location.index, 1, ...container.children)
}

function applyAddToken(draft: Draft<Document>, op: AddTokenOp): void {
  const category = op.category
  const list = draft.tokens[category] as Array<Draft<TokenDefinition<unknown>>>
  if (list.some((t) => t.id === op.definition.id)) {
    throw new Error(`Token "${category}.${op.definition.id}" already exists`)
  }
  list.push(op.definition as Draft<TokenDefinition<unknown>>)
}

function applyUpdateToken(draft: Draft<Document>, op: UpdateTokenOp): void {
  const list = draft.tokens[op.category] as Array<Draft<TokenDefinition<unknown>>>
  const target = list.find((t) => t.id === op.id)
  if (!target) {
    throw new Error(`Token "${op.category}.${op.id}" not found`)
  }
  if (op.value !== undefined) {
    target.value = op.value
  }
  if (op.name !== undefined) {
    target.name = op.name
  }
  if (op.description !== undefined) {
    target.description = op.description
  }
}

function applyDeleteToken(draft: Draft<Document>, op: DeleteTokenOp): void {
  const list = draft.tokens[op.category] as Array<Draft<TokenDefinition<unknown>>>
  const index = list.findIndex((t) => t.id === op.id)
  if (index === -1) {
    throw new Error(`Token "${op.category}.${op.id}" not found`)
  }
  // Freeze the resolved value into every binding BEFORE we drop the def,
  // so the tree stays renderable. Color tokens flatten to the light-theme
  // variant — keeping the dark variant requires keeping the token.
  const def = list[index]!
  const frozen =
    op.category === 'color' ? (def.value as ColorTokenValue).light : (def.value as string)
  const oldRef: TokenRef = `${op.category}.${op.id}`
  walkElements(draft.tree, (node) => {
    rewriteStringValues(node, oldRef, frozen)
  })
  list.splice(index, 1)
}

function applyRenameToken(draft: Draft<Document>, op: RenameTokenOp): void {
  const list = draft.tokens[op.category] as Array<Draft<TokenDefinition<unknown>>>
  const target = list.find((t) => t.id === op.oldId)
  if (!target) {
    throw new Error(`Token "${op.category}.${op.oldId}" not found`)
  }
  if (op.oldId === op.newId) return
  if (list.some((t) => t.id === op.newId)) {
    throw new Error(`Token "${op.category}.${op.newId}" already exists`)
  }
  target.id = op.newId
  const oldRef: TokenRef = `${op.category}.${op.oldId}`
  const newRef: TokenRef = `${op.category}.${op.newId}`
  walkElements(draft.tree, (node) => {
    rewriteStringValues(node, oldRef, newRef)
  })
}

function applyInsertPreset(draft: Draft<Document>, op: InsertPresetOp): void {
  const factory = presetsRegistry[op.presetId]
  if (!factory) {
    throw new Error(`Unknown preset id "${op.presetId}"`)
  }
  const node = factory(op.presetArgs ?? {}, defaultPresetContext())
  applyInsertElement(draft, {
    kind: 'insertElement',
    parentId: op.parentId,
    node,
    index: op.index,
  })
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Apply an operation to an immer draft of the document. Callers must run
 * this inside `produce` / `produceWithPatches`; the function mutates the
 * draft in place and returns `void`.
 *
 * Throws on structurally invalid operations (missing ids, root deletion,
 * duplicate token ids, etc.). The thrown error aborts the producer with
 * no partial state applied.
 */
export function applyOperation(draft: Draft<Document>, op: Operation): void {
  switch (op.kind) {
    case 'insertElement':
      return applyInsertElement(draft, op)
    case 'deleteElement':
      return applyDeleteElement(draft, op)
    case 'reorder':
      return applyReorder(draft, op)
    case 'updateNode':
      return applyUpdateNode(draft, op)
    case 'updateNodeStyle':
      return applyUpdateNodeStyle(draft, op)
    case 'updateNodeState':
      return applyUpdateNodeState(draft, op)
    case 'wrapInGroup':
      return applyWrapInGroup(draft, op)
    case 'unwrapGroup':
      return applyUnwrapGroup(draft, op)
    case 'addToken':
      return applyAddToken(draft, op)
    case 'updateToken':
      return applyUpdateToken(draft, op)
    case 'deleteToken':
      return applyDeleteToken(draft, op)
    case 'renameToken':
      return applyRenameToken(draft, op)
    case 'insertPreset':
      return applyInsertPreset(draft, op)
    default: {
      const exhaustive: never = op
      throw new Error(`Unknown operation: ${JSON.stringify(exhaustive)}`)
    }
  }
}
