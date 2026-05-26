/**
 * Editable token rows (L-TKN-02, rename L-TKN-04, contrast L-TKN-03).
 *
 * Id + name + value editor + delete. Name/value edits forward to `updateToken`;
 * the id editor commits a `renameToken` on blur (which rewrites every binding
 * in one history entry); delete forwards to `deleteToken`. Color rows add
 * react-colorful pickers and a WCAG-AA contrast badge against the surface.
 */

import * as Popover from '@radix-ui/react-popover'
import { X } from 'lucide-react'
import { useState, type JSX, type KeyboardEvent } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

import type { ColorTokenValue, TokenCategory, TokenDefinition } from '@document/types'
import { deleteToken, renameToken, updateToken } from '@store/tokenOps'

import { contrastInfo } from './contrast'
import { isValidTokenId } from './tokenDefaults'
import styles from './TokensPanel.module.css'

/** Every token category that stores a plain string value. */
type ScalarCategory = Exclude<TokenCategory, 'color'>

/**
 * Editor for a token's id (the slug used in `var()` references). Commits a
 * rename on blur / Enter; reverts on an invalid or colliding id (renameToken
 * throws on collision). Local draft state lets the user type freely without
 * rewriting bindings on every keystroke.
 */
function IdInput({ category, id }: { category: TokenCategory; id: string }): JSX.Element {
  const [draft, setDraft] = useState(id)

  const commit = (): void => {
    const next = draft.trim()
    if (next === id) return
    if (!isValidTokenId(next)) {
      setDraft(id)
      return
    }
    try {
      renameToken(category, id, next)
    } catch {
      setDraft(id)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(id)
  }

  return (
    <input
      className={styles.idInput}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      aria-label="Token id"
      title="Token id — used in var() references; renaming rewrites all bindings"
      spellCheck={false}
    />
  )
}

function NameInput({
  name,
  onChange,
}: {
  name: string
  onChange: (next: string) => void
}): JSX.Element {
  return (
    <input
      className={styles.nameInput}
      value={name}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Token name"
      spellCheck={false}
    />
  )
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button className={styles.deleteBtn} onClick={onClick} aria-label={label} title="Delete token">
      <X size={13} />
    </button>
  )
}

function ContrastBadge({
  foreground,
  background,
}: {
  foreground: string
  background: string | null
}): JSX.Element | null {
  if (background === null) return null
  const info = contrastInfo(foreground, background)
  if (info === null) return null
  return (
    <span
      className={info.passesAA ? styles.contrastPass : styles.contrastFail}
      title={`Contrast ${info.ratio.toFixed(2)}:1 vs surface — WCAG AA ${
        info.passesAA ? 'pass' : 'fail'
      }`}
    >
      {`${info.ratio.toFixed(1)}:1`}
    </span>
  )
}

function ColorSwatch({
  scheme,
  color,
  onChange,
}: {
  scheme: 'light' | 'dark'
  color: string
  onChange: (next: string) => void
}): JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={styles.swatch}
          style={{ background: color }}
          aria-label={`${scheme} color ${color}`}
          title={`${scheme}: ${color}`}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.picker} sideOffset={6} side="top">
          <HexColorPicker color={color} onChange={onChange} />
          <HexColorInput className={styles.hexInput} color={color} onChange={onChange} prefixed />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** A single color token: swatch pickers, id, name, contrast badge, delete. */
export function ColorTokenRow({
  token,
  surface,
  theme,
}: {
  token: TokenDefinition<ColorTokenValue>
  surface: string | null
  theme: 'light' | 'dark'
}): JSX.Element {
  const setValue = (next: ColorTokenValue): void => updateToken('color', token.id, { value: next })

  return (
    <li className={styles.row}>
      <span className={styles.swatches}>
        <ColorSwatch
          scheme="light"
          color={token.value.light}
          onChange={(light) => setValue({ ...token.value, light })}
        />
        <ColorSwatch
          scheme="dark"
          color={token.value.dark}
          onChange={(dark) => setValue({ ...token.value, dark })}
        />
      </span>
      <IdInput category="color" id={token.id} />
      <NameInput name={token.name} onChange={(name) => updateToken('color', token.id, { name })} />
      <ContrastBadge foreground={token.value[theme]} background={surface} />
      <DeleteButton label={`Delete ${token.name}`} onClick={() => deleteToken('color', token.id)} />
    </li>
  )
}

/** A single scalar token (spacing / font / shadow / radius): id + name + value + delete. */
export function ScalarTokenRow({
  category,
  token,
}: {
  category: ScalarCategory
  token: TokenDefinition<string>
}): JSX.Element {
  return (
    <li className={styles.row}>
      <IdInput category={category} id={token.id} />
      <NameInput name={token.name} onChange={(name) => updateToken(category, token.id, { name })} />
      <input
        className={styles.valueInput}
        value={token.value}
        onChange={(event) => updateToken(category, token.id, { value: event.target.value })}
        aria-label="Token value"
        spellCheck={false}
      />
      <DeleteButton
        label={`Delete ${token.name}`}
        onClick={() => deleteToken(category, token.id)}
      />
    </li>
  )
}
