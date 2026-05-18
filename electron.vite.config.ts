import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@store': resolve('src/store'),
        '@engine': resolve('src/engine'),
        '@document': resolve('src/document'),
        '@generator': resolve('src/generator'),
        '@seo': resolve('src/seo'),
        '@export': resolve('src/export'),
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
