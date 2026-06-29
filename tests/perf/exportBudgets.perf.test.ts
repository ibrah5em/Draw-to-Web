/**
 * Export perf budgets (I-EXP-01 / I-EXP-04, plan.md §14).
 *
 * This is the perf lane — excluded from the default `npm run test` and run via
 * `npm run test:perf` (vitest.perf.config.ts). Wall-clock budgets live here,
 * not in the functional export suites, so a loaded CI box can't flake the PR
 * gate (gh-actions #89).
 *
 * Each budget is asserted on the *median* of N warm runs, so a single GC
 * pause or scheduler hiccup can't trip it the way a one-shot cold timing did.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createPortfolioTemplate } from '@templates/portfolio'
import { exportProject } from '@export/index'

const doc = createPortfolioTemplate('Ada Lovelace')

/** Median wall-clock (ms) across `samples` runs of `fn`. */
async function medianMs(samples: number, fn: () => Promise<unknown>): Promise<number> {
  const times: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

describe('export perf budgets (median of warm runs)', () => {
  beforeAll(async () => {
    // Minimal IPC stub for the `save` stage of the full-export runs.
    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: async () => ({ success: true, filePath: '/tmp/perf.zip' }),
      },
    })
    // Warm Prettier's ESM graph + lazy lightningcss/terser imports so the
    // measured medians reflect steady state, not cold module loads.
    await exportProject(doc, { dryRun: true })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('dry-run preview median < 500ms', async () => {
    const median = await medianMs(5, () => exportProject(doc, { dryRun: true }))
    // eslint-disable-next-line no-console
    console.log(`[perf] dry-run preview median: ${median.toFixed(0)}ms (budget <500ms)`)
    expect(median).toBeLessThan(500)
  })

  it('full export (default options) median < 10s', async () => {
    const median = await medianMs(3, () => exportProject(doc, { projectName: 'perf' }))
    // eslint-disable-next-line no-console
    console.log(`[perf] full export median: ${median.toFixed(0)}ms (budget <10000ms)`)
    expect(median).toBeLessThan(10_000)
  })

  it('full export (minify + inlineJS) median < 10s', async () => {
    const median = await medianMs(3, () =>
      exportProject(doc, { projectName: 'perf-min', minify: true, inlineJS: true })
    )
    // eslint-disable-next-line no-console
    console.log(
      `[perf] full export (minify+inline) median: ${median.toFixed(0)}ms (budget <10000ms)`
    )
    expect(median).toBeLessThan(10_000)
  })
})
