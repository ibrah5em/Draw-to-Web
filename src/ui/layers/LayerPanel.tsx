/**
 * Layers tree (L-LYR-01).
 *
 * A `react-arborist` tree projection of the document tree. Each row shows a
 * type icon, the element label, and visibility / lock toggles. Selection is
 * bidirectional with the canvas through `sessionStore.selectedIds`: the
 * controlled `selection` prop reflects canvas → tree, and `onSelect` writes
 * tree → canvas.
 *
 * Visibility / lock are editor-only flags stored in the UI-lane `viewPrefs`
 * store: the canvas reads them to skip painting hidden elements and to ignore
 * interaction on locked ones. They are ephemeral (never serialized) and have
 * no effect on the exported output.
 *
 * Virtualization (Y-PRF-03): `react-arborist` renders rows through
 * `react-window`'s `FixedSizeList`, so only the visible window of rows is
 * mounted. The two preconditions are wired below — a bounded `height` from
 * `useElementSize` and a fixed `rowHeight` — which is what keeps a 500-node
 * tree scrolling at 60 fps; `overscanCount` mounts a few rows beyond the
 * viewport so fast scrolls don't flash blank rows.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Tree, type NodeApi, type NodeRendererProps } from 'react-arborist'
import {
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  List as ListIcon,
  Lock,
  Minus,
  MousePointer,
  Star,
  Type,
  Unlock,
  type LucideIcon,
} from 'lucide-react'

import type { ElementNode, ElementType } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { useViewPrefs } from '../state/viewPrefs'
import { layerLabel } from './layerMeta'
import styles from './LayerPanel.module.css'

const TYPE_ICON: Record<ElementType, LucideIcon> = {
  container: Box,
  text: Type,
  image: ImageIcon,
  button: MousePointer,
  link: LinkIcon,
  icon: Star,
  list: ListIcon,
  divider: Minus,
}

interface LayerFlags {
  readonly hidden: ReadonlySet<string>
  readonly locked: ReadonlySet<string>
  readonly toggleHidden: (id: string) => void
  readonly toggleLocked: (id: string) => void
}

const LayerFlagsContext = createContext<LayerFlags>({
  hidden: new Set(),
  locked: new Set(),
  toggleHidden: () => {},
  toggleLocked: () => {},
})

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function LayerRow({ node, style }: NodeRendererProps<ElementNode>): JSX.Element {
  const el = node.data
  const flags = useContext(LayerFlagsContext)
  const hidden = flags.hidden.has(el.id)
  const locked = flags.locked.has(el.id)
  const Icon = TYPE_ICON[el.type]

  const rowClass = [styles.row, node.isSelected ? styles.selected : ''].filter(Boolean).join(' ')

  return (
    <div className={rowClass} style={{ ...style, opacity: hidden ? 0.45 : 1 }}>
      {node.isInternal ? (
        <button
          className={styles.twisty}
          onClick={(event) => {
            event.stopPropagation()
            node.toggle()
          }}
          aria-label={node.isOpen ? 'Collapse' : 'Expand'}
        >
          {node.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className={styles.twistySpacer} />
      )}

      <Icon size={14} className={styles.typeIcon} />
      {node.isEditing ? (
        <input
          className={styles.renameInput}
          autoFocus
          defaultValue={layerLabel(el)}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => node.submit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') node.submit(event.currentTarget.value)
            if (event.key === 'Escape') node.reset()
          }}
          aria-label="Rename layer"
          spellCheck={false}
        />
      ) : (
        <span
          className={styles.name}
          onDoubleClick={(event) => {
            event.stopPropagation()
            node.edit()
          }}
        >
          {layerLabel(el)}
        </span>
      )}

      <button
        className={styles.action}
        title={hidden ? 'Show' : 'Hide'}
        aria-label={hidden ? 'Show layer' : 'Hide layer'}
        onClick={(event) => {
          event.stopPropagation()
          flags.toggleHidden(el.id)
        }}
      >
        {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>

      <button
        className={styles.action}
        title={locked ? 'Unlock' : 'Lock'}
        aria-label={locked ? 'Unlock layer' : 'Lock layer'}
        onClick={(event) => {
          event.stopPropagation()
          flags.toggleLocked(el.id)
        }}
      >
        {locked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>
    </div>
  )
}

function useElementSize(): [React.RefObject<HTMLDivElement>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

/** The Layers panel — a tree view of the document, synced to canvas selection. */
export function LayerPanel(): JSX.Element {
  const tree = useTree()
  const selectedIds = useSessionStore((s) => s.selectedIds)
  const setSelectedIds = useSessionStore((s) => s.setSelectedIds)

  const hidden = useViewPrefs((s) => s.hiddenIds)
  const locked = useViewPrefs((s) => s.lockedIds)
  const toggleHidden = useViewPrefs((s) => s.toggleHidden)
  const toggleLocked = useViewPrefs((s) => s.toggleLocked)
  const flags = useMemo<LayerFlags>(
    () => ({ hidden, locked, toggleHidden, toggleLocked }),
    [hidden, locked, toggleHidden, toggleLocked]
  )

  const [wrapRef, size] = useElementSize()

  const handleSelect = (nodes: NodeApi<ElementNode>[]): void => {
    const ids = nodes.map((n) => n.id)
    if (sameIds(ids, useSessionStore.getState().selectedIds)) return
    setSelectedIds(ids)
  }

  // Rename in place (L-LYR-03). Persists to `element.name` through the C3
  // dispatcher so it is one undoable history entry; an empty/whitespace name
  // is treated as "clear the custom name" and reverts the row to the type
  // label on next render.
  const handleRename = ({ id, name }: { id: string; name: string }): void => {
    const trimmed = name.trim()
    dispatch({
      kind: 'updateNode',
      id,
      path: ['name'],
      value: trimmed === '' ? undefined : trimmed,
    })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Layers</div>
      <div className={styles.treeWrap} ref={wrapRef}>
        <LayerFlagsContext.Provider value={flags}>
          <Tree<ElementNode>
            data={[tree]}
            childrenAccessor={(n) => (n.type === 'container' ? n.children : null)}
            openByDefault
            width={size.width}
            height={size.height}
            rowHeight={26}
            overscanCount={8}
            indent={14}
            disableDrag
            disableMultiSelection
            selection={selectedIds[0]}
            onSelect={handleSelect}
            onRename={handleRename}
          >
            {LayerRow}
          </Tree>
        </LayerFlagsContext.Provider>
      </div>
    </div>
  )
}
