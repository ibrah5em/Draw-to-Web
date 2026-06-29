import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { testAlias } from './vitest.shared'

/**
 * Perf-budget lane. Kept out of the default `npm run test` (see the
 * `*.perf.test.ts` exclusion in `vitest.config.ts`) so wall-clock budget
 * assertions can't flake the PR gate under CPU load (gh-actions #89). Run on
 * a quiet machine / dedicated job via `npm run test:perf`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/perf/**/*.perf.test.ts'],
    // Budget runs re-execute the pipeline several times for a warm median.
    testTimeout: 30_000,
  },
  resolve: {
    alias: testAlias,
  },
})
