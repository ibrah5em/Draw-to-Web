import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useElementStore } from '../../../store/elementStore'
import type { CanvasElement, ElementProps } from '../../../store/elementStore'
import styles from './PropertiesPanel.module.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<CanvasElement['type'], string> = {
  rectangle: 'Rectangle',
  text: 'Text',
  image: 'Image',
  button: 'Button',
}

const FONT_FAMILIES = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']

function toHex(color: string | undefined): string {
  if (!color) return '#000000'
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return '#000000'
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className={styles.sectionContent}>{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <Field label={label}>
      <div className={styles.readonlyValue}>{value}</div>
    </Field>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max?: number
  onChange: (v: number) => void
  suffix?: string
}

function NumberField({ label, value, min, max, onChange, suffix }: NumberFieldProps): JSX.Element {
  return (
    <Field label={label}>
      <div className={styles.inputRow}>
        <input
          type="number"
          className={styles.input}
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) {
              const clamped = max !== undefined ? Math.max(min, Math.min(max, n)) : Math.max(min, n)
              onChange(clamped)
            }
          }}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </Field>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <Field label={`${label}: ${value}`}>
      <input
        type="range"
        className={styles.range}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
}): JSX.Element {
  const hex = toHex(value)
  return (
    <Field label={label}>
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorSwatch}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className={styles.hexInput}
          value={hex}
          maxLength={7}
          onChange={(e) => {
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
          }}
        />
      </div>
    </Field>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <Field label={label}>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  )
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <Field label={label}>
      <textarea
        className={styles.textarea}
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Section groups
// ---------------------------------------------------------------------------

interface GroupProps {
  el: CanvasElement
  updateProps: (patch: Partial<ElementProps>) => void
  updateEl: (patch: Partial<Omit<CanvasElement, 'id'>>) => void
}

function PositionSection({ el, updateEl }: GroupProps): JSX.Element {
  return (
    <Section title="Position">
      <div className={styles.grid2}>
        <ReadonlyField label="X" value={el.x} />
        <ReadonlyField label="Y" value={el.y} />
        <NumberField
          label="Column"
          value={el.x}
          min={0}
          max={11}
          onChange={(v) => updateEl({ x: v })}
        />
        <NumberField label="Row" value={el.y} min={0} onChange={(v) => updateEl({ y: v })} />
      </div>
      <RangeField
        label="Span"
        value={el.width}
        min={1}
        max={12 - el.x}
        onChange={(v) => updateEl({ width: v })}
      />
    </Section>
  )
}

function SizeSection({ el, updateEl }: GroupProps): JSX.Element {
  return (
    <Section title="Size">
      <div className={styles.grid2}>
        <NumberField
          label="Width"
          value={el.width}
          min={1}
          max={12}
          onChange={(v) => updateEl({ width: v })}
        />
        <NumberField
          label="Height"
          value={el.height}
          min={20}
          onChange={(v) => updateEl({ height: v })}
          suffix="px"
        />
      </div>
    </Section>
  )
}

function AppearanceSection({ el, updateProps }: GroupProps): JSX.Element {
  return (
    <Section title="Appearance">
      <ColorField
        label="Background"
        value={el.props.background}
        onChange={(v) => updateProps({ background: v })}
      />
      <NumberField
        label="Border radius"
        value={el.props.borderRadius ?? 0}
        min={0}
        max={200}
        onChange={(v) => updateProps({ borderRadius: v })}
        suffix="px"
      />
      <NumberField
        label="Border width"
        value={el.props.borderWidth ?? 0}
        min={0}
        max={20}
        onChange={(v) => updateProps({ borderWidth: v })}
        suffix="px"
      />
      {(el.props.borderWidth ?? 0) > 0 && (
        <ColorField
          label="Border color"
          value={el.props.borderColor}
          onChange={(v) => updateProps({ borderColor: v })}
        />
      )}
    </Section>
  )
}

function TypographySection({ el, updateProps }: GroupProps): JSX.Element {
  return (
    <Section title="Typography">
      <NumberField
        label="Font size"
        value={el.props.fontSize ?? 16}
        min={8}
        max={120}
        onChange={(v) => updateProps({ fontSize: v })}
        suffix="px"
      />
      <SelectField
        label="Font family"
        value={el.props.fontFamily ?? 'Arial'}
        options={FONT_FAMILIES}
        onChange={(v) => updateProps({ fontFamily: v })}
      />
      <ColorField
        label="Text color"
        value={el.props.color}
        onChange={(v) => updateProps({ color: v })}
      />
      <TextareaField
        label="Content"
        value={el.props.text ?? ''}
        onChange={(v) => updateProps({ text: v })}
      />
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/** Right-side properties panel — owned by Luf8y */
export default function PropertiesPanel(): JSX.Element {
  const selectedId = useElementStore((s) => s.selectedId)
  const elements = useElementStore((s) => s.elements)
  const updateElement = useElementStore((s) => s.updateElement)

  const el = selectedId ? (elements.find((e) => e.id === selectedId) ?? null) : null

  if (!el) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>Select an element to edit its properties.</p>
      </div>
    )
  }

  const updateEl = (patch: Partial<Omit<CanvasElement, 'id'>>): void => updateElement(el.id, patch)

  const updateProps = (patch: Partial<ElementProps>): void =>
    updateElement(el.id, { props: { ...el.props, ...patch } })

  const groupProps: GroupProps = { el, updateProps, updateEl }
  const hasTypography = el.type === 'text' || el.type === 'button'

  return (
    <div className={styles.panel}>
      <div className={styles.header}>{TYPE_NAMES[el.type]}</div>
      <PositionSection {...groupProps} />
      <SizeSection {...groupProps} />
      <AppearanceSection {...groupProps} />
      {hasTypography && <TypographySection {...groupProps} />}
    </div>
  )
}
