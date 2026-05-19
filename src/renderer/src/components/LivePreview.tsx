import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useElementStore } from '../../../store/elementStore'
import { buildPreview } from '../../../export'
import styles from './LivePreview.module.css'

const DEBOUNCE_MS = 300

interface LivePreviewProps {
  open: boolean
  onClose: () => void
}

/**
 * Live preview panel. Re-renders the generator output on every element-store
 * change, debounced to 300 ms so dragging doesn't thrash the generator.
 *
 * Rendered as a sandboxed iframe with srcdoc — gives a byte-identical preview
 * of the final export without needing an asset resolver.
 */
export default function LivePreview({ open, onClose }: LivePreviewProps): JSX.Element {
  const elements = useElementStore((s) => s.elements)
  const [debounced, setDebounced] = useState(elements)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(elements), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [elements])

  const preview = useMemo(() => buildPreview(debounced), [debounced])
  const srcdoc = useMemo(() => buildSrcDoc(preview), [preview])

  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe && iframe.srcdoc !== srcdoc) iframe.srcdoc = srcdoc
  }, [srcdoc])

  return (
    <div className={`${styles.panel} ${open ? '' : styles.panelClosed}`}>
      <div className={styles.header}>
        <span>Live Preview</span>
        {preview === null && <span className={styles.unavailable}>Generator unavailable</span>}
        <button className={styles.closeBtn} onClick={onClose} title="Close preview">
          <X size={14} />
        </button>
      </div>
      <iframe ref={iframeRef} title="Live preview" sandbox="" className={styles.iframe} />
    </div>
  )
}

function buildSrcDoc(preview: { html: string; css: string } | null): string {
  if (!preview) {
    return '<!doctype html><meta charset="UTF-8"><body style="font-family:system-ui;color:#888;padding:24px;background:#1a1a1a">Preview unavailable</body>'
  }
  return preview.html.replace(
    /<link rel="stylesheet" href="styles\.css" \/>/,
    `<style>${preview.css}</style>`
  )
}
