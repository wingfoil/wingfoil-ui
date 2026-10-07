/**
 * The first read of a page on a cold console (bug-004): it runs the WingFoil CLI behind the API
 * (`GET /elements`, `/config`, `/directives`, …), which takes seconds under external load (task-017
 * measured ≈ 25 s at load 76 on 12 cores). Every spec waits for its first load with
 * {@link COLD_READ_MS}; the assertions after it keep Playwright's default, so a slow machine makes
 * a test slower, never wrong.
 */
import { expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadavg } from 'node:os';

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

/** The load average above which `npm run test:timing` is not run either (the dev rules' 12). */
export const TIMING_LOAD_LIMIT = 12;

/** The 1-minute load average (`/proc/loadavg`, else Node's). */
function currentLoad(): number {
  try {
    return Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
  } catch {
    return loadavg()[0] ?? 0;
  }
}

/**
 * The scenarios' "within 5 seconds" of a live refresh (S-25.2, S-26.1, S-26.2, S-27.2): asserted as
 * 5 s when the worker starts below {@link TIMING_LOAD_LIMIT}, and as a cold read above it. A budget
 * is a timing check; under external load the default gates check the value, not the time (bug-001,
 * bug-004).
 */
export const REFRESH_MS = currentLoad() < TIMING_LOAD_LIMIT ? 5_000 : COLD_READ_MS;
