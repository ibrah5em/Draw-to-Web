/**
 * Verify-exports harness — local-only, not run in CI.
 *
 * Bundles the three Tier-1 templates via the export pipeline's dry-run
 * path, serves them off a temp http server, drives headless Chrome to
 * assert:
 *
 *   - I-SEO-01 portfolio Lighthouse SEO category score >= 0.95
 *   - I-SEO-03 every emitted JSON-LD block parses + carries the schema.org
 *     required fields for its `@type`
 *   - I-TPL-03 landing Lighthouse Performance score >= 0.95
 *   - I-TPL-04 resume prints to exactly one A4 page
 *
 * Run via `npm run verify:exports`. Exits 0 on pass, 1 on any miss;
 * per-template scores print regardless so misses can be triaged.
 */

import { createServer, type Server } from 'node:http'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'

import lighthouse from 'lighthouse'
import puppeteer, { type Browser } from 'puppeteer'

import { exportProject } from '../src/export'
import { createLandingTemplate } from '../src/templates/landing'
import { createPortfolioTemplate } from '../src/templates/portfolio'
import { createResumeTemplate } from '../src/templates/resume'
import type { Document } from '../src/document/types'

const SEO_THRESHOLD = 0.95
const PERF_THRESHOLD = 0.95

interface Bundle {
  html: string
  css: string
  js: string
}

async function renderBundle(doc: Document): Promise<Bundle> {
  const result = await exportProject(doc, { dryRun: true, minify: true })
  return { html: result.html, css: result.css, js: result.js }
}

function writeBundle(root: string, name: string, bundle: Bundle): void {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), bundle.html, 'utf8')
  writeFileSync(join(dir, 'styles.css'), bundle.css, 'utf8')
  if (bundle.js.length > 0) {
    writeFileSync(join(dir, 'scripts.js'), bundle.js, 'utf8')
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function startServer(root: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolveP, rejectP) => {
    const server = createServer((req, res) => {
      let urlPath = (req.url ?? '/').split('?')[0]
      if (urlPath.endsWith('/')) urlPath += 'index.html'
      if (urlPath.includes('..')) {
        res.statusCode = 400
        res.end('bad path')
        return
      }
      const filePath = join(root, urlPath)
      try {
        const body = readFileSync(filePath)
        res.statusCode = 200
        res.setHeader('content-type', MIME[extname(filePath)] ?? 'application/octet-stream')
        res.setHeader('cache-control', 'no-store')
        res.end(body)
      } catch {
        res.statusCode = 404
        res.end('not found')
      }
    })
    server.on('error', rejectP)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolveP({ server, port: addr.port })
      } else {
        rejectP(new Error('server.address() returned null'))
      }
    })
  })
}

/**
 * Required schema.org fields for the `@type` values our SEO emitter
 * produces. Mirrors what validator.schema.org enforces for these types.
 */
const SCHEMA_REQUIRED: Record<string, string[]> = {
  Person: ['name'],
  WebSite: ['name', 'url'],
  Organization: ['name', 'url'],
}

interface JsonLdFinding {
  ok: boolean
  type: string
  errors: string[]
}

function validateJsonLd(html: string): JsonLdFinding[] {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  const findings: JsonLdFinding[] = []
  for (const m of matches) {
    const body = m[1].trim()
    const errors: string[] = []
    let type = '(unknown)'
    try {
      const parsed: unknown = JSON.parse(body)
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('JSON-LD body is not an object')
      } else {
        const obj = parsed as Record<string, unknown>
        const ctx = obj['@context']
        if (ctx !== 'https://schema.org' && ctx !== 'http://schema.org') {
          errors.push(`@context "${String(ctx)}" is not schema.org`)
        }
        const t = obj['@type']
        type = typeof t === 'string' ? t : '(missing @type)'
        const required = SCHEMA_REQUIRED[type]
        if (required) {
          for (const field of required) {
            const v = obj[field]
            if (v === undefined || v === null || v === '') {
              errors.push(`@type ${type} missing required field "${field}"`)
            }
          }
        } else {
          errors.push(`@type "${type}" has no required-fields rule in harness`)
        }
      }
    } catch (err) {
      errors.push(`JSON.parse failed: ${(err as Error).message}`)
    }
    findings.push({ ok: errors.length === 0, type, errors })
  }
  return findings
}

interface LighthouseSummary {
  category: string
  score: number
}

async function runLighthouse(
  url: string,
  port: number,
  category: 'seo' | 'performance'
): Promise<LighthouseSummary> {
  const result = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: [category],
  })
  if (!result) throw new Error(`lighthouse returned undefined for ${url}`)
  const score = result.lhr.categories[category]?.score
  return { category, score: typeof score === 'number' ? score : 0 }
}

/**
 * Count `/Type /Page` references in a PDF byte stream — the standard
 * indicator of page-object count. Excludes the pages-tree root
 * (`/Type /Pages`) via negative lookahead.
 */
function countPdfPages(pdf: Buffer): number {
  const text = pdf.toString('binary')
  const matches = text.match(/\/Type\s*\/Page(?!s)/g)
  return matches ? matches.length : 0
}

interface Result {
  label: string
  ok: boolean
  detail: string
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'dtw-verify-exports-'))
  const results: Result[] = []
  let server: Server | null = null
  let browser: Browser | null = null
  try {
    process.stdout.write('[verify-exports] rendering templates via exportProject dry-run...\n')
    const portfolio = await renderBundle(createPortfolioTemplate())
    const landing = await renderBundle(createLandingTemplate())
    const resume = await renderBundle(createResumeTemplate())

    writeBundle(root, 'portfolio', portfolio)
    writeBundle(root, 'landing', landing)
    writeBundle(root, 'resume', resume)

    // I-SEO-03 — JSON-LD structural validity (offline)
    for (const [name, bundle] of [
      ['portfolio', portfolio],
      ['landing', landing],
      ['resume', resume],
    ] as const) {
      const findings = validateJsonLd(bundle.html)
      if (findings.length === 0) {
        results.push({
          label: `I-SEO-03 ${name} JSON-LD present`,
          ok: false,
          detail: 'no <script type="application/ld+json"> block found',
        })
        continue
      }
      const bad = findings.filter((f) => !f.ok)
      results.push({
        label: `I-SEO-03 ${name} JSON-LD valid (${findings.length} block${findings.length === 1 ? '' : 's'})`,
        ok: bad.length === 0,
        detail:
          bad.length === 0
            ? findings.map((f) => f.type).join(', ')
            : bad.map((f) => `${f.type}: ${f.errors.join('; ')}`).join(' | '),
      })
    }

    const started = await startServer(root)
    server = started.server
    const httpPort = started.port

    process.stdout.write('[verify-exports] launching headless Chrome...\n')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    const wsPort = Number(new URL(browser.wsEndpoint()).port)

    process.stdout.write('[verify-exports] running Lighthouse SEO on portfolio...\n')
    const seo = await runLighthouse(
      `http://127.0.0.1:${httpPort}/portfolio/index.html`,
      wsPort,
      'seo'
    )
    results.push({
      label: `I-SEO-01 portfolio Lighthouse SEO >= ${SEO_THRESHOLD}`,
      ok: seo.score >= SEO_THRESHOLD,
      detail: `score ${seo.score.toFixed(2)}`,
    })

    process.stdout.write('[verify-exports] running Lighthouse Performance on landing...\n')
    const perf = await runLighthouse(
      `http://127.0.0.1:${httpPort}/landing/index.html`,
      wsPort,
      'performance'
    )
    results.push({
      label: `I-TPL-03 landing Lighthouse Performance >= ${PERF_THRESHOLD}`,
      ok: perf.score >= PERF_THRESHOLD,
      detail: `score ${perf.score.toFixed(2)}`,
    })

    process.stdout.write('[verify-exports] printing resume to A4 PDF...\n')
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${httpPort}/resume/index.html`, {
      waitUntil: 'networkidle0',
    })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
    await page.close()
    const pages = countPdfPages(Buffer.from(pdf))
    const pdfPath = join(root, 'resume.pdf')
    writeFileSync(pdfPath, pdf)
    results.push({
      label: `I-TPL-04 resume fits one A4 page`,
      ok: pages === 1,
      detail: pages === 1 ? '1 page' : `${pages} pages (preserved at ${pdfPath})`,
    })

    // Defer temp cleanup if the resume failed so the user can inspect the PDF.
    const cleanup = pages === 1
    if (browser) await browser.close()
    browser = null
    if (server) await new Promise<void>((res) => server!.close(() => res()))
    server = null
    if (cleanup) rmSync(root, { recursive: true, force: true })
  } catch (err) {
    if (browser) await browser.close()
    if (server) await new Promise<void>((res) => server!.close(() => res()))
    rmSync(root, { recursive: true, force: true })
    throw err
  }

  let failed = 0
  process.stdout.write('\n[verify-exports] results:\n')
  for (const r of results) {
    process.stdout.write(`  ${r.ok ? '[PASS]' : '[FAIL]'} ${r.label} -- ${r.detail}\n`)
    if (!r.ok) failed++
  }
  process.stdout.write(
    `\n[verify-exports] ${results.length - failed}/${results.length} passed\n`
  )
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  process.stderr.write(`[verify-exports] failed: ${(err as Error).stack ?? String(err)}\n`)
  process.exit(1)
})
