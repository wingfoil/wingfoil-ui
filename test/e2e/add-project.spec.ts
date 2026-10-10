// task-014 — the Add project dialog on the real bin (US-S-03, US-S-04, US-S-05, US-S-06, US-S-07,
// US-S-10), offline: remotes are the fixture's bare repository and bare repositories made by the
// test, cloned as `file://` URLs, or served by a dumb-HTTP server on 127.0.0.1 inside the test (a
// refused authentication, a clone held in progress); `~` is the console's isolated home; whether a
// `wingfoil` is on the console's PATH is set by each test, never inherited. Decisions W4-9…W4-15.
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { mkdir, readdir, realpath, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../harness/cli.js';
import { envWithoutWingfoil, harnessEnv, removeCli } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanForSecrets } from '../harness/secret-scan.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { bareRepository, startGitHttpRemote } from './support/git-http.js';
import { expectFocusVisible } from './support/keyboard.js';
import { expectListed, openSwitcher, rows, switcher, trigger } from './support/switcher.js';

test.use({ prebuild: ['kanban'] });

const INSTALL = 'npm install --save-dev wingfoil';

/** A git credential helper answering the wrong password for any host (S-07.3). */
const CREDENTIAL_HELPER = '!f() { echo username=alex; echo password=wrong; }; f';

/** The Add project dialog. */
function dialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Add project' });
}

/** A text field of the dialog by its label. */
function field(page: Page, name: string): Locator {
  return dialog(page).getByRole('textbox', { name, exact: true });
}

/** The start page's *Add project…*. */
function startAdd(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: 'Add project…' });
}

/** Open the console's start page and the dialog from its *Add project…*. */
async function openDialog(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c);
  await expectFirstLoad(trigger(page));
  await startAdd(page).click();
  await expect(dialog(page)).toBeVisible();
}

/** Choose *Remote git repository*. */
async function chooseRemote(page: Page): Promise<void> {
  await dialog(page).getByText('Remote git repository').click();
  await expect(field(page, 'Repository URL')).toBeVisible();
}

/** Press Tab until `target` has the focus (at most 10 times). */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 10; i++) {
    if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('focus never reached the target');
}

/** The answer of the next add (`POST /api/projects`) or clone (`/api/projects/clone`). */
async function nextAdd(page: Page, clone: boolean): Promise<{ status: number; body: unknown }> {
  const response = await page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === (clone ? '/api/projects/clone' : '/api/projects'),
    { timeout: COLD_READ_MS },
  );
  return { status: response.status(), body: (await response.json()) as unknown };
}

/** Close the dialog with Escape, open the switcher and check that its list read holds `names`. */
async function expectSwitcherLists(page: Page, names: string[]): Promise<ProjectListItem[]> {
  if (await dialog(page).isVisible()) await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  const list = await openSwitcher(page);
  expect(list.projects.map((p) => p.name)).toEqual(names);
  await expectListed(page, names);
  return list.projects;
}

/** The Memory list heading of the opened project (first, cold read). */
async function expectMemoryHeading(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible({ timeout: COLD_READ_MS });
}

/**
 * A `PATH` for the console: the test's `PATH` without any `wingfoil`, plus `node`, `git` and — when
 * `withCli` — the pinned CLI linked as `wingfoil` (a clone has no `node_modules`: S-04.x find it there).
 */
async function consolePath(testInfo: TestInfo, withCli: boolean): Promise<string> {
  const bin = testInfo.outputPath(withCli ? 'bin-with-cli' : 'bin-without-cli');
  const env = await envWithoutWingfoil(process.env, bin);
  if (withCli) {
    const cli = await realpath(path.join(REPO_ROOT, 'node_modules', '.bin', 'wingfoil'));
    await symlink(cli, path.join(bin, 'wingfoil')).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  return env['PATH']!;
}

/** The console's home (`~`) when it was started without projects. */
function homeOf(c: RunningConsole): string {
  return path.join(c.root, 'home');
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

test.describe('US-S-03 — add a local folder', () => {
  test('S-03.1 — Add a local WingFoil folder', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start();
    await openConsole(page, c);
    await expectSwitcherLists(page, []);
    await page.keyboard.press('Escape');
    // Keyboard only: the start page's Add project…, the source, the field, Enter.
    await startAdd(page).focus();
    await expectFocusVisible(startAdd(page));
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await tabTo(page, dialog(page).getByRole('radio', { name: 'Local folder' }));
    await expect(dialog(page).locator('.segmented-option[data-focus-visible]')).toHaveText('Local folder');
    await page.keyboard.press('Tab');
    await expectFocusVisible(field(page, 'Folder path'));
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.type(kanban.dir);
    const added = nextAdd(page, false);
    await page.keyboard.press('Enter');
    const answer = await added;
    expect(answer.status).toBe(201);
    const item = answer.body as ProjectListItem;
    expect(item.id).toMatch(/^p_[0-9a-z]{12}$/);
    // The project opens on its Memory list, by its opaque id; the dialog is gone.
    await expectMemoryHeading(page);
    expect(page.url()).toBe(`${c.origin}/p/${item.id}/memory`);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'kanban added' })).toHaveCount(1);
    // Listed with its name from dna.project.name.
    await expect(trigger(page)).toHaveAccessibleName(`Projects: ${kanban.name}`);
    await expectSwitcherLists(page, [kanban.name]);
  });

  test('S-03.2 — Refuse a path that does not exist', async ({ page, consoles }) => {
    expect(await exists('/tmp/does-not-exist')).toBe(false);
    const c = await consoles.start();
    await openDialog(page, c);
    await field(page, 'Folder path').fill('/tmp/does-not-exist');
    const refused = nextAdd(page, false);
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    expect((await refused).status).toBe(422);
    await expect(dialog(page).getByRole('alert')).toHaveText('Folder not found: /tmp/does-not-exist', {
      timeout: COLD_READ_MS,
    });
    expect(await scanThemes(page)).toEqual([]);
    await expectSwitcherLists(page, []);
  });
});

test.describe('US-S-04 — add from a remote', () => {
  test('S-04.1 — Auto-fill the working directory of a remote', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start();
    await openDialog(page, c);
    // Keyboard: the arrow key chooses the remote source.
    await tabTo(page, dialog(page).getByRole('radio', { name: 'Local folder' }));
    await page.keyboard.press('ArrowRight');
    await expect(dialog(page).getByRole('radio', { name: 'Remote git repository' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expectFocusVisible(field(page, 'Repository URL'));
    await page.keyboard.type(kanban.remoteUrl);
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/kanban');
    await expect(field(page, 'Local working directory')).toHaveAccessibleDescription(
      'The repository is cloned here; WingFoil works on this copy.',
    );
    await expect(dialog(page).getByRole('button', { name: 'Clone and add' })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-04.3 — Clone the remote on confirm', async ({ page, fixtures, consoles }, testInfo) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ env: { PATH: await consolePath(testInfo, true) } });
    await openDialog(page, c);
    await chooseRemote(page);
    await field(page, 'Repository URL').fill(kanban.remoteUrl);
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/kanban');
    const cloned = nextAdd(page, true);
    await dialog(page).getByRole('button', { name: 'Clone and add' }).click();
    const answer = await cloned;
    expect(answer.status).toBe(201);
    const item = answer.body as ProjectListItem;
    await expectMemoryHeading(page);
    expect(page.url()).toBe(`${c.origin}/p/${item.id}/memory`);
    // "~/projects/kanban" is a clone of the remote: its origin, the remote's commit.
    const dir = path.join(homeOf(c), 'projects', 'kanban');
    expect((await git(dir, ['remote', 'get-url', 'origin'], kanban.env)).stdout.trim()).toBe(kanban.remoteUrl);
    expect((await git(dir, ['rev-parse', 'HEAD'], kanban.env)).stdout).toBe(
      (await git(kanban.remoteDir, ['rev-parse', 'HEAD'], kanban.env)).stdout,
    );
    await expectSwitcherLists(page, ['kanban']);
  });

  test('S-04.2 — Use a working directory I typed instead of the auto-filled one', async ({
    page,
    fixtures,
    consoles,
  }, testInfo) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ env: { PATH: await consolePath(testInfo, true) } });
    await openDialog(page, c);
    await chooseRemote(page);
    await field(page, 'Repository URL').fill(kanban.remoteUrl);
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/kanban');
    await field(page, 'Local working directory').fill('~/work/kanban-copy');
    const cloned = nextAdd(page, true);
    await field(page, 'Local working directory').press('Enter');
    expect((await cloned).status).toBe(201);
    await expectMemoryHeading(page);
    const dir = path.join(homeOf(c), 'work', 'kanban-copy');
    expect((await git(dir, ['remote', 'get-url', 'origin'], kanban.env)).stdout.trim()).toBe(kanban.remoteUrl);
    expect(await exists(path.join(homeOf(c), 'projects', 'kanban'))).toBe(false);
    await expectSwitcherLists(page, ['kanban-copy']);
  });

  test('W4-11 — a clone in progress: progress, keyboard, Cancel aborts it and nothing is left', async ({
    page,
    consoles,
  }, testInfo) => {
    const { env } = await harnessEnv(testInfo.outputPath('git'));
    const base = testInfo.outputPath('served');
    await bareRepository(base, 'held', { 'README.md': '# held\n' }, env);
    const remote = await startGitHttpRemote(base, { hold: true });
    try {
      const c = await consoles.start();
      await openDialog(page, c);
      await chooseRemote(page);
      // No userinfo: a URL holding credentials is refused before cloning (bug-006, W5-15).
      await field(page, 'Repository URL').fill(`${remote.origin}/held.git`);
      await field(page, 'Repository URL').press('Enter');
      const text = `Cloning ${remote.origin}/held.git into ~/projects/held… This can take a while.`;
      await expect(dialog(page).getByRole('progressbar', { name: text })).toBeVisible({ timeout: COLD_READ_MS });
      await expect(dialog(page).getByRole('status')).toHaveText(text);
      await expect(field(page, 'Repository URL')).toBeDisabled();
      await expect(dialog(page).getByRole('button', { name: 'Clone and add' })).toBeDisabled();
      // The focus waits on Cancel, the action left.
      await expectFocusVisible(dialog(page).getByRole('button', { name: 'Cancel' }));
      await expect.poll(() => remote.requests(), { timeout: COLD_READ_MS }).toBeGreaterThan(0);
      // The clone's folder exists while git waits (review R3b): its removal below is not vacuous.
      const held = path.join(homeOf(c), 'projects', 'held');
      await expect.poll(() => exists(held), { timeout: COLD_READ_MS }).toBe(true);
      expect(await scanThemes(page)).toEqual([]);
      await page.keyboard.press('Enter');
      await expect(dialog(page)).toHaveCount(0);
      // The server killed git and removed what the clone created.
      await expect.poll(() => exists(held), { timeout: COLD_READ_MS }).toBe(false);
      await expectSwitcherLists(page, []);
    } finally {
      await remote.close();
    }
  });
});

test.describe('US-S-05 — not a WingFoil project', () => {
  test('S-05.1 — Refuse a folder without .wingfoil/', async ({ page, consoles }, testInfo) => {
    const { env } = await harnessEnv(testInfo.outputPath('git'));
    const plain = testInfo.outputPath('plain-repo');
    await mkdir(plain, { recursive: true });
    await git(plain, ['init', '-q'], env);
    const c = await consoles.start();
    await openDialog(page, c);
    await field(page, 'Folder path').fill(plain);
    await field(page, 'Folder path').press('Enter');
    await expect(dialog(page).getByRole('alert')).toHaveText(
      `Not a WingFoil project: no .wingfoil/ folder in ${plain}`,
      { timeout: COLD_READ_MS },
    );
    await expectSwitcherLists(page, []);
  });

  test('S-05.2 — Refuse a remote whose clone has no .wingfoil/', async ({ page, consoles }, testInfo) => {
    const { env } = await harnessEnv(testInfo.outputPath('git'));
    const bare = await bareRepository(testInfo.outputPath('remotes'), 'plain', { 'README.md': '# plain\n' }, env);
    const c = await consoles.start();
    await openDialog(page, c);
    await chooseRemote(page);
    await field(page, 'Repository URL').fill(`file://${bare}`);
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/plain');
    await field(page, 'Repository URL').press('Enter');
    await expect(dialog(page).getByRole('alert')).toHaveText(
      'Not a WingFoil project: no .wingfoil/ folder in the cloned repository',
      { timeout: COLD_READ_MS },
    );
    expect(await exists(path.join(homeOf(c), 'projects', 'plain'))).toBe(false);
    await expectSwitcherLists(page, []);
  });
});

test.describe('US-S-06 — same repository twice', () => {
  test('S-06.1 — Refuse the same local folder twice', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ projects: [kanban] });
    await openDialog(page, c);
    await field(page, 'Folder path').fill(kanban.dir);
    await field(page, 'Folder path').press('Enter');
    const alert = dialog(page).getByRole('alert');
    await expect(alert).toContainText('Already in the list: kanban', { timeout: COLD_READ_MS });
    await expect(alert).not.toContainText('same remote');
    // The link to that entry opens it.
    const link = alert.getByRole('link', { name: 'Open kanban' });
    await expect(link).toHaveAttribute('href', `/p/${c.pids[0]}`);
    await link.focus();
    await expectFocusVisible(link);
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveCount(0);
    await expectMemoryHeading(page);
    expect(page.url()).toBe(`${c.origin}/p/${c.pids[0]}/memory`);
    await expectSwitcherLists(page, ['kanban']);
  });

  test('S-06.2 — Refuse a second working copy of a known remote', async ({ page, fixtures, consoles }, testInfo) => {
    const kanban = await fixtures.get('kanban');
    const second = testInfo.outputPath('kanban-second');
    await mkdir(testInfo.outputPath(), { recursive: true });
    await git(testInfo.outputPath(), ['clone', '-q', kanban.remoteUrl, second], kanban.env);
    const c = await consoles.start();
    // The kanban fixture added through the dialog: the list holds its origin.
    await openDialog(page, c);
    await field(page, 'Folder path').fill(kanban.dir);
    await field(page, 'Folder path').press('Enter');
    await expectMemoryHeading(page);
    // Then its second working copy, from the switcher's Add project….
    await openSwitcher(page);
    await switcher(page).getByRole('button', { name: 'Add project…' }).click();
    await field(page, 'Folder path').fill(second);
    await field(page, 'Folder path').press('Enter');
    const alert = dialog(page).getByRole('alert');
    await expect(alert).toContainText('Already in the list: kanban (same remote)', { timeout: COLD_READ_MS });
    await expect(alert.getByRole('link', { name: 'Open kanban' })).toBeVisible();
    await expectSwitcherLists(page, ['kanban']);
  });
});

test.describe('US-S-07 — failed clone', () => {
  test('S-07.1 — Report an unreachable remote', async ({ page, consoles }) => {
    const c = await consoles.start();
    await openDialog(page, c);
    await chooseRemote(page);
    // `.invalid` never resolves (RFC 6761): git fails at once, with no network.
    await field(page, 'Repository URL').fill('https://git.invalid/team/project.git');
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/project');
    await field(page, 'Repository URL').press('Enter');
    const alert = dialog(page).getByRole('alert');
    await expect(alert.getByText('Git refused the action:')).toBeVisible({ timeout: COLD_READ_MS });
    // The error printed by git, verbatim.
    await expect(alert.locator('pre')).toContainText('git.invalid');
    expect(await scanThemes(page)).toEqual([]);
    expect(await exists(path.join(homeOf(c), 'projects', 'project'))).toBe(false);
    await expectSwitcherLists(page, []);
  });

  test('S-07.2 — Refuse a working directory that is not empty', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start();
    const dir = path.join(homeOf(c), 'projects', 'kanban');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'notes.txt'), 'mine\n');
    await openDialog(page, c);
    await chooseRemote(page);
    await field(page, 'Repository URL').fill(kanban.remoteUrl);
    await expect(field(page, 'Local working directory')).toHaveValue('~/projects/kanban');
    await field(page, 'Repository URL').press('Enter');
    await expect(dialog(page).getByRole('alert')).toHaveText('The working directory is not empty: ~/projects/kanban', {
      timeout: COLD_READ_MS,
    });
    expect(await readdir(dir)).toEqual(['notes.txt']);
    await expectSwitcherLists(page, []);
  });

  // Deviation accepted by the user: the remote refusing the credentials is a local dumb-HTTP
  // server with Basic authentication, not `https://git.example.test` (unreachable offline). The
  // credentials available to git come from a credential helper of the console's isolated global git
  // configuration; the URL holds none (bug-006, W5-15).
  test('S-07.3 — Report a refused authentication', async ({ page, consoles }, testInfo) => {
    const { env } = await harnessEnv(testInfo.outputPath('git'));
    const base = testInfo.outputPath('served');
    await bareRepository(base, 'private', { '.wingfoil/dna.yaml': 'x: 1\n' }, env);
    const remote = await startGitHttpRemote(base, { credentials: 'alex:right-secret' });
    try {
      const c = await consoles.start();
      await git(
        c.root,
        ['config', '--file', path.join(c.root, '.gitconfig'), 'credential.helper', CREDENTIAL_HELPER],
        env,
      );
      await openDialog(page, c);
      await chooseRemote(page);
      await field(page, 'Repository URL').fill(`${remote.origin}/private.git`);
      await expect(field(page, 'Local working directory')).toHaveValue('~/projects/private');
      await field(page, 'Repository URL').press('Enter');
      const alert = dialog(page).getByRole('alert');
      await expect(alert.getByText('Git refused the action:')).toBeVisible({ timeout: COLD_READ_MS });
      // The authentication error printed by git, verbatim (git leaves the credentials out).
      await expect(alert.locator('pre')).toContainText('Authentication failed');
      await expect(alert.locator('pre')).not.toContainText('wrong');
      expect(await page.locator('body').innerText()).not.toContain('wrong');
      // The helper was asked: the remote saw the wrong credentials, not an anonymous request only.
      expect(remote.requests()).toBeGreaterThan(1);
      expect(await exists(path.join(homeOf(c), 'projects', 'private'))).toBe(false);
      await expectSwitcherLists(page, []);
    } finally {
      await remote.close();
    }
  });

  // bug-006 (W5-14, W5-15, decided by the user 2026-10-10): a URL holding credentials is refused
  // before anything runs — nothing cloned, no request to the remote, no credential on the page or in
  // the state.
  test('bug-006 — Refuse a clone URL holding credentials', async ({ page, consoles }, testInfo) => {
    const { env } = await harnessEnv(testInfo.outputPath('git'));
    const base = testInfo.outputPath('served');
    await bareRepository(base, 'private', { '.wingfoil/dna.yaml': 'x: 1\n' }, env);
    const remote = await startGitHttpRemote(base, { credentials: 'alex:s3cret-0123' });
    try {
      const c = await consoles.start();
      await openDialog(page, c);
      await chooseRemote(page);
      await field(page, 'Repository URL').fill(
        `${remote.origin.replace('http://', 'http://alex:s3cret-0123@')}/private.git`,
      );
      await expect(field(page, 'Local working directory')).toHaveValue('~/projects/private');
      const answer = nextAdd(page, true);
      await field(page, 'Repository URL').press('Enter');
      expect((await answer).status).toBe(422);
      await expect(dialog(page).getByRole('alert')).toHaveText(
        "The URL holds credentials: WingFoil UI does not clone with them, because git would keep them in the clone's configuration. Clone over SSH, or enter the URL without them and let a git credential helper supply the password.",
        { timeout: COLD_READ_MS },
      );
      expect(await page.locator('body').innerText()).not.toContain('s3cret');
      expect(remote.requests()).toBe(0);
      expect(await exists(path.join(homeOf(c), 'projects', 'private'))).toBe(false);
      expect(await scanForSecrets([c.stateDir], ['s3cret-0123'])).toEqual([]);
      expect(await scanThemes(page)).toEqual([]);
      await expectSwitcherLists(page, []);
    } finally {
      await remote.close();
    }
  });
});

test.describe('US-S-10 — no WingFoil CLI', () => {
  test('S-10.1 — Do not open a project with no CLI', async ({ page, fixtures, consoles }, testInfo) => {
    const kanban = await fixtures.copy('kanban');
    await removeCli(kanban);
    const c = await consoles.start({ env: { PATH: await consolePath(testInfo, false) } });
    await openDialog(page, c);
    await field(page, 'Folder path').fill(kanban.dir);
    await field(page, 'Folder path').press('Enter');
    await expect(dialog(page).getByRole('alert')).toHaveText(
      `WingFoil CLI not found for this project. Install it with: ${INSTALL}`,
      { timeout: COLD_READ_MS },
    );
    await expectSwitcherLists(page, []);
  });

  test('S-10.2 — Mark a listed project whose CLI disappeared', async ({ page, fixtures, consoles }, testInfo) => {
    const kanban = await fixtures.copy('kanban');
    const c = await consoles.start({ projects: [kanban], env: { PATH: await consolePath(testInfo, false) } });
    await openConsole(page, c);
    const before = await openSwitcher(page);
    expect(before.projects.map((p) => p.availability)).toEqual(['ok']);
    await page.keyboard.press('Escape');
    await removeCli(kanban);
    const after = await openSwitcher(page);
    expect(after.projects).toEqual([
      expect.objectContaining({ id: c.pids[0], availability: 'cli-not-found', command: INSTALL }),
    ]);
    const row = rows(page).first();
    await expect(row).toHaveAccessibleName(
      `kanban ${kanban.dir} Unavailable — WingFoil CLI not found Install it with: ${INSTALL}`,
      { timeout: COLD_READ_MS },
    );
    expect(await scanThemes(page)).toEqual([]);
    // Selecting it opens nothing: the row is no link.
    await expect(row).not.toHaveAttribute('data-href');
    // Selecting it (review R3a): any navigation would read the project (`/api/p/…`) and leave `/`.
    const projectReads: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/p/')) projectReads.push(r.url());
    });
    await row.focus();
    await page.keyboard.press('Enter');
    // Settle: the switcher reopened, its list read completed — after any navigation Enter caused.
    await page.keyboard.press('Escape');
    await openSwitcher(page);
    await expect(page).toHaveURL(`${c.origin}/`);
    expect(projectReads).toEqual([]);
    await expect(rows(page).first()).toHaveAccessibleName(/Unavailable — WingFoil CLI not found/);
  });

  test('W4-12 — a clone with no CLI is added but not opened: the reason and the install command', async ({
    page,
    fixtures,
    consoles,
  }, testInfo) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start({ env: { PATH: await consolePath(testInfo, false) } });
    await openDialog(page, c);
    await chooseRemote(page);
    await field(page, 'Repository URL').fill(kanban.remoteUrl);
    const cloned = nextAdd(page, true);
    await field(page, 'Repository URL').press('Enter');
    expect(await cloned).toMatchObject({ status: 201, body: { availability: 'cli-not-found', command: INSTALL } });
    await expect(dialog(page).getByRole('status')).toContainText(
      'kanban was added but is unavailable — WingFoil CLI not found',
      { timeout: COLD_READ_MS },
    );
    await expect(dialog(page).getByText(`Install it with: ${INSTALL}`)).toBeVisible();
    await expect(dialog(page).getByRole('textbox')).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeFocused();
    expect(await scanThemes(page)).toEqual([]);
    expect(new URL(page.url()).pathname).toBe('/');
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveCount(0);
    await openSwitcher(page);
    await expect(rows(page).first()).toHaveAccessibleName(/Unavailable — WingFoil CLI not found/, {
      timeout: COLD_READ_MS,
    });
  });
});
