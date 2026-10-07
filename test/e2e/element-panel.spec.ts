// task-018 — the read-only element panel on the real bin (US-G-01: G-01.1…G-01.4), on the built
// kanban and custom fixtures. The panel is read-only: the identity of a scenario ("I am Morgan")
// changes nothing it shows, so the fixtures' own identity (Alex) is used.
import type { Page } from '@playwright/test';
import type { MemoryHistory } from '@wingfoil-ui/contracts';
import { scanThemes } from './support/axe.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cli, commitFile } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { expectFocusVisible } from './support/keyboard.js';

/** Open the element panel of `eid` by its URL. */
async function openPanel(page: Page, c: RunningConsole, eid: string) {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/e/${eid}` });
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  return panel;
}

/** The chip of `state` in the panel's state machine (found by the name it shows). */
function chip(page: Page, state: string) {
  return page
    .getByRole('list', { name: 'State machine' })
    .getByRole('listitem')
    .filter({ has: page.locator('[aria-hidden="true"]', { hasText: new RegExp(`^${state}$`) }) });
}

/** Assert the chip of `state`: its position (data), what it shows, what assistive technology reads. */
async function expectChip(page: Page, state: string, position: 'past' | 'current' | 'future'): Promise<void> {
  const c = chip(page, state);
  await expect(c).toHaveAttribute('data-position', position);
  await expect(c.locator('.visually-hidden')).toHaveText(`${state}, ${position} state`);
  if (position === 'current') await expect(c).toHaveAttribute('aria-current', 'step');
  else await expect(c).not.toHaveAttribute('aria-current');
}

test.describe('US-G-01 — element panel', () => {
  test('G-01.1 — Show an element with its state machine and history', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ projects: [kanban] });
    const panel = await openPanel(page, c, 'task-001-login-form');
    await expect(panel).toHaveAccessibleName('Login form');
    await expect(panel.getByText('task', { exact: true })).toBeVisible();
    await expect(panel.getByText('task-001-login-form', { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: 'Login form' })).toBeVisible();
    await expectChip(page, 'draft', 'past');
    await expectChip(page, 'pending', 'current');
    await expectChip(page, 'approved', 'future');
    // The current chip takes the descriptor's tone (data): kanban `pending` is a gate → human.
    await expect(chip(page, 'pending')).toHaveClass(/\btone-human\b/);
    // The history line of the submit: who, its commit hash and its date as the CLI reports them.
    const history = JSON.parse(
      await cli(kanban, ['--format', 'json', 'memory', 'history', 'task-001-login-form']),
    ) as MemoryHistory;
    const submit = history.entries.find((e) => e.operation === 'submit')!;
    const date = await page.evaluate(
      (ts) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts)),
      submit.timestamp,
    );
    const line = panel.getByRole('listitem').filter({ hasText: 'submitted by Jordan' });
    await expect(line).toBeVisible();
    await expect(line).toContainText(submit.sha.slice(0, 7));
    await expect(line).toContainText(date);
    await expect(line.getByTitle(submit.sha)).toBeVisible();
    // Keyboard: the focus is in the panel; Close is reachable with a visible focus; Escape closes.
    const close = panel.getByRole('button', { name: 'Close' });
    for (let i = 0; i < 5 && !(await close.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expectFocusVisible(close);
    // The scrollable body is reachable with Tab (keyboard scrolling), with a visible focus.
    const body = panel.getByRole('region', { name: 'Element details' });
    for (let i = 0; i < 5 && !(await body.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expectFocusVisible(body);
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}`);
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('G-01.2 — Show the rejection banner after a reject', async ({ page, fixtures, consoles }) => {
    // The built kanban fixture has `task-002-password-reset` rejected by Morgan with this reason.
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    const panel = await openPanel(page, c, 'task-002-password-reset');
    await expect(panel.getByText('Rejected by Morgan: Missing acceptance criteria', { exact: true })).toBeVisible();
    await expectChip(page, 'draft', 'current');
    await expectChip(page, 'pending', 'future');
    await expect(panel.getByRole('listitem').filter({ hasText: 'rejected by Morgan' })).toContainText(
      '“Missing acceptance criteria”',
    );
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-01.3 — Flag a missing required field', async ({ page, fixtures, consoles }) => {
    // The built custom fixture has `adr-001-local-server` committed as a draft with an empty `sard_ref`.
    const c = await consoles.start({ projects: [await fixtures.get('custom')] });
    const panel = await openPanel(page, c, 'adr-001-local-server');
    const summary = panel.getByRole('region', { name: 'Summary' });
    await expect(summary.getByText('sard_ref — required field, missing', { exact: true })).toBeVisible();
    await expectChip(page, 'draft', 'current');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-01.4 — Open an element panel from its URL', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openPanel(page, c, 'task-001-login-form');
    const copied = page.url();
    expect(copied).toBe(`${c.origin}/p/${c.pids[0]}/e/task-001-login-form`);
    // A new tab of the same browser session: the session cookie, no token in the URL.
    const tab = await page.context().newPage();
    try {
      await tab.goto(copied);
      const panel = tab.getByRole('dialog', { name: 'Login form' });
      await expect(panel).toBeVisible();
      await expect(panel.getByText('task-001-login-form', { exact: true })).toBeVisible();
      await expect(tab).toHaveTitle(/· task-001-login-form — WingFoil UI$/);
    } finally {
      await tab.close();
    }
  });
});

test.describe('element panel layout', () => {
  test('a long unbroken value wraps inside the drawer: no horizontal scroll', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const file = 'docs/memory/task/task-004-session-timeout.md';
    const long = 'X'.repeat(300);
    const text = await readFile(path.join(kanban.dir, file), 'utf8');
    await commitFile(kanban, file, text.replace('\n---\n', `\nref: "${long}"\n---\n\n${long}\n`), 'docs: long values');
    const c = await consoles.start({ projects: [kanban] });
    const panel = await openPanel(page, c, 'task-004-session-timeout');
    await expect(panel.getByText(long).first()).toBeVisible();
    const overflow = await page
      .locator('.drawer-body')
      .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
  });
});
