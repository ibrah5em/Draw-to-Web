import { useState } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'

import { Canvas } from './canvas/Canvas'
import styles from './App.module.css'

/** localStorage key for the main horizontal panel layout. */
const LAYOUT_STORAGE_KEY = 'dtw.layout.main'

/** Panel ids — also the keys in the persisted {@link Layout} map. */
const PANEL = {
  sidebar: 'sidebar',
  canvas: 'canvas',
  properties: 'properties',
} as const

/** Default column split (percentages of the group) used on first run. */
const DEFAULT_LAYOUT: Layout = {
  [PANEL.sidebar]: 18,
  [PANEL.canvas]: 62,
  [PANEL.properties]: 20,
}

/** Narrow an unknown JSON value to a {@link Layout} (id → numeric percentage). */
function isLayout(value: unknown): value is Layout {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
}

/** Read the persisted layout, falling back to {@link DEFAULT_LAYOUT}. */
function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (raw === null) return DEFAULT_LAYOUT
    const parsed: unknown = JSON.parse(raw)
    if (isLayout(parsed)) return parsed
  } catch {
    // Corrupt or unavailable storage — fall through to the default.
  }
  return DEFAULT_LAYOUT
}

/** Persist the layout after a resize settles (called from `onLayoutChanged`). */
function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

/**
 * Root editor shell (L-CAN-01).
 *
 * Renders the three-column resizable layout — Sidebar / Canvas / Properties —
 * and persists the column split to localStorage so it restores across reloads.
 * The panel contents are placeholders filled in by later L-CAN / L-SBR / L-PRP
 * tasks; this component owns only the frame and its persistence.
 */
export function App(): JSX.Element {
  const [defaultLayout] = useState(loadLayout)

  return (
    <div className={styles.app}>
      <header className={styles.titlebar}>
        <span className={styles.title}>Draw to Web</span>
      </header>

      <Group
        orientation="horizontal"
        className={styles.main}
        defaultLayout={defaultLayout}
        onLayoutChanged={saveLayout}
      >
        <Panel id={PANEL.sidebar} defaultSize="18" minSize="12" maxSize="35">
          <section className={styles.sidebar} aria-label="Insert">
            <Placeholder label="Sidebar" hint="Insert · Layers (L-SBR / L-LYR)" />
          </section>
        </Panel>

        <Separator className={styles.handle}>
          <div className={styles.handleInner} />
        </Separator>

        <Panel id={PANEL.canvas} defaultSize="62" minSize="30">
          <section className={styles.canvas} aria-label="Canvas">
            <Canvas />
          </section>
        </Panel>

        <Separator className={styles.handle}>
          <div className={styles.handleInner} />
        </Separator>

        <Panel id={PANEL.properties} defaultSize="20" minSize="14" maxSize="40">
          <section className={styles.properties} aria-label="Properties">
            <Placeholder label="Properties" hint="Inspector (L-PRP)" />
          </section>
        </Panel>
      </Group>

      <footer className={styles.statusbar} />
    </div>
  )
}

function Placeholder({ label, hint }: { label: string; hint: string }): JSX.Element {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderLabel}>{label}</span>
      <span className={styles.placeholderHint}>{hint}</span>
    </div>
  )
}
