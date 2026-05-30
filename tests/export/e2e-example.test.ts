/**
 * End-to-end export example (I-EXP-01..04 / C12).
 *
 * Runs the real `exportProject` pipeline on the portfolio template,
 * stubs the `window.electronAPI.exportZip` IPC so the `save` stage
 * writes the ZIP to a temp dir, then unzips and verifies every output.
 *
 * Run with:  npx vitest run tests/export/e2e-example.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { createPortfolioTemplate } from '@templates/portfolio'
import { exportProject, type ExportStage } from '@export/index'
import { validateDocument } from '@document/validation'

/** Capture the bytes the save stage hands to the IPC layer. */
let savedBuffer: ArrayBuffer | null = null
let savedPath = ''

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dtw-export-'))
  savedPath = join(dir, 'portfolio.zip')

  // Stub the renderer IPC bridge the `save` stage calls.
  // @ts-expect-error — minimal stub for the one method the pipeline uses.
  globalThis.window = {
    electronAPI: {
      async exportZip(buffer: ArrayBuffer, _filename: string) {
        savedBuffer = buffer
        await writeFile(savedPath, Buffer.from(buffer))
        return { success: true, filePath: savedPath }
      },
    },
  }
})

describe('export pipeline — end to end', () => {
  const doc = createPortfolioTemplate('Ada Lovelace')

  it('emits every stage in order via onProgress, then succeeds', async () => {
    const stages: ExportStage[] = []
    const t0 = performance.now()
    const result = await exportProject(doc, {
      projectName: 'portfolio',
      onProgress: (e) => stages.push(e.stage),
    })
    const elapsedMs = performance.now() - t0

    // eslint-disable-next-line no-console
    console.log(`\n[e2e] full export: ${elapsedMs.toFixed(0)}ms (budget <10000ms)`)
    console.log('[e2e] stages:', stages.join(' → '))

    expect(result.success).toBe(true)
    expect(stages).toEqual([
      'validate',
      'generate',
      'inject-seo',
      'a11y-gate',
      'optimize-images',
      'minify',
      'sitemap-robots',
      'bundle',
      'save',
    ])
    expect(elapsedMs).toBeLessThan(10_000)
    if (result.success) expect(result.report.accessibility.passed).toBe(true)
  })

  it('stays under the 10s portfolio budget with minify=true and inlineJS=true', async () => {
    // The default-options run is timed in the test above; this one
    // exercises the heaviest path (html-minifier-terser + lightningcss
    // + terser + inline-JS splice) so the budget covers both shapes.
    // Use a local IPC stub so the minified buffer doesn't clobber the
    // `savedBuffer` the `bundle contents` describe inspects below.
    const win = globalThis.window as { electronAPI: unknown }
    const prevElectronAPI = win.electronAPI
    win.electronAPI = {
      async exportZip() {
        return { success: true, filePath: '/tmp/minify-budget.zip' }
      },
    }
    try {
      const t0 = performance.now()
      const result = await exportProject(doc, {
        projectName: 'portfolio-min',
        minify: true,
        inlineJS: true,
      })
      const elapsedMs = performance.now() - t0
      // eslint-disable-next-line no-console
      console.log(`[e2e] minify+inline: ${elapsedMs.toFixed(0)}ms (budget <10000ms)`)
      expect(result.success).toBe(true)
      expect(elapsedMs).toBeLessThan(10_000)
    } finally {
      win.electronAPI = prevElectronAPI
    }
  })

  it('validates clean (no errors block the gate)', () => {
    const report = validateDocument(doc)
    console.log(
      `[e2e] validation: ${report.errors.length} errors, ${report.warnings?.length ?? 0} warnings`
    )
    expect(report.errors).toHaveLength(0)
  })

  it('dry-run preview returns html+css under 500ms', async () => {
    // The dry-run path (I-EXP-04) is the document-model preview: it skips
    // the a11y gate + bundle + save and returns the formatted bytes.
    const t0 = performance.now()
    const preview = await exportProject(doc, { dryRun: true })
    const elapsedMs = performance.now() - t0
    console.log(`[e2e] preview: ${elapsedMs.toFixed(0)}ms (budget <500ms)`)
    expect(typeof preview.html).toBe('string')
    expect(typeof preview.css).toBe('string')
    expect(elapsedMs).toBeLessThan(500)
  })

  describe('bundle contents', () => {
    let files: Record<string, string>

    beforeAll(async () => {
      expect(savedBuffer).not.toBeNull()
      const zip = await JSZip.loadAsync(savedBuffer!)
      files = {}
      for (const name of Object.keys(zip.files)) {
        files[name] = await zip.files[name].async('string')
      }
      console.log('[e2e] zip entries:', Object.keys(files).join(', '))
    })

    it('contains the required entries', () => {
      expect(Object.keys(files)).toEqual(
        expect.arrayContaining(['index.html', 'styles.css', 'sitemap.xml', 'robots.txt'])
      )
    })

    it('ships scripts.js iff a runtime flag is on', () => {
      const anyRuntime = Object.values(doc.runtime).some(Boolean)
      expect('scripts.js' in files).toBe(anyRuntime)
    })

    it('HTML: skip link is first body child + CSP meta present', () => {
      const html = files['index.html']
      expect(html).toContain('class="dtw-skip-link"')
      const bodyOpen = html.indexOf('<body')
      const skip = html.indexOf('dtw-skip-link')
      const firstEl = html.indexOf('<', html.indexOf('>', bodyOpen) + 1)
      expect(skip).toBeGreaterThan(bodyOpen)
      expect(skip - firstEl).toBeLessThan(120) // skip link is the first thing in body
      expect(html).toMatch(/http-equiv="Content-Security-Policy"/)
    })

    it('HTML: FOUC inline script in <head> iff theme toggle on', () => {
      const html = files['index.html']
      const headEnd = html.indexOf('</head>')
      const head = html.slice(0, headEnd)
      const hasInlineScript = /<script>[^]*?<\/script>/.test(head)
      expect(hasInlineScript).toBe(doc.runtime.themeToggle === true)
    })

    it('CSS: tokens + theme overrides + dark scheme, no position:absolute', () => {
      const css = files['styles.css']
      expect(css).toMatch(/:root\s*\{[^}]*--/) // :root token block
      expect(css).toMatch(/var\(--/) // var() refs
      expect(css).toMatch(/:root\[data-theme="dark"\]/)
      expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/)
      expect(css).not.toMatch(/position:\s*absolute/)
    })

    it('CSS: element classes follow the scoped dtw-el- scheme and are styled', () => {
      const html = files['index.html']
      const css = files['styles.css']
      const used = new Set<string>()
      for (const m of html.matchAll(/class="([^"]+)"/g)) {
        m[1].split(/\s+/).forEach((c) => c && used.add(c))
      }
      // Every author element gets a scoped `dtw-el-<id>` class (C6 rule).
      // The generator only writes a CSS *rule* for elements that have
      // declarations — unstyled containers carry a class but no rule, which
      // is correct. So: a meaningful fraction of used classes must be styled.
      const elClasses = [...used].filter((c) => c.startsWith('dtw-el-'))
      const styled = elClasses.filter((c) => css.includes(`.${c}`))
      console.log(`[e2e] ${elClasses.length} element classes, ${styled.length} have CSS rules`)
      expect(elClasses.length).toBeGreaterThan(0)
      expect(styled.length).toBeGreaterThan(0)
    })

    it('sitemap.xml + robots.txt are well-formed', () => {
      expect(files['sitemap.xml']).toMatch(/<urlset/)
      expect(files['robots.txt']).toMatch(/User-agent:/i)
    })
  })

  it('is deterministic — same doc generates byte-identical HTML/CSS/JS', async () => {
    // The contract is "same input tree → identical output". A fresh
    // createPortfolioTemplate() mints new nanoid ids, so reuse ONE doc.
    const { generate } = await import('@generator/index')
    const a = await generate(doc)
    const b = await generate(doc)
    expect(a.html).toBe(b.html)
    expect(a.css).toBe(b.css)
    expect(a.js).toBe(b.js)
  })
})
