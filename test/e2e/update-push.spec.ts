// task-040 — Update and Push from the sidebar on the real bin (US-Y-05 … US-Y-08, US-G-12;
// `update.feature`, `push.feature`, `blocked-actions.feature` G-12.x; decisions D40-1 … D40-12).
// Every test runs on a kanban copy of its own as Morgan, with its own bare `origin`; the remote is
// moved "by someone else" from another clone (`support/remote.ts`), and the copy's and the remote's
// git state are read with git. Every console seeds `autoFetch: false` (a real-bin console fetches
// every 60 s by default, task-034) except Y-05.2, which runs the scheduler at its minimum interval of
// 15 s (RP-53; the real 60 s / 65 s budget under `npm run test:timing`, `@live-refresh`, Chromium), and
// Y-07.2, whose settings were never changed. Every first read is waited for with `COLD_READ_MS`.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Locator, Page } from '@playwright/test';
import type { UiSettings } from '@wingfoil-ui/contracts';
import type { Fixture, FixtureKind } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { report } from '../timing/load.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, STRICT_REFRESH } from './support/cold-read.js';
import { openConsole, type ConsoleOptions, type RunningConsole } from './support/console.js';
import { commitFile, lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';
import { fetchCopy, remoteCommit, remoteHead, remoteHook } from './support/remote.js';

test.use({ prebuild: ['kanban'] });

/** The default settings of these tests: no automatic fetch (auto-push off by default). */
const QUIET: Partial<UiSettings> = { autoFetch: false };

const TASK_001 = 'docs/memory/task/task-001-login-form.md';
const TASK_003 = 'docs/memory/task/task-003-logout.md';
const APPROVE_SUBJECT = 'wf(task): approve task-001-login-form [pending → approved]';

const gitStatus = (page: Page): Locator => page.getByRole('region', { name: 'Git status' });
const syncButton = (page: Page, name: string): Locator => gitStatus(page).getByRole('button', { name, exact: true });
const drawer = (page: Page): Locator => page.locator('.drawer');
const gate = (page: Page): Locator => drawer(page).getByRole('region', { name: 'Decision' });
const reasonField = (page: Page): Locator =>
  gate(page).getByRole('textbox', { name: 'Reason, recorded in the commit' });
const approve = (page: Page): Locator => gate(page).getByRole('button', { name: 'Approve → approved', exact: true });
const politeToasts = (page: Page): Locator => page.locator('.toasts [aria-live="polite"]');
const assertiveToasts = (page: Page): Locator => page.locator('.toasts [aria-live="assertive"]');

/** A kanban copy where the user is Morgan, after `prepare` (git changes before the console starts). */
async function copy(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy('kanban');
  await actAs(fx, 'Morgan');
  await prepare(fx);
  return fx;
}

async function start(
  consoles: { start(o?: ConsoleOptions): Promise<RunningConsole> },
  fx: Fixture,
  settings: Partial<UiSettings> | undefined = QUIET,
): Promise<RunningConsole> {
  return consoles.start({ projects: [fx], ...(settings ? { settings } : {}) });
}

/** Open `view` of the console's first project; wait for the header and the git status. */
async function openView(page: Page, c: RunningConsole, view = 'team'): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/${view}` });
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(gitStatus(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** Open the element panel of task-001-login-form (its gate footer). */
async function openTask001(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}/e/task-001-login-form` });
  await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(gitStatus(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** Approve task-001-login-form from its open gate footer. */
async function approveFromUi(page: Page): Promise<void> {
  await reasonField(page).fill('OK', { timeout: COLD_READ_MS });
  await approve(page).click();
}

async function head(fx: Fixture): Promise<string> {
  return (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
}

/** The remote's `main` as the copy last fetched it. */
async function trackingHead(fx: Fixture): Promise<string> {
  return (await git(fx.dir, ['rev-parse', 'refs/remotes/origin/main'], fx.env)).stdout.trim();
}

/** `git status --porcelain` of the copy. */
async function porcelain(fx: Fixture): Promise<string> {
  return (await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout;
}

/** The current content of `file` in the copy, with one more line (a valid element stays valid). */
async function withLine(fx: Fixture, file: string, line: string): Promise<string> {
  return `${await readFile(path.join(fx.dir, file), 'utf8')}\n${line}\n`;
}

/** Click a sync button and wait for the answer of `POST …/git/<op>`. */
async function clickAndAnswer(page: Page, button: Locator, op: string): Promise<number> {
  const answer = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/git/${op}`),
    { timeout: COLD_READ_MS },
  );
  await button.click();
  return (await answer).status();
}

/** `target` is the element a pointer reaches at its centre (nothing, a toast included, covers it). */
async function expectOnTop(page: Page, target: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      if (!box) return false;
      const handle = await target.elementHandle();
      return page.evaluate(
        ([x, y, t]) => {
          const hit = document.elementFromPoint(x, y);
          return hit !== null && (hit === t || t.contains(hit));
        },
        [box.x + box.width / 2, box.y + box.height / 2, handle] as const,
      );
    })
    .toBe(true);
}

/** Whether a process whose command line holds `pattern` runs. */
async function running(pattern: string): Promise<boolean> {
  return promisify(execFile)('pgrep', ['-f', pattern]).then(
    () => true,
    () => false,
  );
}

test.describe('US-Y-05 — update fast-forward', () => {
  test('Y-05.1 — Update a copy that is behind', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, 'outside-1.txt', 'one\n');
      await remoteCommit(f, 'outside-2.txt', 'two\n');
      await fetchCopy(f);
    });
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('2 behind');
    const update = syncButton(page, 'Update');
    await expect(update).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    // Hold the request at the page to scan the running state, then let it go (D40-4).
    let release: () => void = () => {};
    await page.route('**/git/update', async (route) => {
      await new Promise<void>((r) => (release = r));
      await route.continue();
    });
    await update.click();
    await expect(syncButton(page, 'Updating…')).toHaveAttribute('aria-disabled', 'true');
    await expect(syncButton(page, 'Fetch')).toHaveAttribute('aria-disabled', 'true');
    await expect(syncButton(page, 'Cancel')).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
    const answer = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/git/update'), {
      timeout: COLD_READ_MS,
    });
    release();
    expect((await answer).status()).toBe(200);
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    // A fast-forward to the remote's commit: no merge commit (bug-014's hardened pull, D34-2).
    expect(await head(fx)).toBe(await remoteHead(fx));
    await expect(syncButton(page, 'Update')).toHaveCount(0);
  });

  test(
    'Y-05.2 — Update automatically after a fetch',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      // RP-53: 15 s in the default gate; the real 60 s interval and its 65 s budget under test:timing.
      const interval = STRICT_REFRESH ? 60 : 15;
      const fx = await copy(fixtures);
      const c = await start(consoles, fx, { autoFetch: true, autoUpdate: true, fetchIntervalSeconds: interval });
      await openView(page, c);
      await expect(gitStatus(page)).toContainText('In sync with git');
      const t0 = Date.now();
      await remoteCommit(fx, 'outside.txt', 'pushed by someone else\n');
      const remote = await remoteHead(fx);
      await expect.poll(() => head(fx), { timeout: interval * 1000 + COLD_READ_MS }).toBe(remote);
      if (STRICT_REFRESH) {
        const ms = Date.now() - t0;
        report("Y-05.2 remote commit → the copy's HEAD at it (budget 65000 ms)", `${ms} ms`);
        expect(ms).toBeLessThanOrEqual(65_000);
      }
      await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    },
  );

  test('Y-05.3 — Update with local changes that do not touch the incoming files', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, TASK_003, await withLine(f, TASK_003, 'An edit from someone else.'));
      await fetchCopy(f);
      await writeFile(path.join(f.dir, 'README.md'), await withLine(f, 'README.md', 'My uncommitted edit.'));
    });
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('1 behind');
    expect(await clickAndAnswer(page, syncButton(page, 'Update'), 'update')).toBe(200);
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    expect(await head(fx)).toBe(await remoteHead(fx));
    expect(await porcelain(fx)).toBe(' M README.md\n');
    expect(await readFile(path.join(fx.dir, 'README.md'), 'utf8')).toContain('My uncommitted edit.');
  });
});

test.describe('US-Y-06 — an update that cannot fast-forward', () => {
  test('Y-06.1 — Refuse to merge diverged histories', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, 'outside.txt', 'theirs\n');
      await fetchCopy(f);
      await commitFile(f, 'mine.txt', 'mine\n', 'local work');
    });
    const before = await head(fx);
    const c = await start(consoles, fx);
    await openTask001(page, c);
    await expect(gitStatus(page)).toContainText('1 ahead · 1 behind');
    expect(await clickAndAnswer(page, syncButton(page, 'Update'), 'update')).toBe(409);
    await expect(gitStatus(page)).toContainText(
      'Cannot fast-forward: your copy and the remote have diverged — run git pull --rebase or git merge in a terminal',
      { timeout: COLD_READ_MS },
    );
    expect(await head(fx)).toBe(before);
    // Governed actions stay blocked (row 8, the descriptor's copy reason).
    await expect(gate(page)).toContainText('Blocked: your copy has diverged from the remote');
    await expect(approve(page)).toHaveAttribute('aria-disabled', 'true');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('Y-06.2 — Refuse an update that local changes are in the way of', async ({ page, fixtures, consoles }) => {
    let edited = '';
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, TASK_001, await withLine(f, TASK_001, 'An edit from someone else.'));
      await fetchCopy(f);
      edited = await withLine(f, TASK_001, 'My uncommitted edit.');
      await writeFile(path.join(f.dir, TASK_001), edited);
    });
    const before = await head(fx);
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('1 behind');
    expect(await clickAndAnswer(page, syncButton(page, 'Update'), 'update')).toBe(409);
    await expect(gitStatus(page)).toContainText(
      'Cannot fast-forward: local changes to task-001-login-form.md are in the way — commit or stash them in a terminal',
      { timeout: COLD_READ_MS },
    );
    expect(await head(fx)).toBe(before);
    expect(await readFile(path.join(fx.dir, TASK_001), 'utf8')).toBe(edited);
  });
});

test.describe('US-Y-07 — push with the button or automatically', () => {
  test('Y-07.1 — Push with the button', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures);
    const c = await start(consoles, fx);
    await openTask001(page, c);
    await approveFromUi(page);
    await expect(gitStatus(page)).toContainText('1 commit to push', { timeout: COLD_READ_MS });
    await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(APPROVE_SUBJECT);
    expect(await clickAndAnswer(page, syncButton(page, 'Push'), 'push')).toBe(200);
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    expect(await remoteHead(fx)).toBe(await head(fx));
    await expect(syncButton(page, 'Push')).toHaveCount(0);
  });

  test('Y-07.2 — Keep auto-push off by default', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures);
    const remoteBefore = await remoteHead(fx);
    // "The UI settings have never been changed": nothing seeded.
    const c = await start(consoles, fx, undefined);
    await openTask001(page, c);
    await approveFromUi(page);
    await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(APPROVE_SUBJECT);
    await expect(gitStatus(page)).toContainText('1 commit to push', { timeout: COLD_READ_MS });
    await expect(syncButton(page, 'Push')).toBeVisible();
    expect(await remoteHead(fx)).toBe(remoteBefore);
    // The approval commit is not on the remote's branch.
    const contains = await git(fx.remoteDir, ['branch', '--contains', await head(fx)], fx.env).then(
      (r) => r.stdout.trim(),
      () => '',
    );
    expect(contains).toBe('');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('Y-07.3 — Push automatically after a UI action', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures);
    const c = await start(consoles, fx, { ...QUIET, autoPush: true });
    await openTask001(page, c);
    await approveFromUi(page);
    await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(APPROVE_SUBJECT);
    await expect.poll(() => remoteHead(fx), { timeout: COLD_READ_MS }).toBe(await head(fx));
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
  });

  test('Push can be cancelled while it runs (RP-37, D40-4)', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, (f) => commitFile(f, 'mine.txt', 'mine\n', 'local work'));
    // Holds every push until a file the test never writes appears (bounded: about 2 minutes).
    const hook = await remoteHook(
      fx,
      'i=0; while [ ! -f released ] && [ "$i" -lt 600 ]; do sleep 0.2; i=$((i+1)); done; exit 1',
    );
    const remoteBefore = await remoteHead(fx);
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('1 commit to push');
    await syncButton(page, 'Push').click();
    await expect(syncButton(page, 'Pushing…')).toHaveAttribute('aria-disabled', 'true');
    await expect.poll(() => running(hook), { timeout: COLD_READ_MS }).toBe(true);
    expect(await scanThemes(page)).toEqual([]);
    await syncButton(page, 'Cancel').click();
    await expect(syncButton(page, 'Push')).toBeFocused({ timeout: COLD_READ_MS });
    await expect(syncButton(page, 'Cancel')).toHaveCount(0);
    // The process group is gone (the hook with it); the remote is untouched; nothing is shown.
    await expect.poll(() => running(hook), { timeout: COLD_READ_MS }).toBe(false);
    expect(await remoteHead(fx)).toBe(remoteBefore);
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(gitStatus(page).getByRole('alert')).toHaveCount(0);
    await expect(gitStatus(page)).toContainText('1 commit to push');
  });

  test('Update and Push with the keyboard only, the focus kept (D40-4)', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, (f) => commitFile(f, 'mine.txt', 'mine\n', 'local work'));
    const c = await start(consoles, fx);
    await openView(page, c);
    const push = syncButton(page, 'Push');
    await tabUntil(page, push);
    await expectFocusVisible(push);
    await page.keyboard.press('Enter');
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    // Push went with the new state: the focus is on Fetch, not lost to the page.
    await expectFocusVisible(syncButton(page, 'Fetch'));
    expect(await remoteHead(fx)).toBe(await head(fx));
    await remoteCommit(fx, 'outside.txt', 'theirs\n');
    await page.keyboard.press('Enter');
    const update = syncButton(page, 'Update');
    await expect(update).toBeVisible({ timeout: COLD_READ_MS });
    await page.keyboard.press('Tab');
    await expectFocusVisible(update);
    await page.keyboard.press('Enter');
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });
    await expectFocusVisible(syncButton(page, 'Fetch'));
    expect(await head(fx)).toBe(await remoteHead(fx));
  });
});

test.describe('US-Y-08 — a rejected push', () => {
  test('Y-08.1 — Report a push rejected because the remote moved', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, (f) => remoteCommit(f, 'outside.txt', 'theirs\n'));
    const c = await start(consoles, fx, { ...QUIET, autoPush: true });
    await openTask001(page, c);
    await approveFromUi(page);
    // The write's toast (task-038 D38-4, D40-6): polite and sticky, "Not pushed" in red, git's text.
    const toast = politeToasts(page).locator('.toast').filter({ hasText: 'Approved task-001-login-form' });
    await expect(toast).toBeVisible({ timeout: COLD_READ_MS });
    const attention = toast.locator('.toast-attention');
    await expect(attention).toHaveText('Not pushed — the commit stays local');
    const [colour, expected] = await attention.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--tone-attention-fg)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(el).color, want];
    });
    expect(colour).toBe(expected);
    await expect(toast.locator('pre.verbatim')).toContainText('[rejected]');
    await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(APPROVE_SUBJECT);
    await expect(gitStatus(page)).toContainText('1 ahead', { timeout: COLD_READ_MS });
    expect(await remoteHead(fx)).not.toBe(await head(fx));
  });

  test('Y-08.2 — Report a push refused for permission', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, (f) => commitFile(f, 'mine.txt', 'mine\n', 'local work'));
    // The remote declines every push; its message also quotes a file of the home folder and a URL
    // with credentials — what the server must redact (spec-010 §4, D40-9).
    await remoteHook(
      fx,
      [
        `echo "permission denied: morgan may not push here" >&2`,
        `printf '%s/wfui-probe-secret https://morgan:TOKEN-MARKER@example.invalid/kanban.git\\n' "$HOME" >&2`,
        'exit 1',
      ].join('\n'),
    );
    const c = await start(consoles, fx);
    await openView(page, c);
    await expect(gitStatus(page)).toContainText('1 commit to push');
    expect(await clickAndAnswer(page, syncButton(page, 'Push'), 'push')).toBe(422);
    const toast = assertiveToasts(page).locator('.toast');
    await expect(toast).toContainText('Not pushed — the commit stays local', { timeout: COLD_READ_MS });
    await expect(toast).toHaveClass(/toast-error/);
    const verbatim = toast.locator('pre.verbatim');
    await expect(verbatim).toContainText('permission denied: morgan may not push here');
    await expect(verbatim).toContainText('(pre-receive hook declined)');
    // Redacted end to end: the remote's path, the home folder, the URL's credentials.
    const text = (await verbatim.textContent()) ?? '';
    expect(text).toContain('<remote>');
    expect(text).toContain('~/wfui-probe-secret');
    expect(text).toContain('https://example.invalid/kanban.git');
    expect(text).not.toContain('TOKEN-MARKER');
    expect(text).not.toContain(fx.remoteDir);
    expect(text).not.toContain(fx.home);
    await expect(gitStatus(page)).toContainText('1 commit to push');
    expect(await scanThemes(page)).toEqual([]);
    // Nothing fixed covers the sidebar's controls while the sticky toast is shown (Wave 5 lesson).
    for (const size of [
      { width: 1280, height: 720 },
      { width: 600, height: 720 },
      { width: 400, height: 600 },
    ]) {
      await page.setViewportSize(size);
      for (const control of [syncButton(page, 'Push'), syncButton(page, 'Fetch')]) {
        await control.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await expectOnTop(page, control);
      }
      await expectOnTop(page, toast.getByRole('button', { name: 'Close notification' }));
    }
  });
});

test.describe('US-G-12 — governed actions blocked while behind', () => {
  const BEHIND = 'Blocked: your copy is 1 commit behind the remote — Update';

  test('G-12.1 — Block governed actions while behind', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, 'outside.txt', 'theirs\n');
      await fetchCopy(f);
    });
    const c = await start(consoles, fx);
    await openTask001(page, c);
    const blocked = gate(page).locator('.gate-blocked');
    await expect(blocked).toHaveText(BEHIND, { timeout: COLD_READ_MS });
    for (const name of ['Approve → approved', 'Reject → draft']) {
      const b = gate(page).getByRole('button', { name, exact: true });
      await expect(b).toHaveAttribute('aria-disabled', 'true');
      await expect(b).toHaveAccessibleDescription(BEHIND);
    }
    await expect(blocked.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-12.2 — Unblock after the update', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, async (f) => {
      await remoteCommit(f, 'outside.txt', 'theirs\n');
      await fetchCopy(f);
    });
    const c = await start(consoles, fx);
    await openTask001(page, c);
    const blocked = gate(page).locator('.gate-blocked');
    await expect(blocked).toHaveText(BEHIND, { timeout: COLD_READ_MS });
    expect(await clickAndAnswer(page, blocked.getByRole('button', { name: 'Update', exact: true }), 'update')).toBe(
      200,
    );
    await expect.poll(() => head(fx), { timeout: COLD_READ_MS }).toBe(await trackingHead(fx));
    expect(await head(fx)).toBe(await remoteHead(fx));
    await expect(approve(page)).not.toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
    await expect(blocked).toHaveCount(0);
    // The footer's next step takes the focus (D40-2).
    await expect(reasonField(page)).toBeFocused();
    await expect(gitStatus(page)).toContainText('In sync with git');
  });

  test('G-12.3 — Do not block when the copy is only ahead', async ({ page, fixtures, consoles }) => {
    const fx = await copy(fixtures, (f) => commitFile(f, 'mine.txt', 'mine\n', 'local work'));
    const c = await start(consoles, fx);
    await openTask001(page, c);
    await expect(gitStatus(page)).toContainText('1 ahead');
    await expect(reasonField(page)).toBeVisible({ timeout: COLD_READ_MS });
    await expect(approve(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(gate(page).locator('.gate-blocked')).toHaveCount(0);
  });
});
