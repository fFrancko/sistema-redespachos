import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    passWithNoTests: true,
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/*.d.ts'],
      // Umbrales sin activar hasta MVP-14 (ver docs/CI.md). Forma válida en Vitest 2.x:
      // thresholds: { lines: 80, functions: 80, branches: 80, statements: 80,
      //   'packages/motor/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 } }
    },
  },
});
