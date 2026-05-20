import { useCallback, useEffect, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import {
  Download,
  Grid3x3,
  Image,
  MonitorSmartphone,
  MousePointer,
  PanelLeft,
  Redo2,
  Square,
  Type,
  Undo2,
} from 'lucide-react'
import Canvas from './components/Canvas'
import PropertiesPanel from './components/PropertiesPanel'
import LayerPanel from './components/LayerPanel'
import SEOConfigDialog from './components/SEOConfigDialog'
import ExportReportDialog from './components/ExportReportDialog'
import { useElementStore, useTemporalStore } from '../../store/elementStore'
import { exportProject, buildPreview, type ExportProjectResult } from '../../export'
import { deserializeProject, serializeProject } from '../../project'
import type { ActiveTool, SEOConfig } from '../../shared/types'
import styles from './App.module.css'

type DialogState =
  | { kind: 'none' }
  | { kind: 'seo' }
  | { kind: 'exporting' }
  | { kind: 'report'; result: ExportProjectResult }

const ICON_SIZE = 20

const TOOLS: { tool: ActiveTool; icon: JSX.Element; title: string }[] = [
  { tool: 'select', icon: <MousePointer size={ICON_SIZE} />, title: 'Select (V)' },
  { tool: 'rectangle', icon: <Square size={ICON_SIZE} />, title: 'Rectangle' },
  { tool: 'text', icon: <Type size={ICON_SIZE} />, title: 'Text' },
  { tool: 'image', icon: <Image size={ICON_SIZE} />, title: 'Image' },
]

export default function App(): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const replaceElements = useElementStore((s) => s.replaceElements)
  const selectedId = useElementStore((s) => s.selectedId)
  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const canUndo = useTemporalStore((s) => s.pastStates.length > 0)
  const canRedo = useTemporalStore((s) => s.futureStates.length > 0)

  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const [showGrid, setShowGrid] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarPanelRef = usePanelRef()
  const propsPanelRef = usePanelRef()

  const handleExportSubmit = useCallback(
    async (config: SEOConfig) => {
      setDialog({ kind: 'exporting' })
      const result = await exportProject(elements, config)
      setDialog({ kind: 'report', result })
    },
    [elements]
  )

  const handleSaveProject = useCallback(async () => {
    const json = serializeProject(elements)
    const res = await window.electronAPI.saveProject(json, 'project')
    if (!res.success && res.error) {
      window.alert(`Save failed: ${res.error}`)
    }
  }, [elements])

  const handleOpenProject = useCallback(async () => {
    const res = await window.electronAPI.openProject()
    if (!res.success) {
      if (res.error) window.alert(`Open failed: ${res.error}`)
      return
    }
    if (!res.json) return
    const parsed = deserializeProject(res.json)
    if (!parsed) {
      window.alert('Project file is malformed or unsupported version')
      return
    }
    replaceElements(parsed.elements)
  }, [replaceElements])

  // Sync preview window content whenever elements change (debounced 300 ms).
  useEffect(() => {
    if (!previewOpen) return
    let cancelled = false
    const timer = setTimeout(() => {
      void buildPreview(elements).then((preview) => {
        if (cancelled || !preview) return
        void window.electronAPI.updatePreview(preview.html, preview.css)
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [elements, previewOpen])

  // When the preview window is closed by the user, clear the active state.
  useEffect(() => {
    return window.electronAPI.onPreviewClosed(() => setPreviewOpen(false))
  }, [])

  // Expand or collapse the properties panel based on selection.
  useEffect(() => {
    const panel = propsPanelRef.current
    if (!panel) return
    if (selectedId) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [selectedId])

  useEffect(() => {
    return window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'export':
          setDialog({ kind: 'seo' })
          break
        case 'save-project':
          void handleSaveProject()
          break
        case 'open-project':
          void handleOpenProject()
          break
      }
    })
  }, [handleSaveProject, handleOpenProject])

  return (
    <div className={styles.app}>
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <header className={styles.titlebar}>
        <div className={styles.titlebarLeft}>
          <button
            className={styles.titlebarBtn}
            disabled={!canUndo}
            onClick={() => undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={ICON_SIZE} />
          </button>
          <button
            className={styles.titlebarBtn}
            disabled={!canRedo}
            onClick={() => redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={ICON_SIZE} />
          </button>
        </div>

        <div className={styles.titlebarRight}>
          <button
            className={styles.exportBtn}
            onClick={() => setDialog({ kind: 'seo' })}
            title="Export to ZIP (Ctrl+E)"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      {/* ── Activity bar ──────────────────────────────────────────────── */}
      <div className={styles.activityBar}>
        {/* Sidebar toggle */}
        <button
          className={`${styles.activityBtn} ${sidebarOpen ? styles.activityBtnActive : ''}`}
          onClick={() => {
            const panel = sidebarPanelRef.current
            if (!panel) return
            if (panel.isCollapsed()) {
              panel.expand()
            } else {
              panel.collapse()
            }
          }}
          title="Toggle Layers Panel"
        >
          <PanelLeft size={ICON_SIZE} />
        </button>

        <div className={styles.activityDivider} />

        {/* Drawing tools */}
        {TOOLS.map(({ tool, icon, title }) => (
          <button
            key={tool}
            className={`${styles.activityBtn} ${activeTool === tool ? styles.activityBtnActive : ''}`}
            onClick={() => setActiveTool(tool)}
            title={title}
          >
            {icon}
          </button>
        ))}

        <div className={styles.activitySpacer} />

        {/* Live preview toggle */}
        <button
          className={`${styles.activityBtn} ${previewOpen ? styles.activityBtnActive : ''}`}
          onClick={() => {
            void window.electronAPI.openPreviewWindow()
            setPreviewOpen(true)
          }}
          title="Live Preview"
        >
          <MonitorSmartphone size={ICON_SIZE} />
        </button>

        {/* Grid toggle */}
        <button
          className={`${styles.activityBtn} ${showGrid ? styles.activityBtnActive : ''}`}
          onClick={() => setShowGrid((v) => !v)}
          title="Toggle Grid (G)"
        >
          <Grid3x3 size={ICON_SIZE} />
        </button>
      </div>

      {/* ── Resizable main content ────────────────────────────────────── */}
      <Group orientation="horizontal" className={styles.mainContent}>
        <Panel
          panelRef={sidebarPanelRef}
          defaultSize="18"
          minSize="12"
          maxSize="35"
          collapsible
          collapsedSize={0}
          onResize={(size) => setSidebarOpen(size.asPercentage > 0)}
        >
          <div className={styles.sidebar}>
            <LayerPanel />
          </div>
        </Panel>

        <Separator className={styles.resizeHandle}>
          <div className={styles.resizeHandleInner} />
        </Separator>

        <Panel defaultSize="62" minSize="30">
          <div className={styles.canvas}>
            <Canvas
              activeTool={activeTool}
              showGrid={showGrid}
              onToolReset={() => setActiveTool('select')}
            />
          </div>
        </Panel>

        <Separator className={styles.resizeHandle}>
          <div className={styles.resizeHandleInner} />
        </Separator>

        <Panel
          panelRef={propsPanelRef}
          defaultSize="20"
          minSize="14"
          maxSize="40"
          collapsible
          collapsedSize={0}
        >
          <div className={styles.properties}>
            <PropertiesPanel />
          </div>
        </Panel>
      </Group>

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div className={styles.statusbar}>
        <span className={styles.statusItem}>
          {elements.length} element{elements.length !== 1 ? 's' : ''}
        </span>
        <span className={styles.statusItem}>100%</span>
        <span className={styles.statusItem}>Draw to Web v1.0</span>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <SEOConfigDialog
        open={dialog.kind === 'seo'}
        onClose={() => setDialog({ kind: 'none' })}
        onSubmit={handleExportSubmit}
      />

      {dialog.kind === 'exporting' && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>Generating export…</div>
        </div>
      )}

      {dialog.kind === 'report' && (
        <ExportReportDialog
          result={dialog.result}
          onClose={() => setDialog({ kind: 'none' })}
          onRetry={() => setDialog({ kind: 'seo' })}
        />
      )}
    </div>
  )
}
