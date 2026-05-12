import { useState } from 'react'
import type { SEOConfig } from '@seo'

export interface SEOConfigDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the validated config when the user confirms export. */
  onSubmit: (config: SEOConfig) => void
}

const TITLE_LIMIT = 60
const DESC_LIMIT = 160

/**
 * Modal dialog that collects SEO metadata before export.
 * Triggered by File → Export or the toolbar export button.
 * Wire into App.tsx by rendering <SEOConfigDialog open={...} onClose={...} onSubmit={...} />.
 */
export default function SEOConfigDialog({
  open,
  onClose,
  onSubmit,
}: SEOConfigDialogProps): JSX.Element | null {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ogImage, setOgImage] = useState('')
  const [canonicalUrl, setCanonicalUrl] = useState('')

  if (!open) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      ogImage: ogImage.trim() || undefined,
      canonicalUrl: canonicalUrl.trim() || undefined,
    })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose()
  }

  const titleWarn = title.length > TITLE_LIMIT
  const descWarn = description.length > DESC_LIMIT
  const canSubmit = title.trim().length > 0 && description.trim().length > 0

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-labelledby="seo-dialog-title">
        <h2 id="seo-dialog-title" style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
          Export Settings
        </h2>
        <form onSubmit={handleSubmit}>
          <FormField
            label="Page Title"
            required
            hint={`${title.length} / ${TITLE_LIMIT}`}
            warn={titleWarn}
            warnMsg="Over 60 characters — may be truncated in search results"
          >
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome page"
              required
              autoFocus
            />
          </FormField>

          <FormField
            label="Meta Description"
            required
            hint={`${description.length} / ${DESC_LIMIT}`}
            warn={descWarn}
            warnMsg="Over 160 characters — may be truncated in search results"
          >
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief summary of this page..."
              required
            />
          </FormField>

          <FormField label="OG Image URL">
            <input
              style={inputStyle}
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
              placeholder="https://example.com/og-image.png"
              type="url"
            />
          </FormField>

          <FormField label="Canonical URL">
            <input
              style={inputStyle}
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              placeholder="https://example.com/page"
              type="url"
            />
          </FormField>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" onClick={onClose} style={btnSecondaryStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={canSubmit ? btnPrimaryStyle : btnDisabledStyle}
            >
              Export
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  required?: boolean
  hint?: string
  warn?: boolean
  warnMsg?: string
  children: React.ReactNode
}

function FormField({
  label,
  required,
  hint,
  warn,
  warnMsg,
  children,
}: FormFieldProps): JSX.Element {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
          {label}
          {required && <span style={{ color: '#f87171' }}> *</span>}
        </label>
        {hint && <span style={{ fontSize: 12, color: warn ? '#f87171' : '#888' }}>{hint}</span>}
      </div>
      {children}
      {warn && warnMsg && <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{warnMsg}</p>}
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogStyle: React.CSSProperties = {
  background: '#242424',
  border: '1px solid #444',
  borderRadius: 8,
  padding: 24,
  width: 480,
  maxWidth: '90vw',
  color: '#f0f0f0',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: 4,
  padding: '6px 8px',
  color: '#f0f0f0',
  fontSize: 14,
  boxSizing: 'border-box',
}

const btnBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}

const btnPrimaryStyle: React.CSSProperties = { ...btnBase, background: '#0066ff', color: '#fff' }
const btnSecondaryStyle: React.CSSProperties = { ...btnBase, background: '#333', color: '#ccc' }
const btnDisabledStyle: React.CSSProperties = {
  ...btnBase,
  background: '#333',
  color: '#555',
  cursor: 'not-allowed',
}
