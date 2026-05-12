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
        '@generator': resolve('src/generator'),
        '@seo': resolve('src/seo'),
        '@export': resolve('src/export'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
})
