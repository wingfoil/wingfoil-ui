import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** The tag of the TT-PERF-04 tests (test/e2e/support/perf.ts): measured on Chromium only (RP-44). */
const PERF = /@perf/;

/**
 * e2e suite (e2e-smoke `drive-browser`). REQ-INT-08: the suite runs on the three engines of the
 * pinned Playwright — Chromium, Firefox and WebKit (v0.2, task-027; v0.1 ran Chromium only). The
 * `@perf` tests run on Chromium only (task-027 D27-2, RP-44); the timing suite
 * (playwright.timing.config.ts) is Chromium only too. `npm run test:e2e` runs the three projects
 * (the wave and release gate), `npm run test:e2e:chromium` the inner-loop run (task-027 D27-4).
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: PERF },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: PERF },
  ],
});
