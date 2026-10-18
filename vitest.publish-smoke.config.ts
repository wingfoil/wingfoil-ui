// The staging publish smoke (task-029 AC-3, `npm run test:publish-smoke`; the publish pipeline's
// stage job): publishes the packed package to a local registry with no uplink, installs it by name
// and runs `npx wingfoil-ui` (test/smoke/staging.publish.test.ts). Excluded from `test`,
// `test:coverage` and `test:smoke`: it packs (a full build) unless given a tarball, and it starts
// a registry.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/smoke/**/*.publish.test.ts'],
    exclude: ['**/node_modules/**'],
    // The run's temporary root (task-026).
    globalSetup: ['test/smoke/global-setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 600_000,
    hookTimeout: 900_000,
    // The phase durations are part of the output.
    silent: false,
  },
});
