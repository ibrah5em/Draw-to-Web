/**
 * Document Settings dialog (L-DLG-02).
 *
 * Radix Tabs over the document-level configuration the author controls:
 *
 *   - **Meta** — title, description, lang, author (`document.seo`).
 *   - **Schema.org** — JSON-LD type + fields (`document.seo.jsonLd`).
 *   - **Runtime** — the eight opt-in runtime-snippet flags (`document.runtime`).
 *   - **A11y** — WCAG contrast target AA / AAA (`document.settings`).
 *   - **Variables** — `{{name}}` substitution map (`document.variables`).
 *
 * Every write goes through {@link commitDocumentPatch}, which validates the
 * next document against `documentSchema` before committing — satisfying the
 * L-DLG-02 DoD ("writes round-trip through Zod"). The dialog reads live from
 * the store, so edits reflect immediately and survive reopening.
 */

import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type JSX } from 'react'

import type { JsonLdConfig, RuntimeFlags, SEOConfig } from '@document/types'
import {
  useDocumentSettings,
  useDocumentVariables,
  useRuntimeFlags,
  useSEO,
} from '@store/documentStore'

import { commitDocumentPatch } from '../panels/document-settings/applySettings'
import styles from './DocumentSettings.module.css'

interface DocumentSettingsProps {
  readonly open: boolean
  readonly onClose: () => void
}

const RUNTIME_LABELS: Record<keyof RuntimeFlags, string> = {
  themeToggle: 'Theme toggle',
  scrollSpy: 'Scroll-spy nav',
  smoothScroll: 'Smooth scroll',
  mobileNav: 'Mobile menu',
  navOnScroll: 'Nav-on-scroll style',
  reveals: 'Scroll reveals',
  animationGating: 'Animation gating',
  terminalTyping: 'Terminal typing',
}

const JSONLD_KINDS: ReadonlyArray<JsonLdConfig['kind']> = ['Person', 'Organization', 'WebSite']

/** Labelled text field used across the meta + schema tabs. */
function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (next: string) => void
}): JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={label}
      />
    </label>
  )
}

function MetaTab(): JSX.Element {
  const seo = useSEO()
  const patchSeo = (patch: Partial<SEOConfig>): void =>
    commitDocumentPatch((doc) => ({ ...doc, seo: { ...doc.seo, ...patch } }))
  return (
    <div className={styles.tabBody}>
      <TextField label="Title" value={seo.title} onChange={(title) => patchSeo({ title })} />
      <TextField
        label="Description"
        value={seo.description}
        onChange={(description) => patchSeo({ description })}
      />
      <TextField
        label="Language"
        value={seo.lang}
        placeholder="en"
        onChange={(lang) => patchSeo({ lang })}
      />
      <TextField
        label="Author"
        value={seo.author ?? ''}
        onChange={(author) => patchSeo({ author: author || undefined })}
      />
      <TextField
        label="Canonical URL"
        value={seo.canonical ?? ''}
        placeholder="https://example.com"
        onChange={(canonical) => patchSeo({ canonical: canonical || undefined })}
      />
    </div>
  )
}

function SchemaTab(): JSX.Element {
  const seo = useSEO()
  const jsonLd = seo.jsonLd
  const setKind = (kind: JsonLdConfig['kind']): void => {
    commitDocumentPatch((doc) => {
      const name = doc.seo.jsonLd?.name ?? doc.seo.title
      const next: JsonLdConfig =
        kind === 'WebSite'
          ? { kind: 'WebSite', name, url: doc.seo.canonical ?? '' }
          : kind === 'Organization'
            ? { kind: 'Organization', name }
            : { kind: 'Person', name }
      return { ...doc, seo: { ...doc.seo, jsonLd: next } }
    })
  }
  const setName = (name: string): void =>
    commitDocumentPatch((doc) =>
      doc.seo.jsonLd ? { ...doc, seo: { ...doc.seo, jsonLd: { ...doc.seo.jsonLd, name } } } : doc
    )

  return (
    <div className={styles.tabBody}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Schema.org type</span>
        <div className={styles.segmented} role="group" aria-label="Schema.org type">
          {JSONLD_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={jsonLd?.kind === kind ? styles.segActive : styles.seg}
              aria-pressed={jsonLd?.kind === kind}
              onClick={() => setKind(kind)}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>
      {jsonLd ? (
        <TextField label="Name" value={jsonLd.name} onChange={setName} />
      ) : (
        <p className={styles.hint}>Pick a type to emit JSON-LD structured data.</p>
      )}
    </div>
  )
}

function RuntimeTab(): JSX.Element {
  const runtime = useRuntimeFlags()
  const setFlag = (key: keyof RuntimeFlags, value: boolean): void =>
    commitDocumentPatch((doc) => ({ ...doc, runtime: { ...doc.runtime, [key]: value } }))
  return (
    <div className={styles.tabBody}>
      <p className={styles.hint}>
        Each behaviour emits a small vanilla-JS snippet. With all off, the export ships zero
        JavaScript.
      </p>
      <ul className={styles.toggleList}>
        {(Object.keys(RUNTIME_LABELS) as Array<keyof RuntimeFlags>).map((key) => (
          <li key={key} className={styles.toggleRow}>
            <span className={styles.toggleLabel}>{RUNTIME_LABELS[key]}</span>
            <Switch.Root
              className={styles.switch}
              checked={runtime[key]}
              onCheckedChange={(checked) => setFlag(key, checked)}
              aria-label={RUNTIME_LABELS[key]}
            >
              <Switch.Thumb className={styles.switchThumb} />
            </Switch.Root>
          </li>
        ))}
      </ul>
    </div>
  )
}

function A11yTab(): JSX.Element {
  const settings = useDocumentSettings()
  const setTarget = (contrastTarget: 'AA' | 'AAA'): void =>
    commitDocumentPatch((doc) => ({ ...doc, settings: { ...doc.settings, contrastTarget } }))
  return (
    <div className={styles.tabBody}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>WCAG contrast target</span>
        <div className={styles.segmented} role="group" aria-label="WCAG contrast target">
          {(['AA', 'AAA'] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={settings.contrastTarget === level ? styles.segActive : styles.seg}
              aria-pressed={settings.contrastTarget === level}
              onClick={() => setTarget(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.hint}>
        Validation flags text whose contrast against its surface falls below this ratio (AA = 4.5:1,
        AAA = 7:1).
      </p>
    </div>
  )
}

function VariablesTab(): JSX.Element {
  const variables = useDocumentVariables()
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(variables)

  const setValue = (key: string, value: string): void =>
    commitDocumentPatch((doc) => ({ ...doc, variables: { ...doc.variables, [key]: value } }))
  const remove = (key: string): void =>
    commitDocumentPatch((doc) => {
      const next = { ...doc.variables }
      delete next[key]
      return { ...doc, variables: next }
    })
  const add = (): void => {
    const key = newKey.trim()
    if (key === '' || key in variables) return
    setValue(key, '')
    setNewKey('')
  }

  return (
    <div className={styles.tabBody}>
      <p className={styles.hint}>
        Use <code>{'{{name}}'}</code> in text or attributes; the generator substitutes the value at
        export.
      </p>
      <ul className={styles.varList}>
        {entries.length === 0 ? (
          <li className={styles.hint}>No variables defined.</li>
        ) : (
          entries.map(([key, value]) => (
            <li key={key} className={styles.varRow}>
              <code className={styles.varKey}>{key}</code>
              <input
                className={styles.input}
                value={value}
                onChange={(e) => setValue(key, e.target.value)}
                aria-label={`Value for ${key}`}
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => remove(key)}
                aria-label={`Delete ${key}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))
        )}
      </ul>
      <div className={styles.varAdd}>
        <input
          className={styles.input}
          value={newKey}
          placeholder="variable name"
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          aria-label="New variable name"
          spellCheck={false}
        />
        <button type="button" className={styles.addBtn} onClick={add}>
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

const TABS = [
  { value: 'meta', label: 'Meta', body: <MetaTab /> },
  { value: 'schema', label: 'Schema.org', body: <SchemaTab /> },
  { value: 'runtime', label: 'Runtime', body: <RuntimeTab /> },
  { value: 'a11y', label: 'A11y', body: <A11yTab /> },
  { value: 'variables', label: 'Variables', body: <VariablesTab /> },
] as const

/** Document Settings modal (meta / schema / runtime / a11y / variables). */
export function DocumentSettings({ open, onClose }: DocumentSettingsProps): JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>Document settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <Tabs.Root defaultValue="meta" className={styles.tabsRoot}>
            <Tabs.List className={styles.tabsList} aria-label="Settings sections">
              {TABS.map((tab) => (
                <Tabs.Trigger key={tab.value} value={tab.value} className={styles.tab}>
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {TABS.map((tab) => (
              <Tabs.Content key={tab.value} value={tab.value} className={styles.tabContent}>
                {tab.body}
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
