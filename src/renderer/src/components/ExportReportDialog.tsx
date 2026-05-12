import type { ExportProjectResult } from '../../../export'

export interface ExportReportDialogProps {
  result: ExportProjectResult
  onClose: () => void
  onRetry: () => void
}

/**
 * Pre-/post-export report dialog. On success, shows the saved path and the
 * SEO/a11y summary. On failure, identifies the pipeline stage and lists any
 * accessibility violations so the user can fix them and retry.
 */
export default function ExportReportDialog({
  result,
  onClose,
  onRetry,
}: ExportReportDialogProps): JSX.Element {
  const headline = result.success ? 'Export complete' : 'Export blocked'
  const headlineColor = result.success ? '#4ade80' : '#f87171'

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-labelledby="report-heading">
        <h2 id="report-heading" style={{ marginBottom: 12, fontSize: 18, color: headlineColor }}>
          {headline}
        </h2>

        {result.success ? (
          <p style={{ marginBottom: 16, fontSize: 13, color: '#ccc' }}>
            Saved to <code style={codeStyle}>{result.filePath}</code>
          </p>
        ) : (
          <p style={{ marginBottom: 16, fontSize: 13, color: '#f87171' }}>
            <strong>{stageLabel(result.stage)}:</strong> {result.error}
          </p>
        )}

        {result.report && (
          <>
            <section style={{ marginBottom: 16 }}>
              <h3 style={sectionHeadingStyle}>SEO</h3>
              <ul style={listStyle}>
                <li>Title: {result.report.seo.titleLength} chars</li>
                <li>Description: {result.report.seo.descriptionLength} chars</li>
                <li>OG image: {result.report.seo.hasOgImage ? 'yes' : 'no'}</li>
                <li>Canonical URL: {result.report.seo.hasCanonical ? 'yes' : 'no'}</li>
                <li>&lt;h1&gt; count: {result.report.seo.h1Count}</li>
                <li>Empty-alt images: {result.report.seo.imagesMissingAlt}</li>
              </ul>
            </section>

            <section style={{ marginBottom: 16 }}>
              <h3 style={sectionHeadingStyle}>
                Accessibility{' '}
                <span style={{ color: result.report.accessibility.passed ? '#4ade80' : '#f87171' }}>
                  {result.report.accessibility.passed ? '✓ passed' : '✗ blocked'}
                </span>
              </h3>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 8px' }}>
                critical: {result.report.accessibility.counts.critical} · serious:{' '}
                {result.report.accessibility.counts.serious} · moderate:{' '}
                {result.report.accessibility.counts.moderate} · minor:{' '}
                {result.report.accessibility.counts.minor}
              </p>
              {result.report.guidance.length > 0 && (
                <ul style={listStyle}>
                  {result.report.guidance.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {!result.success && (
            <button onClick={onRetry} style={btnSecondaryStyle}>
              Edit SEO and retry
            </button>
          )}
          <button onClick={onClose} style={btnPrimaryStyle}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function stageLabel(stage: ExportProjectResult extends { stage: infer S } ? S : never): string {
  switch (stage) {
    case 'infer':
      return 'Semantic inference'
    case 'generate':
      return 'Code generation'
    case 'inject-seo':
      return 'SEO injection'
    case 'a11y-gate':
      return 'Accessibility check'
    case 'bundle':
      return 'ZIP bundling'
    case 'save':
      return 'Save'
    default:
      return 'Export'
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
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
  width: 560,
  maxWidth: '90vw',
  maxHeight: '85vh',
  overflowY: 'auto',
  color: '#f0f0f0',
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#ccc',
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 12,
  color: '#bbb',
  lineHeight: 1.7,
}

const codeStyle: React.CSSProperties = {
  background: '#1a1a1a',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 12,
  color: '#0096ff',
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
