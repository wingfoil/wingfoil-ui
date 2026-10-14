// task-015 — the project switcher on the real bin (US-S-16, US-S-17, US-S-18, US-S-19, US-X-05),
// plus the browser side of X-02.1 (task-003/013 closure), on the built kanban and custom fixtures
// (copies when a test moves or inspects one). Decisions W4-1…W4-8: a popover with the rows (name,
// path, Remove), *Add project…*; the same view in the other project; the unavailable entries; the
// list read again on every opening; a confirmation for the removal; a non-modal element panel.
import type { Locator, Page } from '@playwright/test';
import { mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { expectFocusVisible } from './support/keyboard.js';
import {
  expectListed,
  expectMemoryList,
  nextListRead,
  openSwitcher,
  rows,
  switcher,
  trigger,
} from './support/switcher.js';

// The fixtures of this spec, built before its first test (shared support, bug-004).
test.use({ prebuild: ['kanban', 'custom'] });

/** Today, the landing view of a project (task-036, D36-1): its heading after the first, cold read. */
async function expectToday(page: Page): Promise<void> {
  await expect(page.locator('.today').getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
  await expect(
    page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Today', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
}

/** The Memory list's type filters (task-017). */
function typeList(page: Page): Locator {
  return page.getByRole('list', { name: 'Element types' });
}

/** What must stay unchanged in a fixture folder: its files, its history, its status. */
async function folderState(fx: Fixture): Promise<{ files: string[]; log: string; status: string }> {
  const files = (await readdir(fx.dir, { recursive: true }))
    .map(String)
    .filter((f) => !f.startsWith('.git/') && f !== '.git')
    .sort();
  const log = (await git(fx.dir, ['log', '--all', '--format=%H %s'], fx.env)).stdout;
  const status = (await git(fx.dir, ['status', '--porcelain', '--ignored'], fx.env)).stdout;
  return { files, log, status };
}

test.describe('US-X-02 — browser session (task-003 closure)', () => {
  test('X-02.1 — Serve the browser session opened with the token', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await page.goto(c.url);
    // Keyboard: the trigger with a visible focus, Enter opens the switcher on its first row.
    await expectFirstLoad(trigger(page));
    await trigger(page).focus();
    await expectFocusVisible(trigger(page));
    await openSwitcher(page, () => page.keyboard.press('Enter'));
    await expectListed(page, ['kanban']);
    // The address bar no longer shows the token.
    expect(page.url()).toBe(`${c.origin}/`);
    expect(page.url()).not.toContain(c.token);
    // The first row has the focus with a visible ring; axe in both themes, switcher open.
    await expectFocusVisible(rows(page).first());
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('US-S-16 — switch project', () => {
  test('S-16.1 — Switch to another project', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban'), await fixtures.get('custom')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectMemoryList(page);
    await expect(page.getByText('task-001-login-form').first()).toBeVisible();
    // Keyboard: Tab to the trigger, Enter, arrow to the custom fixture, Enter.
    await trigger(page).focus();
    await expectFocusVisible(trigger(page));
    await page.keyboard.press('Enter');
    await expect(switcher(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(2, { timeout: COLD_READ_MS });
    await expect(rows(page).first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expectFocusVisible(rows(page).nth(1));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[1]}/memory`);
    await expect(switcher(page)).toBeHidden();
    await expectMemoryList(page);
    await expect(typeList(page).getByRole('link', { name: /^decision-log, / })).toBeVisible();
    // `plan` has no element in the custom fixture: it comes from `GET /config` only, which may answer
    // after the rows (bug-009, task-027 review F2).
    await expect(typeList(page).getByRole('link', { name: /^plan, / })).toBeVisible({ timeout: COLD_READ_MS });
    await expect(trigger(page)).toHaveAccessibleName('Projects: custom');
    // No element id of the kanban fixture is shown on the page.
    const text = await page.locator('body').innerText();
    for (const eid of ['task-001-login-form', 'task-002-password-reset']) expect(text).not.toContain(eid);
  });

  test('S-16.2 — Close the element panel of the previous project on switch', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban'), await fixtures.get('custom')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/e/task-001-login-form` });
    const panel = page.getByRole('dialog').filter({ hasText: 'task-001-login-form' });
    await expectFirstLoad(panel);
    // The panel is not modal (W4-8): the switcher stays operable while it is open.
    await openSwitcher(page);
    await rows(page).filter({ hasText: 'custom' }).click();
    // A panel is not a view: the switch lands on the project's landing view, Today (task-036).
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[1]}/today`);
    await expect(panel).toBeHidden();
    await expectToday(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('US-S-17 — list kept across restarts', () => {
  test('S-17.1 — Keep the project list after a restart', async ({ page, fixtures, consoles }) => {
    const stateDir = await mkdtemp(path.join(tmpdir(), 'wfui-e2e-state-'));
    try {
      const first = await consoles.start({
        projects: [await fixtures.get('kanban'), await fixtures.get('custom')],
        stateDir,
      });
      await openConsole(page, first);
      await openSwitcher(page);
      await expectListed(page, ['kanban', 'custom']);
      await first.stop();
      // `npx wingfoil-ui` again, on the same state directory.
      const second = await consoles.start({ projects: [await fixtures.get('kanban')], stateDir });
      expect(second.pids).toEqual([]);
      await openConsole(page, second);
      await openSwitcher(page);
      await expectListed(page, ['kanban', 'custom']);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  test('S-17.2 — Keep the list out of every project repository', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const c = await consoles.start({ projects: [kanban] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    await expectMemoryList(page);
    await openSwitcher(page);
    await expectListed(page, ['kanban']);
    await c.stop();
    expect((await git(kanban.dir, ['status', '--porcelain'], kanban.env)).stdout).toBe('');
  });
});

test.describe('US-S-18 — remove a project', () => {
  test('S-18.1 — Remove a project from the list', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const before = await folderState(kanban);
    const c = await consoles.start({ projects: [kanban] });
    await openConsole(page, c);
    await openSwitcher(page);
    // Keyboard: Tab from the row reaches its Remove button.
    await expect(rows(page).first()).toBeFocused();
    await page.keyboard.press('Tab');
    const remove = switcher(page).getByRole('button', { name: 'Remove kanban' });
    await expectFocusVisible(remove);
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('alertdialog', { name: 'Remove kanban from the list?' });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Its folder and its files are not touched.');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    expect(await scanThemes(page)).toEqual([]);
    await confirm.getByRole('button', { name: 'Remove' }).click();
    await expect(confirm).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await openSwitcher(page);
    await expect(switcher(page).getByText('No project in the list')).toBeVisible();
    await expectListed(page, []);
    expect(await folderState(kanban)).toEqual(before);
  });

  test('S-18.2 — Cancel the removal', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c);
    await openSwitcher(page);
    await switcher(page).getByRole('button', { name: 'Remove kanban' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Remove kanban from the list?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    expect((await openSwitcher(page)).projects.map((p) => p.name)).toEqual(['kanban']);
    await expectListed(page, ['kanban']);
    // Escape cancels too (ux-reference §5).
    await switcher(page).getByRole('button', { name: 'Remove kanban' }).click();
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    expect((await openSwitcher(page)).projects.map((p) => p.name)).toEqual(['kanban']);
    await expectListed(page, ['kanban']);
  });
});

test.describe('US-S-19 — missing folder', () => {
  /** A console listing a copy of kanban (then moved away) and the custom fixture. */
  async function movedKanban(
    page: Page,
    fixtures: { copy(kind: 'kanban'): Promise<Fixture>; get(kind: 'custom'): Promise<Fixture> },
    consoles: { start(o: object): Promise<RunningConsole> },
  ): Promise<{ c: RunningConsole; kanban: Fixture; moved: string }> {
    const kanban = await fixtures.copy('kanban');
    const c = await consoles.start({ projects: [kanban, await fixtures.get('custom')] });
    // The page's first list read completes before the folder moves: a later read is the opening's.
    const first = nextListRead(page);
    await openConsole(page, c);
    expect((await first).body.projects.map((p) => p.availability)).toEqual(['ok', 'ok']);
    const moved = `${kanban.dir}-moved`;
    await rename(kanban.dir, moved);
    return { c, kanban, moved };
  }

  test('S-19.1 — Show a moved project as unavailable', async ({ page, fixtures, consoles }) => {
    const { c } = await movedKanban(page, fixtures, consoles);
    // The read sent by the opening already sees the folder missing (W4-4).
    const list = await openSwitcher(page);
    expect(list.projects.map((p) => p.availability)).toEqual(['folder-not-found', 'ok']);
    const entry = rows(page).filter({ hasText: 'kanban' });
    await expect(entry).toContainText('Unavailable — folder not found', { timeout: COLD_READ_MS });
    await expect(entry.getByRole('button', { name: 'Remove kanban' })).toBeVisible();
    // Not a link (W4-3).
    expect(await entry.getAttribute('data-href')).toBeNull();
    expect(await scanThemes(page)).toEqual([]);
    // The other project still opens, on Today (its landing view, task-036).
    await rows(page).filter({ hasText: 'custom' }).click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[1]}/today`);
    await expectToday(page);
  });

  test('S-19.2 — Recover when the folder comes back', async ({ page, fixtures, consoles }) => {
    const { kanban, moved } = await movedKanban(page, fixtures, consoles);
    await openSwitcher(page);
    const entry = rows(page).filter({ hasText: 'kanban' });
    await expect(entry).toContainText('Unavailable — folder not found', { timeout: COLD_READ_MS });
    await page.keyboard.press('Escape');
    await expect(switcher(page)).toBeHidden();
    await rename(moved, kanban.dir);
    // The read sent by the opening sees the folder back (W4-4), whatever the periodic check did.
    const list = await openSwitcher(page);
    expect(list.projects.map((p) => p.availability)).toEqual(['ok', 'ok']);
    await expect(entry).not.toContainText('Unavailable', { timeout: COLD_READ_MS });
    expect(await entry.getAttribute('data-href')).not.toBeNull();
  });
});

test.describe('US-X-05 — opaque project ids', () => {
  test('X-05.1 — Use opaque project ids in URLs', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ projects: [kanban] });
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    page.on('framenavigated', (f) => urls.push(f.url()));
    await openConsole(page, c);
    await openSwitcher(page);
    await rows(page).filter({ hasText: 'kanban' }).click();
    await expectToday(page);
    const parent = path.basename(path.dirname(kanban.dir));
    // The scenario's "/home/test" is the folder holding the fixture; "projects/kanban" its last two
    // segments.
    const holder = path.dirname(kanban.dir);
    const forbidden = [holder, encodeURIComponent(holder), `${parent}/kanban`, `${parent}%2Fkanban`];
    expect(urls.length).toBeGreaterThan(3);
    for (const url of urls) for (const f of forbidden) expect(url).not.toContain(f);
    expect(page.url()).toBe(`${c.origin}/p/${c.pids[0]}/today`);
  });

  test('X-05.2 — Refuse a project id that is not in the list', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c);
    await expectFirstLoad(trigger(page));
    // With the page's session (cookie): the id "../../etc", encoded so that it stays one segment.
    const id = encodeURIComponent('../../etc');
    const answer = await page.request.get(`${c.origin}/api/p/${id}`);
    expect(answer.status()).toBe(404);
    // What the user sees at that address: "Not found", nothing of any folder.
    await page.goto(`${c.origin}/p/${id}/memory`);
    await expect(page.getByText('Not found').first()).toBeVisible({ timeout: COLD_READ_MS });
  });
});
