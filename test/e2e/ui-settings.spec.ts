// task-041 — Configuration › UI settings on the real bin (US-C-07, `ui-settings.feature` C-07.1 …
// C-07.3; X-08.3 of `themes-and-strings.feature`; decisions D41-1 … D41-13). The page is reached
// from the sidebar's pinned *Configuration* entry; every control saves the whole settings object on
// its own (`PUT /api/settings`). C-07.3 runs with `fetchIntervalSeconds` 15 (RP-53, seeded with
// `ConsoleOptions.settings`, Wave 5 C2) and counts the bin's `git fetch` processes in its
// `GIT_TRACE` file, as task-034's timing test; the real 60 s / 120 s are measured in
// `test/timing/ui-settings.timing.test.ts` (Chromium-free, RP-44). Every console of this spec is
// its own: a forced theme never reaches the shared screens console (C9).
import type { Locator, Page, Response } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

const RESIDUAL =
  'Auto-update does what git pull does, on a timer: incoming commits can run commands your own git configuration points at (filter drivers, credential helpers, aliases). Leave it off if your configuration runs scripts from your projects.';

const sw = (page: Page, name: string) => page.getByRole('switch', { name, exact: true });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const interval = (page: Page) => page.getByRole('textbox', { name: 'Fetch interval (seconds)' });
const cap = (page: Page) => page.getByRole('textbox', { name: 'Entries kept' });
const configurationLink = (page: Page) =>
  page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Configuration' });

/** Click the label that draws a switch or a radio, as the user does (their input is visually hidden). */
const press = (control: Locator) => control.locator('xpath=ancestor::label[1]').click();

/** A kanban copy where the user is Morgan (the feature's Background). */
async function morganKanban(fixtures: { copy(kind: 'kanban'): Promise<Fixture> }): Promise<Fixture> {
  const kanban = await fixtures.copy('kanban');
  await actAs(kanban, 'Morgan');
  return kanban;
}

/** Open the project's Today, then Configuration › UI settings from the sidebar; wait for its first read. */
async function openSettings(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/today` });
  await expectFirstLoad(configurationLink(page));
  await configurationLink(page).click();
  await expect(page).toHaveURL(new RegExp(`/p/${c.pids[0]}/configuration/ui-settings$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Configuration' })).toBeVisible();
  await expectFirstLoad(sw(page, 'Auto-fetch'));
}

/**
 * `control` has the focus and the user sees the focus ring of spec-009 (2 px solid): on the control
 * itself, or — for a switch or a radio, whose focused input is visually hidden — on the label that
 * draws it (React Aria's `data-focus-visible`).
 */
async function expectRingShown(control: Locator): Promise<void> {
  await expect(control).toBeFocused();
  const ring = await control.evaluate((el) => {
    const shown = el.closest('label') ?? el;
    const s = getComputedStyle(shown);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), box: shown.getBoundingClientRect().width };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(2);
  expect(ring.box).toBeGreaterThan(10);
}

/** The answer of the next settings `PUT`. */
function nextSave(page: Page): Promise<Response> {
  return page.waitForResponse((r) => r.url().endsWith('/api/settings') && r.request().method() === 'PUT', {
    timeout: COLD_READ_MS,
  });
}

/** The `git fetch` processes the bin started so far (its `GIT_TRACE` file). */
async function fetches(trace: string): Promise<number> {
  return (await readFile(trace, 'utf8').catch(() => '')).split('\n').filter((l) => /built-in: git fetch\b/.test(l))
    .length;
}

/** `sync.fetch.lastSuccessAt` of the project, read with the page's session. */
async function lastFetch(page: Page, c: RunningConsole): Promise<string | null> {
  const r = await page.request.get(`${c.origin}/api/p/${c.pids[0]}`);
  expect(r.status()).toBe(200);
  return ((await r.json()) as { repository: { sync: { fetch: { lastSuccessAt: string | null } } } }).repository.sync
    .fetch.lastSuccessAt;
}

test.describe('UI settings (US-C-07)', () => {
  test('C-07.1 — Show the settings with their defaults', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await morganKanban(fixtures)] });
    await openSettings(page, c);
    await expect(sw(page, 'Auto-fetch')).toBeChecked();
    await expect(sw(page, 'Auto-update')).not.toBeChecked();
    await expect(sw(page, 'Auto-push')).not.toBeChecked();
    await expect(radio(page, 'System')).toBeChecked();
    await expect(sw(page, 'Confirm agent launch')).toBeChecked();
    await expect(interval(page)).toHaveValue('60');
    await expect(cap(page)).toHaveValue('5000');
    // The declared residual of Auto-update (W4-16, approver) and the WingFoil 0.3 note (RP-15),
    // visible and as the switches' descriptions.
    await expect(page.getByText(RESIDUAL)).toBeVisible();
    await expect(page.getByText('Before you turn Auto-update on')).toBeVisible();
    await expect(sw(page, 'Auto-update')).toHaveAccessibleDescription(new RegExp(RESIDUAL.replace(/[().]/g, '\\$&')));
    await expect(sw(page, 'Confirm agent launch')).toHaveAccessibleDescription(/WingFoil 0\.3/);
    await expect(configurationLink(page)).toHaveAttribute('aria-current', 'page');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('C-07.2 — Keep a setting across restarts without touching the project', async ({ page, fixtures, consoles }) => {
    const stateDir = await mkdtemp(path.join(tmpdir(), 'wfui-e2e-state-'));
    try {
      const kanban = await morganKanban(fixtures);
      const head = (await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim();
      const first = await consoles.start({ projects: [kanban], stateDir });
      await openSettings(page, first);
      const saved = nextSave(page);
      await press(sw(page, 'Auto-push'));
      expect((await saved).status()).toBe(200);
      await expect(sw(page, 'Auto-push')).toBeChecked();
      await expect(page.getByRole('status').filter({ hasText: 'Settings saved' })).toBeVisible();
      await first.stop();
      // `npx wingfoil-ui` again, on the same state directory.
      const second = await consoles.start({ projects: [kanban], stateDir });
      expect(second.pids).toEqual([]);
      await openConsole(page, second);
      await page.goto(`${second.origin}/p/${first.pids[0]}/configuration/ui-settings`, { timeout: COLD_READ_MS });
      await expectFirstLoad(sw(page, 'Auto-push'));
      await expect(sw(page, 'Auto-push')).toBeChecked();
      expect((await git(kanban.dir, ['status', '--porcelain'], kanban.env)).stdout).toBe('');
      expect((await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim()).toBe(head);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  test('C-07.3 — Apply a setting change without a restart', async ({ page, fixtures, consoles }) => {
    const kanban = await morganKanban(fixtures);
    const trace = path.join(path.dirname(kanban.dir), 'git-trace.log');
    const c = await consoles.start({
      projects: [kanban],
      settings: { fetchIntervalSeconds: 15 },
      env: { GIT_TRACE: trace },
    });
    await openSettings(page, c);
    await expect(sw(page, 'Auto-fetch')).toBeChecked();
    // Precondition: the console fetches by itself, and a tick has just ended — the next one is an
    // interval away, so no tick that read the setting before the change is still running (D41-10).
    await expect.poll(() => lastFetch(page, c), { timeout: COLD_READ_MS }).not.toBeNull();
    const before = await lastFetch(page, c);
    await expect.poll(() => lastFetch(page, c), { timeout: COLD_READ_MS }).not.toBe(before);
    expect(await fetches(trace)).toBeGreaterThan(0);
    const saved = nextSave(page);
    await press(sw(page, 'Auto-fetch'));
    expect((await saved).status()).toBe(200);
    await expect(sw(page, 'Auto-fetch')).not.toBeChecked();
    const count = await fetches(trace);
    // Two intervals and a margin with Auto-fetch off: no `git fetch` (the scenario's 120 s at 60 s).
    await page.waitForTimeout(2 * 15_000 + 5_000);
    expect(await fetches(trace)).toBe(count);
    // The trace is still written (the reads of the console), so 0 fetches is not vacuous.
    expect(await readFile(trace, 'utf8')).toMatch(/built-in: git status\b/);
    await page.reload();
    await expectFirstLoad(sw(page, 'Auto-fetch'));
    await expect(sw(page, 'Auto-fetch')).not.toBeChecked();
  });

  test('another tab follows a change (spec-004 §6 settings event)', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await morganKanban(fixtures)] });
    await openSettings(page, c);
    const other = await page.context().newPage();
    await other.goto(`${c.origin}/p/${c.pids[0]}/configuration/ui-settings`, { timeout: COLD_READ_MS });
    await expectFirstLoad(sw(other, 'Auto-push'));
    await expect(sw(other, 'Auto-push')).not.toBeChecked();
    const saved = nextSave(page);
    await press(sw(page, 'Auto-push'));
    expect((await saved).status()).toBe(200);
    await expect(sw(other, 'Auto-push')).toBeChecked({ timeout: COLD_READ_MS });
    await other.close();
  });

  test('a fetch interval out of range is refused in the field and nothing is sent', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await morganKanban(fixtures)] });
    await openSettings(page, c);
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/settings') && r.method() === 'PUT') puts.push(r.url());
    });
    await interval(page).fill('5');
    await interval(page).press('Enter');
    await expect(page.getByText('Enter a whole number of seconds from 15 to 3600.')).toBeVisible();
    await expect(interval(page)).toHaveAttribute('aria-invalid', 'true');
    await page.reload();
    await expectFirstLoad(interval(page));
    await expect(interval(page)).toHaveValue('60');
    expect(puts).toEqual([]);
  });

  test('every control is operable from the keyboard with a visible focus', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await morganKanban(fixtures)] });
    await openSettings(page, c);
    await tabUntil(page, sw(page, 'Auto-push'));
    await expectRingShown(sw(page, 'Auto-push'));
    let saved = nextSave(page);
    await page.keyboard.press('Space');
    expect((await saved).status()).toBe(200);
    await expect(sw(page, 'Auto-push')).toBeChecked();
    await tabUntil(page, interval(page));
    await expectRingShown(interval(page));
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('30');
    saved = nextSave(page);
    await page.keyboard.press('Enter');
    expect(JSON.parse((await saved).request().postData() ?? '{}')).toMatchObject({
      autoPush: true,
      fetchIntervalSeconds: 30,
    });
    await tabUntil(page, radio(page, 'System'));
    await expectRingShown(radio(page, 'System'));
    saved = nextSave(page);
    await page.keyboard.press('ArrowRight');
    expect(JSON.parse((await saved).request().postData() ?? '{}')).toMatchObject({ theme: 'light' });
    await expect(radio(page, 'Light')).toBeChecked();
    for (const control of [
      sw(page, 'Auto-fetch'),
      sw(page, 'Auto-update'),
      sw(page, 'Confirm agent launch'),
      cap(page),
    ]) {
      await tabUntil(page, control);
      await expectRingShown(control);
    }
  });
});

test.describe('US-X-08 — themes', () => {
  test('X-08.3 — Override the system with the theme setting', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await morganKanban(fixtures)] });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openSettings(page, c);
    const html = page.locator('html');
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const dark = await background();
    const saved = nextSave(page);
    await press(radio(page, 'Light'));
    expect((await saved).status()).toBe(200);
    await expect(html).toHaveAttribute('data-theme', 'light');
    // What the user sees: the light body background (spec-009 `--color-surface` light #F5F7FA).
    await expect.poll(background).toBe('rgb(245, 247, 250)');
    expect(dark).not.toBe('rgb(245, 247, 250)');
    // Kept after a reload, and the system preference no longer moves it.
    await page.reload();
    await expectFirstLoad(radio(page, 'Light'));
    await expect(radio(page, 'Light')).toBeChecked();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'light');
    // Back to System: the dark preference again.
    await press(radio(page, 'System'));
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect.poll(background).toBe(dark);
  });
});
