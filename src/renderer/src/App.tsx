import { useCallback, useEffect, useState } from 'react'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PropertiesPanel from './components/PropertiesPanel'
import LivePreview from './components/LivePreview'
import SEOConfigDialog from './components/SEOConfigDialog'
import ExportReportDialog from './components/ExportReportDialog'
import { useElementStore } from '../../store/elementStore'
import { exportProject, type ExportProjectResult } from '../../export'
import { deserializeProject, serializeProject } from '../../project'
import type { ActiveTool, SEOConfig } from '../../shared/types'

type DialogState =
  | { kind: 'none' }
  | { kind: 'seo' }
  | { kind: 'exporting' }
  | { kind: 'report'; result: ExportProjectResult }

export default function App(): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const replaceElements = useElementStore((s) => s.replaceElements)
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const [showGrid, setShowGrid] = useState(true)

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onExport={() => setDialog({ kind: 'seo' })}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Canvas
          activeTool={activeTool}
          showGrid={showGrid}
          onToolReset={() => setActiveTool('select')}
        />
        <LivePreview />
        <PropertiesPanel />
      </div>

      <SEOConfigDialog
        open={dialog.kind === 'seo'}
        onClose={() => setDialog({ kind: 'none' })}
        onSubmit={handleExportSubmit}
      />

      {dialog.kind === 'exporting' && (
        <div style={overlayStyle}>
          <div style={spinnerCardStyle}>Generating export…</div>
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

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const spinnerCardStyle: React.CSSProperties = {
  background: '#242424',
  border: '1px solid #444',
  borderRadius: 8,
  padding: '20px 32px',
  color: '#f0f0f0',
  fontSize: 14,
}
