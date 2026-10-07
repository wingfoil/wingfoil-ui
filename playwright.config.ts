import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * e2e suite (e2e-smoke `drive-browser`). REQ-INT-08 is staged: v0.1 runs on Chromium only;
 * Firefox and WebKit join in v0.2 (SARD 04 v0.4).
 */
export default defineConfig({
  testDir: path.join(root, 'test', 'e2e'),
  // Builds server/dist, web/dist and web/dist-keys once: the suites start the real bin.
  globalSetup: path.join(root, 'test', 'e2e', 'support', 'global-setup.ts'),
  // Kills and reports any console of the run still running (bug-004).
  globalTeardown: path.join(root, 'test', 'e2e', 'support', 'global-teardown.ts'),
  // A test may wait for several cold reads (60 s each, test/e2e/support/cold-read.ts) and two axe
  // scans under external load (bug-004).
  timeout: 180_000,
  outputDir: path.join(root, 'test-results'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
