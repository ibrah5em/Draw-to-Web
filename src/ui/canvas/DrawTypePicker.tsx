/**
 * Inline type picker for a freshly-drawn element.
 *
 * Anchored to the just-inserted node, it shows the interpreter's best guess
 * (with a "suggested" badge, a confidence read-out, and a one-line hint) and
 * every alternative one click — or one keystroke — away. Number keys 1–9 pick
 * directly, arrows move the focus, Enter applies it, Esc dismisses. Picking a
 * kind calls back to the {@link DrawSurface}, which applies it as a normal tree
 * operation, so correcting a guess is never special-cased model state.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  CreditCard,
  Group,
  Heading,
  Image as ImageIcon,
  LayoutTemplate,
  List,
  Minus,
  MousePointerClick,
  Type,
} from 'lucide-react'

import type { DrawnElementKind, ElementTypeGuess } from '@draw'

import styles from './DrawTypePicker.module.css'

/** Human label + icon per drawn kind. */
const KIND_META: Readonly<Record<DrawnElementKind, { label: string; icon: JSX.Element }>> = {
  section: { label: 'Section', icon: <LayoutTemplate size={14} /> },
  group: { label: 'Group', icon: <Group size={14} /> },
  card: { label: 'Card', icon: <CreditCard size={14} /> },
  heading: { label: 'Heading', icon: <Heading size={14} /> },
  text: { label: 'Text', icon: <Type size={14} /> },
  image: { label: 'Image', icon: <ImageIcon size={14} /> },
  button: { label: 'Button', icon: <MousePointerClick size={14} /> },
  list: { label: 'List', icon: <List size={14} /> },
  divider: { label: 'Divider', icon: <Minus size={14} /> },
}

interface DrawTypePickerProps {
  /** `data-dtw-id` of the element the picker annotates. */
  readonly targetId: string
  /** The interpreter's guess (best + alternatives + confidence + hint). */
  readonly guess: ElementTypeGuess
  /** Currently applied kind (highlighted). */
  readonly current: DrawnElementKind
  /** Apply a different kind. */
  readonly onPick: (kind: DrawnElementKind) => void
  /** Dismiss the picker. */
  readonly onClose: () => void
}

/** Floating one-click / one-key type-correction popover. */
export function DrawTypePicker({
  targetId,
  guess,
  current,
  onPick,
  onClose,
}: DrawTypePickerProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const ordered: DrawnElementKind[] = [guess.best, ...guess.alternatives]
  const [focus, setFocus] = useState(0)

  // Anchor to the target element's on-screen box (fixed positioning so it
  // tracks the rendered node regardless of canvas scroll).
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-dtw-id="${targetId}"]`)
    if (!target) {
      setPosition(null)
      return
    }
    const box = target.getBoundingClientRect()
    setPosition({ position: 'fixed', left: Math.max(8, box.left), top: Math.max(8, box.top - 48) })
  }, [targetId, current])

  // Keep keyboard focus on the toolbar so 1–9 / arrows / Enter / Esc work.
  useEffect(() => {
    ref.current?.focus()
  }, [])

  if (!position) return null

  const apply = (kind: DrawnElementKind): void => onPick(kind)

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      apply(ordered[focus]!)
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setFocus((f) => (f + 1) % ordered.length)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFocus((f) => (f - 1 + ordered.length) % ordered.length)
      return
    }
    const digit = Number.parseInt(event.key, 10)
    if (Number.isInteger(digit) && digit >= 1 && digit <= ordered.length) {
      event.preventDefault()
      apply(ordered[digit - 1]!)
    }
  }

  const confidencePct = Math.round(guess.confidence * 100)

  return (
    <div
      ref={ref}
      className={styles.picker}
      style={position}
      role="toolbar"
      aria-label="Choose element type"
      data-testid="draw-type-picker"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className={styles.header}>
        <span className={styles.hint}>{guess.hint}</span>
        <span className={styles.confidence} title="Interpreter confidence">
          {confidencePct}% sure
        </span>
      </div>
      <div className={styles.options}>
        {ordered.map((kind, i) => {
          const meta = KIND_META[kind]
          const isBest = kind === guess.best
          return (
            <button
              key={kind}
              type="button"
              className={styles.option}
              data-active={kind === current}
              data-focus={i === focus}
              aria-pressed={kind === current}
              title={`${meta.label}${isBest ? ' (suggested)' : ''} — press ${i + 1}`}
              onMouseEnter={() => setFocus(i)}
              onClick={() => apply(kind)}
            >
              <kbd className={styles.kbd}>{i + 1}</kbd>
              {meta.icon}
              <span className={styles.label}>{meta.label}</span>
              {isBest ? <span className={styles.badge}>suggested</span> : null}
            </button>
          )
        })}
      </div>
      <button type="button" className={styles.done} onClick={onClose}>
        Done
      </button>
    </div>
  )
}
