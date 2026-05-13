import { describe, expect, test } from 'vitest'
import { generate } from '@generator'
import { injectSEO, runAxeGate } from '@seo'
import { PAGE_WITH_NAV, SIMPLE_PAGE } from '../generator/fixtures'

interface CheckResult {
  name: string
  passed: boolean
  detail: string
}

function collectClassNames(html: string): string[] {
  const out: string[] = []
  const re = /class="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    for (const cls of m[1].split(/\s+/)) if (cls) out.push(cls)
  }
  return out
}

function collectCssSelectors(css: string): Set<string> {
  const set = new Set<string>()
  const re = /\.([A-Za-z_][\w-]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) set.add(m[1])
  return set
}

function checkWellFormed(html: string): CheckResult {
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ])
  const stack: string[] = []
  const tagRe = /<\/?([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html))) {
    const raw = m[0]
    const tag = m[1].toLowerCase()
    const selfClose = m[2] === '/' || voidTags.has(tag)
    if (raw.startsWith('</')) {
      const top = stack.pop()
      if (top !== tag) {
        return {
          name: 'Well-formed HTML5',
          passed: false,
          detail: `mismatched close: expected </${top ?? 'none'}>, got </${tag}>`,
        }
      }
    } else if (!selfClose) {
      stack.push(tag)
    }
  }
  if (stack.length) {
    return {
      name: 'Well-formed HTML5',
      passed: false,
      detail: `unclosed tags: ${stack.join(', ')}`,
    }
  }
  return { name: 'Well-formed HTML5', passed: true, detail: 'all tags balanced' }
}

function checkClassesReferenced(html: string, css: string): CheckResult {
  const used = collectClassNames(html)
  const defined = collectCssSelectors(css)
  const missing = used.filter((c) => !defined.has(c))
  return {
    name: 'CSS classes resolve',
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `${used.length} class refs, all defined`
        : `missing definitions for: ${missing.join(', ')}`,
  }
}

function checkNoAbsolutePositioning(css: string): CheckResult {
  const match = css.match(/position\s*:\s*absolute/i)
  return {
    name: 'No absolute positioning',
    passed: !match,
    detail: match ? `found "${match[0]}"` : 'none found',
  }
}

async function runFixture(name: string, elements: typeof SIMPLE_PAGE) {
  const { html, css } = generate(elements)
  const seoHtml = injectSEO(html, {
    title: 'Draw-to-Web E2E Test',
    description: 'End-to-end validation of the generator + SEO + axe pipeline.',
    ogImage: 'https://example.com/og.png',
    canonicalUrl: 'https://example.com/',
  })
  const fullDoc = seoHtml.replace(
    '<link rel="stylesheet" href="styles.css" />',
    `<style>${css}</style>`
  )
  const axe = await runAxeGate(fullDoc)
  const results: CheckResult[] = [
    checkWellFormed(seoHtml),
    checkClassesReferenced(seoHtml, css),
    checkNoAbsolutePositioning(css),
    {
      name: 'axe-core gate',
      passed: axe.passed,
      detail: axe.passed
        ? `0 blocking violations (${axe.violations.length} total)`
        : `${axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length} blocking violations: ${axe.violations.map((v) => v.id).join(', ')}`,
    },
  ]

  const table = [
    `\n=== Fixture: ${name} ===`,
    'Check                       | Status | Details',
    '----------------------------|--------|--------',
    ...results.map((r) => `${r.name.padEnd(27)} | ${r.passed ? 'PASS  ' : 'FAIL  '} | ${r.detail}`),
  ].join('\n')
  console.log(table)
  return results
}

describe('full export pipeline e2e', () => {
  test('PAGE_WITH_NAV (most complex) passes all gates', async () => {
    const results = await runFixture('PAGE_WITH_NAV', PAGE_WITH_NAV)
    for (const r of results) expect(r.passed, `${r.name}: ${r.detail}`).toBe(true)
  })

  test('SIMPLE_PAGE passes all gates', async () => {
    const results = await runFixture('SIMPLE_PAGE', SIMPLE_PAGE)
    for (const r of results) expect(r.passed, `${r.name}: ${r.detail}`).toBe(true)
  })
})
