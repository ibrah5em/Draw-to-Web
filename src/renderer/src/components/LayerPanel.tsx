import { useRef, useState } from 'react'
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image,
  Lock,
  MousePointer,
  Square,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react'
import { useElementStore } from '../../../store/elementStore'
import type { CanvasElement } from '../../../store/elementStore'
import styles from './LayerPanel.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<CanvasElement['type'], string> = {
  rectangle: 'Rectangle',
  text: 'Text',
  image: 'Image',
  button: 'Button',
}

const TYPE_ICONS: Record<CanvasElement['type'], JSX.Element> = {
  rectangle: <Square size={14} />,
  text: <Type size={14} />,
  image: <Image size={14} />,
  button: <MousePointer size={14} />,
}

// ---------------------------------------------------------------------------
// Layer row
// ---------------------------------------------------------------------------

interface LayerRowProps {
  el: CanvasElement
  displayName: string
  isSelected: boolean
  isDropTarget: boolean
  onSelect: () => void
  onVisibilityToggle: () => void
  onLockToggle: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onNameCommit: (name: string) => void
}

function LayerRow({
  el,
  displayName,
  isSelected,
  isDropTarget,
  onSelect,
  onVisibilityToggle,
  onLockToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onNameCommit,
}: LayerRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const isVisible = el.visible !== false
  const isLocked = el.locked === true

  const startEdit = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setDraft(displayName)
    setEditing(true)
  }

  const commitEdit = (): void => {
    const trimmed = draft.trim()
    if (trimmed) onNameCommit(trimmed)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={[
        styles.item,
        isSelected ? styles.itemSelected : '',
        isDropTarget ? styles.dropTarget : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ opacity: isVisible ? 1 : 0.45 }}
    >
      <span className={styles.dragHandle}>
        <GripVertical size={14} />
      </span>

      <span className={styles.typeIcon}>{TYPE_ICONS[el.type]}</span>

      {editing ? (
        <input
          autoFocus
          className={styles.nameInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.name} onDoubleClick={startEdit}>
          {displayName}
        </span>
      )}

      <button
        className={`${styles.iconBtn} ${!isVisible ? styles.iconBtnActive : ''}`}
        title={isVisible ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation()
          onVisibilityToggle()
        }}
      >
        {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>

      <button
        className={`${styles.iconBtn} ${isLocked ? styles.iconBtnActive : ''}`}
        title={isLocked ? 'Unlock' : 'Lock'}
        onClick={(e) => {
          e.stopPropagation()
          onLockToggle()
        }}
      >
        {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/** Left sidebar layers panel — owned by Luf8y */
export default function LayerPanel(): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const selectedId = useElementStore((s) => s.selectedId)
  const setSelected = useElementStore((s) => s.setSelected)
  const updateElement = useElementStore((s) => s.updateElement)
  const removeElement = useElementStore((s) => s.removeElement)
  const reorderElement = useElementStore((s) => s.reorderElement)
  const addElement = useElementStore((s) => s.addElement)

  const dragIndexRef = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // Display order: topmost layer first (reverse of array order)
  const reversed = [...elements].reverse()

  // Auto-generated display names (e.g. "Rectangle 1")
  const typeCounts = new Map<string, number>()
  const displayNames = elements.map((el) => {
    const count = (typeCounts.get(el.type) ?? 0) + 1
    typeCounts.set(el.type, count)
    return el.layerName ?? `${TYPE_NAMES[el.type]} ${count}`
  })
  // reversed display names aligned to reversed
  const reversedNames = [...displayNames].reverse()

  const handleDragStart = (visualIndex: number): void => {
    dragIndexRef.current = visualIndex
  }

  const handleDragOver = (e: React.DragEvent, visualIndex: number): void => {
    e.preventDefault()
    setDropTarget(visualIndex)
  }

  const handleDrop = (targetVI: number): void => {
    const sourceVI = dragIndexRef.current
    if (sourceVI === null || sourceVI === targetVI) {
      dragIndexRef.current = null
      setDropTarget(null)
      return
    }
    const n = elements.length
    const sourceArrayIndex = n - 1 - sourceVI
    const targetArrayIndex = n - 1 - targetVI
    const id = elements[sourceArrayIndex]?.id
    if (id) reorderElement(id, targetArrayIndex)
    dragIndexRef.current = null
    setDropTarget(null)
  }

  const selectedEl = selectedId ? (elements.find((e) => e.id === selectedId) ?? null) : null

  const handleDelete = (): void => {
    if (selectedId) removeElement(selectedId)
  }

  const handleDuplicate = (): void => {
    if (!selectedEl) return
    const { id: _id, ...rest } = selectedEl
    addElement({ ...rest, y: rest.y + 20, layerName: undefined })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Layers</div>

      {elements.length === 0 ? (
        <p className={styles.empty}>No elements yet.</p>
      ) : (
        <div className={styles.list}>
          {reversed.map((el, vi) => (
            <LayerRow
              key={el.id}
              el={el}
              displayName={reversedNames[vi] ?? el.type}
              isSelected={el.id === selectedId}
              isDropTarget={dropTarget === vi && dragIndexRef.current !== vi}
              onSelect={() => setSelected(el.id)}
              onVisibilityToggle={() => updateElement(el.id, { visible: el.visible === false })}
              onLockToggle={() => updateElement(el.id, { locked: !el.locked })}
              onDragStart={() => handleDragStart(vi)}
              onDragOver={(e) => handleDragOver(e, vi)}
              onDrop={() => handleDrop(vi)}
              onNameCommit={(name) => updateElement(el.id, { layerName: name })}
            />
          ))}
        </div>
      )}

      <div className={styles.toolbar}>
        <button
          className={`${styles.toolbarBtn} ${styles.toolbarBtnDanger}`}
          title="Delete selected (Del)"
          disabled={!selectedId}
          onClick={handleDelete}
        >
          <Trash2 size={16} />
        </button>
        <button
          className={styles.toolbarBtn}
          title="Duplicate selected"
          disabled={!selectedId}
          onClick={handleDuplicate}
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  )
}
