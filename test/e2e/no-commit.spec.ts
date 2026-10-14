// task-025 AC-5 (e2e-smoke `drive-browser`, ES-15): "every commit is a CLI `wf(…)` commit or a
// `chore(ui)` commit touching only `.wingfoil/ui.yaml`". v0.1 makes no governed write, so the check
// is that a console session over every v0.1 screen — the `SCREENS` of task-021 (start page,
// switcher, add/remove dialogs opened, Memory list, element panel, role view, DNA, Directives,
// Team, Documentation, …), a role view picked and a project switch — leaves both observed
// repositories as they were: HEAD, refs, stash, index, configuration and working tree
// (`test/harness/repo-state.ts`, whose own test proves it sees each kind of change).
import { snapshotRepo, diffRepo, type RepoState } from '../harness/repo-state.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectSettled, SCREENS } from './support/screens.js';
import { openSwitcher, rows } from './support/switcher.js';

test.use({ prebuild: ['kanban', 'custom'] });

test.describe('task-025 AC-5 — a console session commits nothing', () => {
  test('AC-5.1 — every v0.1 screen, a role view and a project switch leave HEAD, refs, index and working tree unchanged', async ({
    page,
    fixtures,
    consoles,
  }) => {
    // The console of the screens (`startScreensConsole`): kanban and custom, Morgan in both, and a
    // kanban copy where the user is Riley (the How to join panel, task-035).
    const kanban = await fixtures.copy('kanban');
    const custom = await fixtures.copy('custom');
    const outsider = await fixtures.copy('kanban');
    await actAs(kanban, 'Morgan');
    await actAs(custom, 'Morgan');
    await actAs(outsider, 'Riley');
    const repos = [kanban, custom, outsider];
    const before: RepoState[] = await Promise.all(repos.map((fx) => snapshotRepo(fx.dir, fx.env)));
    const c = await consoles.start({ projects: repos });
    await openConsole(page, c);

    const visited: string[] = [];
    for (const screen of SCREENS) {
      await screen.open(page, c);
      visited.push(screen.name);
    }
    expect(visited).toHaveLength(SCREENS.length);

    // A role view picked (written to the local state, never to the repository).
    await page.goto(`${c.origin}/p/${c.pids[0]}/team`, { timeout: COLD_READ_MS });
    await expect(page.locator('.member-card').first()).toBeVisible({ timeout: COLD_READ_MS });
    const put = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/p/${c.pids[0]}/role-view`,
      { timeout: COLD_READ_MS },
    );
    await page.locator('.role-view-button').click();
    await page.getByRole('listbox').getByRole('option', { name: 'tech-lead', exact: true }).click();
    expect((await put).status()).toBe(204);
    await expect(page.locator('.role-view-button')).toHaveAccessibleName('tech-lead Role view');

    // A switch to the other project through the switcher.
    await openSwitcher(page);
    await rows(page).filter({ hasText: 'custom' }).click();
    // The switcher keeps the current view (S2): the other project's Team.
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[1]}/team`, { timeout: COLD_READ_MS });
    await expect(page.locator('.member-card').first()).toBeVisible({ timeout: COLD_READ_MS });
    await expectSettled(page);

    // Every read answered, then the console stopped: nothing it does at shutdown counts either.
    await c.stop();
    const after = await Promise.all(repos.map((fx) => snapshotRepo(fx.dir, fx.env)));
    for (const [i, fx] of repos.entries()) {
      expect(await diffRepo(fx.dir, fx.env, before[i]!, after[i]!), fx.name).toEqual([]);
    }
  });
});
