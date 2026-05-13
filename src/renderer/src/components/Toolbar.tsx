import { useTemporalStore } from '../../../store/elementStore'
import type { ActiveTool } from '../../../shared/types'

export interface ToolbarProps {
  activeTool: ActiveTool
  onToolChange: (tool: ActiveTool) => void
  showGrid: boolean
  onToggleGrid: () => void
  onExport: () => void
}

interface ToolButtonProps {
  label: string
  title: string
  active?: boolean
  onClick: () => void
}

function ToolButton({ label, title, active = false, onClick }: ToolButtonProps): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        height: 30,
        padding: '0 10px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#fff' : '#bbb',
        background: active ? '#4a9eff' : 'transparent',
        border: active ? 'none' : '1px solid #444',
        borderRadius: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

const DRAWING_TOOLS: { tool: Exclude<ActiveTool, 'select'>; label: string; title: string }[] = [
  { tool: 'rectangle', label: 'Rect', title: 'Rectangle — click canvas to place' },
  { tool: 'text', label: 'Text', title: 'Text — click canvas to place' },
  { tool: 'image', label: 'Image', title: 'Image placeholder — click canvas to place' },
  { tool: 'button', label: 'Button', title: 'Button — click canvas to place' },
]

/** Top toolbar — tool selection, grid toggle, undo/redo, export — owned by Luf8y */
export default function Toolbar({
  activeTool,
  onToolChange,
  showGrid,
  onToggleGrid,
  onExport,
}: ToolbarProps): JSX.Element {
  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const pastStates = useTemporalStore((s) => s.pastStates)
  const futureStates = useTemporalStore((s) => s.futureStates)

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  return (
    <div style={toolbarStyle}>
      <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginRight: 8 }}>
        Draw to Web
      </span>

      <div style={dividerStyle} />

      {/* Pointer / select tool */}
      <ToolButton
        label="Select"
        title="Select / move tool (V)"
        active={activeTool === 'select'}
        onClick={() => onToolChange('select')}
      />

      {/* Drawing tools */}
      {DRAWING_TOOLS.map(({ tool, label, title }) => (
        <ToolButton
          key={tool}
          label={label}
          title={title}
          active={activeTool === tool}
          onClick={() => onToolChange(tool)}
        />
      ))}

      <div style={dividerStyle} />

      {/* Grid toggle */}
      <ToolButton
        label={showGrid ? 'Grid On' : 'Grid Off'}
        title="Toggle 12-column grid overlay (G)"
        active={showGrid}
        onClick={onToggleGrid}
      />

      <div style={dividerStyle} />

      {/* Undo / Redo */}
      <button
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => undo()}
        style={{ ...iconBtnStyle, opacity: canUndo ? 1 : 0.35 }}
      >
        Undo
      </button>
      <button
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => redo()}
        style={{ ...iconBtnStyle, opacity: canRedo ? 1 : 0.35 }}
      >
        Redo
      </button>

      {/* Spacer pushes Export to the right */}
      <div style={{ flex: 1 }} />

      {/* Export */}
      <button title="Export to ZIP (Ctrl+E)" onClick={onExport} style={exportBtnStyle}>
        Export
      </button>
    </div>
  )
}

const toolbarStyle: React.CSSProperties = {
  height: 48,
  background: '#111',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 6,
  flexShrink: 0,
  userSelect: 'none',
}

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: '#333',
  margin: '0 4px',
  flexShrink: 0,
}

const iconBtnStyle: React.CSSProperties = {
  height: 30,
  padding: '0 10px',
  fontSize: 12,
  color: '#bbb',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
}

const exportBtnStyle: React.CSSProperties = {
  height: 30,
  padding: '0 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  background: '#1a6fba',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
}
