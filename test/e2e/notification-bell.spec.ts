// task-042 — the notification bell, the all-roles summary and the empty Today on the real bin
// (US-S-21, US-S-23, US-T-07; TT-PERF-09's S-23.1, TT-PERF-11's S-21.1 and S-23.4; `shell.feature`,
// `requires-you.feature`; decisions D42-1…D42-8). The user is set with `actAs` on a kanban copy;
// element states are moved with the pinned CLI before the console starts. Every first read is
// waited for with `COLD_READ_MS`, lists with retrying expects (bug-009); assertions are on what the
// user sees and on the accessible names.
import type { Locator, Page } from '@playwright/test';
import type { MemoryEventsPage } from '@wingfoil-ui/contracts';
import type { Fixture, MemberName } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

/** Today's heading: the greeting, or "Today". */
const heading = (page: Page): Locator => page.locator('.today').getByRole('heading', { level: 1 });

/** The Requires you card. */
const requiresYou = (page: Page): Locator => page.getByRole('region', { name: 'Requires you' });

/** The all-roles summary card. */
const summary = (page: Page): Locator => page.getByRole('region', { name: 'Your roles' });

/** The bell of the global header (its accessible name carries the count, D42-4). */
const bell = (page: Page): Locator => page.getByRole('banner').getByRole('button', { name: /^Notifications/ });

/** The bell's panel. */
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'Notifications' });

/** The ids of the `li[data-eid]` rows of `list`, in order. */
async function idsOf(list: Locator): Promise<string[]> {
  return list.locator('li[data-eid]').evaluateAll((els) => els.map((el) => el.getAttribute('data-eid') ?? ''));
}

/** The summary line of `role` (its switch, or the current view's text). */
const lineOf = (page: Page, role: string): Locator =>
  summary(page)
    .locator('.today-summary-line')
    .filter({ has: page.locator('.today-summary-role', { hasText: new RegExp(`^${role} · \\d+$`) }) });

/** A kanban copy where the user is `name`, after `prepare` (CLI changes). */
async function copyAs(
  fixtures: { copy(kind: 'kanban'): Promise<Fixture> },
  name: MemberName,
  prepare: (fx: Fixture) => Promise<void> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy('kanban');
  await actAs(fx, name);
  await prepare(fx);
  return fx;
}

/** Open the project on Today (its landing view) and wait for Today's first read. */
async function openToday(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}` });
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`, { timeout: COLD_READ_MS });
  await expect(page.locator('.today').locator('.today-card, .today-identity, [role="alert"]').first()).toBeVisible({
    timeout: COLD_READ_MS,
  });
}

/** Approve `eid` from Today: its action opens the panel with the reason focused, then Approve (G-04.1). */
async function approveFromToday(page: Page, c: RunningConsole, eid: string): Promise<void> {
  await requiresYou(page).locator(`li[data-eid="${eid}"]`).getByRole('button').click();
  const drawer = page.locator('.drawer');
  await drawer.getByRole('button', { name: 'Approve → approved', exact: true }).click({ timeout: COLD_READ_MS });
  // task-038: the result is a toast of the shell (D38-10).
  await expect(
    page.locator('.toasts [aria-live="polite"] .toast-title').filter({ hasText: `Approved ${eid}` }),
  ).toHaveCount(1, { timeout: COLD_READ_MS });
  await drawer.getByRole('button', { name: 'Close' }).first().click();
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`, { timeout: COLD_READ_MS });
}

test.describe('US-S-21 — notification bell', () => {
  test('S-21.1 — Count the items to unblock', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Morgan')] });
    await openToday(page, c);
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: approver');
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 to unblock', { timeout: COLD_READ_MS });
    await expect(bell(page).locator('.bell-count')).toHaveText('2');
    // From the keyboard, with a visible focus (D42-3).
    await tabUntil(page, bell(page));
    await expectFocusVisible(bell(page));
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    const toUnblock = panel(page).getByRole('region', { name: 'To unblock' });
    await expect
      .poll(() => idsOf(toUnblock), { timeout: COLD_READ_MS })
      .toEqual(['task-001-login-form', 'bug-001-crash-on-save']);
    // Updates: the last 10 Memory events, newest first — the order of the API (TT-PERF-11).
    const api = await page.request.get(`${c.origin}/api/p/${c.pids[0]}/events/memory?limit=10`);
    expect(api.status()).toBe(200);
    const events = ((await api.json()) as MemoryEventsPage).events;
    expect(events).toHaveLength(10);
    const updates = panel(page).getByRole('region', { name: 'Updates' });
    await expect
      .poll(() => updates.locator('li[data-sha]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sha'))), {
        timeout: COLD_READ_MS,
      })
      .toEqual(events.map((e) => e.sha));
    await expect(updates.locator('li[data-sha]').first().locator('.bell-update-id')).toHaveText(events[0]!.id);
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(bell(page)).toBeFocused();
    // A row opens the element panel with the gate reason focused, as Today's action (review R4).
    await bell(page).click();
    await panel(page).getByRole('link', { name: 'Login form' }).click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-001-login-form`, { timeout: COLD_READ_MS });
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('.drawer').getByRole('textbox', { name: 'Reason, recorded in the commit' })).toBeFocused({
      timeout: COLD_READ_MS,
    });
  });

  test('S-21.2 — Show no count when nothing requires me', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Casey')] });
    await openToday(page, c);
    await expect(heading(page)).toHaveText('Casey, nothing requires you', { timeout: COLD_READ_MS });
    await expect(bell(page)).toHaveAccessibleName('Notifications');
    await expect(bell(page).locator('.bell-count')).toHaveCount(0);
    await bell(page).click();
    await expect(panel(page).getByRole('region', { name: 'To unblock' })).toContainText('Nothing to unblock', {
      timeout: COLD_READ_MS,
    });
  });

  test('S-21.3 — Update the count after an action', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Morgan')] });
    await openToday(page, c);
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 to unblock', { timeout: COLD_READ_MS });
    await approveFromToday(page, c, 'task-001-login-form');
    await expect(bell(page)).toHaveAccessibleName('Notifications, 1 to unblock', { timeout: COLD_READ_MS });
    await expect(bell(page).locator('.bell-count')).toHaveText('1');
  });
});

test.describe('US-S-23 — all-roles summary', () => {
  test('S-23.1 — Summarise what requires each of my roles', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Alex')] });
    await openToday(page, c);
    await expect(summary(page)).toBeVisible({ timeout: COLD_READ_MS });
    await expect(summary(page).locator('.today-summary-line')).toHaveCount(7, { timeout: COLD_READ_MS });
    const approver = lineOf(page, 'approver');
    await expect(approver.locator('.today-summary-role')).toHaveText('approver · 2');
    expect(await idsOf(approver)).toEqual(['task-001-login-form', 'bug-001-crash-on-save']);
    await expect(lineOf(page, 'developer').locator('.today-summary-role')).toHaveText('developer · 0');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-23.2 — Switch role view from the summary', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Alex')] });
    await openToday(page, c);
    // The role view "developer" first, through the header's selector.
    await page
      .getByRole('banner')
      .getByRole('button', { name: /Role view$/ })
      .click();
    await page.getByRole('listbox').getByRole('option', { name: 'developer', exact: true }).click();
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: developer', { timeout: COLD_READ_MS });
    await expect(lineOf(page, 'developer')).toHaveAttribute('aria-current', 'true', { timeout: COLD_READ_MS });
    await summary(page).getByRole('button', { name: 'approver · 2', exact: true }).click();
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: approver', { timeout: COLD_READ_MS });
    await expect(page.getByRole('banner').getByRole('button', { name: /Role view$/ })).toContainText('approver');
    await expect
      .poll(() => idsOf(requiresYou(page)), { timeout: COLD_READ_MS })
      .toEqual(['task-001-login-form', 'bug-001-crash-on-save']);
    // D42-6: the focus moves to Requires you once the new view is read.
    await expect(requiresYou(page).getByRole('heading', { name: 'Requires you' })).toBeFocused();
  });

  test('S-23.3 — Show no summary to a single-role member', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Jordan')] });
    await openToday(page, c);
    await expect(requiresYou(page)).toBeVisible({ timeout: COLD_READ_MS });
    await expect(summary(page)).toHaveCount(0);
  });

  test('S-23.4 — Show at most 3 items per role', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'Alex', async (fx) => {
      // 5 elements in "pending": the 2 of the fixture, 2 drafts submitted, 1 task added and submitted.
      await cli(fx, ['memory', 'submit', 'task-002-password-reset']);
      await cli(fx, ['memory', 'submit', 'task-004-session-timeout']);
      const added = JSON.parse(
        await cli(fx, ['--format', 'json', 'memory', 'add', '--type', 'task', '--title', 'Remember me']),
      ) as { id: string };
      await cli(fx, ['memory', 'submit', added.id]);
    });
    const c = await consoles.start({ projects: [kanban] });
    await openToday(page, c);
    const approver = lineOf(page, 'approver');
    await expect(approver.locator('.today-summary-role')).toHaveText('approver · 5', { timeout: COLD_READ_MS });
    await expect(approver.locator('li[data-eid]')).toHaveCount(3);
    const more = approver.getByRole('button', { name: '2 more for approver' });
    await expect(more).toHaveText('2 more');
  });
});

test.describe('US-T-07 — empty state', () => {
  test('T-07.1 — Say that nothing requires me', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'Casey')] });
    await openToday(page, c);
    await expect(requiresYou(page)).toContainText('Nothing requires you', { timeout: COLD_READ_MS });
    await expect(heading(page)).toHaveText('Casey, nothing requires you');
  });

  test('T-07.2 — Reach the empty state after the last action', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'Morgan', async (fx) => {
      await cli(fx, ['memory', 'approve', 'bug-001-crash-on-save', '--reason', 'Fixed']);
    });
    const c = await consoles.start({ projects: [kanban] });
    await openToday(page, c);
    await expect.poll(() => idsOf(requiresYou(page)), { timeout: COLD_READ_MS }).toEqual(['task-001-login-form']);
    await approveFromToday(page, c, 'task-001-login-form');
    await expect(requiresYou(page)).toContainText('Nothing requires you', { timeout: COLD_READ_MS });
    await expect(heading(page)).toHaveText('Morgan, nothing requires you');
    await expect(bell(page)).toHaveAccessibleName('Notifications');
  });
});
