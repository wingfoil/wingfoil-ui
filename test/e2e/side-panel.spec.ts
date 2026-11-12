// task-077 — the side panel in the address on the real bin (US-G-01 G-01.8, US-S-21 S-21.4; spec-011
// §2, §6; ux-reference §4.2 v0.3; D77-1 … D77-8): Today's rows and the bell's items open the element
// in a non-modal side panel over the current view, addressed by `?panel=<full id>`; a reload keeps
// it; closing removes the parameter and keeps the others; on the element page a bell item opens that
// item's page (Q1 (a)); the focus returns to the opener (X-06.3); the toasts never cover the panel's
// Close or its footer. Every Given is scenario-local, on a kanban copy where the user is Morgan.
import type { Locator, Page } from '@playwright/test';
import type { Fixture } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { sidePanel } from './support/element.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

const ID = 'task-001-login-form';

/** The Requires you card. */
const requiresYou = (page: Page): Locator => page.getByRole('region', { name: 'Requires you' });

/** The bell of the global header. */
const bell = (page: Page): Locator => page.getByRole('banner').getByRole('button', { name: /^Notifications/ });

/** The bell's panel. */
const bellPanel = (page: Page): Locator => page.getByRole('dialog', { name: 'Notifications' });

/** A kanban copy where the user is Morgan (approver). */
async function morgan(fixtures: { copy(kind: 'kanban'): Promise<Fixture> }): Promise<Fixture> {
  const fx = await fixtures.copy('kanban');
  await actAs(fx, 'Morgan');
  return fx;
}

/** Open the project on Today and wait for Requires you's first read. */
async function openToday(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/today` });
  await expectFirstLoad(requiresYou(page).locator(`li[data-eid="${ID}"]`));
}

/** The address's search parameters, as a sorted list of `key=value`. */
function params(page: Page): string[] {
  return [...new URL(page.url()).searchParams.entries()].map(([k, v]) => `${k}=${v}`).sort();
}

/** `target` is the element a pointer reaches at its centre (nothing, a toast included, covers it). */
async function expectOnTop(page: Page, target: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      if (!box) return false;
      const handle = await target.elementHandle();
      return page.evaluate(
        ([x, y, t]) => {
          const hit = document.elementFromPoint(x, y);
          return hit !== null && (hit === t || t.contains(hit));
        },
        [box.x + box.width / 2, box.y + box.height / 2, handle] as const,
      );
    })
    .toBe(true);
}

test.describe('US-G-01 / US-S-21 — the side panel in the address', () => {
  test('G-01.8 — Open an element from Requires you in the side panel and keep it on reload', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
    const pid = c.pids[0]!;
    await openToday(page, c);
    await requiresYou(page).locator(`li[data-eid="${ID}"]`).getByRole('link').click();
    await expect(sidePanel(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/today?panel=${ID}`);
    await page.reload();
    await expect(sidePanel(page).getByRole('heading', { level: 2, name: 'Login form' })).toBeVisible({
      timeout: COLD_READ_MS,
    });
    await expect(page.locator('.today').getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/today?panel=${ID}`);
  });

  test('S-21.4 — Open an item of the bell in the side panel of the current view', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
    const pid = c.pids[0]!;
    await openConsole(page, c, { path: `/p/${pid}/memory?type=task` });
    await expectFirstLoad(page.locator('.memory-row').first());
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 to unblock', { timeout: COLD_READ_MS });
    await bell(page).click();
    await bellPanel(page).getByRole('link', { name: 'Login form' }).click({ timeout: COLD_READ_MS });
    await expect(sidePanel(page).getByRole('heading', { level: 2, name: 'Login form' })).toBeVisible({
      timeout: COLD_READ_MS,
    });
    await expect(bellPanel(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/p/${pid}/memory`);
    expect(params(page)).toEqual([`panel=${ID}`, 'type=task']);
    // The Memory list stays shown, still filtered.
    await expect(page.getByRole('main').locator('.memory-row').first()).toBeVisible();
    // The bell's item keeps the gate's reason request (D37-1).
    await expect(sidePanel(page).getByRole('textbox', { name: 'Reason, recorded in the commit' })).toBeFocused({
      timeout: COLD_READ_MS,
    });
    // Closed: back to the list with its filter, the focus on the main region (opened from a popover).
    await sidePanel(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sidePanel(page)).toHaveCount(0);
    expect(params(page)).toEqual(['type=task']);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('AC-2 — On the element page a bell item opens that item’s element page', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
    const pid = c.pids[0]!;
    await openConsole(page, c, { path: `/p/${pid}/e/task-003-logout` });
    await expectFirstLoad(page.locator('[data-element-view] .type-tag'));
    await bell(page).click();
    await bellPanel(page).getByRole('link', { name: 'Login form' }).click({ timeout: COLD_READ_MS });
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/e/${ID}`);
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Login form' })).toBeVisible({
      timeout: COLD_READ_MS,
    });
    await expect(sidePanel(page)).toHaveCount(0);
  });

  test('AC-3 — Opening pushes, a reload keeps, closing removes panel= and keeps the other parameters', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
    const pid = c.pids[0]!;
    await openConsole(page, c, { path: `/p/${pid}/directives?show=all` });
    await expectFirstLoad(page.getByRole('main').getByRole('heading', { level: 1 }));
    await bell(page).click();
    await bellPanel(page).getByRole('link', { name: 'Login form' }).click({ timeout: COLD_READ_MS });
    await expect(sidePanel(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
    expect(params(page)).toEqual([`panel=${ID}`, 'show=all']);
    // A push: Back closes the panel, Forward reopens it.
    await page.goBack();
    await expect(sidePanel(page)).toHaveCount(0);
    expect(params(page)).toEqual(['show=all']);
    await page.goForward();
    await expect(sidePanel(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
    // A reload keeps it and the entry the console pushed (D77-5): Escape then goes back to the view
    // without the panel, the other parameter kept.
    await page.reload();
    await expect(sidePanel(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
    await sidePanel(page).getByRole('heading', { level: 2 }).focus();
    await page.keyboard.press('Escape');
    await expect(sidePanel(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/p/${pid}/directives`);
    expect(params(page)).toEqual(['show=all']);
    // A hostile value: the panel's not found, nothing else moves (AC-4).
    await page.goto(`${c.origin}/p/${pid}/directives?show=all&panel=..%2F..%2Fx`);
    await expect(sidePanel(page).getByRole('alert')).toBeVisible({ timeout: COLD_READ_MS });
    expect(new URL(page.url()).pathname).toBe(`/p/${pid}/directives`);
  });

  test('X-06.3 — Escape on the side panel returns the focus to its opener', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
    await openToday(page, c);
    const title = requiresYou(page).locator(`li[data-eid="${ID}"]`).getByRole('link');
    await tabUntil(page, title);
    await page.keyboard.press('Enter');
    const close = sidePanel(page).getByRole('button', { name: 'Close', exact: true });
    await expect(sidePanel(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
    // The heading has the focus; Shift+Tab reaches Close with a visible focus (non-modal, W4-8).
    await expect(sidePanel(page).getByRole('heading', { level: 2 })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    await expectFocusVisible(close);
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(sidePanel(page)).toHaveCount(0);
    await expect(title).toBeFocused({ timeout: COLD_READ_MS });
    await expectFocusVisible(title);
  });

  for (const size of [
    { width: 1280, height: 720 },
    { width: 600, height: 720 },
    { width: 400, height: 600 },
  ]) {
    test(`AC-5 — The toasts never cover the side panel’s actions (${size.width}×${size.height})`, async ({
      page,
      fixtures,
      consoles,
    }) => {
      await page.setViewportSize(size);
      const c = await consoles.start({ projects: [await morgan(fixtures)], settings: { autoFetch: false } });
      await openToday(page, c);
      await requiresYou(page).locator(`li[data-eid="${ID}"]`).getByRole('button').click();
      const approve = sidePanel(page).getByRole('button', { name: /^Approve → / });
      await approve.click({ timeout: COLD_READ_MS });
      const toast = page.locator('.toast').filter({ hasText: `Approved ${ID}` });
      await expect(toast).toBeVisible({ timeout: COLD_READ_MS });
      // Hovered, its 8 s timer is paused (D38-2) while the checks run.
      await toast.hover();
      // The panel stays open on the new state: its footer line, then nothing of it under a toast (the
      // footer read first — the gate's buttons are gone with the decision).
      const footerLine = sidePanel(page).locator('.element-footer').getByText('Final state: no action is possible');
      await expect(footerLine).toBeVisible({ timeout: COLD_READ_MS });
      await expect(toast).toBeVisible();
      await expectOnTop(page, sidePanel(page).getByRole('button', { name: 'Close', exact: true }));
      await expectOnTop(page, footerLine);
    });
  }
});
