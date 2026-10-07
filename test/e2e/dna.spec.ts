// task-019 — the DNA view on the real bin (US-R-05: R-05.1, R-05.2) and a failed CLI read confined
// to it (US-S-27: S-27.1, S-27.2; deferred from task-004, task-005 and task-010), on the built
// custom and kanban fixtures (copies when a test mutates one or sets the user).
import type { Page } from '@playwright/test';
import type { DnaShow } from '@wingfoil-ui/contracts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pinnedCli } from '../harness/cli.js';
import { run } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { expectFirstLoad, REFRESH_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, commitFile, mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';

test.use({ prebuild: ['custom', 'kanban'] });

const DNA_FILE = '.wingfoil/dna.yaml';
/** YAML the CLI cannot parse (an unclosed flow sequence). */
const INVALID_DNA = 'version: 1\nmodules: [\n  - name: broken\n';

/** The labelled section `name` of the DNA view. */
const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** Open the DNA view of the console's first project. */
async function openDna(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/dna` });
}

/** The CLI's own message for the project's `dna show` (stderr `{"error": …}`, else its text). */
async function cliMessage(dir: string, env: NodeJS.ProcessEnv): Promise<string> {
  const { stderr } = await run(process.execPath, [pinnedCli().script, '--format', 'json', 'dna', 'show'], {
    cwd: dir,
    env,
    allowFailure: true,
  });
  try {
    return String((JSON.parse(stderr) as { error: unknown }).error);
  } catch {
    return stderr.trim();
  }
}

test.describe('US-R-05 — DNA view', () => {
  test("R-05.1 — Show the project's DNA", async ({ page, fixtures, consoles }) => {
    const custom = await fixtures.copy('custom');
    await actAs(custom, 'Riley');
    const dna = JSON.parse(await cli(custom, ['--format', 'json', 'dna', 'show'])) as DnaShow;
    const c = await consoles.start({ projects: [custom] });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/memory` });
    // "When I open the DNA view": the sidebar entry, by keyboard.
    const entry = page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'DNA' });
    await entry.focus();
    await expectFocusVisible(entry);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/dna`);
    const modules = section(page, 'Modules');
    await expectFirstLoad(modules);
    await expect(page).toHaveTitle('custom · DNA — WingFoil UI');
    // The modules "server", "web", "contracts" with their descriptions and paths.
    expect(dna.modules.map((m) => m.name)).toEqual(['server', 'web', 'contracts']);
    for (const m of dna.modules) {
      const item = modules.getByRole('listitem').filter({ hasText: m.name });
      await expect(item.locator('.rules-name')).toHaveText(m.name);
      await expect(item.getByText(m.description!, { exact: true })).toBeVisible();
      await expect(item.getByText(m.path!, { exact: true })).toBeVisible();
    }
    // The technologies, the methodologies with their phase.
    const stack = section(page, 'Stack');
    for (const t of dna.stacks.technologies ?? []) {
      await expect(stack.locator('.rules-name', { hasText: t.name }).first()).toBeVisible();
    }
    for (const m of dna.stacks.methodologies ?? []) {
      const item = stack.getByRole('listitem').filter({ has: page.locator('.rules-name', { hasText: m.name }) });
      await expect(item.locator('.rules-meta')).toHaveText(m.phase!);
    }
    // The team with each member's roles.
    const team = section(page, 'Team and roles');
    for (const member of dna.team.members) {
      const item = team.getByRole('listitem', { name: member.name, exact: true });
      await expect(item.locator('.role-chip')).toHaveText(member.roles);
    }
    // The paths.
    const paths = section(page, 'Paths');
    for (const [category, values] of Object.entries(dna.paths)) {
      const item = paths.locator('.rules-item').filter({ has: page.locator('dt', { hasText: category }) });
      await expect(item.locator('dd')).toHaveText(values);
    }
    expect(await scanThemes(page)).toEqual([]);
  });

  test('R-05.2 — Show an empty DNA section as empty', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    expect((JSON.parse(await cli(kanban, ['--format', 'json', 'dna', 'show'])) as DnaShow).modules).toEqual([]);
    const c = await consoles.start({ projects: [kanban] });
    await openDna(page, c);
    const modules = section(page, 'Modules');
    await expectFirstLoad(modules);
    await expect(modules.getByText('No module declared', { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('US-S-27 — a failed read confined to its view', () => {
  test('S-27.1 — Confine a failed DNA read to the DNA view', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await commitFile(kanban, DNA_FILE, INVALID_DNA, 'chore: break the DNA');
    const message = await cliMessage(kanban.dir, kanban.env);
    expect(message).not.toBe('');
    const c = await consoles.start({ projects: [kanban] });
    await openDna(page, c);
    const alert = page.getByRole('main').getByRole('alert');
    await expectFirstLoad(alert);
    await expect(alert).toContainText('The DNA could not be read.');
    await expect(alert.locator('.verbatim')).toHaveText(message);
    await expect(section(page, 'Modules')).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
    // The Memory list opens and lists the fixture's elements.
    await page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Memory' }).click();
    const rows = page.locator('[data-eid]');
    await expectFirstLoad(rows.first());
    const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['eid']));
    expect(ids.sort()).toEqual([
      'bug-001-crash-on-save',
      'task-001-login-form',
      'task-002-password-reset',
      'task-003-logout',
      'task-004-session-timeout',
    ]);
  });

  test('S-27.2 — Recover when the file is fixed', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const original = await readFile(path.join(kanban.dir, DNA_FILE), 'utf8');
    await commitFile(kanban, DNA_FILE, INVALID_DNA, 'chore: break the DNA');
    const c = await consoles.start({ projects: [kanban] });
    await recordServerEvents(page);
    await openDna(page, c);
    await expectFirstLoad(page.getByRole('main').getByRole('alert'));
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    // The file restored to valid YAML and committed (W3-46).
    await mutateAndWait(page, () => commitFile(kanban, DNA_FILE, original, 'chore: restore the DNA'), {
      event: 'repo',
      pid: c.pids[0]!,
    });
    const modules = section(page, 'Modules');
    await expect(modules).toBeVisible({ timeout: REFRESH_MS });
    await expect(modules.getByText('No module declared', { exact: true })).toBeVisible();
    await expect(section(page, 'Stack').getByText('Kanban', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    // No reload.
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });
});
