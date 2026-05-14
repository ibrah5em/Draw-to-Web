import { useRef, useState } from 'react'
import { useElementStore } from '../../../store/elementStore'
import type { CanvasElement } from '../../../store/elementStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<CanvasElement['type'], string> = {
  rectangle: '□',
  text: 'T',
  image: '⬜',
  button: '◉',
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface LayerRowProps {
  el: CanvasElement
  /** Visual index (0 = topmost layer). */
  visualIndex: number
  isSelected: boolean
  onSelect: (id: string) => void
  onLockToggle: (id: string, locked: boolean) => void
  onVisibleToggle: (id: string, visible: boolean) => void
  onDragStart: (visualIndex: number) => void
  onDragOver: (e: React.DragEvent, visualIndex: number) => void
  onDrop: (visualIndex: number) => void
}

function LayerRow({
  el,
  visualIndex,
  isSelected,
  onSelect,
  onLockToggle,
  onVisibleToggle,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerRowProps): JSX.Element {
  const isVisible = el.visible !== false
  const isLocked = el.locked === true

  return (
    <div
      draggable
      onDragStart={() => onDragStart(visualIndex)}
      onDragOver={(e) => onDragOver(e, visualIndex)}
      onDrop={() => onDrop(visualIndex)}
      onClick={() => onSelect(el.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        cursor: 'pointer',
        background: isSelected ? '#1a3a5c' : 'transparent',
        borderLeft: isSelected ? '2px solid #4a9eff' : '2px solid transparent',
        borderRadius: 2,
        opacity: isVisible ? 1 : 0.4,
        userSelect: 'none',
      }}
    >
      {/* Drag handle */}
      <span style={{ color: '#555', fontSize: 10, cursor: 'grab' }}>⠿</span>

      {/* Type badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#888',
          background: '#222',
          padding: '1px 4px',
          borderRadius: 2,
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {TYPE_BADGE[el.type]}
      </span>

      {/* Layer name — truncated */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: isSelected ? '#fff' : '#ccc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {el.layerName || el.type}
      </span>

      {/* Lock toggle */}
      <button
        title={isLocked ? 'Unlock' : 'Lock'}
        onClick={(e) => {
          e.stopPropagation()
          onLockToggle(el.id, !isLocked)
        }}
        style={iconBtnStyle(isLocked)}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Visibility toggle */}
      <button
        title={isVisible ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation()
          onVisibleToggle(el.id, !isVisible)
        }}
        style={iconBtnStyle(!isVisible)}
      >
        {isVisible ? '👁' : '—'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/** Bottom layer panel — element stack, reorder by drag, lock/hide per element — owned by Luf8y */
export default function LayerPanel(): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const selectedId = useElementStore((s) => s.selectedId)
  const setSelected = useElementStore((s) => s.setSelected)
  const updateElement = useElementStore((s) => s.updateElement)
  const reorderElement = useElementStore((s) => s.reorderElement)

  const dragVisualIndex = useRef<number | null>(null)
  // Track which row is being dragged over for a visual drop indicator
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // Display order: topmost layer first (reverse of array order)
  const reversed = [...elements].reverse()

  const handleDragStart = (vi: number): void => {
    dragVisualIndex.current = vi
  }

  const handleDragOver = (e: React.DragEvent, vi: number): void => {
    e.preventDefault()
    setDropTarget(vi)
  }

  const handleDrop = (targetVI: number): void => {
    const sourceVI = dragVisualIndex.current
    if (sourceVI === null || sourceVI === targetVI) {
      dragVisualIndex.current = null
      setDropTarget(null)
      return
    }
    const n = elements.length
    // visual index 0 = array index n-1
    const sourceArrayIndex = n - 1 - sourceVI
    const targetArrayIndex = n - 1 - targetVI
    const id = elements[sourceArrayIndex]?.id
    if (id) reorderElement(id, targetArrayIndex)
    dragVisualIndex.current = null
    setDropTarget(null)
  }

  if (elements.length === 0) {
    return (
      <div style={panelStyle}>
        <span style={{ fontSize: 11, color: '#555' }}>No elements yet.</span>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#555',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        Layers
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {reversed.map((el, vi) => (
          <div
            key={el.id}
            style={{
              borderTop:
                dropTarget === vi && dragVisualIndex.current !== vi
                  ? '1px solid #4a9eff'
                  : '1px solid transparent',
            }}
          >
            <LayerRow
              el={el}
              visualIndex={vi}
              isSelected={el.id === selectedId}
              onSelect={setSelected}
              onLockToggle={(id, locked) => updateElement(id, { locked })}
              onVisibleToggle={(id, visible) => updateElement(id, { visible })}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  height: 160,
  background: '#111',
  borderTop: '1px solid #333',
  padding: '8px 8px 4px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    fontSize: 9,
    fontWeight: 700,
    color: active ? '#4a9eff' : '#555',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    lineHeight: '18px',
    textAlign: 'center',
  }
}
