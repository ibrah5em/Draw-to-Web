import { beforeEach, describe, expect, it } from 'vitest'

import type { ContainerNode, Document, TextNode } from '../../src/document/types'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import { findElementById } from '../../src/store/selectors'
import { useSessionStore } from '../../src/store/sessionStore'
import {
  resolveLayoutProperty,
  resolveStyleProperty,
  writeActiveLayout,
  writeActiveStyle,
} from '../../src/store/styleRouting'

const ROOT_ID = 'root-id-'
const TARGET_ID = 'target--'

/** Single-element document with a known target id. */
function buildFixture(): Document {
  const target: TextNode = {
    id: TARGET_ID,
    type: 'text',
    tag: 'p',
    content: 'Hello',
    style: { base: { opacity: 1 } },
  }
  const root: ContainerNode = {
    id: ROOT_ID,
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [target],
  }
  const base = createBlankDocument('Routing fixture')
  return { ...base, tree: root }
}

const reset = (): void => {
  useDocumentStore.setState({ document: buildFixture(), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
  useSessionStore.setState({
    selectedIds: [],
    activeBreakpoint: 'base',
    activeState: 'default',
  })
}

const target = () => {
  const node = findElementById(useDocumentStore.getState().document.tree, TARGET_ID)
  if (node === null || node.type !== 'text') throw new Error('target missing')
  return node
}

const rootNode = () => {
  const node = findElementById(useDocumentStore.getState().document.tree, ROOT_ID)
  if (node === null || node.type !== 'container') throw new Error('root missing')
  return node
}

describe('writeActiveStyle — slot routing', () => {
  beforeEach(reset)

  it('routes to style.base when activeBreakpoint=base and activeState=default', () => {
    writeActiveStyle(TARGET_ID, ['opacity'], 0.5)
    expect(target().style.base?.opacity).toBe(0.5)
    expect(target().style.mobile).toBeUndefined()
    expect(target().states).toBeUndefined()
  })

  it('Y-STR-07 DoD — write at activeBreakpoint=mobile lands in style.mobile, leaves base untouched', () => {
    const before = target()
    useSessionStore.getState().setActiveBreakpoint('mobile')

    writeActiveStyle(TARGET_ID, ['opacity'], 0.25)

    const after = target()
    expect(after.style.mobile?.opacity).toBe(0.25)
    // The base slot is byte-identical to before — never silently overwritten.
    expect(after.style.base).toEqual(before.style.base)
  })

  it('Y-STR-06 DoD — write at activeState=hover lands in states.hover, leaves base untouched', () => {
    const before = target()
    useSessionStore.getState().setActiveState('hover')

    writeActiveStyle(TARGET_ID, ['opacity'], 0.75)

    const after = target()
    expect(after.states?.hover?.opacity).toBe(0.75)
    expect(after.style.base).toEqual(before.style.base)
  })

  it('state precedence — when both activeBreakpoint=mobile and activeState=hover, write goes to states.hover', () => {
    useSessionStore.getState().setActiveBreakpoint('mobile')
    useSessionStore.getState().setActiveState('hover')

    writeActiveStyle(TARGET_ID, ['opacity'], 0.4)

    const node = target()
    expect(node.states?.hover?.opacity).toBe(0.4)
    // The breakpoint dimension is dropped — StatesMap is non-responsive.
    expect(node.style.mobile).toBeUndefined()
    expect(node.style.base?.opacity).toBe(1)
  })

  it('routes correctly with the renamed focus-visible state key', () => {
    useSessionStore.getState().setActiveState('focus-visible')

    writeActiveStyle(TARGET_ID, ['opacity'], 0.6)

    expect(target().states?.['focus-visible']?.opacity).toBe(0.6)
  })

  it('records exactly one history entry per write', () => {
    useSessionStore.getState().setActiveBreakpoint('mobile')
    writeActiveStyle(TARGET_ID, ['opacity'], 0.5)
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })
})

describe('resolveStyleProperty — Y-STR-07 inheritance DoD', () => {
  beforeEach(reset)

  it('returns the base value when only base is defined', () => {
    const node = target()
    expect(resolveStyleProperty(node, ['opacity'], 'base')).toBe(1)
    expect(resolveStyleProperty(node, ['opacity'], 'mobile')).toBe(1)
    expect(resolveStyleProperty(node, ['opacity'], 'tablet')).toBe(1)
  })

  it('returns the breakpoint-specific value when defined, falls back to base when not', () => {
    useSessionStore.getState().setActiveBreakpoint('mobile')
    writeActiveStyle(TARGET_ID, ['opacity'], 0.3)
    const node = target()

    // Active breakpoint reads its slot value.
    expect(resolveStyleProperty(node, ['opacity'], 'mobile')).toBe(0.3)
    // Sibling breakpoint with no override falls back to base.
    expect(resolveStyleProperty(node, ['opacity'], 'tablet')).toBe(1)
    // Base remains untouched.
    expect(resolveStyleProperty(node, ['opacity'], 'base')).toBe(1)
  })

  it('state override wins over both breakpoint and base', () => {
    // Seed mobile + hover overrides on the same property.
    useSessionStore.getState().setActiveBreakpoint('mobile')
    writeActiveStyle(TARGET_ID, ['opacity'], 0.5)
    useSessionStore.getState().setActiveBreakpoint('base')
    useSessionStore.getState().setActiveState('hover')
    writeActiveStyle(TARGET_ID, ['opacity'], 0.2)

    const node = target()

    // At hover, every breakpoint resolves to the state override.
    expect(resolveStyleProperty(node, ['opacity'], 'base', 'hover')).toBe(0.2)
    expect(resolveStyleProperty(node, ['opacity'], 'mobile', 'hover')).toBe(0.2)
    expect(resolveStyleProperty(node, ['opacity'], 'tablet', 'hover')).toBe(0.2)

    // At default state, the existing precedence holds: mobile sees its
    // own override, others see base.
    expect(resolveStyleProperty(node, ['opacity'], 'mobile', 'default')).toBe(0.5)
    expect(resolveStyleProperty(node, ['opacity'], 'base', 'default')).toBe(1)
  })

  it('state override only fires on properties it defines — falls through otherwise', () => {
    // Set hover for opacity, but the canvas asks for `borderRadius.all` at hover.
    useSessionStore.getState().setActiveState('hover')
    writeActiveStyle(TARGET_ID, ['opacity'], 0.2)
    useSessionStore.getState().setActiveState('default')
    writeActiveStyle(TARGET_ID, ['borderRadius', 'all'], '4px')

    const node = target()
    // Hover defines opacity → resolves to 0.2.
    expect(resolveStyleProperty(node, ['opacity'], 'base', 'hover')).toBe(0.2)
    // Hover doesn't define borderRadius.all → falls back to base.
    expect(resolveStyleProperty(node, ['borderRadius', 'all'], 'base', 'hover')).toBe('4px')
  })

  it('returns undefined when no slot defines the property', () => {
    const node = target()
    expect(resolveStyleProperty(node, ['transform'], 'mobile')).toBeUndefined()
    expect(resolveStyleProperty(node, ['transform'], 'base', 'hover')).toBeUndefined()
  })
})

describe('writeActiveLayout — breakpoint routing (M4)', () => {
  beforeEach(reset)

  it('writes layout.base at the base breakpoint', () => {
    writeActiveLayout(ROOT_ID, 'direction', 'row')
    expect(rootNode().layout.base.direction).toBe('row')
    expect(rootNode().layout.mobile).toBeUndefined()
  })

  it('writes layout[bp] at a non-base breakpoint and leaves base untouched', () => {
    const before = rootNode()
    useSessionStore.getState().setActiveBreakpoint('mobile')

    writeActiveLayout(ROOT_ID, 'gap', '8px')

    const after = rootNode()
    expect(after.layout.mobile?.gap).toBe('8px')
    expect(after.layout.base).toEqual(before.layout.base)
  })

  it('ignores activeState — layout is non-stateful, so it still targets the breakpoint slot', () => {
    useSessionStore.getState().setActiveState('hover')
    writeActiveLayout(ROOT_ID, 'direction', 'row')

    const after = rootNode()
    expect(after.layout.base.direction).toBe('row')
    expect(after.states).toBeUndefined()
  })
})

describe('resolveLayoutProperty — inheritance (M4)', () => {
  beforeEach(reset)

  it('returns base when no breakpoint override exists', () => {
    expect(resolveLayoutProperty(rootNode(), 'direction', 'base')).toBe('column')
    expect(resolveLayoutProperty(rootNode(), 'direction', 'mobile')).toBe('column')
  })

  it('returns the breakpoint override when present, else falls back to base', () => {
    useSessionStore.getState().setActiveBreakpoint('mobile')
    writeActiveLayout(ROOT_ID, 'gap', '8px')

    expect(resolveLayoutProperty(rootNode(), 'gap', 'mobile')).toBe('8px')
    expect(resolveLayoutProperty(rootNode(), 'direction', 'mobile')).toBe('column')
    expect(resolveLayoutProperty(rootNode(), 'gap', 'base')).toBeUndefined()
  })
})
