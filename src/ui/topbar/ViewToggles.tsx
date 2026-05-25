/**
 * Topbar panel-visibility toggles.
 *
 * VS Code-style buttons that collapse / expand the editor's side and bottom
 * panels. Presentational: the shell owns the panel refs and passes the
 * current visibility plus a toggle handler per panel.
 */

import type { JSX, ReactNode } from 'react'

import styles from './ViewToggles.module.css'

export interface ViewToggle {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  readonly visible: boolean
  readonly onToggle: () => void
}

/** A button group that shows/hides editor panels. */
export function ViewToggles({ toggles }: { toggles: ReadonlyArray<ViewToggle> }): JSX.Element {
  return (
    <div className={styles.group} role="group" aria-label="Toggle panels">
      {toggles.map((toggle) => (
        <button
          key={toggle.id}
          className={toggle.visible ? styles.toggleActive : styles.toggle}
          onClick={toggle.onToggle}
          aria-pressed={toggle.visible}
          aria-label={`${toggle.visible ? 'Hide' : 'Show'} ${toggle.label}`}
          title={`${toggle.visible ? 'Hide' : 'Show'} ${toggle.label}`}
        >
          {toggle.icon}
        </button>
      ))}
    </div>
  )
}
