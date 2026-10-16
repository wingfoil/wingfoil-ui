// task-039 — the repository status and Fetch in the sidebar on the real bin (US-Y-01 … US-Y-04,
// US-S-11; `repository-status.feature`, `fetch.feature`, `capabilities.feature` S-11.x; decisions
// D39-1 … D39-13). Every test runs on a fixture copy of its own with its own bare `origin`; the
// remote is moved "by someone else" from another clone (`support/remote.ts`). Every console seeds
// `autoFetch: false` (every real-bin console fetches every 60 s by default, task-034) except Y-02.1,
// which runs the scheduler at its minimum interval of 15 s (RP-53); the real 60 s / 65 s budget is
// measured by the same test under `npm run test:timing` (`@live-refresh`, Chromium).
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import type { UiSettings } from '@wingfoil-ui/contracts';
import type { Fixture, FixtureKind, MemberName } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { report } from '../timing/load.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock, STRICT_REFRESH } from './support/cold-read.js';
import { openConsole, type ConsoleOptions, type RunningConsole } from './support/console.js';
import { commitFile } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { startGitHttpRemote } from './support/git-http.js';
import { actAs } from './support/identity.js';
import { remoteCommit, setRemoteUrl } from './support/remote.js';

test.use({ prebuild: ['kanban', 'custom'] });

/** An origin nothing listens on (git: "Failed to connect"). */
const UNREACHABLE = 'http://127.0.0.1:9/kanban.git';

/** The default settings of these tests: no automatic fetch. */
const QUIET: Partial<UiSettings> = { autoFetch: false };

/** The sidebar's git status. */
const gitStatus = (page: Page): Locator => page.getByRole('region', { name: 'Git status' });
const fetchButton = (page: Page): Locator => gitStatus(page).getByRole('button', { name: 'Fetch', exact: true });

/** A copy of `kind` where the user is `name`, after `prepare` (git changes before the console starts). */
async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName,
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await actAs(fx, name);
  await prepare(fx);
  return fx;
}

/** Open `view` of the console's first project and wait for the header and the git status. */
async function openView(page: Page, c: RunningConsole, view = 'team'): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/${view}` });
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(gitStatus(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** Stage `count` new files: as many local changes in the working-tree status. */
async function stageFiles(fx: Fixture, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const file = `local-change-${i}.txt`;
    await writeFile(path.join(fx.dir, file), `edit ${i}\n`);
    await git(fx.dir, ['add', '--', file], fx.env);
  }
}

/** Click Fetch and wait for the answer of `POST …/git/fetch`. */
async function clickFetch(page: Page): Promise<{ status: number; body: unknown }> {
  const answer = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/git/fetch'),
    { timeout: COLD_READ_MS },
  );
  await fetchButton(page).click();
  const r = await answer;
  return { status: r.status(), body: await r.json().catch(() => undefined) };
}

/** How the page writes a time of today (D39-8), computed in the page with its own Intl. */
function timeInPage(page: Page, iso: string): Promise<string> {
  return page.evaluate((at) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(at)), iso);
}

/** Hover the info button of the failure line and return the tooltip (git's message, D39-4). */
async function openGitMessage(page: Page): Promise<Locator> {
  await gitStatus(page).getByRole('button', { name: "Git's message" }).first().hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  return tip;
}

async function start(
  consoles: { start(o?: ConsoleOptions): Promise<RunningConsole> },
  fx: Fixture,
  settings: Partial<UiSettings> = QUIET,
  env?: NodeJS.ProcessEnv,
): Promise<RunningConsole> {
  return consoles.start({ projects: [fx], settings, ...(env ? { env } : {}) });
}

test.describe('US-Y-01 — branch, ahead/behind and local changes', () => {
  test('Y-01.1 — Show branch, ahead/behind and local changes', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', async (f) => {
      await remoteCommit(f, 'outside-1.txt', 'one\n');
      await remoteCommit(f, 'outside-2.txt', 'two\n');
      await git(f.dir, ['fetch', '-q', 'origin'], f.env);
      await commitFile(f, 'mine.txt', 'mine\n', 'local work');
      await stageFiles(f, 3);
    });
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page).locator('.git-branch')).toHaveText('main');
    await expect(gitStatus(page)).toContainText('1 ahead');
    await expect(gitStatus(page)).toContainText('2 behind');
    await expect(gitStatus(page)).toContainText('3 local changes');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('Y-01.2 — Show an up-to-date copy', async ({ page, fixtures, consoles }) => {
    const c = await start(consoles, await copyAs(fixtures, 'kanban', 'Morgan'));
    await openView(page, c);
    await expect(gitStatus(page).locator('.git-branch')).toHaveText('main');
    await expect(gitStatus(page)).toContainText('In sync with git');
    await expect(gitStatus(page)).not.toContainText('local change');
  });

  test('a tall git status never pushes the views out (review R5)', async ({ page, fixtures, consoles }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    const c = await start(consoles, await copyAs(fixtures, 'kanban', 'Morgan'));
    await openView(page, c);
    // A git status taller than the sidebar (long error texts): the foot scrolls, the views stay.
    await gitStatus(page).evaluate((el) => {
      const filler = document.createElement('p');
      filler.style.height = '2000px';
      el.prepend(filler);
    });
    const box = (sel: string) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().height);
    expect(await box('.project-nav')).toBeGreaterThan(200);
    expect(await box('.sidebar-foot')).toBeLessThanOrEqual((await box('.project-sidebar')) / 2 + 1);
    await fetchButton(page).scrollIntoViewIfNeeded();
    await expect(fetchButton(page)).toBeInViewport();
    await expect(
      page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Today', exact: true }),
    ).toBeInViewport();
  });

  test('Y-01.3 — Show a detached HEAD', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', (f) => git(f.dir, ['checkout', '-q', '--detach'], f.env));
    const short = (await git(fx.dir, ['rev-parse', '--short=7', 'HEAD'], fx.env)).stdout.trim();
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page).locator('.git-head')).toHaveText(`Detached HEAD at ${short}`);
    expect(await scanThemes(page)).toEqual([]);
    // Governed actions are blocked with the reason (row 8 of task-033, the footer of task-037).
    await page.goto(`${c.origin}/p/${c.pids[0]}/e/task-001-login-form`, { timeout: COLD_READ_MS });
    const footer = page.locator('.drawer .element-footer');
    await expect(footer).toContainText('Blocked: no branch checked out', { timeout: COLD_READ_MS });
    for (const outcome of await footer.getByRole('button', { name: /→/ }).all()) {
      await expect(outcome).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(footer.getByRole('button', { name: /^Approve/ })).toHaveAccessibleDescription(
      'Blocked: no branch checked out',
    );
  });
});

test.describe('US-Y-02 — fetch automatically and on demand', () => {
  test('Y-02.1 — Fetch automatically', { tag: LIVE_REFRESH_TAG }, async ({ page, fixtures, consoles }) => {
    // RP-53: 15 s in the default gate; the real 60 s interval and its 65 s budget under test:timing.
    const interval = STRICT_REFRESH ? 60 : 15;
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await start(consoles, fx, { autoFetch: true, fetchIntervalSeconds: interval });
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('In sync with git');
    const t0 = Date.now();
    await remoteCommit(fx, 'outside.txt', 'pushed by someone else\n');
    await expect(gitStatus(page)).toContainText('1 behind', { timeout: interval * 1000 + COLD_READ_MS });
    if (STRICT_REFRESH) {
      const ms = Date.now() - t0;
      report('Y-02.1 remote commit → "1 behind" in the sidebar (budget 65000 ms)', `${ms} ms`);
      expect(ms).toBeLessThanOrEqual(65_000);
    }
  });

  test('Y-02.2 — Fetch on demand', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', (f) => remoteCommit(f, 'outside.txt', 'x\n'));
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('In sync with git');
    expect((await clickFetch(page)).status).toBe(200);
    await expect(gitStatus(page)).toContainText('1 behind', { timeout: COLD_READ_MS });
  });

  test('Y-02.3 — Do not fetch when auto-fetch is off', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    const trace = path.join(await mkdtemp(path.join(path.dirname(fx.dir), 'trace-')), 'git-trace.log');
    const interval = 15;
    const c = await start(consoles, fx, { autoFetch: false, fetchIntervalSeconds: interval }, { GIT_TRACE: trace });
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('In sync with git');
    await remoteCommit(fx, 'outside.txt', 'x\n');
    // The scenario is about time passing: two intervals and a margin (a stated fixed wait, D39-10).
    await page.waitForTimeout((2 * interval + 5) * 1000);
    await expect(gitStatus(page)).toContainText('In sync with git');
    await expect(gitStatus(page)).not.toContainText('behind');
    const lines = (await readFile(trace, 'utf8')).split('\n');
    expect(lines.filter((l) => /built-in: git fetch\b/.test(l))).toEqual([]);
    // Not vacuous: the trace holds the header's own status read.
    expect(lines.some((l) => /built-in: git status\b/.test(l))).toBe(true);
  });

  test('Fetch can be cancelled while it runs (RP-37, D39-13)', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    await git(fx.remoteDir, ['update-server-info'], fx.env);
    const remote = await startGitHttpRemote(path.dirname(fx.remoteDir), { hold: true });
    try {
      await setRemoteUrl(fx, `${remote.origin}/${path.basename(fx.remoteDir)}`);
      const c = await start(consoles, fx);
      await openView(page, c);
      await fetchButton(page).click();
      const busy = gitStatus(page).getByRole('button', { name: 'Fetching…' });
      await expect(busy).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
      await expect.poll(() => remote.requests(), { timeout: COLD_READ_MS }).toBeGreaterThan(0);
      // The "Fetching…" state in both themes (D39-12, review R4).
      expect(await scanThemes(page)).toEqual([]);
      await gitStatus(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(fetchButton(page)).toBeFocused();
      await expect(gitStatus(page).getByRole('button', { name: 'Cancel' })).toHaveCount(0);
      await expect(gitStatus(page).getByRole('alert')).toHaveCount(0);
      await expect(gitStatus(page)).not.toContainText('Fetch failed');
    } finally {
      remote.release();
      await remote.close();
    }
  });
});

test.describe('US-Y-03 — a failed fetch never blocks reading', () => {
  test('Y-03.1 — Report a failed fetch with the last successful time', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await start(consoles, fx);
    await openView(page, c);
    const ok = await clickFetch(page);
    expect(ok.status).toBe(200);
    const lastSuccessAt = (ok.body as { repository: { sync: { fetch: { lastSuccessAt: string } } } }).repository.sync
      .fetch.lastSuccessAt;
    await setRemoteUrl(fx, UNREACHABLE);
    expect((await clickFetch(page)).status).toBe(422);
    // Shown after the header is read again (review R1).
    await expect(gitStatus(page)).toContainText(
      `Fetch failed — last fetched at ${await timeInPage(page, lastSuccessAt)}`,
      { timeout: COLD_READ_MS },
    );
    const tip = await openGitMessage(page);
    await expect(tip).toContainText('unable to access');
    expect(await scanThemes(page)).toEqual([]);
    // Reading still works.
    await page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Memory' }).click();
    await expect(page.locator('.memory-row').first()).toBeVisible({ timeout: COLD_READ_MS });
  });

  test('Y-03.2 — Report a fetch refused for authentication', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    await git(fx.remoteDir, ['update-server-info'], fx.env);
    const remote = await startGitHttpRemote(path.dirname(fx.remoteDir), { credentials: 'u:secret' });
    try {
      await setRemoteUrl(fx, `${remote.origin}/${path.basename(fx.remoteDir)}`);
      const c = await start(consoles, fx);
      await openView(page, c);
      expect((await clickFetch(page)).status).toBe(422);
      await expect(gitStatus(page)).toContainText('Fetch failed', { timeout: COLD_READ_MS });
      const tip = await openGitMessage(page);
      await expect(tip).toContainText('could not read Username');
      // A press (a tap on a touch screen) opens the same message (review R6).
      await gitStatus(page).getByRole('button', { name: "Git's message" }).click();
      await expect(page.getByRole('dialog', { name: "Git's message" })).toContainText('could not read Username');
      await expect(gitStatus(page).getByRole('button', { name: "Git's message" })).toHaveAccessibleDescription(
        /could not read Username/,
      );
    } finally {
      await remote.close();
    }
  });
});

test.describe('US-Y-04 — no remote, no sync controls', () => {
  test('Y-04.1 — Hide sync controls without a remote', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', async (f) => {
      await git(f.dir, ['remote', 'remove', 'origin'], f.env);
      await stageFiles(f, 2);
    });
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page).locator('.git-branch')).toHaveText('main');
    await expect(gitStatus(page)).toContainText('2 local changes');
    await expect(page.getByRole('button', { name: /^(Fetch|Update|Push)$/ })).toHaveCount(0);
    await expect(gitStatus(page)).not.toContainText(/ahead|behind|In sync/);
    expect(await scanThemes(page)).toEqual([]);
  });

  test(
    'Y-04.2 — Show the controls once a remote is added',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const fx = await copyAs(fixtures, 'kanban', 'Morgan', (f) => git(f.dir, ['remote', 'remove', 'origin'], f.env));
      const c = await start(consoles, fx);
      await openView(page, c);
      await expect(fetchButton(page)).toHaveCount(0);
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      const clock = refreshClock();
      clock.start();
      await git(fx.dir, ['remote', 'add', 'origin', fx.remoteUrl], fx.env);
      await expect(fetchButton(page)).toBeVisible({ timeout: clock.timeout() });
      clock.done('Y-04.2 Fetch shown after git remote add');
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    },
  );
});

test.describe('US-S-11 — read-only with the reason, or hidden', () => {
  test('S-11.1 — Show a capability my role lacks as read-only with the reason', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await start(consoles, await copyAs(fixtures, 'custom', 'Jordan'));
    await openConsole(page, c, { path: `/p/${c.pids[0]}/e/dl-002-use-fastify` });
    const footer = page.locator('.drawer .element-footer');
    await expect(footer).toHaveText('Reserved to approver — Morgan, Alex can act', { timeout: COLD_READ_MS });
    await expect(footer.getByRole('button')).toHaveCount(0);
  });

  test('S-11.2 — Hide a capability that does not apply to the project', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', (f) => git(f.dir, ['remote', 'remove', 'origin'], f.env));
    const c = await start(consoles, fx);
    await openView(page, c, 'today');
    await expect(page.locator('.today').getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
    await expect(page.getByRole('button', { name: /^(Push|Fetch|Update)$/ })).toHaveCount(0);
  });
});
