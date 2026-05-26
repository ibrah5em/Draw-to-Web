/**
 * Properties panel (L-PRP-02..04).
 *
 * Inspector for the selected element. Layout controls (direction, gap,
 * alignment, padding, sizing) write through the active-slot router; color
 * controls bind tokens or set free values with a live contrast badge. All
 * edits dispatch document operations, so the canvas reflows live and every
 * change is undoable.
 *
 * M2 scope: single selection, base breakpoint. Multi-select (L-CAN-06) and
 * the breakpoint switcher (L-TOP-02) are M3.
 */

import type { JSX } from 'react'

import { dispatch } from '@store/dispatch'
import type {
  Alignment,
  Bindable,
  ContainerNode,
  ElementNode,
  FlexDirection,
} from '@document/types'
import { useElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { writeActiveStyle } from '@store/styleRouting'

import { layerLabel } from '../../layers/layerMeta'
import { BindableInput, ColorControl, Field, Segmented } from './controls'
import styles from './properties.module.css'

type SizingMode = 'hug' | 'fill' | 'fixed'

const DIRECTION_OPTIONS: ReadonlyArray<{ value: FlexDirection; label: string }> = [
  { value: 'row', label: 'Row' },
  { value: 'column', label: 'Column' },
]

const SIZING_OPTIONS: ReadonlyArray<{ value: SizingMode; label: string }> = [
  { value: 'hug', label: 'Hug' },
  { value: 'fill', label: 'Fill' },
  { value: 'fixed', label: 'Fixed' },
]

const ALIGNMENTS: ReadonlyArray<Alignment> = [
  'start',
  'center',
  'end',
  'stretch',
  'space-between',
  'space-around',
  'space-evenly',
]

/** Write a layout property to `layout.base` (base breakpoint, M2). */
function writeLayout(id: string, key: string, value: unknown): void {
  dispatch({ kind: 'updateNode', id, path: ['layout', 'base', key], value })
}

function AlignmentSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: Alignment | undefined
  onChange: (next: Alignment) => void
}): JSX.Element {
  return (
    <Field label={label}>
      <select
        className={styles.select}
        value={value ?? 'start'}
        onChange={(event) => onChange(event.target.value as Alignment)}
        aria-label={label}
      >
        {ALIGNMENTS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  )
}

function widthMode(width: string | undefined): SizingMode {
  if (width === undefined || width === 'auto') return 'hug'
  if (width === '100%') return 'fill'
  return 'fixed'
}

function LayoutSection({ node }: { node: ContainerNode }): JSX.Element {
  const layout = node.layout.base
  const base = node.style.base
  const width = typeof base.width === 'string' ? base.width : undefined
  const mode = widthMode(width)

  const setWidth = (value: string): void => writeActiveStyle(node.id, ['width'], value)
  const setSizing = (next: SizingMode): void => {
    if (next === 'hug') setWidth('auto')
    else if (next === 'fill') setWidth('100%')
    else setWidth(width && widthMode(width) === 'fixed' ? width : '200px')
  }

  const setPadding = (side: string, value: Bindable<string>): void =>
    writeActiveStyle(node.id, ['padding', side], value)

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Layout</h3>

      <Field label="Direction">
        <Segmented
          ariaLabel="Direction"
          value={layout.direction === 'column' ? 'column' : 'row'}
          options={DIRECTION_OPTIONS}
          onChange={(next) => writeLayout(node.id, 'direction', next)}
        />
      </Field>

      <Field label="Gap">
        <BindableInput
          value={layout.gap}
          category="spacing"
          placeholder="0"
          onChange={(next) => writeLayout(node.id, 'gap', next)}
        />
      </Field>

      <AlignmentSelect
        label="Main axis"
        value={layout.justify}
        onChange={(next) => writeLayout(node.id, 'justify', next)}
      />
      <AlignmentSelect
        label="Cross axis"
        value={layout.align}
        onChange={(next) => writeLayout(node.id, 'align', next)}
      />

      <Field label="Padding">
        <div className={styles.box}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <BindableInput
              key={side}
              value={base.padding?.[side]}
              category="spacing"
              placeholder={side[0]?.toUpperCase()}
              onChange={(next) => setPadding(side, next)}
            />
          ))}
        </div>
      </Field>

      <Field label="Width">
        <Segmented
          ariaLabel="Width sizing"
          value={mode}
          options={SIZING_OPTIONS}
          onChange={setSizing}
        />
      </Field>
      {mode === 'fixed' ? (
        <Field label="Width value">
          <input
            className={styles.textInput}
            value={width ?? ''}
            onChange={(event) => setWidth(event.target.value)}
            aria-label="Width value"
            spellCheck={false}
          />
        </Field>
      ) : null}
    </section>
  )
}

function AppearanceSection({ node }: { node: ElementNode }): JSX.Element {
  const base = node.style.base
  const textColor = base.typography?.color
  const bg = base.background
  const bgColor = bg && bg[0]?.kind === 'solid' ? bg[0].color : undefined

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Appearance</h3>

      <Field label="Text color">
        <ColorControl
          value={textColor}
          onChange={(next) => writeActiveStyle(node.id, ['typography', 'color'], next)}
        />
      </Field>

      <Field label="Background">
        <ColorControl
          value={bgColor}
          onChange={(next) =>
            writeActiveStyle(node.id, ['background'], [{ kind: 'solid', color: next }])
          }
        />
      </Field>
    </section>
  )
}

/** The inspector for the current selection. */
export function PropertiesPanel(): JSX.Element {
  const selectedId = useSessionStore((s) => s.selectedIds[0])
  const node = useElementById(selectedId ?? '')

  if (!selectedId || node === null) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyLabel}>Properties</span>
        <span className={styles.emptyHint}>Select an element to edit</span>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.elementName}>{layerLabel(node)}</span>
        <span className={styles.elementType}>{node.type}</span>
      </header>
      {node.type === 'container' ? <LayoutSection node={node} /> : null}
      <AppearanceSection node={node} />
    </div>
  )
}
