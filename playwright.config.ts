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
  outputDir: path.join(root, 'test-results'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
