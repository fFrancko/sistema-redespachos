import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['packages/motor/src/**/*.ts', 'packages/shared/src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/*.config.ts',
        '**/__tests__/**',
        '**/index.ts',
        '**/firebase.ts',
        '**/firebase-init.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'packages/motor/src/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
