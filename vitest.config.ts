import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@store': resolve(__dirname, 'src/store'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@generator': resolve(__dirname, 'src/generator'),
      '@seo': resolve(__dirname, 'src/seo'),
      '@export': resolve(__dirname, 'src/export'),
    },
  },
})
