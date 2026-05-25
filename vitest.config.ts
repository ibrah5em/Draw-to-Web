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
      '@ui': resolve(__dirname, 'src/ui'),
      '@store': resolve(__dirname, 'src/store'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@document': resolve(__dirname, 'src/document'),
      '@generator': resolve(__dirname, 'src/generator'),
      '@seo': resolve(__dirname, 'src/seo'),
      '@export': resolve(__dirname, 'src/export'),
      '@templates': resolve(__dirname, 'src/templates'),
      '@project': resolve(__dirname, 'src/project'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
