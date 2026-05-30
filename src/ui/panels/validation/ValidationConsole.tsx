/**
 * Validation console (L-VAL-01..03).
 *
 * Bottom-bar surface that runs `validateDocument` (C8) live and lists every
 * error / warning / info with its message and fix hint. Clicking an issue
 * that carries a `nodeId` selects the offending element and scrolls the
 * canvas to it (L-VAL-02). The header summary doubles as the export-block
 * source of truth — the same `errors.length` that disables the topbar
 * Export button (L-VAL-03 / L-TOP-04).
 *
 * Hosted in the bottom dock beside the Tokens panel (see `App.tsx`); the
 * dock owns sizing + collapse, this component only renders the list.
 */

import { AlertCircle, AlertTriangle, Info, Wand2 } from 'lucide-react'
import type { JSX } from 'react'

import type { ValidationIssue } from '@document/validation'
import { dispatch } from '@store/dispatch'
import { useSessionStore } from '@store/sessionStore'

import { quickFixFor } from './quickFix'
import { useValidationReport } from './useValidationReport'
import styles from './ValidationConsole.module.css'

type Severity = 'error' | 'warning' | 'info'

const ICON: Record<Severity, JSX.Element> = {
  error: <AlertCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  info: <Info size={14} />,
}

/**
 * Select the offending element and scroll it into view (L-VAL-02). The
 * canvas renders every node with a `data-dtw-id` attribute, so a single
 * query locates the DOM node regardless of element type. Selecting via the
 * session store keeps the Properties / Layers panels in sync; the scroll is
 * best-effort (the node may be virtualized away, in which case selection
 * alone still surfaces it in the inspector).
 */
function jumpToElement(nodeId: string): void {
  useSessionStore.getState().setSelectedIds([nodeId])
  if (typeof document === 'undefined') return
  // `CSS.escape` is unavailable in some jsdom builds; nanoid ids are already
  // CSS-safe ([A-Za-z0-9_-]), so fall back to the raw id when it's missing.
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(nodeId) : nodeId
  const el = document.querySelector<HTMLElement>(`[data-dtw-id="${escaped}"]`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function IssueRow({
  severity,
  issue,
}: {
  severity: Severity
  issue: ValidationIssue
}): JSX.Element {
  const jumpable = issue.nodeId !== undefined
  const fixOp = quickFixFor(issue)
  const body = (
    <>
      <span className={styles.issueIcon}>{ICON[severity]}</span>
      <span className={styles.issueText}>
        <span className={styles.issueMessage}>{issue.message}</span>
        {issue.fix ? <span className={styles.issueFix}>{issue.fix}</span> : null}
      </span>
    </>
  )
  const rowClass = `${styles.issue} ${styles[severity]}`
  return (
    <li className={styles.issueRow}>
      {jumpable ? (
        <button
          type="button"
          className={`${rowClass} ${styles.jumpable} ${styles.issueButton}`}
          onClick={() => jumpToElement(issue.nodeId as string)}
          title="Select this element on the canvas"
        >
          {body}
        </button>
      ) : (
        <span className={rowClass}>{body}</span>
      )}
      {fixOp !== null ? (
        <button
          type="button"
          className={styles.fixBtn}
          onClick={() => dispatch(fixOp)}
          title="Apply the suggested fix"
        >
          <Wand2 size={12} /> Fix
        </button>
      ) : null}
    </li>
  )
}

function Group({
  severity,
  issues,
}: {
  severity: Severity
  issues: ReadonlyArray<ValidationIssue>
}): JSX.Element | null {
  if (issues.length === 0) return null
  return (
    <ul className={styles.list}>
      {issues.map((issue, index) => (
        <IssueRow key={`${severity}-${index}`} severity={severity} issue={issue} />
      ))}
    </ul>
  )
}

/** The validation console body: a summary line over the grouped issue list. */
export function ValidationConsole(): JSX.Element {
  const report = useValidationReport()
  const { errors, warnings, infos } = report
  const total = errors.length + warnings.length + infos.length

  return (
    <div className={styles.console}>
      <div className={styles.summary} role="status" aria-live="polite">
        <span className={`${styles.count} ${errors.length > 0 ? styles.error : ''}`}>
          <AlertCircle size={13} /> {errors.length}
        </span>
        <span className={`${styles.count} ${warnings.length > 0 ? styles.warning : ''}`}>
          <AlertTriangle size={13} /> {warnings.length}
        </span>
        <span className={`${styles.count} ${styles.info}`}>
          <Info size={13} /> {infos.length}
        </span>
      </div>

      <div className={styles.body}>
        {total === 0 ? (
          <p className={styles.clean}>No issues. The document is ready to export.</p>
        ) : (
          <>
            <Group severity="error" issues={errors} />
            <Group severity="warning" issues={warnings} />
            <Group severity="info" issues={infos} />
          </>
        )}
      </div>
    </div>
  )
}
