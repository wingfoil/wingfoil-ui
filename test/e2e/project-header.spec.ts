// task-016 — the project header on the real bin (US-S-08, US-S-09, US-S-12, US-S-13, US-S-14,
// US-S-15, US-S-22; decisions W4-16…W4-22): the WingFoil version line and its notice in the
// "Project header" strip, the current user and the role view at the right end of the global header,
// the read-only notices. The user of a scenario is the fixture copy's `git config user.email`
// (`actAs`); the version-fake variant (`installCliStub`) pins another version; the PATH variant
// removes the project's CLI and installs the pinned one globally. Live changes (S-12.3, S-13.3,
// S-15.3) are waited for with `refreshClock` (COLD_READ_MS by default, 5 s under `test:timing`).
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { ElementList, ProjectHeader } from '@wingfoil-ui/contracts';
import { PINNED_PACKAGE_DIR } from '../harness/cli.js';
import { envWithoutWingfoil, installCliStub, removeCli, type Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { installGlobally, withPathFirst } from '../server/cli/fake-cli.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, commitFile } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible } from './support/keyboard.js';
import { openSwitcher, rows } from './support/switcher.js';

test.use({ prebuild: ['kanban', 'custom'] });

const RANGE = 'supported 0.2.2 to 0.2.x';

/** The "Project header" strip above the view. */
const strip = (page: Page): Locator => page.getByRole('main').getByRole('region', { name: 'Project header' });

/** The version line of the strip. */
const versionLine = (page: Page): Locator => strip(page).locator('.project-version');

/** The current user at the right end of the global header. */
const currentUser = (page: Page): Locator => page.getByRole('banner').getByRole('group', { name: /^Current user: / });

/** The role view selector's button (React Aria names it by the value, then the label). */
const roleView = (page: Page): Locator => page.getByRole('banner').getByRole('button', { name: /Role view$/ });

/** The read-only notices of the strip. */
const notices = (page: Page): Locator => strip(page).locator('.project-notice');

/** The next `GET /api/p/:pid` (the header) the page completes, with its body. */
async function nextHeaderRead(page: Page, pid: string): Promise<ProjectHeader> {
  const request = await page.waitForEvent('requestfinished', {
    predicate: (r) => r.method() === 'GET' && new URL(r.url()).pathname === `/api/p/${pid}`,
    timeout: COLD_READ_MS,
  });
  const response = (await request.response())!;
  expect(response.status()).toBe(200);
  return (await response.json()) as ProjectHeader;
}

/** Open the view `view` of the console's project `i` and wait for its header (a cold read). */
async function openProject(page: Page, c: RunningConsole, view = 'memory', i = 0): Promise<ProjectHeader> {
  const read = nextHeaderRead(page, c.pids[i]!);
  await openConsole(page, c, { path: `/p/${c.pids[i]}/${view}` });
  const header = await read;
  await expectFirstLoad(currentUser(page));
  return header;
}

/** Pick `role` in the open project's role view selector and wait for the PUT and the header read after it. */
async function pickRole(page: Page, pid: string, role: string): Promise<ProjectHeader> {
  const put = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/p/${pid}/role-view`,
    { timeout: COLD_READ_MS },
  );
  await roleView(page).click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const reread = nextHeaderRead(page, pid);
  await listbox.getByRole('option', { name: role, exact: true }).click();
  expect((await put).status()).toBe(204);
  const header = await reread;
  expect(header.roleView).toBe(role);
  await expect(roleView(page)).toHaveAccessibleName(`${role} Role view`);
  return header;
}

/** The PATH of a console that finds no `wingfoil` but the pinned one installed globally (npm -g layout). */
async function pathWithGlobalCli(testInfo: TestInfo, fx: Fixture): Promise<string> {
  const bin = await installGlobally(testInfo.outputPath('global'), PINNED_PACKAGE_DIR);
  const env = withPathFirst(await envWithoutWingfoil(fx.env, testInfo.outputPath('safe-bin')), bin);
  return env['PATH']!;
}

/** Add the local folder `dir` through the start page's Add project dialog (task-014). */
async function addLocalFolder(page: Page, c: RunningConsole, dir: string): Promise<string> {
  await openConsole(page, c);
  const add = page.getByRole('main').getByRole('button', { name: 'Add project…' });
  await expectFirstLoad(add);
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'Add project' });
  await dialog.getByRole('textbox', { name: 'Folder path', exact: true }).fill(dir);
  const added = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects',
    { timeout: COLD_READ_MS },
  );
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  const response = await added;
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  await expect(dialog).toHaveCount(0, { timeout: COLD_READ_MS });
  return id;
}

/** Run the pinned CLI on `fx` with JSON output and no prompt. */
async function wingfoil(fx: Fixture, args: readonly string[]): Promise<void> {
  await cli(fx, ['--format', 'json', ...args, '--no-interactive']);
}

/** Replace the DNA member `name` by one with `email` and `roles` (with the CLI, as in a terminal). */
async function setMember(fx: Fixture, name: string, email: string, roles: readonly string[]): Promise<void> {
  await wingfoil(fx, ['dna', 'remove', 'team.members', '--value', name]);
  await wingfoil(fx, [
    'dna',
    'add',
    'team.members',
    '--value',
    name,
    '--entry-email',
    email,
    '--entry-roles',
    roles.join(','),
  ]);
}

/** Mark the page so that a reload would be seen (the live scenarios refresh without one). */
async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
}

async function expectNoReload(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
}

/** The sidebar views and their headings. */
const VIEWS = [
  ['Memory', 'Memory'],
  ['DNA', 'DNA'],
  ['Directives', 'Directives'],
  ['Team', 'Team'],
  ['Documentation', 'Documentation'],
] as const;

/** Open every view from the sidebar; `check` runs on each once its heading shows. */
async function visitViews(page: Page, check: (view: string) => Promise<void>): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Project views' });
  for (const [link, heading] of VIEWS) {
    await nav.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible({
      timeout: COLD_READ_MS,
    });
    await check(link);
  }
}

/** A governed action control (the descriptor verbs; v0.1 renders none, W4-21). */
const GOVERNED = /^(submit|approve|reject)\b/i;

test.describe('US-S-08 — version and missing capabilities', () => {
  test('S-08.1 — Show the version on add, nothing missing', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.get('kanban');
    const c = await consoles.start();
    await addLocalFolder(page, c, kanban.dir);
    // The project opens on its Memory list with the header (its first, cold read).
    await expect(versionLine(page)).toHaveText('WingFoil 0.2.2', { timeout: COLD_READ_MS });
    await expect(strip(page).getByText('Every capability of this release is available', { exact: true })).toBeVisible();
    await expect(notices(page)).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-08.2 — Use the CLI on the PATH when the project pins none', async ({
    page,
    fixtures,
    consoles,
  }, testInfo) => {
    const kanban = await fixtures.copy('kanban');
    await removeCli(kanban);
    const c = await consoles.start({ env: { PATH: await pathWithGlobalCli(testInfo, kanban) } });
    await addLocalFolder(page, c, kanban.dir);
    await expect(versionLine(page)).toHaveText('WingFoil 0.2.2 (from PATH)', { timeout: COLD_READ_MS });
    await expect(strip(page).getByText('Every capability of this release is available', { exact: true })).toBeVisible();
  });
});

test.describe('US-S-09 — version outside the supported range', () => {
  test('S-09.1 — Open a project with a newer, untested CLI read-only', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Alex');
    await installCliStub(kanban, { version: '0.4.0' });
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    const elements = page.waitForResponse(
      (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === `/api/p/${pid}/elements`,
      { timeout: COLD_READ_MS },
    );
    const header = await openProject(page, c);
    expect(header.wingfoil).toMatchObject({ version: '0.4.0', state: 'above', inRange: false });
    await expect(versionLine(page)).toHaveText(`WingFoil 0.4.0 — read-only: ${RANGE}`);
    await expect(strip(page).getByText('Every capability of this release is available')).toHaveCount(0);
    // Every verb of every element disabled for the version (W4-21) …
    const list = (await (await elements).json()) as ElementList;
    const verbs = list.elements.flatMap((e) => e.descriptor?.verbs ?? []);
    expect(verbs.length).toBeGreaterThan(0);
    for (const v of verbs) expect(v).toMatchObject({ enabled: false, reason: { code: 'version-unsupported' } });
    // … and no governed action on any screen: every view, then the element panel.
    await visitViews(page, async () => {
      await expect(versionLine(page)).toHaveText(`WingFoil 0.4.0 — read-only: ${RANGE}`);
      await expect(page.getByRole('button', { name: GOVERNED })).toHaveCount(0);
    });
    await page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Memory' }).click();
    await page
      .getByRole('link', { name: /Login form/ })
      .first()
      .click();
    const panel = page.getByRole('dialog');
    await expectFirstLoad(panel.locator('.type-tag'));
    await expect(panel.getByRole('button', { name: GOVERNED })).toHaveCount(0);
    await expect(page.getByRole('button', { name: GOVERNED })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Close' }).click();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-09.2 — Open a project with an older CLI read-only', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await installCliStub(kanban, { version: '0.2.0' });
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.wingfoil).toMatchObject({ version: '0.2.0', state: 'below', inRange: false });
    await expect(versionLine(page)).toHaveText(`WingFoil 0.2.0 — read-only: ${RANGE}`);
  });
});

test.describe('US-S-12 — recognised from git', () => {
  test('S-12.1 — Recognise a single-role member', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Jordan');
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toMatchObject({ kind: 'member', name: 'Jordan' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Jordan, developer');
    await expect(currentUser(page).getByText('Jordan', { exact: true })).toBeVisible();
    await expect(currentUser(page).getByText('developer', { exact: true })).toBeVisible();
    await expect(roleView(page)).toHaveCount(0);
    await expect(notices(page)).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-12.2 — Match the email regardless of letter case', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await git(kanban.dir, ['config', 'user.email', 'Jordan@Example.TEST'], kanban.env);
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toMatchObject({ kind: 'member', name: 'Jordan' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Jordan, developer');
    await expect(currentUser(page).getByText('Jordan', { exact: true })).toBeVisible();
  });

  test('S-12.3 — Follow a change of git email', { tag: LIVE_REFRESH_TAG }, async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Jordan');
    const c = await consoles.start({ projects: [kanban] });
    await openProject(page, c);
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Jordan, developer');
    await markNoReload(page);
    const clock = refreshClock();
    clock.start();
    await git(kanban.dir, ['config', 'user.email', 'morgan@example.test'], kanban.env);
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Morgan', { timeout: clock.timeout() });
    clock.done('S-12.3 current user Morgan');
    await expect(currentUser(page).getByText('Morgan', { exact: true })).toBeVisible();
    // Morgan holds two roles: the selector appears with the first one.
    await expect(roleView(page)).toHaveAccessibleName('approver Role view');
    await expectNoReload(page);
  });
});

test.describe('US-S-13 — not in team', () => {
  test('S-13.1 — Mark a user who is not in the team', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Riley');
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toEqual({ kind: 'not-in-team', email: 'riley@example.test' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: riley@example.test, not in team');
    await expect(currentUser(page).getByText('riley@example.test', { exact: true })).toBeVisible();
    await expect(currentUser(page).getByText('not in team', { exact: true })).toBeVisible();
    // The notice's sentence, then its *How to join* button (task-035, D35-2).
    await expect(notices(page).locator('p')).toHaveText([
      'Read-only: riley@example.test is not in the team of this project.',
    ]);
    await expect(notices(page).getByRole('button', { name: 'How to join' })).toBeVisible();
    await expect(currentUser(page).getByRole('button', { name: 'Not in team — how to join' })).toBeVisible();
    await expect(roleView(page)).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
    // Every view opens, the badge stays.
    await visitViews(page, async () => {
      await expect(currentUser(page).getByText('not in team', { exact: true })).toBeVisible();
    });
  });

  test(
    'S-13.3 — Mark a member removed from the team',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const kanban = await fixtures.copy('kanban');
      await actAs(kanban, 'Jordan');
      const c = await consoles.start({ projects: [kanban] });
      await openProject(page, c);
      await expect(currentUser(page)).toHaveAccessibleName('Current user: Jordan, developer');
      await markNoReload(page);
      const clock = refreshClock();
      clock.start();
      await wingfoil(kanban, ['dna', 'remove', 'team.members', '--value', 'Jordan']);
      await expect(currentUser(page)).toHaveAccessibleName('Current user: jordan@example.test, not in team', {
        timeout: clock.timeout(),
      });
      clock.done('S-13.3 not in team');
      await expect(currentUser(page).getByText('not in team', { exact: true })).toBeVisible();
      await expect(notices(page).locator('p')).toHaveText([
        'Read-only: jordan@example.test is not in the team of this project.',
      ]);
      await expectNoReload(page);
    },
  );
  test('W4-22 — Say the team is unknown when the DNA cannot be read', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Jordan');
    // YAML the CLI cannot parse (an unclosed flow sequence), as in S-27.1.
    await commitFile(
      kanban,
      '.wingfoil/dna.yaml',
      'version: 1\nmodules: [\n  - name: broken\n',
      'chore: break the DNA',
    );
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.dnaError).toBeDefined();
    expect(header.identity).toEqual({ kind: 'not-in-team', email: 'jordan@example.test' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: jordan@example.test, team unknown');
    await expect(currentUser(page).getByText('team unknown', { exact: true })).toBeVisible();
    await expect(currentUser(page).getByText('not in team')).toHaveCount(0);
    await expect(notices(page)).toHaveText(['Read-only: the DNA could not be read, so the team is unknown.']);
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('US-S-14 — no git email', () => {
  test('S-14.1 — Open read-only when git has no email', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await git(kanban.dir, ['config', '--unset-all', 'user.email'], kanban.env);
    await git(kanban.dir, ['config', '--global', '--unset-all', 'user.email'], kanban.env).catch(() => undefined);
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toEqual({ kind: 'no-identity' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: no identity');
    await expect(currentUser(page).getByText('No identity', { exact: true })).toBeVisible();
    await expect(notices(page)).toHaveText([
      'Read-only: git has no user.email for this project. Set it with: git config user.email <your email>',
    ]);
    await expect(notices(page).locator('code')).toHaveText('git config user.email <your email>');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-14.2 — Use the global git email when the repository sets none', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await git(kanban.dir, ['config', '--unset-all', 'user.email'], kanban.env);
    await git(kanban.dir, ['config', '--global', 'user.email', 'casey@example.test'], kanban.env);
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toMatchObject({ kind: 'member', name: 'Casey' });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Casey, product-owner');
    await expect(currentUser(page).getByText('Casey', { exact: true })).toBeVisible();
  });
});

test.describe('US-S-15 — ambiguous identity', () => {
  /** A kanban copy whose DNA gives Jordan and Sam the same email, used by git. */
  async function shared(fixtures: { copy(kind: 'kanban'): Promise<Fixture> }): Promise<Fixture> {
    const kanban = await fixtures.copy('kanban');
    await setMember(kanban, 'Jordan', 'shared@example.test', ['developer']);
    await setMember(kanban, 'Sam', 'shared@example.test', ['reviewer']);
    await git(kanban.dir, ['config', 'user.email', 'shared@example.test'], kanban.env);
    return kanban;
  }

  test('S-15.1 — Open read-only when the email matches two members', async ({ page, fixtures, consoles }) => {
    const kanban = await shared(fixtures);
    const c = await consoles.start({ projects: [kanban] });
    const header = await openProject(page, c);
    expect(header.identity).toEqual({ kind: 'ambiguous', email: 'shared@example.test', members: ['Jordan', 'Sam'] });
    await expect(currentUser(page)).toHaveAccessibleName('Current user: shared@example.test, ambiguous identity');
    await expect(currentUser(page).getByText('Ambiguous identity', { exact: true })).toBeVisible();
    await expect(notices(page)).toHaveText([
      'Read-only: shared@example.test matches 2 members: Jordan, Sam. Give each member an email of their own in the DNA.',
    ]);
    await expect(roleView(page)).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test(
    'S-15.3 — Recognise the member once the DNA is fixed',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const kanban = await shared(fixtures);
      const c = await consoles.start({ projects: [kanban] });
      await openProject(page, c);
      await expect(currentUser(page)).toHaveAccessibleName('Current user: shared@example.test, ambiguous identity');
      await markNoReload(page);
      const clock = refreshClock();
      clock.start();
      await setMember(kanban, 'Sam', 'sam@example.test', ['reviewer']);
      await expect(currentUser(page)).toHaveAccessibleName('Current user: Jordan, developer', {
        timeout: clock.timeout(),
      });
      clock.done('S-15.3 current user Jordan');
      await expect(notices(page)).toHaveCount(0);
      await expectNoReload(page);
    },
  );
});

test.describe('US-S-22 — role views', () => {
  test('S-22.1 — Switch role view', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Alex');
    const all = (
      JSON.parse(await cli(kanban, ['--format', 'json', 'directives', 'list'])) as {
        entries: { frontmatter: { id: string }; roles: string[]; global: boolean }[];
      }
    ).entries;
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    await openProject(page, c, 'directives');
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Alex');
    // Given the role view "approver" (picked by keyboard: the selector opens on the current role).
    const put = page.waitForResponse((r) => r.request().method() === 'PUT', { timeout: COLD_READ_MS });
    await roleView(page).focus();
    await expectFocusVisible(roleView(page));
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option', { name: 'tech-lead', exact: true })).toBeFocused();
    const approver = listbox.getByRole('option', { name: 'approver', exact: true });
    for (let i = 0; i < 10 && !(await approver.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(approver).toBeFocused();
    const reread = nextHeaderRead(page, pid);
    await page.keyboard.press('Enter');
    expect((await put).status()).toBe(204);
    expect((await reread).roleView).toBe('approver');
    await expect(roleView(page)).toHaveAccessibleName('approver Role view');
    // The approver's header and directives re-reads are over (the selector is enabled again only
    // when the mutation settled, review R2) before waiting for the developer's directives.
    await expect(roleView(page)).toBeEnabled({ timeout: COLD_READ_MS });
    // When the role view "developer" is selected, the directives are read again for it.
    const directives = page.waitForEvent('requestfinished', {
      predicate: (r) => r.method() === 'GET' && new URL(r.url()).pathname === `/api/p/${pid}/directives`,
      timeout: COLD_READ_MS,
    });
    await pickRole(page, pid, 'developer');
    const read = (await (await (await directives).response())!.json()) as {
      entries: { frontmatter: { id: string }; mine: boolean }[];
    };
    const expected = all.filter((e) => e.global || e.roles.includes('developer')).map((e) => e.frontmatter.id);
    expect(read.entries.filter((e) => e.mine).map((e) => e.frontmatter.id)).toEqual(expected);
    // "only mine" shows the directives bound to developer (and the global ones).
    await expect(page.getByRole('radio', { name: 'Only mine' })).toBeChecked();
    const shown = page.getByRole('list', { name: 'Directives', exact: true }).locator('.directive-row');
    await expect
      .poll(() => shown.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['directive'] ?? '')))
      .toEqual(expected);
  });

  test('S-22.2 — Offer only the roles the member holds', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await actAs(kanban, 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openProject(page, c);
    await expect(currentUser(page)).toHaveAccessibleName('Current user: Morgan');
    await roleView(page).focus();
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toHaveText(['approver', 'tech-lead']);
    await expect(page.getByText('You hold several roles: choose the view', { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expectFocusVisible(roleView(page));
  });

  test('S-22.3 — Keep the role view per project', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const custom = await fixtures.copy('custom');
    await actAs(kanban, 'Alex');
    await actAs(custom, 'Alex');
    const c = await consoles.start({ projects: [kanban, custom] });
    const [kanbanId, customId] = c.pids as [string, string];
    await openProject(page, c);
    await pickRole(page, kanbanId, 'developer');
    // The custom fixture open with the role view "approver".
    await openSwitcher(page);
    const customRead = nextHeaderRead(page, customId);
    await rows(page).filter({ hasText: 'custom' }).click();
    await customRead;
    await pickRole(page, customId, 'approver');
    // Switch back to kanban: its role view is developer.
    await openSwitcher(page);
    await rows(page).filter({ hasText: 'kanban' }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${kanbanId}/`));
    await expect(roleView(page)).toHaveAccessibleName('developer Role view');
    // Not from the page's cache: fresh pages read both from the console.
    const kanbanPage = await page.context().newPage();
    const kanbanHeader = await openProject(kanbanPage, c);
    expect(kanbanHeader.roleView).toBe('developer');
    await expect(roleView(kanbanPage)).toHaveAccessibleName('developer Role view');
    const customPage = await page.context().newPage();
    const customHeader = await openProject(customPage, c, 'memory', 1);
    expect(customHeader.roleView).toBe('approver');
    await expect(roleView(customPage)).toHaveAccessibleName('approver Role view');
  });
});
