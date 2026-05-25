/**
 * Editable token rows (L-TKN-02).
 *
 * Swatch + name + value editor + delete. Edits forward to the Y-STR-05
 * helpers (`updateToken` / `deleteToken`), which dispatch through the C3
 * handler so each change is one (coalesced) history entry. Color values use
 * `react-colorful` inside a Radix Popover; scalar categories use a text input.
 */

import * as Popover from '@radix-ui/react-popover'
import { X } from 'lucide-react'
import type { JSX } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

import type { ColorTokenValue, TokenCategory, TokenDefinition } from '@document/types'
import { deleteToken, updateToken } from '@store/tokenOps'

import styles from './TokensPanel.module.css'

/** Every token category that stores a plain string value. */
type ScalarCategory = Exclude<TokenCategory, 'color'>

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

/** A single color token: light + dark swatch pickers, name, delete. */
export function ColorTokenRow({ token }: { token: TokenDefinition<ColorTokenValue> }): JSX.Element {
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
      <NameInput name={token.name} onChange={(name) => updateToken('color', token.id, { name })} />
      <DeleteButton label={`Delete ${token.name}`} onClick={() => deleteToken('color', token.id)} />
    </li>
  )
}

/** A single scalar token (spacing / font / shadow / radius): name + value + delete. */
export function ScalarTokenRow({
  category,
  token,
}: {
  category: ScalarCategory
  token: TokenDefinition<string>
}): JSX.Element {
  return (
    <li className={styles.row}>
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
