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
 * Runs axe-core against generated HTML and produces a structured report.
 *
 * In the Electron renderer process, execution is delegated to the main process
 * via IPC so that jsdom (a Node.js-only package) never runs in the sandboxed
 * browser context. In Node.js environments (tests, main process IPC handler),
 * jsdom and axe-core are loaded via dynamic import and run locally.
 */
export async function runAxeGate(html: string): Promise<AccessibilityReport> {
  // Renderer path: delegate to main process where Node.js APIs are available.
  if (typeof window !== 'undefined' && window.electronAPI?.runAxe) {
    return window.electronAPI.runAxe(html)
  }
  return runAxeGateNode(html)
}

/**
 * Node.js-only implementation. Uses dynamic imports so bundlers targeting
 * browser environments (Vite renderer build) never include jsdom or axe-core.
 */
async function runAxeGateNode(html: string): Promise<AccessibilityReport> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { JSDOM } = await import(/* @vite-ignore */ 'jsdom')
  // Node's native CJS-from-ESM interop puts axe-core under `.default`; Vitest's
  // loader flattens it onto the namespace. Unwrap so `.source` resolves either way.
  const axeMod = (await import(/* @vite-ignore */ 'axe-core')) as Record<string, unknown>
  const axe = (axeMod.default ?? axeMod) as unknown as { source: string }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const { window: win } = dom

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    win.eval(axe.source)
    // axe-core's IIFE exposes itself as `window.axe` when run in a window context.
    const windowAxe = (win as unknown as { axe: { run: (...args: unknown[]) => Promise<unknown> } })
      .axe
    const raw = (await windowAxe.run(win.document, {
      rules: { 'color-contrast': { enabled: false } },
    })) as RawAxeResults

    const violations = raw.violations.map(normalizeViolation)
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const v of violations) counts[v.impact] += 1

    const passed = !violations.some((v) => BLOCKING_IMPACTS.has(v.impact))
    return { passed, violations, counts }
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    win.close()
  }
}

/**
 * Formats a violation as a one-line actionable message for the SEO report.
 * Example: "[critical] image-alt: Images must have alternate text (3 nodes) — https://..."
 */
export function formatViolation(v: AccessibilityViolation): string {
  return `[${v.impact}] ${v.id}: ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'}) — ${v.helpUrl}`
}
