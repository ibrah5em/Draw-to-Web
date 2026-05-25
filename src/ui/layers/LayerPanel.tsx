/**
 * Layers tree (L-LYR-01).
 *
 * A `react-arborist` tree projection of the document tree. Each row shows a
 * type icon, the element label, and visibility / lock toggles. Selection is
 * bidirectional with the canvas through `sessionStore.selectedIds`: the
 * controlled `selection` prop reflects canvas → tree, and `onSelect` writes
 * tree → canvas.
 *
 * Visibility / lock are editor-only affordances held in local state here.
 * Propagating them to the canvas / generator needs a shared session field
 * (C5, Yousef's lane) and is intentionally deferred.
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
import { useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

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

function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

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
      <span className={styles.name}>{layerLabel(el)}</span>

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

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [locked, setLocked] = useState<ReadonlySet<string>>(() => new Set())
  const flags = useMemo<LayerFlags>(
    () => ({
      hidden,
      locked,
      toggleHidden: (id) => setHidden((set) => toggleInSet(set, id)),
      toggleLocked: (id) => setLocked((set) => toggleInSet(set, id)),
    }),
    [hidden, locked]
  )

  const [wrapRef, size] = useElementSize()

  const handleSelect = (nodes: NodeApi<ElementNode>[]): void => {
    const ids = nodes.map((n) => n.id)
    if (sameIds(ids, useSessionStore.getState().selectedIds)) return
    setSelectedIds(ids)
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
            indent={14}
            disableDrag
            disableMultiSelection
            selection={selectedIds[0]}
            onSelect={handleSelect}
          >
            {LayerRow}
          </Tree>
        </LayerFlagsContext.Provider>
      </div>
    </div>
  )
}
