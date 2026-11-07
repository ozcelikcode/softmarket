import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@payload-config': path.resolve(__dirname, 'src/payload.config.ts'),
    },
  },
  test: {
    server: { deps: { inline: ['next-intl'] } },
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
})
