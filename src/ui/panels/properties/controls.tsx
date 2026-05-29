/**
 * Reusable Properties-panel controls (L-PRP-02..04).
 *
 *   - `Segmented` / `Field` — layout primitives for the inspector.
 *   - `TokenBindButton` (L-PRP-03) — a 🔗 button opening a searchable Radix
 *     Popover of tokens in one category; selecting binds, "Unlink" frees.
 *   - `BindableInput` (L-PRP-03) — a scalar value editor that shows a token
 *     chip when bound, a text input when free, with a bind button.
 *   - `ColorControl` (L-PRP-04) — react-colorful free-value picker, token
 *     binding, and a live chroma-js contrast badge (AA default, AAA toggle).
 *
 * Controls are presentational: they receive the current `Bindable<string>`
 * and an `onChange`; the parent decides which document path the change
 * writes to and how it routes (see `PropertiesPanel`).
 */

import * as Popover from '@radix-ui/react-popover'
import { Link2, Unlink } from 'lucide-react'
import { useState, type JSX, type ReactNode } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

import { isTokenRef } from '@document/tokens'
import type {
  Bindable,
  ColorTokenValue,
  TokenCategory,
  TokenDefinition,
  TokenRef,
} from '@document/types'
import { useTokensByCategory } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'

import { contrastInfo, findSurfaceColor } from '../tokens/contrast'
import styles from './properties.module.css'

type ScalarCategory = Exclude<TokenCategory, 'color'>

/** The token ref a bindable value points at, or `null` when it's a raw value. */
function boundRef(value: Bindable<string> | undefined): TokenRef | null {
  return typeof value === 'string' && isTokenRef(value) ? value : null
}

function refId(ref: TokenRef): string {
  return ref.slice(ref.indexOf('.') + 1)
}

function rawString(value: Bindable<string> | undefined): string {
  return typeof value === 'string' && !isTokenRef(value) ? value : ''
}

/** A labelled inspector row. Optional `badge` slot renders next to the label. */
export function Field({
  label,
  badge,
  children,
}: {
  label: string
  badge?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {badge}
      </span>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  )
}

/** A single-choice segmented button group. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string; icon?: JSX.Element }>
  onChange: (next: T) => void
  ariaLabel: string
}): JSX.Element {
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          className={option.value === value ? styles.segActive : styles.seg}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          title={option.label}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  )
}

/** 🔗 button → searchable token popover (L-PRP-03). */
export function TokenBindButton({
  category,
  boundId,
  onBind,
  onUnbind,
}: {
  category: TokenCategory
  boundId: string | null
  onBind: (ref: TokenRef) => void
  onUnbind: () => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const tokens = useTokensByCategory(category) as ReadonlyArray<
    TokenDefinition<ColorTokenValue | string>
  >
  const theme = useSessionStore((s) => s.theme)

  const needle = query.trim().toLowerCase()
  const filtered = tokens.filter((t) =>
    needle === '' ? true : `${t.name} ${t.id}`.toLowerCase().includes(needle)
  )

  const preview = (value: ColorTokenValue | string): string =>
    typeof value === 'string' ? value : value[theme]

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={boundId !== null ? styles.bindActive : styles.bind}
          aria-label="Bind to token"
          title={boundId !== null ? 'Bound to token' : 'Bind to token'}
        >
          <Link2 size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.bindPop} sideOffset={6} align="end">
          <input
            className={styles.search}
            placeholder="Search tokens…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search tokens"
            autoFocus
            spellCheck={false}
          />
          <ul className={styles.bindList}>
            {filtered.length === 0 ? (
              <li className={styles.bindEmpty}>No tokens</li>
            ) : (
              filtered.map((token) => (
                <li key={token.id}>
                  <button
                    className={token.id === boundId ? styles.bindItemActive : styles.bindItem}
                    onClick={() => {
                      onBind(`${category}.${token.id}` as TokenRef)
                      setOpen(false)
                    }}
                  >
                    {category === 'color' ? (
                      <span
                        className={styles.miniSwatch}
                        style={{ background: preview(token.value) }}
                      />
                    ) : null}
                    <span className={styles.bindName}>{token.name}</span>
                    <span className={styles.bindVal}>{preview(token.value)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {boundId !== null ? (
            <button
              className={styles.unlinkBtn}
              onClick={() => {
                onUnbind()
                setOpen(false)
              }}
            >
              <Unlink size={12} /> Unlink
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Scalar value editor with token binding (gap, padding, font-size, …). */
export function BindableInput({
  value,
  category,
  placeholder,
  onChange,
}: {
  value: Bindable<string> | undefined
  category: ScalarCategory
  placeholder?: string
  onChange: (next: Bindable<string>) => void
}): JSX.Element {
  const tokens = useTokensByCategory(category)
  const ref = boundRef(value)
  const boundId = ref ? refId(ref) : null
  const boundToken = boundId !== null ? tokens.find((t) => t.id === boundId) : undefined

  return (
    <div className={styles.bindable}>
      {ref !== null ? (
        <span className={styles.tokenChip} title={ref}>
          {boundToken?.name ?? ref}
        </span>
      ) : (
        <input
          className={styles.textInput}
          value={rawString(value)}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-label={placeholder ?? 'Value'}
          spellCheck={false}
        />
      )}
      <TokenBindButton
        category={category}
        boundId={boundId}
        onBind={(next) => onChange(next)}
        onUnbind={() => onChange(boundToken?.value ?? rawString(value))}
      />
    </div>
  )
}

function ContrastBadge({
  ratio,
  threshold,
  level,
}: {
  ratio: number
  threshold: number
  level: 'AA' | 'AAA'
}): JSX.Element {
  const passes = ratio >= threshold
  return (
    <span
      className={passes ? styles.contrastPass : styles.contrastFail}
      title={`Contrast ${ratio.toFixed(2)}:1 vs surface — WCAG ${level} needs ${threshold}:1`}
    >
      {passes ? `${ratio.toFixed(1)}:1 ${level}` : `${ratio.toFixed(1)}:1 — needs ${threshold}:1`}
    </span>
  )
}

/** Color value editor: free-value picker, token binding, contrast badge (L-PRP-04). */
export function ColorControl({
  value,
  onChange,
}: {
  value: Bindable<string> | undefined
  onChange: (next: Bindable<string>) => void
}): JSX.Element {
  const colors = useTokensByCategory('color')
  const theme = useSessionStore((s) => s.theme)
  const [aaa, setAaa] = useState(false)

  const ref = boundRef(value)
  const boundId = ref ? refId(ref) : null
  const boundToken = boundId !== null ? colors.find((t) => t.id === boundId) : undefined
  const resolved = ref !== null ? (boundToken?.value[theme] ?? null) : rawString(value) || null

  const surface = findSurfaceColor(colors, theme)
  const info = resolved !== null && surface !== null ? contrastInfo(resolved, surface) : null
  const threshold = aaa ? 7 : 4.5

  return (
    <div className={styles.colorControl}>
      <div className={styles.colorRow}>
        {ref !== null ? (
          <span className={styles.tokenChip} title={ref}>
            {boundToken?.name ?? ref}
          </span>
        ) : (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                className={styles.colorSwatch}
                style={{ background: resolved ?? 'transparent' }}
                aria-label={`Edit color ${resolved ?? ''}`}
              />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.picker} sideOffset={6} align="start">
                <HexColorPicker color={resolved ?? '#000000'} onChange={onChange} />
                <HexColorInput
                  className={styles.hexInput}
                  color={resolved ?? '#000000'}
                  onChange={onChange}
                  prefixed
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        <span className={styles.colorValue}>{resolved ?? '—'}</span>
        <TokenBindButton
          category="color"
          boundId={boundId}
          onBind={(next) => onChange(next)}
          onUnbind={() => onChange(boundToken?.value[theme] ?? resolved ?? '#000000')}
        />
      </div>
      {info !== null ? (
        <div className={styles.contrastRow}>
          <ContrastBadge ratio={info.ratio} threshold={threshold} level={aaa ? 'AAA' : 'AA'} />
          <button
            className={styles.levelToggle}
            onClick={() => setAaa((v) => !v)}
            aria-pressed={aaa}
            title="Toggle WCAG AA / AAA target"
          >
            {aaa ? 'AAA' : 'AA'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
