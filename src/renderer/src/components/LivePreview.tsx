import { useEffect, useMemo, useRef, useState } from 'react'
import { useElementStore } from '../../../store/elementStore'
import { buildPreview } from '../../../export'

const DEBOUNCE_MS = 300

/**
 * Live preview panel. Re-renders the generator output on every element-store
 * change, debounced to 300ms so dragging doesn't thrash the generator.
 *
 * Implementation choice: sandboxed iframe with srcdoc rather than Electron's
 * BrowserView/<webview>. Justified because:
 *   - Generated output is guaranteed zero-JS (see CLAUDE.md), so an iframe
 *     sandbox=""/allow-same-origin omitted is sufficient isolation.
 *   - srcdoc gives a byte-identical preview of the final export — no asset
 *     resolution mismatch between preview and ZIP output.
 *   - BrowserView lives in the main process and is harder to lay out
 *     responsively next to React components; <webview> is being phased out
 *     of Electron core.
 */
export default function LivePreview(): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const [debounced, setDebounced] = useState(elements)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(elements), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [elements])

  const preview = useMemo(() => buildPreview(debounced), [debounced])
  const srcdoc = useMemo(() => buildSrcDoc(preview), [preview])

  // Avoid a hard reload on every keystroke — only swap srcdoc when it actually changes.
  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe && iframe.srcdoc !== srcdoc) iframe.srcdoc = srcdoc
  }, [srcdoc])

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>Live Preview</span>
        {preview === null && (
          <span style={{ fontSize: 11, color: '#888' }}>Generator unavailable</span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        title="Live preview"
        sandbox=""
        style={iframeStyle}
        // Defer-set via the effect above so React doesn't replace the iframe on every update
      />
    </div>
  )
}

function buildSrcDoc(preview: { html: string; css: string } | null): string {
  if (!preview) {
    return '<!doctype html><meta charset="UTF-8"><body style="font-family:system-ui;color:#888;padding:24px;background:#1a1a1a">Preview unavailable</body>'
  }
  // Inline the CSS so a single srcdoc string carries everything — no external resolver needed.
  return preview.html.replace(
    /<link rel="stylesheet" href="styles\.css" \/>/,
    `<style>${preview.css}</style>`
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 480,
  borderLeft: '1px solid #333',
  background: '#1a1a1a',
  flexShrink: 0,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid #333',
  background: '#111',
  gap: 8,
}

const iframeStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  border: 'none',
  background: '#fff',
}
