/**
 * The project switcher seen by the e2e suites (task-015, shared with task-014): its trigger, its
 * popover and rows, the list read that each opening sends (W4-4) and the Memory list a project
 * opens on.
 */
import type { Locator, Page } from '@playwright/test';
import type { ProjectListResponse } from '@wingfoil-ui/contracts';
import { COLD_READ_MS, expectFirstLoad } from './cold-read.js';
import { expect } from './fixtures.js';

/** The switcher's trigger: "Projects" on the start page, "Projects: <name>" inside a project. */
export function trigger(page: Page): Locator {
  return page.getByRole('banner').getByRole('button', { name: /^Projects(: .*)?$/ });
}

/** The switcher's popover. */
export function switcher(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Projects' });
}

/** The project rows of the open switcher. */
export function rows(page: Page): Locator {
  return switcher(page).getByRole('grid', { name: 'Projects' }).getByRole('row');
}

/**
 * The next `GET /api/projects` the page completes (W4-4: one on every opening of the switcher), read
 * as soon as it finished: a read cancelled by a newer one never completes.
 */
export async function nextListRead(page: Page): Promise<{ status: number; body: ProjectListResponse }> {
  const request = await page.waitForEvent('requestfinished', {
    predicate: (r) => r.method() === 'GET' && new URL(r.url()).pathname === '/api/projects',
    timeout: COLD_READ_MS,
  });
  const response = (await request.response())!;
  return { status: response.status(), body: (await response.json()) as ProjectListResponse };
}

/**
 * Open the switcher (`open`: a click on the trigger by default) and wait for the list read that the
 * opening sent (W4-4) — not for the periodic check of the server — and its answer rendered.
 */
export async function openSwitcher(page: Page, open = () => trigger(page).click()): Promise<ProjectListResponse> {
  await expectFirstLoad(trigger(page));
  const read = nextListRead(page);
  await open();
  const answer = await read;
  expect(answer.status).toBe(200);
  await expect(switcher(page)).toBeVisible();
  await expect(switcher(page).getByRole('status')).toHaveCount(0, { timeout: COLD_READ_MS });
  return answer.body;
}

/** The switcher lists `names`, in this order (retrying until the last read is rendered). */
export async function expectListed(page: Page, names: string[]): Promise<void> {
  const shown = switcher(page).locator('.switcher-row-name');
  if (names.length === 0) await expect(shown).toHaveCount(0, { timeout: COLD_READ_MS });
  else await expect(shown).toHaveText(names, { timeout: COLD_READ_MS });
}

/** Wait for the Memory list of a project (first, cold read). */
export async function expectMemoryList(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible({ timeout: COLD_READ_MS });
  await expect(page.getByRole('list', { name: 'Elements' }).getByRole('link').first()).toBeVisible({
    timeout: COLD_READ_MS,
  });
}
