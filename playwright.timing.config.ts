import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './playwright.config.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// The workers inherit it: the live-refresh tests assert the 5 s budget (test/e2e/support/cold-read.ts)
// and the TT-PERF-04 tests run 20 runs and assert p95 ≤ 1.0 s (test/e2e/support/perf.ts).
process.env['WFUI_STRICT_REFRESH'] = '1';

/**
 * The Playwright part of the timing suite (`npm run test:timing`, W3-47): the live-refresh scenarios
 * (S-25.2, S-26.1, S-26.2, S-27.2, tag `@live-refresh`) on the real bin, each checking that the
 * screen changed within 5 s of the mutation, and TT-PERF-04 (tag `@perf`, task-021, W5-9): each
 * other view rendered within 1.0 s at p95 over 20 runs with a warm cache, on the large fixture. One worker, one test at a time, on a quiet machine only
 * (load below 12, as REQ-PERF-03/06); the default `npm run test:e2e` checks the same behaviour
 * without the budget.
 */
export default defineConfig({
  ...base,
  grep: /@live-refresh|@perf/,
  workers: 1,
  fullyParallel: false,
  outputDir: path.join(root, 'test-results', 'timing'),
});
