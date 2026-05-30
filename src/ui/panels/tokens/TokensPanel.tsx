/**
 * Bottom-bar Tokens panel (L-TKN-01..04).
 *
 * Radix Tabs over the five token categories (Colors / Spacing / Typography /
 * Shadows / Radii), reading the registry from the document store. Rows are
 * editable (L-TKN-02), each category has an Add button (L-TKN-04), and color
 * rows show a live WCAG-AA contrast badge against the surface (L-TKN-03). The
 * header carries a theme switch (L-TKN-06) — the same sessionStore-bound
 * toggle as the topbar (L-TOP-01), so the panel and canvas repaint together.
 * The panel is hosted in a resizable, collapsible region whose size persists
 * (the shell owns that; see `App.tsx`).
 */

import * as Tabs from '@radix-ui/react-tabs'
import { ChevronDown, ChevronUp, Download, Plus, Upload } from 'lucide-react'
import { useRef, type JSX } from 'react'

import type { ColorTokenValue, TokenCategory, TokenDefinition } from '@document/types'
import { useDocumentMeta, useTokens } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'
import { addToken } from '@store/tokenOps'

import { ThemeToggle } from '../../topbar/ThemeToggle'
import { findSurfaceColor } from './contrast'
import { ColorTokenRow, ScalarTokenRow } from './TokenRow'
import { colorDefault, nextTokenId, scalarDefault } from './tokenDefaults'
import { downloadTokens, importTokensFromFile } from './tokenIO'
import styles from './TokensPanel.module.css'

type ScalarCategory = Exclude<TokenCategory, 'color'>

interface TokensPanelProps {
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  /**
   * Render the panel's own collapse chevron. Defaults to `true` for
   * standalone use; the bottom dock (which owns a shared collapse control
   * across the Tokens / Problems tabs) passes `false` to avoid a duplicate.
   */
  readonly showCollapse?: boolean
}

const TAB_DEFS = [
  { value: 'colors', label: 'Colors' },
  { value: 'spacing', label: 'Spacing' },
  { value: 'typography', label: 'Typography' },
  { value: 'shadows', label: 'Shadows' },
  { value: 'radii', label: 'Radii' },
] as const

function EmptyState(): JSX.Element {
  return <p className={styles.empty}>No tokens in this category.</p>
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button className={styles.addBtn} onClick={onClick}>
      <Plus size={13} />
      {label}
    </button>
  )
}

function ScalarList({
  category,
  items,
}: {
  category: ScalarCategory
  items: ReadonlyArray<TokenDefinition<string>>
}): JSX.Element {
  const add = (): void => addToken(category, scalarDefault(category, nextTokenId(items)))
  return (
    <>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className={styles.list}>
          {items.map((token) => (
            <ScalarTokenRow key={token.id} category={category} token={token} />
          ))}
        </ul>
      )}
      <AddButton label="Add token" onClick={add} />
    </>
  )
}

function ScalarGroup({
  label,
  category,
  items,
}: {
  label: string
  category: ScalarCategory
  items: ReadonlyArray<TokenDefinition<string>>
}): JSX.Element {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <ScalarList category={category} items={items} />
    </section>
  )
}

function ColorList({
  items,
}: {
  items: ReadonlyArray<TokenDefinition<ColorTokenValue>>
}): JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const surface = findSurfaceColor(items, theme)
  const add = (): void => addToken('color', colorDefault(nextTokenId(items)))
  return (
    <>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className={styles.list}>
          {items.map((token) => (
            <ColorTokenRow key={token.id} token={token} surface={surface} theme={theme} />
          ))}
        </ul>
      )}
      <AddButton label="Add color" onClick={add} />
    </>
  )
}

/** The Tokens panel: tab bar (always visible) over a collapsible body. */
export function TokensPanel({
  collapsed,
  onToggleCollapse,
  showCollapse = true,
}: TokensPanelProps): JSX.Element {
  const tokens = useTokens()
  const meta = useDocumentMeta()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onImportFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-importing the same file
    if (!file) return
    void importTokensFromFile(file).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Token import failed: ${message}`)
      }
    })
  }

  return (
    <Tabs.Root defaultValue="colors" className={styles.panel}>
      <div className={styles.header}>
        <Tabs.List className={styles.tabs} aria-label="Token categories">
          {TAB_DEFS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} className={styles.tab}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className={styles.headerRight}>
          <button
            className={styles.ioBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import tokens from JSON"
            title="Import tokens (JSON)"
          >
            <Upload size={14} />
          </button>
          <button
            className={styles.ioBtn}
            onClick={() => downloadTokens(tokens, meta.name)}
            aria-label="Export tokens to JSON"
            title="Export tokens (JSON)"
          >
            <Download size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            hidden
            aria-hidden
          />
          <ThemeToggle />
          {showCollapse ? (
            <button
              className={styles.collapseBtn}
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand tokens panel' : 'Collapse tokens panel'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.body}>
        <Tabs.Content value="colors" className={styles.content}>
          <ColorList items={tokens.color} />
        </Tabs.Content>
        <Tabs.Content value="spacing" className={styles.content}>
          <ScalarList category="spacing" items={tokens.spacing} />
        </Tabs.Content>
        <Tabs.Content value="typography" className={styles.content}>
          <ScalarGroup label="Font family" category="fontFamily" items={tokens.fontFamily} />
          <ScalarGroup label="Font size" category="fontSize" items={tokens.fontSize} />
          <ScalarGroup label="Line height" category="lineHeight" items={tokens.lineHeight} />
        </Tabs.Content>
        <Tabs.Content value="shadows" className={styles.content}>
          <ScalarList category="shadow" items={tokens.shadow} />
        </Tabs.Content>
        <Tabs.Content value="radii" className={styles.content}>
          <ScalarList category="radius" items={tokens.radius} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
