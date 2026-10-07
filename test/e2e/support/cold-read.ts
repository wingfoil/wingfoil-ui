/**
 * The first read of a page on a cold console (bug-004): it runs the WingFoil CLI behind the API
 * (`GET /elements`, `/config`, `/directives`, …), which takes seconds under external load (task-017
 * measured ≈ 25 s at load 76 on 12 cores). Every spec waits for its first load with
 * {@link COLD_READ_MS}; the assertions after it keep Playwright's default, so a slow machine makes
 * a test slower, never wrong.
 */
import { expect, type Locator } from '@playwright/test';

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
