import { useEffect, useState, type JSX } from 'react'
import { Group, Panel, Separator, usePanelRef, type Layout } from 'react-resizable-panels'
import { PanelBottom, PanelLeft, PanelRight } from 'lucide-react'

import { createBlankTemplate } from '@templates/blank'
import { createPortfolioTemplate } from '@templates/portfolio'
import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { Canvas } from './canvas/Canvas'
import { Welcome, type WelcomeTemplate } from './dialogs/Welcome'
import { LayerPanel } from './layers/LayerPanel'
import { PropertiesPanel } from './panels/properties/PropertiesPanel'
import { TokensPanel } from './panels/tokens/TokensPanel'
import { InsertDndProvider } from './sidebar/InsertDnd'
import { InsertSidebar } from './sidebar/InsertSidebar'
import { BreakpointSwitcher } from './topbar/BreakpointSwitcher'
import { MenuBar } from './topbar/MenuBar'
import { ThemeToggle } from './topbar/ThemeToggle'
import { ViewToggles, type ViewToggle } from './topbar/ViewToggles'
import styles from './App.module.css'

/** localStorage keys for each persisted panel group. */
const COLUMNS_KEY = 'dtw.layout.main'
const ROWS_KEY = 'dtw.layout.vertical'
const SIDEBAR_KEY = 'dtw.layout.sidebar'

/** Panel ids — also the keys in each persisted {@link Layout} map. */
const PANEL = {
  sidebar: 'sidebar',
  canvas: 'canvas',
  properties: 'properties',
  workspace: 'workspace',
  tokens: 'tokens',
  insert: 'insert',
  layers: 'layers',
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

const DEFAULT_SIDEBAR: Layout = {
  [PANEL.insert]: 55,
  [PANEL.layers]: 45,
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
  const [sidebarRows] = useState(() => loadLayout(SIDEBAR_KEY, DEFAULT_SIDEBAR))
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => useSessionStore.getState().currentFilePath === null
  )

  const closeWelcome = (): void => setWelcomeOpen(false)
  const openWelcome = (): void => setWelcomeOpen(true)

  const newBlank = (): void => {
    useDocumentStore.getState().hydrate(createBlankTemplate())
    closeWelcome()
  }
  const openProject = async (): Promise<void> => {
    const api = (globalThis as { electronAPI?: Window['electronAPI'] }).electronAPI
    if (!api?.openProject) {
      closeWelcome()
      return
    }
    const result = await api.openProject()
    if (result.success && result.json) {
      try {
        const parsed = JSON.parse(result.json) as Parameters<
          ReturnType<typeof useDocumentStore.getState>['hydrate']
        >[0]
        useDocumentStore.getState().hydrate(parsed)
        if (result.filePath) useSessionStore.getState().setCurrentFilePath(result.filePath)
        closeWelcome()
      } catch {
        // Bad JSON — leave the welcome open so the user can try again.
      }
    }
  }
  const openTemplate = (template: WelcomeTemplate): void => {
    if (template === 'portfolio') {
      useDocumentStore.getState().hydrate(createPortfolioTemplate())
    } else if (template === 'blank') {
      useDocumentStore.getState().hydrate(createBlankTemplate())
    }
    closeWelcome()
  }
  const openRecent = async (path: string): Promise<void> => {
    void path
    // Recent-open requires a `loadFromPath` IPC that isn't wired yet (I-ELE-07
    // covers persistence; reading by absolute path is downstream of that). Fall
    // back to the standard open flow so the user still gets to a project.
    await openProject()
  }

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
          <BreakpointSwitcher />
          <ViewToggles toggles={panelToggles} />
          <ThemeToggle />
        </div>
      </header>

      <InsertDndProvider>
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
                <section className={styles.sidebar} aria-label="Insert and Layers">
                  <Group
                    orientation="vertical"
                    className={styles.sidebarStack}
                    defaultLayout={sidebarRows}
                    onLayoutChanged={(layout) => saveLayout(SIDEBAR_KEY, layout)}
                  >
                    <Panel id={PANEL.insert} defaultSize="55" minSize="20">
                      <div className={styles.sidebarRegion} aria-label="Insert">
                        <InsertSidebar />
                      </div>
                    </Panel>

                    <Separator className={styles.handleH}>
                      <div className={styles.handleHInner} />
                    </Separator>

                    <Panel id={PANEL.layers} defaultSize="45" minSize="15">
                      <div className={styles.sidebarRegion} aria-label="Layers">
                        <LayerPanel />
                      </div>
                    </Panel>
                  </Group>
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
                onResize={() =>
                  setPropertiesCollapsed(propertiesRef.current?.isCollapsed() ?? false)
                }
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
      </InsertDndProvider>

      <Welcome
        open={welcomeOpen}
        onClose={closeWelcome}
        onNew={newBlank}
        onOpen={() => void openProject()}
        onTemplate={openTemplate}
        onRecent={(path) => void openRecent(path)}
      />

      <footer className={styles.statusbar} />
      {/* expose welcome opener for future MenuBar wiring */}
      <span hidden data-testid="welcome-opener" onClick={openWelcome} />
    </div>
  )
}
