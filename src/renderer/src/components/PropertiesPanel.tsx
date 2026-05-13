import { useElementStore } from '../../../store/elementStore'
import type { CanvasElement, ElementProps } from '../../../store/elementStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any stored CSS colour to a 6-digit hex string for <input type="color">. */
function toHex(color: string | undefined): string {
  if (!color) return '#000000'
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const r = color[1]
    const g = color[2]
    const b = color[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return '#000000'
}

const FONT_FAMILIES = [
  'sans-serif',
  'serif',
  'monospace',
  'Arial',
  'Georgia',
  'Verdana',
  'Courier New',
]

// ---------------------------------------------------------------------------
// Primitive field components
// ---------------------------------------------------------------------------

interface RowProps {
  label: string
  children: React.ReactNode
}

function Row({ label, children }: RowProps): JSX.Element {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={controlStyle}>{children}</div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps): JSX.Element {
  return (
    <Row label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
        style={inputStyle}
      />
    </Row>
  )
}

interface ColorFieldProps {
  label: string
  value: string | undefined
  onChange: (v: string) => void
}

function ColorField({ label, value, onChange }: ColorFieldProps): JSX.Element {
  return (
    <Row label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 28,
            height: 24,
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            background: 'none',
          }}
        />
        <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace' }}>
          {value ?? '#000000'}
        </span>
      </div>
    </Row>
  )
}

interface TextFieldProps {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}

function TextField({ label, value, placeholder, onChange }: TextFieldProps): JSX.Element {
  return (
    <Row label={label}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </Row>
  )
}

interface TextareaFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function TextareaField({ label, value, onChange }: TextareaFieldProps): JSX.Element {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...labelStyle, marginBottom: 4, display: 'block' }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          ...inputStyle,
          width: '100%',
          resize: 'vertical',
          fontFamily: 'sans-serif',
          lineHeight: 1.4,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}

function SelectField({ label, value, options, onChange }: SelectFieldProps): JSX.Element {
  return (
    <Row label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Row>
  )
}

interface CheckboxFieldProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#ccc',
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#666',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 14,
      }}
    >
      {title}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type-specific field groups
// ---------------------------------------------------------------------------

interface FieldGroupProps {
  el: CanvasElement
  updateProps: (patch: Partial<ElementProps>) => void
  updateEl: (patch: Partial<Omit<CanvasElement, 'id'>>) => void
}

function RectangleFields({ el, updateProps }: FieldGroupProps): JSX.Element {
  return (
    <>
      <SectionHeader title="Appearance" />
      <ColorField
        label="Background"
        value={el.props.background}
        onChange={(v) => updateProps({ background: v })}
      />
      <NumberField
        label="Radius"
        value={el.props.borderRadius ?? 0}
        min={0}
        max={200}
        onChange={(v) => updateProps({ borderRadius: v })}
      />
      <NumberField
        label="Border"
        value={el.props.borderWidth ?? 0}
        min={0}
        max={20}
        onChange={(v) => updateProps({ borderWidth: v })}
      />
      {(el.props.borderWidth ?? 0) > 0 && (
        <ColorField
          label="Border color"
          value={el.props.borderColor}
          onChange={(v) => updateProps({ borderColor: v })}
        />
      )}
    </>
  )
}

function TextFields({ el, updateProps }: FieldGroupProps): JSX.Element {
  return (
    <>
      <SectionHeader title="Text" />
      <TextareaField
        label="Content"
        value={el.props.text ?? ''}
        onChange={(v) => updateProps({ text: v })}
      />
      <NumberField
        label="Font size"
        value={el.props.fontSize ?? 16}
        min={8}
        max={120}
        onChange={(v) => updateProps({ fontSize: v })}
      />
      <SelectField
        label="Font"
        value={el.props.fontFamily ?? 'sans-serif'}
        options={FONT_FAMILIES}
        onChange={(v) => updateProps({ fontFamily: v })}
      />
      <ColorField
        label="Color"
        value={el.props.color}
        onChange={(v) => updateProps({ color: v })}
      />
      <ColorField
        label="Background"
        value={el.props.background}
        onChange={(v) => updateProps({ background: v })}
      />
    </>
  )
}

function ButtonFields({ el, updateProps }: FieldGroupProps): JSX.Element {
  return (
    <>
      <SectionHeader title="Button" />
      <TextField
        label="Label"
        value={el.props.text ?? 'Button'}
        onChange={(v) => updateProps({ text: v })}
      />
      <NumberField
        label="Font size"
        value={el.props.fontSize ?? 14}
        min={8}
        max={72}
        onChange={(v) => updateProps({ fontSize: v })}
      />
      <ColorField
        label="Background"
        value={el.props.background}
        onChange={(v) => updateProps({ background: v })}
      />
      <ColorField
        label="Text color"
        value={el.props.color}
        onChange={(v) => updateProps({ color: v })}
      />
      <NumberField
        label="Radius"
        value={el.props.borderRadius ?? 4}
        min={0}
        max={100}
        onChange={(v) => updateProps({ borderRadius: v })}
      />
      <NumberField
        label="Padding"
        value={el.props.padding ?? 0}
        min={0}
        max={64}
        onChange={(v) => updateProps({ padding: v })}
      />
    </>
  )
}

function ImageFields({ el, updateProps }: FieldGroupProps): JSX.Element {
  return (
    <>
      <SectionHeader title="Image" />
      <TextField
        label="Alt text"
        value={el.props.alt ?? ''}
        placeholder="Describe the image…"
        onChange={(v) => updateProps({ alt: v })}
      />
    </>
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
      <div style={panelStyle}>
        <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
          Select an element to edit its properties.
        </p>
      </div>
    )
  }

  const updateEl = (patch: Partial<Omit<CanvasElement, 'id'>>): void => updateElement(el.id, patch)

  const updateProps = (patch: Partial<ElementProps>): void =>
    updateElement(el.id, { props: { ...el.props, ...patch } })

  const fieldGroupProps: FieldGroupProps = { el, updateProps, updateEl }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>Properties</span>
        <span
          style={{
            fontSize: 10,
            color: '#666',
            background: '#222',
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {el.type}
        </span>
      </div>

      {/* Layout section */}
      <SectionHeader title="Layout" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 2 }}>Column</div>
          <input
            type="number"
            value={el.x}
            min={0}
            max={11}
            onChange={(e) => {
              const n = Math.max(0, Math.min(11, Number(e.target.value)))
              if (!Number.isNaN(n)) updateEl({ x: n })
            }}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 2 }}>Span (1–12)</div>
          <input
            type="number"
            value={el.width}
            min={1}
            max={12 - el.x}
            onChange={(e) => {
              const n = Math.max(1, Math.min(12 - el.x, Number(e.target.value)))
              if (!Number.isNaN(n)) updateEl({ width: n })
            }}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 2 }}>Y (px)</div>
          <input
            type="number"
            value={el.y}
            min={0}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n) && n >= 0) updateEl({ y: n })
            }}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 2 }}>Height (px)</div>
          <input
            type="number"
            value={el.height}
            min={20}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n) && n >= 20) updateEl({ height: n })
            }}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Type-specific sections */}
      {el.type === 'rectangle' && <RectangleFields {...fieldGroupProps} />}
      {el.type === 'text' && <TextFields {...fieldGroupProps} />}
      {el.type === 'button' && <ButtonFields {...fieldGroupProps} />}
      {el.type === 'image' && <ImageFields {...fieldGroupProps} />}

      {/* Layer section */}
      <SectionHeader title="Layer" />
      <TextField
        label="Name"
        value={el.layerName ?? ''}
        placeholder={el.type}
        onChange={(v) => updateEl({ layerName: v })}
      />
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        <CheckboxField
          label="Locked"
          checked={el.locked ?? false}
          onChange={(v) => updateEl({ locked: v })}
        />
        <CheckboxField
          label="Visible"
          checked={el.visible !== false}
          onChange={(v) => updateEl({ visible: v })}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  width: 260,
  background: '#111',
  borderLeft: '1px solid #333',
  padding: '12px 14px',
  flexShrink: 0,
  overflowY: 'auto',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#999',
  flexShrink: 0,
  minWidth: 60,
}

const controlStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'flex-end',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#ddd',
  fontSize: 12,
  padding: '3px 6px',
  outline: 'none',
}
