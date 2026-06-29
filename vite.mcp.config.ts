/**
 * Build config for the standalone MCP server.
 *
 * `vite build -c vite.mcp.config.ts` bundles `mcp/server.ts` (plus the `src/`
 * modules it reuses, resolving the `@`-aliases) into a single ESM file at
 * `dist/mcp/server.mjs`, with all `node_modules` left external (required at
 * runtime from the repo's `node_modules`). Run it with `node dist/mcp/server.mjs`
 * — no `vite-node`, no Electron. Dynamic imports (jsdom / axe-core / minifiers)
 * stay external and load lazily, exactly as in the source.
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
  build: {
    ssr: 'mcp/server.ts',
    outDir: 'dist/mcp',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'server.mjs', format: 'es' },
    },
  },
})
