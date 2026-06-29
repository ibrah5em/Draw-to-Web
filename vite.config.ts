/**
 * Root Vite config — consumed ONLY by `vite-node` (the headless MCP server
 * entry, `mcp/server.ts`, and the repo's existing `vite-node` scripts).
 *
 * Electron builds use `electron.vite.config.ts`; Vitest uses
 * `vitest.config.ts`. This file exists so a plain `vite-node` run resolves the
 * project's `@`-aliases (the document/store/ui modules the server reuses
 * import each other through them). Aliases mirror `vitest.config.ts`.
 */

import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
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
    },
  },
})
