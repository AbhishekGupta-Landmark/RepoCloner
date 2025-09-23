/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'server',
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/server-setup.ts'],
    include: ['server/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*'],
      exclude: [
        'server/**/*.d.ts',
        'server/index.ts',
        'server/vite.ts'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 90,
          statements: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared')
    }
  }
})