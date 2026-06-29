/**
 * Match-my-layout dialog.
 *
 * Takes the layout the author has drawn on the canvas (the live document
 * tree) and ranks it against the bundled library of professional designs
 * via `findLayoutMatches` (pure, offline — see `src/match/`). Shows the best
 * match plus ranked alternatives, each with the per-dimension breakdown that
 * explains the score, and lets the author adopt one.
 *
 * Adopting reuses the existing store-hydration path (`adoptLibraryPage` →
 * the same trio a `.dtw` load uses): the chosen design becomes an ordinary,
 * fully-editable document. There is no content-transplant step here.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { Check, Sparkles, X } from 'lucide-react'
import { useMemo, type JSX } from 'react'

import { adoptLibraryPage, findLayoutMatches, getLibraryPage } from '@match/index'
import { useDocumentStore } from '@store/documentStore'

import styles from './MatchLayout.module.css'

interface MatchLayoutProps {
  /** Whether the dialog is currently open. */
  readonly open: boolean
  /** Close the dialog without adopting anything. */
  readonly onClose: () => void
}

/** One labelled sub-score bar (sequence / regions / content). */
function ScoreBar({ label, value }: { label: string; value: number }): JSX.Element {
  const pct = Math.round(value * 100)
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.barPct}>{pct}%</span>
    </div>
  )
}

/**
 * Dialog ranking the drawn layout against the design library and adopting a
 * chosen page. Matches are recomputed whenever the document tree changes, so
 * reopening after edits reflects the current canvas.
 */
export function MatchLayout({ open, onClose }: MatchLayoutProps): JSX.Element {
  const tree = useDocumentStore((s) => s.document.tree)

  // Pure + offline; cheap enough to memoise on the tree reference (which is
  // stable between edits because mutations flow through immer).
  const matches = useMemo(() => (open ? findLayoutMatches({ tree }) : []), [open, tree])

  const adopt = (pageId: string): void => {
    adoptLibraryPage(pageId)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <div>
              <Dialog.Title className={styles.title}>Match my layout</Dialog.Title>
              <Dialog.Description className={styles.subtitle}>
                Your sketch ranked against professional designs. Adopt one to keep editing it as a
                normal document.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <ol className={styles.list}>
            {matches.map((match, index) => {
              const page = getLibraryPage(match.pageId)
              const isBest = index === 0
              return (
                <li
                  key={match.pageId}
                  className={isBest ? `${styles.card} ${styles.cardBest}` : styles.card}
                >
                  <div className={styles.cardMain}>
                    <div className={styles.cardHead}>
                      <span className={styles.rank}>
                        {isBest ? (
                          <>
                            <Sparkles size={13} aria-hidden /> Best match
                          </>
                        ) : (
                          `#${index + 1}`
                        )}
                      </span>
                      <span className={styles.score}>{Math.round(match.score * 100)}%</span>
                    </div>
                    <h3 className={styles.pageName}>{page?.name ?? match.pageId}</h3>
                    <p className={styles.pageDesc}>{page?.description}</p>
                    <div className={styles.bars}>
                      <ScoreBar label="Order" value={match.breakdown.sequence} />
                      <ScoreBar label="Regions" value={match.breakdown.region} />
                      <ScoreBar label="Content" value={match.breakdown.content} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.adoptBtn}
                    onClick={() => adopt(match.pageId)}
                  >
                    <Check size={14} aria-hidden />
                    Use this design
                  </button>
                </li>
              )
            })}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
