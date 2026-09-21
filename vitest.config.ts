import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@erp/types': fileURLToPath(new URL('./packages/types/src/index.ts', import.meta.url)),
      '@erp/validation': fileURLToPath(new URL('./packages/validation/src/index.ts', import.meta.url)),
      '@erp/api': fileURLToPath(new URL('./apps/api/src/app.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'apps/api/src/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    // La primera ejecución puede descargar el binario de mongodb-memory-server.
    hookTimeout: 300_000,
  },
});
