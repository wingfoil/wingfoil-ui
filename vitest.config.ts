import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // The timing suite runs on its own (`npm run test:timing`, vitest.timing.config.ts, bug-001).
    exclude: ['test/e2e/**', 'test/timing/**', '**/node_modules/**'],
    // Builds server/dist once for the bin and child-process tests.
    globalSetup: ['test/global-setup.ts'],
    // Longer async waits of the component tests under external load (bug-004).
    setupFiles: ['test/web/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      include: ['server/src/**', 'contracts/src/**', 'web/src/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
