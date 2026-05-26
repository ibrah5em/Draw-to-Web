/**
 * Topbar theme toggle (L-TOP-01).
 *
 * A Radix Switch bound to the editor preview theme in `sessionStore`. The
 * canvas reads the same theme to set `data-theme` on its root and to resolve
 * color tokens for the active scheme, so flipping this re-renders the canvas
 * with the alternate palette.
 */

import * as Switch from '@radix-ui/react-switch'
import { Moon, Sun } from 'lucide-react'
import type { JSX } from 'react'

import { useSessionStore } from '@store/sessionStore'

import styles from './ThemeToggle.module.css'

/** Light / dark preview switch for the canvas. */
export function ThemeToggle(): JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const setTheme = useSessionStore((s) => s.setTheme)
  const isDark = theme === 'dark'

  return (
    <div className={styles.wrap}>
      <Sun size={14} className={isDark ? styles.iconMuted : styles.iconActive} aria-hidden />
      <Switch.Root
        className={styles.root}
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label="Toggle dark theme"
      >
        <Switch.Thumb className={styles.thumb} />
      </Switch.Root>
      <Moon size={14} className={isDark ? styles.iconActive : styles.iconMuted} aria-hidden />
    </div>
  )
}
