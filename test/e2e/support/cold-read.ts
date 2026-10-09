/**
 * The first read of a page on a cold console (bug-004): it runs the WingFoil CLI behind the API
 * (`GET /elements`, `/config`, `/directives`, …), which takes seconds under external load (task-017
 * measured ≈ 25 s at load 76 on 12 cores). Every spec waits for its first load with
 * {@link COLD_READ_MS}; the assertions after it keep Playwright's default, so a slow machine makes
 * a test slower, never wrong.
 */
import { expect, type Locator } from '@playwright/test';
import { report } from '../../timing/load.js';

/** The longest a first, cold read may take (the measured worst case, doubled). */
export const COLD_READ_MS = 60_000;

/** Wait for `locator` — something only the first read can show — to be visible. */
export async function expectFirstLoad(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: COLD_READ_MS });
}

/** Wait until `scope` shows no loading status ("Loading …") any more. */
export async function expectLoaded(scope: Locator): Promise<void> {
  await expect(scope.getByRole('status').filter({ hasText: /^Loading\b/ })).toHaveCount(0, { timeout: COLD_READ_MS });
}

/** `WFUI_STRICT_REFRESH=1`: the Playwright part of `npm run test:timing` (W3-47). */
export const STRICT_REFRESH = process.env['WFUI_STRICT_REFRESH'] === '1';

/** The scenarios' "within 5 seconds" of a live refresh (S-25.2, S-26.1, S-26.2, S-27.2). */
export const REFRESH_BUDGET_MS = 5_000;

/** The tag of the live-refresh tests that `npm run test:timing` runs again with the strict budget. */
export const LIVE_REFRESH_TAG = '@live-refresh';

/** A live refresh measured from its mutation (see {@link refreshClock}). */
export interface RefreshClock {
  /** Call right before the mutation: the commit, the file write or the CLI verb that commits. */
  start(): void;
  /** The timeout of the assertion that the screen changed. */
  timeout(): number;
  /** Once the screen changed: in strict mode, print the time and fail beyond the budget. */
  done(label: string): void;
}

/**
 * The clock of a live refresh (W3-47). In the default e2e gate the refresh is a behaviour (the
 * screen changes by itself, without a reload) waited for with the cold-read budget, whatever the
 * load (bug-004). With `WFUI_STRICT_REFRESH=1` (`npm run test:timing`, quiet machine only) it is a
 * budget: the screen must change within 5 s of the mutation — watcher, event stream, refetch and
 * render included.
 */
export function refreshClock(): RefreshClock {
  let t0 = Date.now();
  return {
    start: () => {
      t0 = Date.now();
    },
    timeout: () => (STRICT_REFRESH ? Math.max(1, t0 + REFRESH_BUDGET_MS - Date.now()) : COLD_READ_MS),
    done: (label) => {
      if (!STRICT_REFRESH) return;
      const ms = Date.now() - t0;
      report(`${label} (from the mutation, budget ${REFRESH_BUDGET_MS} ms)`, `${ms} ms`);
      expect(ms).toBeLessThanOrEqual(REFRESH_BUDGET_MS);
    },
  };
}
