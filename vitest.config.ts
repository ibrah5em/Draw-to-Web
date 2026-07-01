import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { testAlias } from './vitest.shared'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // Wall-clock perf budgets live in their own lane (`npm run test:perf`,
    // vitest.perf.config.ts) so a loaded machine can't flake the default
    // suite. See gh-actions #89.
    exclude: [...configDefaults.exclude, '**/*.perf.test.ts'],
  },
  resolve: {
    alias: testAlias,
  },
})
