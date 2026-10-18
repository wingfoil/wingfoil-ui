import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './playwright.config.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// The workers inherit it: the live-refresh tests assert the 5 s budget (test/e2e/support/cold-read.ts)
// and the `@perf` tests run 20 runs and assert their p95 (test/e2e/support/perf.ts): TT-PERF-04
// ≤ 1.0 s, TT-PERF-01 ≤ 2.0 s (task-036), TT-PERF-02 ≤ 3.0 s (task-038, `performance.spec.ts`).
process.env['WFUI_STRICT_REFRESH'] = '1';

/**
 * The Playwright part of the timing suite (`npm run test:timing`, W3-47): the live-refresh scenarios
 * (S-25.2, S-26.1, S-26.2, S-27.2, tag `@live-refresh`) on the real bin, each checking that the
 * screen changed within 5 s of the mutation (Y-02.1 and Y-05.2 — tasks 039, 040 — within 65 s of a
 * remote commit at the default 60 s interval), and the `@perf` tests on the large fixture: TT-PERF-04
 * (task-021, W5-9) each other view rendered within 1.0 s at p95 over 20 runs with a warm cache,
 * TT-PERF-01 (task-036) Today within 2.0 s, TT-PERF-02 (task-038) a click on an outcome or on
 * Submit to the toast with the commit within 3.0 s. One worker, one test at a time, on a quiet machine only
 * (load below 12, as REQ-PERF-03/06); the default `npm run test:e2e` checks the same behaviour
 * without the budget. Chromium only (task-027 AC-2, RP-44): the budgets are not multiplied by engine.
 */
export default defineConfig({
  ...base,
  grep: /@live-refresh|@perf/,
  projects: (base.projects ?? []).filter((p) => p.name === 'chromium'),
  workers: 1,
  fullyParallel: false,
  outputDir: path.join(root, 'test-results', 'timing'),
});
