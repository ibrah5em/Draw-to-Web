/**
 * Topbar breakpoint switcher (L-TOP-02).
 *
 * Four-button group that drives `sessionStore.activeBreakpoint`. Pixel
 * widths match the generator's `@media (max-width: ...)` thresholds
 * (`src/generator/cssEmitter.ts`) so the canvas preview reflects what
 * authors will see in the exported HTML. When a non-`base` breakpoint
 * is active, the canvas viewport caps to that width and per-breakpoint
 * edits route into `element.responsive[bp]` via the store (L-PRP-09).
 */

import { Monitor, Smartphone, Tablet } from 'lucide-react'
import type { JSX, ReactNode } from 'react'

import type { BreakpointKey } from '@document/types'
import { useSessionStore } from '@store/sessionStore'

import styles from './BreakpointSwitcher.module.css'

/** Editor pixel widths used to size the canvas viewport per breakpoint. */
export const BREAKPOINT_WIDTH_PX: Readonly<Record<BreakpointKey, number>> = {
  base: 1280,
  tablet: 1024,
  mobile: 768,
  small: 480,
}

interface BreakpointOption {
  readonly value: BreakpointKey
  readonly label: string
  readonly icon: ReactNode
}

const OPTIONS: ReadonlyArray<BreakpointOption> = [
  { value: 'base', label: 'Desktop', icon: <Monitor size={14} /> },
  { value: 'tablet', label: 'Tablet', icon: <Tablet size={14} /> },
  { value: 'mobile', label: 'Mobile', icon: <Smartphone size={14} /> },
  { value: 'small', label: 'Small', icon: <Smartphone size={12} /> },
]

/** Topbar control that sets the active editor breakpoint. */
export function BreakpointSwitcher(): JSX.Element {
  const active = useSessionStore((s) => s.activeBreakpoint)
  const setActiveBreakpoint = useSessionStore((s) => s.setActiveBreakpoint)

  return (
    <div className={styles.group} role="group" aria-label="Canvas breakpoint">
      {OPTIONS.map((option) => {
        const width = BREAKPOINT_WIDTH_PX[option.value]
        const isActive = active === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={styles.button}
            data-active={isActive}
            data-breakpoint={option.value}
            aria-pressed={isActive}
            aria-label={`${option.label} (${width}px)`}
            title={`${option.label} — ${width}px`}
            onClick={() => setActiveBreakpoint(option.value)}
          >
            <span aria-hidden>{option.icon}</span>
            <span className={styles.label}>{width}</span>
          </button>
        )
      })}
    </div>
  )
}
