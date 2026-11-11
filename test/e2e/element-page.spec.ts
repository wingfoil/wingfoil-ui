// task-062 — the element page and its addresses on the real bin (US-G-01: G-01.5 … G-01.7;
// spec-011 §2, §3; ux-reference §4.2 v0.3): a short id rewritten to the full id, the candidates of
// an ambiguous short id, an id longer than 100 characters opened from the Memory list and decided.
// Every Given is scenario-local, on a kanban copy (dl-009 action 9).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { addLongIdElement } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole } from './support/console.js';
import { elementView, openElementPage } from './support/element.js';
import { commitFile, lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban'] });

test.describe('US-G-01 — the element page and its addresses', () => {
  test('G-01.5 — Open an element by its short id and show its full id', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    const pid = c.pids[0]!;
    // The console's Memory list first: the address is then reached inside the console.
    await openConsole(page, c, { path: `/p/${pid}/memory` });
    await page.goto(`${c.origin}/p/${pid}/e/task-003`);
    const view = elementView(page);
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/e/task-003-logout`, { timeout: COLD_READ_MS });
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Logout' })).toBeVisible();
    await expect(view.getByText('task-003-logout', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The short form was replaced: Back does not return to it.
    await page.goBack();
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/memory`);
  });

  test('G-01.6 — List the candidates of an ambiguous short id', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const file = 'docs/memory/task/task-001-login-form.md';
    const copy = (await readFile(path.join(kanban.dir, file), 'utf8'))
      .replace('id: task-001-login-form', 'id: task-001-login-form-copy')
      .replace(/^title: .*$/m, 'title: "Login form copy"');
    await commitFile(kanban, 'docs/memory/task/task-001-login-form-copy.md', copy, 'docs: a copy by hand');
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    await openConsole(page, c, { path: `/p/${pid}/e/task-001` });
    const list = page.getByRole('list', { name: 'task-001 names several elements' });
    await expectFirstLoad(list);
    const links = list.getByRole('link');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', `/p/${pid}/e/task-001-login-form`);
    await expect(links.nth(1)).toHaveAttribute('href', `/p/${pid}/e/task-001-login-form-copy`);
    await expect(links.nth(0)).toContainText('Login form');
    await expect(links.nth(1)).toContainText('Login form copy');
    await expect(page.getByText('Not found', { exact: true })).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
    // Keyboard: Tab reaches a candidate with a visible focus; Enter opens its page.
    await tabUntil(page, links.nth(1));
    await expectFocusVisible(links.nth(1));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/e/task-001-login-form-copy`);
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Login form copy' })).toBeVisible({
      timeout: COLD_READ_MS,
    });
  });

  test('G-01.7 — Open and decide an element whose id is longer than 100 characters', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const kanban = await fixtures.copy('kanban');
    const long = await addLongIdElement(kanban, { length: 140 });
    expect(long.id).toHaveLength(140);
    await actAs(kanban, 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    await openConsole(page, c, { path: `/p/${pid}/memory` });
    const row = page.locator(`.memory-row[data-eid="${long.id}"]`);
    await expectFirstLoad(row);
    await row.click();
    await expect(page).toHaveURL(`${c.origin}/p/${pid}/e/${long.id}`);
    const view = elementView(page);
    await expect(view.getByText(long.id, { exact: true })).toBeVisible({ timeout: COLD_READ_MS });
    // The long id wraps: no horizontal scroll of the page.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const gate = view.getByRole('region', { name: 'Decision' });
    const reason = gate.getByRole('textbox', { name: 'Reason, recorded in the commit' });
    await reason.fill('Long ids work', { timeout: COLD_READ_MS });
    await gate.getByRole('button', { name: 'Approve → approved', exact: true }).click();
    await expect
      .poll(() => lastCommitSubject(kanban), { timeout: COLD_READ_MS })
      .toBe(`wf(task): approve ${long.id} [pending → approved]`);
  });

  test('an unknown id says not found, the address as the page heading', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/e/task-46` });
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Not found', { timeout: COLD_READ_MS });
    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'task-46' })).toBeVisible();
  });

  test('the element page is a page of the main region with the sidebar; Escape goes to the Memory list', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    const view = await openElementPage(page, c, 'task-001-login-form');
    await expect(page.getByRole('main')).toContainText('Login form');
    await expect(page.getByRole('navigation', { name: 'Project views' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await view.getByRole('heading', { level: 1 }).focus();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/memory`);
    await expect(page.locator('main#main')).toBeFocused();
  });
});
