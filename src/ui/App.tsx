import { useState, type JSX } from 'react'
import { Group, Panel, Separator, usePanelRef, type Layout } from 'react-resizable-panels'

import type { ElementNode } from '@document/types'
import { useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { Canvas } from './canvas/Canvas'
import { LayerPanel } from './layers/LayerPanel'
import { layerLabel } from './layers/layerMeta'
import { TokensPanel } from './panels/tokens/TokensPanel'
import { ThemeToggle } from './topbar/ThemeToggle'
import styles from './App.module.css'

/** localStorage keys for each persisted panel group. */
const COLUMNS_KEY = 'dtw.layout.main'
const ROWS_KEY = 'dtw.layout.vertical'

/** Panel ids — also the keys in each persisted {@link Layout} map. */
const PANEL = {
  sidebar: 'sidebar',
  canvas: 'canvas',
  properties: 'properties',
  workspace: 'workspace',
  tokens: 'tokens',
} as const

const DEFAULT_COLUMNS: Layout = {
  [PANEL.sidebar]: 18,
  [PANEL.canvas]: 62,
  [PANEL.properties]: 20,
}

const DEFAULT_ROWS: Layout = {
  [PANEL.workspace]: 74,
  [PANEL.tokens]: 26,
}

/** Narrow an unknown JSON value to a {@link Layout} (id → numeric percentage). */
function isLayout(value: unknown): value is Layout {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
}

/** Read a persisted layout for `key`, falling back to `fallback`. */
function loadLayout(key: string, fallback: Layout): Layout {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (isLayout(parsed)) return parsed
  } catch {
    // Corrupt or unavailable storage — fall through to the default.
  }
  return fallback
}

/** Persist `layout` under `key` after a resize settles. */
function saveLayout(key: string, layout: Layout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

/**
 * Root editor shell.
 *
 * Three resizable columns (Sidebar / Canvas / Properties) over a collapsible
 * bottom Tokens panel; both splits persist to localStorage. The topbar holds
 * the theme toggle (L-TOP-01); the bottom panel hosts the Tokens UI (L-TKN).
 */
export function App(): JSX.Element {
  const [columns] = useState(() => loadLayout(COLUMNS_KEY, DEFAULT_COLUMNS))
  const [rows] = useState(() => loadLayout(ROWS_KEY, DEFAULT_ROWS))

  const tokensRef = usePanelRef()
  const [tokensCollapsed, setTokensCollapsed] = useState(false)

  const toggleTokens = (): void => {
    const panel = tokensRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  return (
    <div className={styles.app}>
      <header className={styles.titlebar}>
        <span className={styles.title}>Draw to Web</span>
        <div className={styles.titlebarActions}>
          <ThemeToggle />
        </div>
      </header>

      <Group
        orientation="vertical"
        className={styles.main}
        defaultLayout={rows}
        onLayoutChanged={(layout) => saveLayout(ROWS_KEY, layout)}
      >
        <Panel id={PANEL.workspace} defaultSize="74" minSize="40">
          <Group
            orientation="horizontal"
            className={styles.workspace}
            defaultLayout={columns}
            onLayoutChanged={(layout) => saveLayout(COLUMNS_KEY, layout)}
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
        </Panel>

        <Separator className={styles.handleH}>
          <div className={styles.handleHInner} />
        </Separator>

        <Panel
          id={PANEL.tokens}
          panelRef={tokensRef}
          defaultSize="26"
          minSize="12"
          collapsible
          collapsedSize="34px"
          onResize={() => setTokensCollapsed(tokensRef.current?.isCollapsed() ?? false)}
        >
          <section className={styles.tokens} aria-label="Tokens">
            <TokensPanel collapsed={tokensCollapsed} onToggleCollapse={toggleTokens} />
          </section>
        </Panel>
      </Group>

      <footer className={styles.statusbar} />
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
    return (
      <div className={styles.placeholder}>
        <span className={styles.placeholderLabel}>Properties</span>
        <span className={styles.placeholderHint}>Select an element to edit</span>
      </div>
    )
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
