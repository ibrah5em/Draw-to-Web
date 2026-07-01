import { resolve } from 'path'

/**
 * Path aliases shared by the default test config (`vitest.config.ts`) and the
 * perf-budget lane (`vitest.perf.config.ts`) so the two can never drift.
 */
export const testAlias = {
  '@ui': resolve(__dirname, 'src/ui'),
  '@store': resolve(__dirname, 'src/store'),
  '@document': resolve(__dirname, 'src/document'),
  '@draw': resolve(__dirname, 'src/draw'),
  '@match': resolve(__dirname, 'src/match'),
  '@generator': resolve(__dirname, 'src/generator'),
  '@seo': resolve(__dirname, 'src/seo'),
  '@export': resolve(__dirname, 'src/export'),
  '@templates': resolve(__dirname, 'src/templates'),
  '@shared': resolve(__dirname, 'src/shared'),
}
