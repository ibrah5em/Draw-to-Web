import { JSDOM } from 'jsdom'
import * as axe from 'axe-core'
import type { AccessibilityReport, AccessibilityViolation } from '../shared/types'

/** Impacts that hard-block export. */
const BLOCKING_IMPACTS: ReadonlySet<string> = new Set(['critical', 'serious'])

/** Shape we read off axe-core's result — typed locally to avoid pulling axe's full Result type. */
interface RawAxeViolation {
  id: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null
  description: string
  help: string
  helpUrl: string
  nodes: ReadonlyArray<unknown>
}

interface RawAxeResults {
  violations: ReadonlyArray<RawAxeViolation>
}

function isImpact(value: string | null): value is AccessibilityViolation['impact'] {
  return value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor'
}

function normalizeViolation(v: RawAxeViolation): AccessibilityViolation {
  const impact: AccessibilityViolation['impact'] = isImpact(v.impact) ? v.impact : 'minor'
  return {
    id: v.id,
    impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }
}

/**
 * Runs axe-core against generated HTML in a jsdom environment and produces
 * a structured report. The export pipeline (T4.1) reads `passed` and blocks
 * the ZIP step if false.
 *
 * Implementation notes (jsdom + axe quirks):
 *   - axe.run() expects a real window. We inject axe-core's bundled source into
 *     a jsdom window via window.eval(axe.source), then call window.axe.run().
 *   - runScripts: 'outside-only' allows our injection without executing any
 *     <script> tags that may be in the input HTML — the generator never emits
 *     scripts, but this is a defence-in-depth choice.
 *   - We disable colour-contrast: jsdom does not layout or compute styles, so
 *     contrast checks would either crash or produce false positives.
 */
export async function runAxeGate(html: string): Promise<AccessibilityReport> {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const { window } = dom

  try {
    window.eval(axe.source)
    const windowAxe = (window as unknown as { axe: typeof axe }).axe
    const raw = (await windowAxe.run(window.document, {
      rules: { 'color-contrast': { enabled: false } },
    })) as unknown as RawAxeResults

    const violations = raw.violations.map(normalizeViolation)
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const v of violations) counts[v.impact] += 1

    const passed = !violations.some((v) => BLOCKING_IMPACTS.has(v.impact))
    return { passed, violations, counts }
  } finally {
    window.close()
  }
}

/**
 * Formats a violation as a one-line actionable message for the SEO report.
 * Example: "[critical] image-alt: Images must have alternate text (3 nodes) — https://..."
 */
export function formatViolation(v: AccessibilityViolation): string {
  return `[${v.impact}] ${v.id}: ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'}) — ${v.helpUrl}`
}
