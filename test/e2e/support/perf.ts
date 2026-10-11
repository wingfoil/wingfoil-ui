/**
 * The TT-PERF-04 measurement (REQ-PERF-04, "other views": p95 ≤ 1.0 s with a warm cache; W5-6,
 * W5-9, decided by the user 2026-10-10). A view is reached by in-app navigation — Enter on its
 * sidebar link or on a row — in a fresh page opened on another view: the server's cache is warm
 * (the same repository state was read by the warm-up run), the page's query cache is cold. The time
 * runs from the Enter key press to the first frame where the view's content is visible and no
 * loading status is left, measured in the page (`performance.now()`).
 *
 * `npm run test:timing` (`WFUI_STRICT_REFRESH=1`, quiet machine only) runs 20 measured runs and
 * asserts the p95; `npm run test:e2e` runs 2 without a budget, so that the measuring code keeps
 * working. The warm-up run (the first open after the console started) is reported, not asserted.
 */
import type { Locator, Page } from '@playwright/test';
import { report } from '../../timing/load.js';
import { STRICT_REFRESH } from './cold-read.js';
import { installLoadingCheck, type LoadingCheckWindow } from './loading.js';

/** The timing run (`npm run test:timing`): the budget is asserted. */
export const STRICT_PERF = STRICT_REFRESH;

/** Measured runs after the warm-up: 20 in the timing run (SARD *p95 over 20 runs*), else 2. */
export const PERF_RUNS = STRICT_PERF ? 20 : 2;

/** REQ-PERF-04: p95 ≤ 1.0 s. */
export const PERF_BUDGET_MS = 1_000;

/** The tag of the tests that `npm run test:timing` runs with the budget. */
export const PERF_TAG = '@perf';

/**
 * Press Enter on `target` (already focused by the caller's keyboard path, or focused here) and
 * return the milliseconds until an element matching `ready` (CSS) is visible with no loading status.
 */
export async function timeNavigation(page: Page, target: Locator, ready: string): Promise<number> {
  await target.focus();
  await installLoadingCheck(page);
  await page.evaluate((selector) => {
    const w = window as unknown as { wfuiPerf?: Promise<number> };
    w.wfuiPerf = new Promise<number>((resolve) => {
      let t0: number | undefined;
      window.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Enter') t0 = performance.now();
        },
        { capture: true, once: true },
      );
      const isReady = () => {
        const el = document.querySelector(selector);
        if (!(el instanceof HTMLElement) || !el.checkVisibility()) return false;
        return (window as unknown as LoadingCheckWindow).wfuiNoLoading();
      };
      const tick = () => {
        if (t0 !== undefined && isReady()) resolve(performance.now() - t0);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, ready);
  await page.keyboard.press('Enter');
  return page.evaluate(() => (window as unknown as { wfuiPerf: Promise<number> }).wfuiPerf);
}

/** The nearest-rank percentile `p` (0–100) of `values`. */
export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

/** Print the runs of `view`: warm-up (first open), p50, p95, max, with the load average. */
export function reportRuns(view: string, warmUp: number, runs: readonly number[]): void {
  const fmt = (ms: number) => `${Math.round(ms)} ms`;
  report(
    `TT-PERF-04 ${view} (${runs.length} runs, warm cache)`,
    `p50 ${fmt(percentile(runs, 50))}, p95 ${fmt(percentile(runs, 95))}, max ${fmt(Math.max(...runs))}; first open ${fmt(warmUp)}`,
  );
}
