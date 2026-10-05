// The timing suite (bug-001, `npm run test:timing`): the tests whose verdict depends on elapsed
// time (REQ-PERF-03, REQ-PERF-06, the TypeDoc build). Run on a quiet machine, one file at a time,
// each measurement printed with the load average; excluded from `test` and `test:coverage`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/timing/**/*.timing.test.ts'],
    exclude: ['**/node_modules/**'],
    globalSetup: ['test/timing/global-setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 600_000,
  },
});
