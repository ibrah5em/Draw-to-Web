import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // nanoid v5 and chokidar v5 are pure ESM; Electron's CJS main process
    // can't `require()` them. Exclude them from externalization so they get
    // bundled into the CJS output instead.
    plugins: [externalizeDepsPlugin({ exclude: ['nanoid', 'chokidar'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@ui': resolve('src/ui'),
        '@store': resolve('src/store'),
        '@document': resolve('src/document'),
        '@generator': resolve('src/generator'),
        '@seo': resolve('src/seo'),
        '@export': resolve('src/export'),
        '@templates': resolve('src/templates'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        // jsdom and axe-core are Node.js-only; the renderer uses IPC instead.
        external: ['jsdom', 'axe-core'],
      },
    },
    optimizeDeps: {
      exclude: ['jsdom', 'axe-core'],
    },
  },
})
