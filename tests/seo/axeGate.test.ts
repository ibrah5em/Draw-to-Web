import { describe, it, expect, beforeAll } from 'vitest'
import { runAxeGate, formatViolation } from '@seo/axeGate'
import { generateFullReport, injectSEO } from '@seo'
import { generate } from '@generator'
import { buildSimpleDocument } from '../fixtures/documents'
import type { Document } from '../../src/document/types'

const BASE_CONFIG = {
  title: 'Axe Gate Page',
  description: 'A test page used by the axe-core gate suite.',
} as const

let SIMPLE_HTML: string
let SIMPLE_DOC: Document

beforeAll(async () => {
  SIMPLE_DOC = buildSimpleDocument(BASE_CONFIG)
  SIMPLE_HTML = (await generate(SIMPLE_DOC)).html
})

/** Wraps an HTML body fragment in a minimal valid document. */
function doc(body: string, opts: { lang?: string; title?: string } = {}): string {
  const lang = opts.lang ?? 'en'
  const title = opts.title ?? 'Test'
  return `<!doctype html><html lang="${lang}"><head><meta charset="UTF-8" /><title>${title}</title></head><body>${body}</body></html>`
}

describe('runAxeGate', () => {
  it('passes on a clean injectSEO output', async () => {
    const html = injectSEO(SIMPLE_HTML, SIMPLE_DOC.seo)
    const report = await runAxeGate(html)
    const blocking = report.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
    expect(report.passed).toBe(true)
  })

  it('fails when an <img> is missing alt', async () => {
    const html = doc('<img src="foo.png">')
    const report = await runAxeGate(html)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.id === 'image-alt')).toBe(true)
  })

  it('fails when a <button> has no accessible name', async () => {
    const html = doc('<button></button>')
    const report = await runAxeGate(html)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.id === 'button-name')).toBe(true)
  })

  it('fails when <html> is missing lang', async () => {
    const html =
      '<!doctype html><html><head><meta charset="UTF-8" /><title>x</title></head><body><p>hi</p></body></html>'
    const report = await runAxeGate(html)
    expect(report.passed).toBe(false)
    expect(report.violations.some((v) => v.id === 'html-has-lang')).toBe(true)
  })

  it('counts violations by impact', async () => {
    const html = doc('<img src="a.png"><button></button>')
    const report = await runAxeGate(html)
    const total =
      report.counts.critical + report.counts.serious + report.counts.moderate + report.counts.minor
    expect(total).toBe(report.violations.length)
    expect(report.counts.critical + report.counts.serious).toBeGreaterThan(0)
  })

  it('aggregates multiple violating nodes for one rule into a single entry', async () => {
    const html = doc('<img src="a.png"><img src="b.png"><img src="c.png">')
    const report = await runAxeGate(html)
    const imageAlt = report.violations.find((v) => v.id === 'image-alt')
    expect(imageAlt).toBeDefined()
    expect(imageAlt?.nodes).toBe(3)
  })
})

describe('formatViolation', () => {
  it('renders a one-line message including impact, id, help, node count, and URL', () => {
    const line = formatViolation({
      id: 'image-alt',
      impact: 'critical',
      description: '...',
      help: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4/image-alt',
      nodes: 2,
    })
    expect(line).toContain('[critical]')
    expect(line).toContain('image-alt')
    expect(line).toContain('Images must have alternate text')
    expect(line).toContain('2 nodes')
    expect(line).toContain('https://dequeuniversity.com/rules/axe/4/image-alt')
  })

  it('uses singular "node" for a single affected element', () => {
    const line = formatViolation({
      id: 'button-name',
      impact: 'serious',
      description: '...',
      help: 'Buttons must have discernible text',
      helpUrl: 'https://example.com',
      nodes: 1,
    })
    expect(line).toContain('1 node)')
  })
})

describe('generateFullReport', () => {
  it('returns SEO + accessibility + guidance for a clean page', async () => {
    const html = injectSEO(SIMPLE_HTML, SIMPLE_DOC.seo)
    const report = await generateFullReport(html, SIMPLE_DOC.seo)

    expect(report.seo.titleLength).toBe(BASE_CONFIG.title.length)
    expect(report.accessibility.passed).toBe(true)
    expect(Array.isArray(report.guidance)).toBe(true)
  })

  it('flags missing OG image and canonical in guidance', async () => {
    const html = injectSEO(SIMPLE_HTML, SIMPLE_DOC.seo)
    const report = await generateFullReport(html, SIMPLE_DOC.seo)
    expect(report.guidance.some((g) => g.includes('Open Graph'))).toBe(true)
    expect(report.guidance.some((g) => g.includes('canonical'))).toBe(true)
  })

  it('flags over-long title with a warning', async () => {
    const longConfig = {
      title: 'x'.repeat(80),
      description: 'ok',
    }
    const longDoc = buildSimpleDocument(longConfig)
    const html = injectSEO((await generate(longDoc)).html, longDoc.seo)
    const report = await generateFullReport(html, longDoc.seo)
    expect(report.guidance.some((g) => g.includes('truncated above 60'))).toBe(true)
  })

  it('includes blocking ✗ markers when a11y violations are critical/serious', async () => {
    const html = doc('<img src="x.png">', { title: 'y' })
    const report = await generateFullReport(html, SIMPLE_DOC.seo)
    expect(report.accessibility.passed).toBe(false)
    expect(report.guidance.some((g) => g.startsWith('✗'))).toBe(true)
  })
})
