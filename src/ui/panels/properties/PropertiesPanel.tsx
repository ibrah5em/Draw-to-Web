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
import { Image as ImageIcon, MousePointerClick, Smartphone, UploadCloud } from 'lucide-react'
import { useCallback, useId, useState, type ChangeEvent, type DragEvent, type JSX } from 'react'

import { dispatch } from '@store/dispatch'
import { useElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import {
  resolveLayoutProperty,
  resolveStyleProperty,
  writeActiveLayout,
  writeActiveStyle,
} from '@store/styleRouting'
import type {
  Alignment,
  AnimationSpec,
  AssetManifestEntry,
  BackgroundLayer,
  Bindable,
  BreakpointKey,
  ContainerNode,
  ElementNode,
  FlexDirection,
  ImageNode,
  StateKey,
  Typography,
} from '@document/types'

import { BREAKPOINT_WIDTH_PX } from '../../topbar/breakpoints'
import { layerLabel } from '../../layers/layerMeta'
import { commitDocumentPatch } from '../document-settings/applySettings'
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

/** Friendly name + short pill text for each non-default pseudo-state. */
const STATE_LABEL: Readonly<Record<StateKey, string>> = {
  hover: 'Hover',
  'focus-visible': 'Focus',
  active: 'Active',
}
const STATE_PILL: Readonly<Record<StateKey, string>> = {
  hover: 'H',
  'focus-visible': 'F',
  active: 'A',
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

/** Write a layout property at the active breakpoint slot (Y-STR-07). */
function writeLayout(id: string, key: string, value: unknown): void {
  writeActiveLayout(id, key, value)
}

/**
 * The active routing slot — the breakpoint + pseudo-state that property
 * reads resolve against. Mirrors `writeActiveStyle`'s write target so the
 * controls display the same slot they write to (no revert on edit).
 */
function useActiveSlot(): { breakpoint: BreakpointKey; state: ActiveState } {
  const breakpoint = useSessionStore((s) => s.activeBreakpoint)
  const state = useSessionStore((s) => s.activeState)
  return { breakpoint, state }
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

/** Walk `path` into a style-block-like object; `undefined` if any segment is missing. */
function pickAtPath(target: unknown, path: readonly string[]): unknown {
  let current = target
  for (const key of path) {
    if (current === undefined || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Banner shown while a non-default pseudo-state is active (L-PRP-05). Tells
 * the author every edit is routing to `element.states[state]` and counts the
 * overrides already there — the state analogue of {@link BreakpointBanner}.
 */
function StateBanner({ node }: { node: ElementNode }): JSX.Element | null {
  const state = useSessionStore((s) => s.activeState)
  if (state === 'default') return null
  const block = node.states?.[state]
  const overrideCount = block ? Object.keys(block).length : 0
  return (
    <div className={styles.bpBanner} role="status">
      <span className={styles.bpBannerIcon} aria-hidden>
        <MousePointerClick size={12} />
      </span>
      <span>
        Editing {STATE_LABEL[state]} state —
        {overrideCount > 0
          ? ` ${overrideCount} override${overrideCount === 1 ? '' : 's'}`
          : ' no overrides yet'}
      </span>
    </div>
  )
}

function BreakpointBanner({ node }: { node: ElementNode }): JSX.Element | null {
  const breakpoint = useSessionStore((s) => s.activeBreakpoint)
  const state = useSessionStore((s) => s.activeState)
  // A state slot wins over the breakpoint slot for writes, so when a state is
  // active the StateBanner stands in and this one steps aside.
  if (breakpoint === 'base' || state !== 'default') return null
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
 * Per-field badge for the active write slot (L-PRP-05 / L-PRP-09). When a
 * pseudo-state is active it pills the state (H/F/A) if this field is overridden
 * in `states[state]`; otherwise it pills the active breakpoint (TB/MB/SM) if the
 * field is overridden there. The precedence mirrors the write router.
 */
function OverrideBadge({
  node,
  path,
}: {
  node: ElementNode
  path: readonly string[]
}): JSX.Element | null {
  const breakpoint = useSessionStore((s) => s.activeBreakpoint)
  const state = useSessionStore((s) => s.activeState)
  if (state !== 'default') {
    if (pickAtPath(node.states?.[state], path) === undefined) return null
    return (
      <span className={styles.bpOverride} title={`Override for ${STATE_LABEL[state]} state`}>
        {STATE_PILL[state]}
      </span>
    )
  }
  if (breakpoint === 'base') return null
  if (pickAtPath(node.style[breakpoint], path) === undefined) return null
  return (
    <span className={styles.bpOverride} title={`Override for ${BREAKPOINT_LABEL[breakpoint]}`}>
      {breakpoint === 'tablet' ? 'TB' : breakpoint === 'mobile' ? 'MB' : 'SM'}
    </span>
  )
}

function LayoutSection({ node }: { node: ContainerNode }): JSX.Element {
  const { breakpoint, state } = useActiveSlot()
  const readLayout = (key: string): unknown => resolveLayoutProperty(node, key, breakpoint)
  const readStyle = (path: readonly string[]): unknown =>
    resolveStyleProperty(node, path, breakpoint, state)
  const rawWidth = readStyle(['width'])
  const width = typeof rawWidth === 'string' ? rawWidth : undefined
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
          value={readLayout('direction') === 'column' ? 'column' : 'row'}
          options={DIRECTION_OPTIONS}
          onChange={(next) => writeLayout(node.id, 'direction', next)}
        />
      </Field>

      <Field label="Gap">
        <BindableInput
          value={readLayout('gap') as Bindable<string> | undefined}
          category="spacing"
          placeholder="0"
          onChange={(next) => writeLayout(node.id, 'gap', next)}
        />
      </Field>

      <AlignmentSelect
        label="Main axis"
        value={readLayout('justify') as Alignment | undefined}
        onChange={(next) => writeLayout(node.id, 'justify', next)}
      />
      <AlignmentSelect
        label="Cross axis"
        value={readLayout('align') as Alignment | undefined}
        onChange={(next) => writeLayout(node.id, 'align', next)}
      />

      <Field label="Padding" badge={<OverrideBadge node={node} path={['padding']} />}>
        <div className={styles.box}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <BindableInput
              key={side}
              value={readStyle(['padding', side]) as Bindable<string> | undefined}
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

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
  { value: 'justify', label: 'J' },
] as const

const TEXT_DECORATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'underline', label: 'Underline' },
  { value: 'line-through', label: 'Strike' },
] as const

const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'aa' },
  { value: 'uppercase', label: 'AB' },
  { value: 'capitalize', label: 'Ab' },
] as const

const FONT_STYLE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'italic', label: 'Italic' },
] as const

function TypographySection({ node }: { node: ElementNode }): JSX.Element {
  const { breakpoint, state } = useActiveSlot()
  const read = <K extends keyof Typography>(key: K): Typography[K] | undefined =>
    resolveStyleProperty(node, ['typography', key], breakpoint, state) as Typography[K] | undefined
  const t: Partial<Typography> = {
    fontFamily: read('fontFamily'),
    fontSize: read('fontSize'),
    fontWeight: read('fontWeight'),
    lineHeight: read('lineHeight'),
    letterSpacing: read('letterSpacing'),
    textAlign: read('textAlign'),
    textDecoration: read('textDecoration'),
    textTransform: read('textTransform'),
    fontStyle: read('fontStyle'),
    color: read('color'),
  }
  const write = (key: string, value: unknown): void =>
    writeActiveStyle(node.id, ['typography', key], value)

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Typography</h3>

      <Field
        label="Font family"
        badge={<OverrideBadge node={node} path={['typography', 'fontFamily']} />}
      >
        <BindableInput
          value={t.fontFamily}
          category="fontFamily"
          placeholder="Inter, system-ui"
          onChange={(next) => write('fontFamily', next)}
        />
      </Field>

      <Field
        label="Font size"
        badge={<OverrideBadge node={node} path={['typography', 'fontSize']} />}
      >
        <BindableInput
          value={t.fontSize}
          category="fontSize"
          placeholder="16px"
          onChange={(next) => write('fontSize', next)}
        />
      </Field>

      <Field label="Weight">
        <input
          className={styles.textInput}
          value={typeof t.fontWeight === 'number' ? String(t.fontWeight) : (t.fontWeight ?? '')}
          onChange={(event) => {
            const raw = event.target.value
            if (raw === '') {
              write('fontWeight', undefined)
              return
            }
            const num = Number(raw)
            write('fontWeight', Number.isFinite(num) ? num : raw)
          }}
          placeholder="400"
          aria-label="Font weight"
          spellCheck={false}
        />
      </Field>

      <Field
        label="Line height"
        badge={<OverrideBadge node={node} path={['typography', 'lineHeight']} />}
      >
        <BindableInput
          value={typeof t.lineHeight === 'string' ? t.lineHeight : undefined}
          category="lineHeight"
          placeholder="1.4"
          onChange={(next) => write('lineHeight', next)}
        />
      </Field>

      <Field label="Letter spacing">
        <input
          className={styles.textInput}
          value={typeof t.letterSpacing === 'string' ? t.letterSpacing : ''}
          onChange={(event) => write('letterSpacing', event.target.value || undefined)}
          placeholder="0.02em"
          aria-label="Letter spacing"
          spellCheck={false}
        />
      </Field>

      <Field label="Align">
        <Segmented
          ariaLabel="Text align"
          value={t.textAlign ?? 'left'}
          options={TEXT_ALIGN_OPTIONS}
          onChange={(next) => write('textAlign', next === 'left' ? undefined : next)}
        />
      </Field>

      <Field label="Decoration">
        <Segmented
          ariaLabel="Text decoration"
          value={t.textDecoration ?? 'none'}
          options={TEXT_DECORATION_OPTIONS}
          onChange={(next) => write('textDecoration', next === 'none' ? undefined : next)}
        />
      </Field>

      <Field label="Transform">
        <Segmented
          ariaLabel="Text transform"
          value={t.textTransform === 'lowercase' ? 'none' : (t.textTransform ?? 'none')}
          options={TEXT_TRANSFORM_OPTIONS}
          onChange={(next) => write('textTransform', next === 'none' ? undefined : next)}
        />
      </Field>

      <Field label="Style">
        <Segmented
          ariaLabel="Font style"
          value={t.fontStyle ?? 'normal'}
          options={FONT_STYLE_OPTIONS}
          onChange={(next) => write('fontStyle', next === 'normal' ? undefined : next)}
        />
      </Field>

      <Field label="Color" badge={<OverrideBadge node={node} path={['typography', 'color']} />}>
        <ColorControl value={t.color} onChange={(next) => write('color', next)} />
      </Field>
    </section>
  )
}

function FillSection({ node }: { node: ElementNode }): JSX.Element {
  const { breakpoint, state } = useActiveSlot()
  const bg = resolveStyleProperty(node, ['background'], breakpoint, state) as
    | ReadonlyArray<BackgroundLayer>
    | undefined
  const bgColor = bg && bg[0]?.kind === 'solid' ? bg[0].color : undefined
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Fill</h3>
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

function SizeSection({ node }: { node: ElementNode }): JSX.Element {
  const { breakpoint, state } = useActiveSlot()
  const read = (key: string): unknown => resolveStyleProperty(node, [key], breakpoint, state)
  const dimToString = (value: unknown): string => (typeof value === 'string' ? value : '')
  const setDim =
    (key: 'width' | 'height' | 'minWidth' | 'maxWidth') =>
    (raw: string): void => {
      writeActiveStyle(node.id, [key], raw === '' ? undefined : raw)
    }
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Size</h3>
      <Field label="Width" badge={<OverrideBadge node={node} path={['width']} />}>
        <input
          className={styles.textInput}
          value={dimToString(read('width'))}
          onChange={(event) => setDim('width')(event.target.value)}
          placeholder="auto"
          aria-label="Width"
          spellCheck={false}
        />
      </Field>
      <Field label="Height" badge={<OverrideBadge node={node} path={['height']} />}>
        <input
          className={styles.textInput}
          value={dimToString(read('height'))}
          onChange={(event) => setDim('height')(event.target.value)}
          placeholder="auto"
          aria-label="Height"
          spellCheck={false}
        />
      </Field>
      <Field label="Max width">
        <input
          className={styles.textInput}
          value={dimToString(read('maxWidth'))}
          onChange={(event) => setDim('maxWidth')(event.target.value)}
          placeholder="none"
          aria-label="Max width"
          spellCheck={false}
        />
      </Field>
    </section>
  )
}

function SpacingSection({ node }: { node: ElementNode }): JSX.Element {
  const { breakpoint, state } = useActiveSlot()
  const read = (kind: 'padding' | 'margin', side: string): Bindable<string> | undefined =>
    resolveStyleProperty(node, [kind, side], breakpoint, state) as Bindable<string> | undefined
  const setBox = (kind: 'padding' | 'margin', side: string, value: Bindable<string>): void =>
    writeActiveStyle(node.id, [kind, side], value)
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Spacing</h3>
      <Field label="Padding" badge={<OverrideBadge node={node} path={['padding']} />}>
        <div className={styles.box}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <BindableInput
              key={`p-${side}`}
              value={read('padding', side)}
              category="spacing"
              placeholder={side[0]?.toUpperCase()}
              onChange={(next) => setBox('padding', side, next)}
            />
          ))}
        </div>
      </Field>
      <Field label="Margin" badge={<OverrideBadge node={node} path={['margin']} />}>
        <div className={styles.box}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <BindableInput
              key={`m-${side}`}
              value={read('margin', side)}
              category="spacing"
              placeholder={side[0]?.toUpperCase()}
              onChange={(next) => setBox('margin', side, next)}
            />
          ))}
        </div>
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
  const writeAsset = (asset: AssetManifestEntry): void => {
    // Register the processed image in the document so the canvas (and the
    // Assets panel) have a real source to load; then point this node at it.
    commitDocumentPatch((doc) => ({ ...doc, assets: { ...doc.assets, [asset.id]: asset } }))
    dispatch({ kind: 'updateNode', id: node.id, path: ['assetId'], value: asset.id })
    dispatch({ kind: 'updateNode', id: node.id, path: ['externalUrl'], value: undefined })
    writeActiveStyle(node.id, ['width'], `${asset.width}px`)
    writeActiveStyle(node.id, ['height'], `${asset.height}px`)
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
        writeAsset(result.asset)
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
      <StateBanner node={node} />
      <BreakpointBanner node={node} />
      {node.type === 'container' ? <LayoutSection node={node} /> : null}
      <SizeSection node={node} />
      <SpacingSection node={node} />
      <TypographySection node={node} />
      <FillSection node={node} />
      {node.type === 'image' ? <ImageSection node={node} /> : null}
      <AnimationSection node={node} />
      <RuntimeSection node={node} />
    </div>
  )
}
