/**
 * Properties panel (L-PRP-02..09).
 *
 * Inspector for the selected element. Layout / appearance controls write
 * through the active-slot router (`writeActiveStyle`) so the value lands in
 * the right state and breakpoint slot automatically. The panel also hosts:
 *
 *   - L-PRP-05: a `Default / Hover / Focus / Active` tab strip bound to
 *     `sessionStore.activeState`. Switching tabs reroutes subsequent edits
 *     to `element.states[stateName]`.
 *   - L-PRP-06: keyframe + delay + duration controls writing to
 *     `node.animation`.
 *   - L-PRP-07: a Reveal-on-scroll switch that toggles
 *     `node.dataAttributes.reveal`, which the generator emits as
 *     `data-reveal` for the IntersectionObserver runtime snippet.
 *   - L-PRP-08: image upload (file picker + drag-drop) for image nodes
 *     calling `electronAPI.uploadImage` (C11). Falls back gracefully when
 *     the pipeline isn't installed yet.
 *   - L-PRP-09: a banner + per-field badge when the active breakpoint is
 *     non-base, telling authors writes are routing to `responsive[bp]` and
 *     highlighting fields that already have an override.
 */

import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import { Image as ImageIcon, Smartphone, UploadCloud } from 'lucide-react'
import { useCallback, useId, useState, type ChangeEvent, type DragEvent, type JSX } from 'react'

import { dispatch } from '@store/dispatch'
import { useElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { writeActiveStyle } from '@store/styleRouting'
import type {
  Alignment,
  AnimationSpec,
  Bindable,
  BreakpointKey,
  ContainerNode,
  ElementNode,
  FlexDirection,
  ImageNode,
  StateKey,
} from '@document/types'

import { BREAKPOINT_WIDTH_PX } from '../../topbar/BreakpointSwitcher'
import { layerLabel } from '../../layers/layerMeta'
import { BindableInput, ColorControl, Field, Segmented } from './controls'
import styles from './properties.module.css'

type SizingMode = 'hug' | 'fill' | 'fixed'
type ActiveState = 'default' | StateKey

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

const STATE_TABS: ReadonlyArray<{ value: ActiveState; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'hover', label: 'Hover' },
  { value: 'focus-visible', label: 'Focus' },
  { value: 'active', label: 'Active' },
]

const BREAKPOINT_LABEL: Readonly<Record<BreakpointKey, string>> = {
  base: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
  small: 'Small',
}

/**
 * Keyframe presets exposed in the Animation picker. The names match the
 * generator's keyframe library (I-GEN-11).
 */
const ANIMATION_PRESETS = [
  'none',
  'fadeUp',
  'fadeIn',
  'scaleIn',
  'slideLeft',
  'pulse',
  'blink-cursor',
  'shimmer',
] as const

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

function StateTabs(): JSX.Element {
  const activeState = useSessionStore((s) => s.activeState)
  const setActiveState = useSessionStore((s) => s.setActiveState)
  return (
    <Tabs.Root
      value={activeState}
      onValueChange={(value) => setActiveState(value as ActiveState)}
      className={styles.stateTabs}
    >
      <Tabs.List className={styles.stateTabs} aria-label="Element state">
        {STATE_TABS.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className={styles.stateTab}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}

function BreakpointBanner({ node }: { node: ElementNode }): JSX.Element | null {
  const breakpoint = useSessionStore((s) => s.activeBreakpoint)
  if (breakpoint === 'base') return null
  const responsive = node.style[breakpoint]
  const overrideCount = responsive ? Object.keys(responsive).length : 0
  return (
    <div className={styles.bpBanner} role="status">
      <span className={styles.bpBannerIcon} aria-hidden>
        <Smartphone size={12} />
      </span>
      <span>
        Editing {BREAKPOINT_LABEL[breakpoint]} ({BREAKPOINT_WIDTH_PX[breakpoint]}px) —
        {overrideCount > 0
          ? ` ${overrideCount} override${overrideCount === 1 ? '' : 's'}`
          : ' no overrides yet'}
      </span>
    </div>
  )
}

/**
 * Per-field badge for L-PRP-09. Renders a small "BP" pill when the active
 * breakpoint has an override at the given style path.
 */
function OverrideBadge({
  node,
  path,
}: {
  node: ElementNode
  path: readonly string[]
}): JSX.Element | null {
  const breakpoint = useSessionStore((s) => s.activeBreakpoint)
  if (breakpoint === 'base') return null
  let current: unknown = node.style[breakpoint]
  for (const key of path) {
    if (current === undefined || current === null) return null
    current = (current as Record<string, unknown>)[key]
  }
  if (current === undefined) return null
  return (
    <span className={styles.bpOverride} title={`Override for ${BREAKPOINT_LABEL[breakpoint]}`}>
      {breakpoint === 'tablet' ? 'TB' : breakpoint === 'mobile' ? 'MB' : 'SM'}
    </span>
  )
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

      <Field label="Padding" badge={<OverrideBadge node={node} path={['padding']} />}>
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

      <Field label="Width" badge={<OverrideBadge node={node} path={['width']} />}>
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

      <Field
        label="Text color"
        badge={<OverrideBadge node={node} path={['typography', 'color']} />}
      >
        <ColorControl
          value={textColor}
          onChange={(next) => writeActiveStyle(node.id, ['typography', 'color'], next)}
        />
      </Field>

      <Field label="Background" badge={<OverrideBadge node={node} path={['background']} />}>
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

function AnimationSection({ node }: { node: ElementNode }): JSX.Element {
  const animation = node.animation
  const writeAnimation = (next: AnimationSpec | undefined): void => {
    dispatch({ kind: 'updateNode', id: node.id, path: ['animation'], value: next })
  }
  const setName = (name: string): void => {
    if (name === 'none') {
      writeAnimation(undefined)
      return
    }
    writeAnimation({ ...(animation ?? {}), name })
  }
  const setDuration = (duration: string): void => {
    if (!animation) return
    writeAnimation({ ...animation, duration: duration || undefined })
  }
  const setDelay = (delay: string): void => {
    if (!animation) return
    writeAnimation({ ...animation, delay: delay || undefined })
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Animation</h3>
      <Field label="Keyframe">
        <select
          className={styles.select}
          value={animation?.name ?? 'none'}
          onChange={(event) => setName(event.target.value)}
          aria-label="Animation keyframe"
        >
          {ANIMATION_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>
      </Field>
      <div className={styles.animationGrid}>
        <Field label="Duration">
          <input
            className={styles.textInput}
            value={animation?.duration ?? ''}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="600ms"
            aria-label="Animation duration"
            disabled={!animation}
            spellCheck={false}
          />
        </Field>
        <Field label="Delay">
          <input
            className={styles.textInput}
            value={animation?.delay ?? ''}
            onChange={(event) => setDelay(event.target.value)}
            placeholder="0ms"
            aria-label="Animation delay"
            disabled={!animation}
            spellCheck={false}
          />
        </Field>
      </div>
    </section>
  )
}

function RuntimeSection({ node }: { node: ElementNode }): JSX.Element {
  const reveal = node.dataAttributes?.reveal === 'true'
  const onChange = (checked: boolean): void => {
    const next: Record<string, string> = { ...(node.dataAttributes ?? {}) }
    if (checked) next.reveal = 'true'
    else delete next.reveal
    dispatch({
      kind: 'updateNode',
      id: node.id,
      path: ['dataAttributes'],
      value: Object.keys(next).length === 0 ? undefined : next,
    })
  }
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Runtime</h3>
      <Field label="Reveal on scroll">
        <Switch.Root
          className={styles.switchRoot}
          checked={reveal}
          onCheckedChange={onChange}
          aria-label="Reveal on scroll"
        >
          <Switch.Thumb className={styles.switchThumb} />
        </Switch.Root>
      </Field>
    </section>
  )
}

interface UploadState {
  readonly status: 'idle' | 'uploading' | 'error'
  readonly message?: string
}

function ImageSection({ node }: { node: ImageNode }): JSX.Element {
  const [drag, setDrag] = useState(false)
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' })
  const inputId = useId()

  const writeAlt = (alt: string): void => {
    dispatch({ kind: 'updateNode', id: node.id, path: ['alt'], value: alt })
  }
  const writeUrl = (url: string): void => {
    dispatch({ kind: 'updateNode', id: node.id, path: ['externalUrl'], value: url || undefined })
  }
  const writeAsset = (assetId: string, width: number, height: number): void => {
    dispatch({ kind: 'updateNode', id: node.id, path: ['assetId'], value: assetId })
    dispatch({ kind: 'updateNode', id: node.id, path: ['externalUrl'], value: undefined })
    writeActiveStyle(node.id, ['width'], `${width}px`)
    writeActiveStyle(node.id, ['height'], `${height}px`)
  }

  const handleFiles = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return
      const file = files[0]
      setUpload({ status: 'uploading' })
      try {
        const buffer = await file.arrayBuffer()
        const api = (globalThis as { electronAPI?: Window['electronAPI'] }).electronAPI
        if (!api?.uploadImage) {
          setUpload({ status: 'error', message: 'Upload not available in this build.' })
          return
        }
        const result = await api.uploadImage(buffer, file.name)
        if (!result.success) {
          setUpload({ status: 'error', message: result.error })
          return
        }
        writeAsset(result.asset.id, result.asset.width, result.asset.height)
        setUpload({ status: 'idle' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown upload error.'
        setUpload({ status: 'error', message })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    void handleFiles(event.target.files)
  }
  const onDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setDrag(false)
    void handleFiles(event.dataTransfer.files)
  }
  const onDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setDrag(true)
  }
  const onDragLeave = (): void => setDrag(false)

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Image</h3>

      {node.assetId ? (
        <div className={styles.assetPreview}>
          <ImageIcon size={28} className={styles.assetThumb} />
          <div className={styles.assetMeta}>
            <span className={styles.assetPath}>asset:{node.assetId}</span>
            <span>Replace by uploading another image</span>
          </div>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        className={styles.fileDrop}
        data-active={drag || undefined}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <UploadCloud size={20} aria-hidden />
        <span>
          {upload.status === 'uploading'
            ? 'Uploading…'
            : drag
              ? 'Drop to upload'
              : 'Click or drop an image'}
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={onSelect}
          style={{ display: 'none' }}
          aria-label="Upload image"
        />
      </label>

      {upload.status === 'error' && upload.message ? (
        <p className={styles.fileError} role="alert">
          {upload.message}
        </p>
      ) : null}

      <Field label="External URL">
        <input
          className={styles.textInput}
          value={node.externalUrl ?? ''}
          onChange={(event) => writeUrl(event.target.value)}
          placeholder="https://…"
          aria-label="Image URL"
          spellCheck={false}
        />
      </Field>

      <Field label="Alt text">
        <input
          className={styles.textInput}
          value={node.alt}
          onChange={(event) => writeAlt(event.target.value)}
          placeholder="Describe the image (empty for decorative)"
          aria-label="Image alt text"
          spellCheck
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
      <StateTabs />
      <BreakpointBanner node={node} />
      {node.type === 'container' ? <LayoutSection node={node} /> : null}
      <AppearanceSection node={node} />
      {node.type === 'image' ? <ImageSection node={node} /> : null}
      <AnimationSection node={node} />
      <RuntimeSection node={node} />
    </div>
  )
}
