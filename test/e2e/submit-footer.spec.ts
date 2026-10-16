// task-038 — the single-action footer, blocked actions and action feedback on the real bin
// (US-G-10, US-G-11, US-G-13, US-G-14, US-X-07; `submit.feature`, `blocked-actions.feature`,
// `action-feedback.feature`, `accessibility.feature` X-07.x; decisions D38-1 … D38-13): *Submit → <to>*,
// actions disabled with the reason as their description on an element with local changes, and the
// toasts of the shell — the result with the `wf(…)` commit and "pushed", a red toast with the CLI's
// reason or the catalogue text of `element-changed`. Every write is made on a fixture copy of its
// own, through task-032's routes and the pinned CLI; commits are read with git on the copy and on
// its bare remote. Every first read is waited for with `COLD_READ_MS`.
import type { Locator, Page, Route } from '@playwright/test';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Fixture, FixtureKind, MemberName } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, commitFile, lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';
import { remoteHead } from './support/remote.js';

test.use({ prebuild: ['kanban', 'custom'] });

const LOCAL_CHANGES = 'Blocked: this element has local changes — commit or discard them first';

const drawer = (page: Page): Locator => page.locator('.drawer');
const gate = (page: Page): Locator => drawer(page).getByRole('region', { name: 'Decision' });
const reasonField = (page: Page): Locator =>
  gate(page).getByRole('textbox', { name: 'Reason, recorded in the commit' });
const outcome = (page: Page, name: string): Locator => gate(page).getByRole('button', { name, exact: true });
/** The Submit button of the single-action footer ("Submit → <to>", D38-6). */
const submitButton = (page: Page): Locator => drawer(page).getByRole('button', { name: /^Submit → / });
const currentState = (page: Page): Locator =>
  drawer(page).getByRole('list', { name: 'State machine' }).locator('[aria-current="step"] .visually-hidden');

/** The polite and the assertive toast regions of the shell (D38-1). */
const politeToasts = (page: Page): Locator => page.locator('.toasts [aria-live="polite"]');
const assertiveToasts = (page: Page): Locator => page.locator('.toasts [aria-live="assertive"]');

async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName,
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await actAs(fx, name);
  return fx;
}

/** The repository-relative file of element `eid` (one tracked `<eid>.md`). */
async function elementFile(fx: Fixture, eid: string): Promise<string> {
  const { stdout } = await git(fx.dir, ['ls-files', '-z'], fx.env);
  const files = stdout.split('\0').filter((f) => path.posix.basename(f) === `${eid}.md`);
  expect(files).toHaveLength(1);
  return files[0]!;
}

/** "The file of <eid> has an uncommitted edit": a line appended to its body. */
async function editElement(fx: Fixture, eid: string): Promise<void> {
  await appendFile(path.join(fx.dir, await elementFile(fx, eid)), '\nAn uncommitted edit.\n');
}

async function openPanel(page: Page, c: RunningConsole, eid: string, pid = c.pids[0]!): Promise<void> {
  await openConsole(page, c, { path: `/p/${pid}/e/${eid}` });
  await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
}

async function expectLastCommit(fx: Fixture, subject: string): Promise<void> {
  await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(subject);
}

async function head(fx: Fixture): Promise<string> {
  return (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
}

/** Approve `eid` from its open gate footer with `reason`. */
async function approveWith(page: Page, reason: string, name = 'Approve → approved'): Promise<void> {
  await reasonField(page).fill(reason, { timeout: COLD_READ_MS });
  await outcome(page, name).click();
}

/** The success toast of `title`, kept on screen (hovered: its timer is paused, D38-2) for the checks. */
async function successToast(page: Page, title: string): Promise<Locator> {
  const toast = politeToasts(page).locator('.toast').filter({ hasText: title });
  await expect(toast).toBeVisible({ timeout: COLD_READ_MS });
  await toast.hover();
  return toast;
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

/** The bottom edge of `locator` in the viewport. */
async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box ? box.y + box.height : Number.POSITIVE_INFINITY;
}

test.describe('US-G-10 — submit from the single-action footer', () => {
  test('G-10.1 — Submit a draft', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Jordan');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-004-session-timeout');
    await expect(submitButton(page)).toHaveAccessibleName('Submit → pending', { timeout: COLD_READ_MS });
    await expect(submitButton(page)).toHaveClass(/button-primary/);
    expect(await scanThemes(page)).toEqual([]);
    await submitButton(page).click();
    // The toast first: its 8 s timer must not race the refetch of the panel (review R2).
    const toast = await successToast(page, 'Submitted task-004-session-timeout');
    await expectLastCommit(kanban, 'wf(task): submit task-004-session-timeout');
    await expect(toast.locator('.toast-commits li')).toHaveText(
      `${(await head(kanban)).slice(0, 7)} wf(task): submit task-004-session-timeout`,
    );
    await expect(currentState(page)).toHaveText('pending, current state', { timeout: COLD_READ_MS });
  });

  test('G-10.2 — Submit rejected work again', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Jordan');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-002-password-reset');
    const banner = drawer(page).getByText('Rejected by Morgan: Missing acceptance criteria', { exact: true });
    await expect(banner).toBeVisible({ timeout: COLD_READ_MS });
    await submitButton(page).click({ timeout: COLD_READ_MS });
    await expectLastCommit(kanban, 'wf(task): submit task-002-password-reset');
    await expect(currentState(page)).toHaveText('pending, current state', { timeout: COLD_READ_MS });
    await expect(banner).toHaveCount(0);
  });

  test('G-10.3 — Offer no submit on an element waiting on a gate', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Jordan')] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(drawer(page).locator('.element-footer')).toContainText('Reserved to approver', {
      timeout: COLD_READ_MS,
    });
    await expect(drawer(page).getByRole('button', { name: /^Submit/ })).toHaveCount(0);
  });

  test('Submit and close the toast with the keyboard only', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Jordan');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-004-session-timeout');
    await tabUntil(page, submitButton(page));
    await expectFocusVisible(submitButton(page));
    await page.keyboard.press('Enter');
    await expectLastCommit(kanban, 'wf(task): submit task-004-session-timeout');
    const close = politeToasts(page).getByRole('button', { name: 'Close notification' });
    await expect(close).toBeVisible({ timeout: COLD_READ_MS });
    // Held without a time dependence while the keyboard reaches it (review R2): hovered, its timer
    // is paused (D38-2); then the focus inside it keeps it paused.
    await politeToasts(page).locator('.toast').hover();
    await tabUntil(page, close);
    await expectFocusVisible(close);
    await page.keyboard.press('Enter');
    await expect(politeToasts(page).locator('.toast')).toHaveCount(0);
    await expect(page.locator('#main')).toBeFocused();
  });
});

test.describe('US-G-11 — actions blocked on local changes', () => {
  test('G-11.1 — Block a gate on an element with local changes', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    await editElement(kanban, 'task-001-login-form');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    for (const name of ['Approve → approved', 'Reject → draft']) {
      await expect(outcome(page, name)).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
    }
    await expect(gate(page).getByText(LOCAL_CHANGES, { exact: true })).toBeVisible();
  });

  test('G-11.2 — Block a submit on an element with local changes', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Jordan');
    await editElement(kanban, 'task-004-session-timeout');
    const before = await lastCommitSubject(kanban);
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-004-session-timeout');
    await expect(submitButton(page)).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
    await expect(submitButton(page)).toHaveAccessibleDescription(LOCAL_CHANGES);
    await expect(drawer(page).locator('.submit-footer').getByText(LOCAL_CHANGES, { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    // A press on the disabled button sends nothing (force: Playwright waits for an enabled button).
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') writes.push(r.url());
    });
    await submitButton(page).click({ force: true });
    await submitButton(page).press('Enter');
    expect(writes).toEqual([]);
    expect(await lastCommitSubject(kanban)).toBe(before);
  });

  test('G-11.3 — Do not block an element when only another file has local changes', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const readme = path.join(kanban.dir, 'README.md');
    const content = await readFile(readme, 'utf8').catch(() => undefined);
    if (content === undefined) await commitFile(kanban, 'README.md', '# kanban\n', 'docs: add a README');
    await writeFile(readme, `${content ?? '# kanban\n'}\nAn uncommitted edit.\n`);
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(outcome(page, 'Approve → approved')).toBeVisible({ timeout: COLD_READ_MS });
    await expect(outcome(page, 'Approve → approved')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(gate(page).getByText(LOCAL_CHANGES)).toHaveCount(0);
  });
});

test.describe('US-G-13 — the result and the commit', () => {
  test('G-13.1 — Show the commit and "pushed" after an approval', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban], settings: { autoPush: true } });
    await openPanel(page, c, 'task-001-login-form');
    await approveWith(page, 'OK');
    const subject = 'wf(task): approve task-001-login-form [pending → approved]';
    const toast = await successToast(page, 'Approved task-001-login-form');
    await expectLastCommit(kanban, subject);
    const sha = await head(kanban);
    await expect(toast.locator('.toast-commits li')).toHaveText(`${sha.slice(0, 7)} ${subject}`);
    await expect(toast.locator('.toast-commits code')).toHaveText(sha.slice(0, 7));
    await expect(toast.locator('.toast-pushed')).toHaveText('pushed');
    expect(await remoteHead(kanban)).toBe(sha);
    expect(await scanThemes(page)).toEqual([]);
  });

  // RP-52: the sidebar's "1 commit to push" is added to this test by task-040.
  test('G-13.2 — Show the commit without "pushed" when auto-push is off', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    const remoteBefore = await remoteHead(kanban);
    await openPanel(page, c, 'task-001-login-form');
    await approveWith(page, 'OK');
    const subject = 'wf(task): approve task-001-login-form [pending → approved]';
    const toast = await successToast(page, 'Approved task-001-login-form');
    await expectLastCommit(kanban, subject);
    await expect(toast.locator('.toast-commits li')).toHaveText(`${(await head(kanban)).slice(0, 7)} ${subject}`);
    await expect(toast.locator('.toast-pushed')).toHaveCount(0);
    await expect(toast).not.toContainText('pushed');
    expect(await remoteHead(kanban)).toBe(remoteBefore);
  });
});

test.describe('US-G-14 — a refusal as a red toast', () => {
  test("G-14.1 — Show the CLI's reason when a submit is refused", async ({ page, fixtures, consoles }) => {
    const custom = await copyAs(fixtures, 'custom', 'Alex');
    const before = await lastCommitSubject(custom);
    const c = await consoles.start({ projects: [custom] });
    await openPanel(page, c, 'adr-001-local-server');
    // "with the role view architect" (Alex holds several roles).
    const roleView = page.getByRole('banner').getByRole('button', { name: /Role view$/ });
    await roleView.click({ timeout: COLD_READ_MS });
    await page.getByRole('listbox').getByRole('option', { name: 'architect', exact: true }).click();
    await expect(roleView).toHaveAccessibleName('architect Role view', { timeout: COLD_READ_MS });
    await submitButton(page).click({ timeout: COLD_READ_MS });
    const toast = assertiveToasts(page).locator('.toast');
    await expect(toast).toContainText('Submit of adr-001-local-server not done', { timeout: COLD_READ_MS });
    await expect(toast).toContainText('WingFoil refused the action:');
    await expect(toast.locator('pre.verbatim')).toContainText('sard_ref');
    await expect(toast).toHaveClass(/toast-error/);
    // Review R1: the toast stays out of the drawer's footer — Submit is the element at its centre,
    // and a second click (no force) reaches it: the new refusal replaces the toast (one key).
    await expectOnTop(page, submitButton(page));
    await submitButton(page).click();
    await expect(assertiveToasts(page).locator('.toast')).toHaveCount(1);
    await expect(toast).toContainText('sard_ref', { timeout: COLD_READ_MS });
    // Review R2-2: beside the drawer but right of the sidebar (its foot holds the Git status).
    await expect
      .poll(async () => (await toast.boundingBox())!.x - (await page.locator('#main').boundingBox())!.x)
      .toBeGreaterThanOrEqual(0);
    expect(await scanThemes(page)).toEqual([]);
    // Too narrow for the toasts beside the drawer: stacked above its footer.
    await page.setViewportSize({ width: 600, height: 720 });
    await expectOnTop(page, submitButton(page));
    await expect.poll(() => bottomOf(toast)).toBeLessThanOrEqual((await submitButton(page).boundingBox())!.y);
    await expect(currentState(page)).toHaveText('draft, current state');
    expect(await lastCommitSubject(custom)).toBe(before);
  });

  test('G-14.2 — Show the refusal when the element moved in the meantime', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    const pid = c.pids[0]!;
    await openPanel(page, c, 'task-001-login-form');
    await expect(outcome(page, 'Reject → draft')).toBeVisible({ timeout: COLD_READ_MS });
    // The panel must not refresh before the click (D38-8): its re-reads are held until then.
    const held: Route[] = [];
    const hold = async (route: Route) => {
      if (route.request().method() === 'GET') held.push(route);
      else await route.continue();
    };
    await page.route(`**/api/p/${pid}/**`, hold);
    await page.route(`**/api/p/${pid}`, hold);
    await cli(kanban, ['memory', 'approve', 'task-001-login-form', '--reason', 'Done in a terminal']);
    const approved = 'wf(task): approve task-001-login-form [pending → approved]';
    expect(await lastCommitSubject(kanban)).toBe(approved);
    await expect(outcome(page, 'Reject → draft')).toBeVisible();
    await reasonField(page).fill('Too late');
    await outcome(page, 'Reject → draft').click();
    const toast = assertiveToasts(page).locator('.toast');
    await expect(toast).toContainText('This element changed since you opened it', { timeout: COLD_READ_MS });
    await expect(toast).toContainText('Reject of task-001-login-form not done');
    // Review R1: the gate footer's outcomes stay reachable under the refusal.
    await expectOnTop(page, outcome(page, 'Reject → draft'));
    await expectOnTop(page, outcome(page, 'Approve → approved'));
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    for (const r of held) await r.continue().catch(() => {});
    // No reject ran: the last commit is the terminal's approve (task-032 counts 0 CLI processes, row 9).
    expect(await lastCommitSubject(kanban)).toBe(approved);
    const { stdout } = await git(kanban.dir, ['log', '--format=%s'], kanban.env);
    expect(stdout).not.toContain('reject task-001-login-form');
    await expect(currentState(page)).toHaveText('approved, final state', { timeout: COLD_READ_MS });
  });
});

// Review round 2 (R2-3): refusals stay until closed, so on a small window they can outgrow it; the
// stack then scrolls and the oldest toast's Close stays reachable.
test.describe('review R2-3 — a stack taller than the window', () => {
  test('Refusals that overflow the window stay reachable', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    const message = Array.from({ length: 12 }, (_, i) => `Error: refused, line ${i + 1}`).join('\n');
    await page.route(/\/elements\/[^/]+\/(submit|approve)$/, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'cli-refused', message } }),
      }),
    );
    await page.setViewportSize({ width: 400, height: 600 });
    const refusals = assertiveToasts(page).locator('.toast');
    await openPanel(page, c, 'task-004-session-timeout');
    await submitButton(page).click({ timeout: COLD_READ_MS });
    await expect(refusals).toHaveCount(1, { timeout: COLD_READ_MS });
    // The refusals stay on screen while the next ones are made: reach the controls with the keyboard
    // (the stack may cover them on a window this small; that is what its Close buttons are for).
    for (const [n, eid] of [
      [2, 'task-001-login-form'],
      [3, 'bug-001-crash-on-save'],
    ] as const) {
      await drawer(page).getByRole('button', { name: 'Close' }).first().press('Enter');
      await page
        .getByRole('region', { name: 'Requires you' })
        .locator(`li[data-eid="${eid}"]`)
        .getByRole('button')
        .press('Enter', { timeout: COLD_READ_MS });
      await drawer(page)
        .getByRole('button', { name: /^Approve → / })
        .press('Enter', { timeout: COLD_READ_MS });
      await expect(refusals).toHaveCount(n, { timeout: COLD_READ_MS });
    }
    // The drawer's own Close is not under the stack (below its header).
    await expectOnTop(page, drawer(page).getByRole('button', { name: 'Close' }).first());
    await expect(page.locator('.toasts')).toHaveClass(/toasts-overflow/);
    const oldest = refusals.first().getByRole('button', { name: 'Close notification' });
    await oldest.focus();
    await expectOnTop(page, oldest);
    await oldest.click();
    await expect(refusals).toHaveCount(2);
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('US-X-07 — announced to screen readers', () => {
  test('X-07.1 — Announce a toast', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    await approveWith(page, 'OK');
    const text = page.locator('.toasts .toast-title').filter({ hasText: 'Approved task-001-login-form' });
    await expect(text).toBeVisible({ timeout: COLD_READ_MS });
    expect(await text.evaluate((e) => e.closest('[aria-live]')?.getAttribute('aria-live'))).toBe('polite');
  });

  test('X-07.2 — Announce a refusal assertively', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Alex')] });
    await openPanel(page, c, 'adr-001-local-server');
    await submitButton(page).click({ timeout: COLD_READ_MS });
    const text = page.locator('.toasts .toast').filter({ hasText: 'sard_ref' });
    await expect(text).toBeVisible({ timeout: COLD_READ_MS });
    expect(await text.evaluate((e) => e.closest('[aria-live]')?.getAttribute('aria-live'))).toBe('assertive');
  });

  test('X-07.3 — Expose the reason of a blocked action', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    await editElement(kanban, 'task-001-login-form');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    const approve = outcome(page, 'Approve → approved');
    await expect(approve).toHaveAttribute('aria-disabled', 'true', { timeout: COLD_READ_MS });
    await approve.focus();
    await expect(approve).toBeFocused();
    await expect(approve).toHaveAccessibleDescription(LOCAL_CHANGES);
  });
});
