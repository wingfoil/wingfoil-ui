// task-043 AC-1 (e2e-smoke `drive-browser`, gap G2 of `e2e-smoke-rel-v0.2-plan`; decisions D43-1 …
// D43-4, D43-7, D43-8): "every commit the UI causes is a CLI `wf(…)` commit" over a whole console
// session, not only the subject of HEAD after one write. On a kanban copy as Morgan, the test
// commits to the copy's remote, then the user fetches and updates from the sidebar, submits,
// approves and rejects from the element panel, changes a UI setting and the role view, and pushes.
// After the console stopped, `test/harness/commit-provenance.ts` checks every commit of
// `<before>..HEAD` the remote did not bring (the CLI's subject form, only its element's file, in the
// session's order), that no other ref, tag, stash, configuration or working-tree file changed, and
// that the remote's branch is HEAD. v0.2 writes no `.wingfoil/ui.yaml`, so no `chore(ui)` commit
// is expected. `autoFetch` is off (a real-bin console fetches every 60 s, task-034) and auto-push
// off (the Push is the user's).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import type { StateFile } from '../../contracts/src/index.js';
import { provenanceProblems, remoteRefs } from '../harness/commit-provenance.js';
import type { Fixture } from '../harness/fixtures/index.js';
import { snapshotRepo } from '../harness/repo-state.js';
import { git } from '../harness/run.js';
import { COLD_READ_MS, expectFirstLoad } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { remoteCommit, remoteHead } from './support/remote.js';

test.use({ prebuild: ['kanban'] });

const SUBMIT = 'wf(task): submit task-004-session-timeout';
const APPROVE = 'wf(task): approve task-001-login-form [pending → approved]';
const REJECT = 'wf(bug): reject bug-001-crash-on-save [pending → draft]';
const REJECT_REASON = 'Steps to reproduce are missing (task-043)';

const gitStatus = (page: Page): Locator => page.getByRole('region', { name: 'Git status' });
const syncButton = (page: Page, name: string): Locator => gitStatus(page).getByRole('button', { name, exact: true });
const drawer = (page: Page): Locator => page.locator('.drawer');
const gate = (page: Page): Locator => drawer(page).getByRole('region', { name: 'Decision' });
const reasonField = (page: Page): Locator =>
  gate(page).getByRole('textbox', { name: 'Reason, recorded in the commit' });
const politeToast = (page: Page, title: string): Locator =>
  page.locator('.toasts [aria-live="polite"] .toast').filter({ hasText: title });

/** Click `button` and wait for the answer of the `POST` whose path ends with `suffix`. */
async function clickAndAnswer(page: Page, button: Locator, suffix: string): Promise<number> {
  const answer = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(suffix),
    { timeout: COLD_READ_MS },
  );
  await button.click({ timeout: COLD_READ_MS });
  return (await answer).status();
}

/** Open the element panel of `eid` (the session exists: a plain navigation) and wait for its footer. */
async function openPanel(page: Page, c: RunningConsole, eid: string): Promise<void> {
  await page.goto(`${c.origin}/p/${c.pids[0]}/e/${eid}`, { timeout: COLD_READ_MS });
  await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(drawer(page).locator('.element-footer')).toBeVisible({ timeout: COLD_READ_MS });
}

/** The governed write's toast (what the user sees), then its commit as HEAD's subject. */
async function expectWrite(page: Page, fx: Fixture, title: string, subject: string): Promise<void> {
  await expect(politeToast(page, title)).toBeVisible({ timeout: COLD_READ_MS });
  await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(subject);
}

test.describe('task-043 AC-1 — commit provenance of a UI session (G2)', () => {
  test("drive-browser — every commit of a UI session is the CLI's `wf(…)` commit of its element (G2)", async ({
    page,
    fixtures,
    consoles,
  }) => {
    const fx = await fixtures.copy('kanban');
    await actAs(fx, 'Morgan');
    const before = await snapshotRepo(fx.dir, fx.env);
    const remoteBefore = await remoteRefs(fx.remoteDir, fx.env);
    const c = await consoles.start({ projects: [fx], settings: { autoFetch: false } });
    await openConsole(page, c, { path: `/p/${c.pids[0]}/today` });
    await expectFirstLoad(gitStatus(page));
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });

    // 1. Someone else pushes to the remote (the test, from another clone); Fetch, then Update (D43-3,
    //    D43-4): before any write, so the copy is behind only.
    await remoteCommit(fx, 'outside.txt', 'pushed by someone else\n');
    const brought = await remoteHead(fx);
    expect(await clickAndAnswer(page, syncButton(page, 'Fetch'), '/git/fetch')).toBe(200);
    await expect(gitStatus(page)).toContainText('1 behind', { timeout: COLD_READ_MS });
    expect(await clickAndAnswer(page, syncButton(page, 'Update'), '/git/update')).toBe(200);
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });

    // 2. Submit, approve, reject (with a reason) from the element panel.
    await openPanel(page, c, 'task-004-session-timeout');
    await drawer(page)
      .getByRole('button', { name: /^Submit → / })
      .click();
    await expectWrite(page, fx, 'Submitted task-004-session-timeout', SUBMIT);

    await openPanel(page, c, 'task-001-login-form');
    await reasonField(page).fill('Looks right (task-043)');
    await gate(page).getByRole('button', { name: 'Approve → approved', exact: true }).click();
    await expectWrite(page, fx, 'Approved task-001-login-form', APPROVE);

    await openPanel(page, c, 'bug-001-crash-on-save');
    await reasonField(page).fill(REJECT_REASON);
    await gate(page).getByRole('button', { name: 'Reject → draft', exact: true }).click();
    await expectWrite(page, fx, 'Rejected bug-001-crash-on-save', REJECT);

    // 3. A UI setting (the theme) and the role view: the local state only.
    await page.goto(`${c.origin}/p/${c.pids[0]}/configuration/ui-settings`, { timeout: COLD_READ_MS });
    const light = page.getByRole('radio', { name: 'Light', exact: true });
    await expectFirstLoad(light);
    const saved = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/settings',
      { timeout: COLD_READ_MS },
    );
    await light.locator('xpath=ancestor::label[1]').click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const put = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/p/${c.pids[0]}/role-view`,
      { timeout: COLD_READ_MS },
    );
    await page.locator('.role-view-button').click();
    await page.getByRole('listbox').getByRole('option', { name: 'tech-lead', exact: true }).click();
    expect((await put).status()).toBe(204);
    await expect(page.locator('.role-view-button')).toHaveAccessibleName('tech-lead Role view');

    // 4. Push the three commits from the sidebar (no navigation while it runs, task-040 S2).
    await expect(gitStatus(page)).toContainText('3 commits to push', { timeout: COLD_READ_MS });
    expect(await clickAndAnswer(page, syncButton(page, 'Push'), '/git/push')).toBe(200);
    await expect(gitStatus(page)).toContainText('In sync with git', { timeout: COLD_READ_MS });

    // The setting and the role view are in the console's state file (spec-006), not the repository.
    const state = JSON.parse(await readFile(path.join(c.stateDir, 'state.json'), 'utf8')) as StateFile;
    expect(state.settings['theme']).toBe('light');
    expect(state.projects[0]!.roleView).toBe('tech-lead');

    // Whatever the console does at shutdown counts too.
    await c.stop();
    const problems = await provenanceProblems({
      dir: fx.dir,
      env: fx.env,
      before,
      after: await snapshotRepo(fx.dir, fx.env),
      remoteBefore,
      remoteAfter: await remoteRefs(fx.remoteDir, fx.env),
      remoteBrought: brought,
      remoteExpected: ['outside: outside.txt'],
      expected: [SUBMIT, APPROVE, REJECT],
    });
    expect(problems).toEqual([]);
    // The reject's reason is recorded in its commit (the CLI's `--reason`).
    const { stdout: body } = await git(fx.dir, ['log', '-1', '--format=%B'], fx.env);
    expect(body).toContain(REJECT_REASON);
  });
});
