import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    passWithNoTests: true,
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
    ],
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
      // MVP-14: activo solo el umbral de motor. El global (80 %) sigue inactivo (ver docs/CI.md):
      // lines: 80, functions: 80, branches: 80, statements: 80
      thresholds: {
        'packages/motor/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
