import { useEffect, useState, type JSX } from 'react'
import { Group, Panel, Separator, usePanelRef, type Layout } from 'react-resizable-panels'
import { PanelBottom, PanelLeft, PanelRight } from 'lucide-react'

import { Canvas } from './canvas/Canvas'
import { LayerPanel } from './layers/LayerPanel'
import { PropertiesPanel } from './panels/properties/PropertiesPanel'
import { TokensPanel } from './panels/tokens/TokensPanel'
import { MenuBar } from './topbar/MenuBar'
import { ThemeToggle } from './topbar/ThemeToggle'
import { ViewToggles, type ViewToggle } from './topbar/ViewToggles'
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

  const sidebarRef = usePanelRef()
  const propertiesRef = usePanelRef()
  const tokensRef = usePanelRef()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [tokensCollapsed, setTokensCollapsed] = useState(false)

  type PanelRef = ReturnType<typeof usePanelRef>
  const togglePanel = (ref: PanelRef): void => {
    const panel = ref.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  // Sync the toggle button states to the actual (possibly persisted-collapsed)
  // panel state once the imperative handles are attached.
  useEffect(() => {
    setSidebarCollapsed(sidebarRef.current?.isCollapsed() ?? false)
    setPropertiesCollapsed(propertiesRef.current?.isCollapsed() ?? false)
    setTokensCollapsed(tokensRef.current?.isCollapsed() ?? false)
  }, [sidebarRef, propertiesRef, tokensRef])

  const panelToggles: ViewToggle[] = [
    {
      id: 'sidebar',
      label: 'Layers panel',
      icon: <PanelLeft size={16} />,
      visible: !sidebarCollapsed,
      onToggle: () => togglePanel(sidebarRef),
    },
    {
      id: 'properties',
      label: 'Properties panel',
      icon: <PanelRight size={16} />,
      visible: !propertiesCollapsed,
      onToggle: () => togglePanel(propertiesRef),
    },
    {
      id: 'tokens',
      label: 'Tokens panel',
      icon: <PanelBottom size={16} />,
      visible: !tokensCollapsed,
      onToggle: () => togglePanel(tokensRef),
    },
  ]

  return (
    <div className={styles.app}>
      <header className={styles.titlebar}>
        <MenuBar panels={panelToggles} />
        <div className={styles.titlebarActions}>
          <ViewToggles toggles={panelToggles} />
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
            <Panel
              id={PANEL.sidebar}
              panelRef={sidebarRef}
              defaultSize="18"
              minSize="12"
              maxSize="35"
              collapsible
              collapsedSize={0}
              onResize={() => setSidebarCollapsed(sidebarRef.current?.isCollapsed() ?? false)}
            >
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

            <Panel
              id={PANEL.properties}
              panelRef={propertiesRef}
              defaultSize="20"
              minSize="14"
              maxSize="40"
              collapsible
              collapsedSize={0}
              onResize={() => setPropertiesCollapsed(propertiesRef.current?.isCollapsed() ?? false)}
            >
              <section className={styles.properties} aria-label="Properties">
                <PropertiesPanel />
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
            <TokensPanel
              collapsed={tokensCollapsed}
              onToggleCollapse={() => togglePanel(tokensRef)}
            />
          </section>
        </Panel>
      </Group>

      <footer className={styles.statusbar} />
    </div>
  )
}
