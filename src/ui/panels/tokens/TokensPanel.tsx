/**
 * Bottom-bar Tokens panel (L-TKN-01).
 *
 * Radix Tabs over the five token categories (Colors / Spacing / Typography /
 * Shadows / Radii), reading the registry from the document store. Rows are
 * read-only here; inline editing, delete, and the color picker arrive in
 * L-TKN-02 / L-TKN-04. The panel is hosted in a resizable, collapsible
 * region whose size persists (the shell owns that; see `App.tsx`).
 */

import * as Tabs from '@radix-ui/react-tabs'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { JSX } from 'react'

import type { ColorTokenValue, TokenCategory, TokenDefinition } from '@document/types'
import { useTokens } from '@store/documentStore'

import { ColorTokenRow, ScalarTokenRow } from './TokenRow'
import styles from './TokensPanel.module.css'

type ScalarCategory = Exclude<TokenCategory, 'color'>

interface TokensPanelProps {
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
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

function ScalarList({
  category,
  items,
}: {
  category: ScalarCategory
  items: ReadonlyArray<TokenDefinition<string>>
}): JSX.Element {
  if (items.length === 0) return <EmptyState />
  return (
    <ul className={styles.list}>
      {items.map((token) => (
        <ScalarTokenRow key={token.id} category={category} token={token} />
      ))}
    </ul>
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
  if (items.length === 0) return <EmptyState />
  return (
    <ul className={styles.list}>
      {items.map((token) => (
        <ColorTokenRow key={token.id} token={token} />
      ))}
    </ul>
  )
}

/** The Tokens panel: tab bar (always visible) over a collapsible body. */
export function TokensPanel({ collapsed, onToggleCollapse }: TokensPanelProps): JSX.Element {
  const tokens = useTokens()

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
        <button
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand tokens panel' : 'Collapse tokens panel'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
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
