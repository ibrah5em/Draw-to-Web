import JSZip from 'jszip'

export interface ExportBundle {
  html: string
  css: string
  filename: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
}

/**
 * Packages HTML and CSS into a ZIP archive, then triggers the native save dialog via IPC.
 * @param bundle - Generated HTML, CSS, and the desired output filename
 */
export async function exportProject(bundle: ExportBundle): Promise<ExportResult> {
  const zip = new JSZip()
  zip.file('index.html', bundle.html)
  zip.file('styles.css', bundle.css)

  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return window.electronAPI.exportZip(buffer, bundle.filename)
}
