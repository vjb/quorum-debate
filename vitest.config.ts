import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000, // OpenRouter calls might take a while
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/playwright-report/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
