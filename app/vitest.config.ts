import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/**',
        'src/preload/**',
        'src/shared/**',
        'src/**/index.ts',
        'src/**/*.config.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        'src/main/planner/**': {
          lines: 60,
          branches: 60,
          functions: 60,
          statements: 60,
        },
        'src/main/store/**': {
          lines: 60,
          branches: 60,
          functions: 60,
          statements: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared'),
    },
  },
});
