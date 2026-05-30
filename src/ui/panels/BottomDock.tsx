/**
 * Bottom dock — Tokens + Problems tabs (L-VAL-01).
 *
 * The validation console lives "alongside Tokens" (L-VAL-01 task line), so
 * the two share one collapsible bottom region instead of competing for
 * vertical space. A lightweight tab switch flips between them; the shared
 * header carries the single collapse chevron (TokensPanel renders without
 * its own when docked here) and a live error/warning badge on the Problems
 * tab so issues are visible even while Tokens is foregrounded.
 *
 * Sizing + collapse of the region itself is owned by the shell (`App.tsx`);
 * this component only owns which tab is active.
 */

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type JSX } from 'react'

import { TokensPanel } from './tokens/TokensPanel'
import { ValidationConsole } from './validation/ValidationConsole'
import { useValidationReport } from './validation/useValidationReport'
import styles from './BottomDock.module.css'

type DockTab = 'tokens' | 'problems'

interface BottomDockProps {
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
}

/** Tokens / Problems tab host for the bottom panel. */
export function BottomDock({ collapsed, onToggleCollapse }: BottomDockProps): JSX.Element {
  const [tab, setTab] = useState<DockTab>('tokens')
  const report = useValidationReport()
  const problemCount = report.errors.length + report.warnings.length

  return (
    <div className={styles.dock}>
      <div className={styles.tabBar}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tokens'}
          className={tab === 'tokens' ? styles.tabActive : styles.tab}
          onClick={() => setTab('tokens')}
        >
          Tokens
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'problems'}
          className={tab === 'problems' ? styles.tabActive : styles.tab}
          onClick={() => setTab('problems')}
        >
          Problems
          {problemCount > 0 ? (
            <span
              className={`${styles.badge} ${report.errors.length > 0 ? styles.badgeError : styles.badgeWarn}`}
            >
              {problemCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className={styles.body}>
        {/*
          Both panels stay mounted so switching tabs is instant and neither
          loses transient UI state (open popovers, scroll position). The
          inactive one is hidden with `display:none`, which also keeps the
          Tokens panel's own validation-free render cost off the Problems tab.
        */}
        <div className={tab === 'tokens' ? styles.pane : styles.paneHidden}>
          <TokensPanel
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            showCollapse={false}
          />
        </div>
        <div className={tab === 'problems' ? styles.pane : styles.paneHidden}>
          <ValidationConsole />
        </div>
      </div>
    </div>
  )
}
