import { useState, type JSX } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'

import type { ElementNode } from '@document/types'
import { useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { Canvas } from './canvas/Canvas'
import { LayerPanel } from './layers/LayerPanel'
import { layerLabel } from './layers/layerMeta'
import styles from './App.module.css'

/** localStorage key for the main horizontal panel layout. */
const LAYOUT_STORAGE_KEY = 'dtw.layout.main'

/** Panel ids — also the keys in the persisted {@link Layout} map. */
const PANEL = {
  sidebar: 'sidebar',
  canvas: 'canvas',
  properties: 'properties',
} as const

/** Default column split (percentages of the group) used on first run. */
const DEFAULT_LAYOUT: Layout = {
  [PANEL.sidebar]: 18,
  [PANEL.canvas]: 62,
  [PANEL.properties]: 20,
}

/** Narrow an unknown JSON value to a {@link Layout} (id → numeric percentage). */
function isLayout(value: unknown): value is Layout {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
}

/** Read the persisted layout, falling back to {@link DEFAULT_LAYOUT}. */
function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (raw === null) return DEFAULT_LAYOUT
    const parsed: unknown = JSON.parse(raw)
    if (isLayout(parsed)) return parsed
  } catch {
    // Corrupt or unavailable storage — fall through to the default.
  }
  return DEFAULT_LAYOUT
}

/** Persist the layout after a resize settles (called from `onLayoutChanged`). */
function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

/**
 * Root editor shell (L-CAN-01).
 *
 * Renders the three-column resizable layout — Sidebar / Canvas / Properties —
 * and persists the column split to localStorage so it restores across reloads.
 * The panel contents are placeholders filled in by later L-CAN / L-SBR / L-PRP
 * tasks; this component owns only the frame and its persistence.
 */
export function App(): JSX.Element {
  const [defaultLayout] = useState(loadLayout)

  return (
    <div className={styles.app}>
      <header className={styles.titlebar}>
        <span className={styles.title}>Draw to Web</span>
      </header>

      <Group
        orientation="horizontal"
        className={styles.main}
        defaultLayout={defaultLayout}
        onLayoutChanged={saveLayout}
      >
        <Panel id={PANEL.sidebar} defaultSize="18" minSize="12" maxSize="35">
          <section className={styles.sidebar} aria-label="Layers">
            <LayerPanel />
          </section>
        </Panel>

        <Separator className={styles.handle}>
          <div className={styles.handleInner} />
        </Separator>

        <Panel id={PANEL.canvas} defaultSize="62" minSize="30">
          <section className={styles.canvas} aria-label="Canvas">
            <Canvas />
          </section>
        </Panel>

        <Separator className={styles.handle}>
          <div className={styles.handleInner} />
        </Separator>

        <Panel id={PANEL.properties} defaultSize="20" minSize="14" maxSize="40">
          <section className={styles.properties} aria-label="Properties">
            <SelectionInfo />
          </section>
        </Panel>
      </Group>

      <footer className={styles.statusbar} />
    </div>
  )
}

function Placeholder({ label, hint }: { label: string; hint: string }): JSX.Element {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderLabel}>{label}</span>
      <span className={styles.placeholderHint}>{hint}</span>
    </div>
  )
}

function findNode(node: ElementNode, id: string): ElementNode | undefined {
  if (node.id === id) return node
  if (node.type !== 'container') return undefined
  for (const child of node.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return undefined
}

/**
 * Placeholder inspector for M1: reflects the current selection so element
 * clicks are observably wired end-to-end (L-CAN-05). The real Properties
 * panel replaces this in the L-PRP tasks.
 */
function SelectionInfo(): JSX.Element {
  const selectedIds = useSessionStore((s) => s.selectedIds)
  const tree = useTree()

  if (selectedIds.length === 0) {
    return <Placeholder label="Properties" hint="Select an element to edit" />
  }

  const node = findNode(tree, selectedIds[0])
  const extra = selectedIds.length > 1 ? ` +${selectedIds.length - 1} more` : ''
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderLabel}>{node ? layerLabel(node) : 'Unknown'}</span>
      <span
        className={styles.placeholderHint}
      >{`${node ? node.type : selectedIds[0]}${extra}`}</span>
    </div>
  )
}
