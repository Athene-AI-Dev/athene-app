import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['lib/**'],
      exclude: ['lib/**/__tests__/**', 'lib/**/*.test.ts', 'lib/**/*.d.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
