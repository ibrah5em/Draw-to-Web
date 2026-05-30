/**
 * Canvas right-click context menu (L-CAN-08).
 *
 * Wraps the canvas page in a Radix ContextMenu offering z-order actions
 * (bring forward / send back / bring to front / send to back) plus the
 * common edit verbs already wired for the keyboard layer (duplicate, delete).
 * Right-clicking first selects the node under the cursor — resolved from the
 * nearest `[data-dtw-id]` ancestor — so the actions target what the author
 * clicked, and the resulting order always matches the Layers tree (the DoD).
 *
 * All actions dispatch through the same helpers the shortcuts use, so a
 * menu action and its keyboard equivalent are one and the same operation.
 */

import * as ContextMenu from '@radix-ui/react-context-menu'
import type { JSX, ReactNode } from 'react'

import { useSessionStore } from '@store/sessionStore'

import { deleteSelected } from './useDeleteSelection'
import { duplicateSelection, moveToEdge, moveZOrder } from './clipboard'
import styles from './CanvasContextMenu.module.css'

/** Resolve the element id under a right-click, walking up to the nearest node. */
function idFromEvent(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest('[data-dtw-id]')
  return el instanceof HTMLElement ? (el.dataset.dtwId ?? null) : null
}

/** Canvas wrapper that adds the right-click z-order / edit menu. */
export function CanvasContextMenu({ children }: { children: ReactNode }): JSX.Element {
  // Select the clicked node before the menu opens so every action targets it.
  const onContextMenu = (event: React.MouseEvent): void => {
    const id = idFromEvent(event.target)
    if (id !== null && !useSessionStore.getState().selectedIds.includes(id)) {
      useSessionStore.getState().setSelectedIds([id])
    }
  }

  const hasSelection = useSessionStore((s) => s.selectedIds.length > 0)

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild onContextMenu={onContextMenu}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.content}>
          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => moveToEdge('front')}
          >
            Bring to front
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => moveZOrder(1)}
          >
            Bring forward <span className={styles.shortcut}>]</span>
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => moveZOrder(-1)}
          >
            Send backward <span className={styles.shortcut}>[</span>
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => moveToEdge('back')}
          >
            Send to back
          </ContextMenu.Item>

          <ContextMenu.Separator className={styles.separator} />

          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => duplicateSelection()}
          >
            Duplicate <span className={styles.shortcut}>Ctrl+D</span>
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.item}
            disabled={!hasSelection}
            onSelect={() => void deleteSelected()}
          >
            Delete <span className={styles.shortcut}>Del</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
