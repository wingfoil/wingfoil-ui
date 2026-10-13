// The launch smoke (e2e-smoke `launch`, task-025 AC-3, `npm run test:smoke`): packs the repository
// (its `prepack` rebuilds server/dist and web/dist), installs the tarball into a temporary folder
// and runs `npx wingfoil-ui` there. Excluded from `test` and `test:coverage`, whose bin tests read
// the build while it would be rewritten.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/smoke/**/*.smoke.test.ts'],
    exclude: ['**/node_modules/**'],
    // The run's temporary root (task-026).
    globalSetup: ['test/smoke/global-setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 120_000,
    hookTimeout: 900_000,
    // The phase durations are part of the output.
    silent: false,
  },
});
