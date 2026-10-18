// task-037 — the gate footer of the element panel on the real bin (US-G-04 … US-G-07, US-G-09,
// US-S-24, S-13.2, S-15.2, X-06.2, TT-PERF-10, TT-SEC-07; `gate-footer.feature`,
// `action-descriptor.feature`; decisions D37-1 … D37-12): every outcome of a gate side by side, the
// reason required with an editable default, the read-only, reserved, waiting and final footers.
// Every decision is made on a fixture copy of its own, through task-032's routes and the pinned CLI;
// the commit is read with git on the copy. The panel reads the element and the project header:
// every first read is waited for with `COLD_READ_MS`.
import type { Locator, Page } from '@playwright/test';
import type { Fixture, FixtureKind, MemberName } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, lastCommitSubject } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';
import { remoteHead } from './support/remote.js';

test.use({ prebuild: ['kanban', 'custom', 'unknown'] });

const DEFAULT_REASON = 'Approved via WingFoil UI';

/** The element panel. */
const drawer = (page: Page): Locator => page.locator('.drawer');

/** The gate footer of the panel. */
const gate = (page: Page): Locator => drawer(page).getByRole('region', { name: 'Decision' });

/** The footer slot of the panel, whatever it shows. */
const footer = (page: Page): Locator => drawer(page).locator('.element-footer');

const reasonField = (page: Page): Locator =>
  gate(page).getByRole('textbox', { name: 'Reason, recorded in the commit' });
const outcome = (page: Page, name: string): Locator => gate(page).getByRole('button', { name, exact: true });

/** A copy of `kind` where the user is `name`, after `prepare` (CLI changes before the console starts). */
async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName | 'Riley',
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await actAs(fx, name);
  await prepare(fx);
  return fx;
}

/** Give `name` the roles `roles` in the DNA of `fx` (the pinned CLI). */
function setRoles(fx: Fixture, name: MemberName, roles: string): Promise<string> {
  return cli(fx, ['dna', 'update', 'team.members', '--value', name, '--entry-roles', roles]);
}

/** Open the element panel of `eid` by its URL and wait until its footer slot is read. */
async function openPanel(page: Page, c: RunningConsole, eid: string, pid = c.pids[0]!): Promise<void> {
  await openConsole(page, c, { path: `/p/${pid}/e/${eid}` });
  await expect(drawer(page).locator('.type-tag')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
}

/** Open Today of the first project and wait for its Requires you card. */
async function openToday(page: Page, c: RunningConsole): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[0]}` });
  await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`, { timeout: COLD_READ_MS });
  await expect(page.getByRole('region', { name: 'Requires you' })).toBeVisible({ timeout: COLD_READ_MS });
}

/** The Requires you action of `eid` on Today. */
const todayAction = (page: Page, eid: string): Locator =>
  page.getByRole('region', { name: 'Requires you' }).locator(`li[data-eid="${eid}"]`).getByRole('button');

/** The text of the outcome buttons of the gate footer, in order. */
async function outcomes(page: Page): Promise<string[]> {
  return gate(page).locator('.gate-outcome').allTextContents();
}

/** Record the governed-write requests the page sends. */
function recordWrites(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/elements\/[^/]+\/(approve|reject|submit)$/.test(r.url())) urls.push(r.url());
  });
  return urls;
}

/** The commit subject of `fx` once it is `subject`. */
async function expectLastCommit(fx: Fixture, subject: string): Promise<void> {
  await expect.poll(() => lastCommitSubject(fx), { timeout: COLD_READ_MS }).toBe(subject);
}

test.describe('US-G-04 — two clicks from Today', () => {
  test('G-04.1 — Approve a gate in two clicks from Today', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openToday(page, c);
    // TT-PERF-10: every click from here on is counted.
    await page.evaluate(() => {
      const w = window as unknown as { wfuiClicks: number };
      w.wfuiClicks = 0;
      document.addEventListener('click', () => (w.wfuiClicks += 1), true);
    });
    await todayAction(page, 'task-001-login-form').click();
    await outcome(page, 'Approve → approved').click({ timeout: COLD_READ_MS });
    await expectLastCommit(kanban, 'wf(task): approve task-001-login-form [pending → approved]');
    // task-038: the result is a toast of the shell (D38-10).
    await expect(
      page.locator('.toasts [aria-live="polite"] .toast-title').filter({ hasText: 'Approved task-001-login-form' }),
    ).toHaveCount(1, { timeout: COLD_READ_MS });
    expect(await page.evaluate(() => (window as unknown as { wfuiClicks: number }).wfuiClicks)).toBe(2);
    // The panel shows the new state: approved is the last state of the kanban default (S-24.1's footer).
    await expect(footer(page)).toHaveText('Final state: no action is possible', { timeout: COLD_READ_MS });
  });

  // task-043 AC-2 (gap G3): success criterion 1 of minor-v0.2 in one test — a member holding
  // `approver` passes a gate from Today in two clicks, with the `wf(…)` commit shown and pushed.
  test('G-04.1 — Approve a gate in two clicks from Today, with the commit shown and pushed (success criterion 1)', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban], settings: { autoPush: true, autoFetch: false } });
    await openToday(page, c);
    await page.evaluate(() => {
      const w = window as unknown as { wfuiClicks: number };
      w.wfuiClicks = 0;
      document.addEventListener('click', () => (w.wfuiClicks += 1), true);
    });
    await todayAction(page, 'task-001-login-form').click();
    await outcome(page, 'Approve → approved').click({ timeout: COLD_READ_MS });
    // The toast first, hovered (its 8 s timer paused, D38-2), before any server-read wait (W5 lesson).
    const toast = page
      .locator('.toasts [aria-live="polite"] .toast')
      .filter({ hasText: 'Approved task-001-login-form' });
    await expect(toast).toBeVisible({ timeout: COLD_READ_MS });
    await toast.hover();
    await expect(toast.locator('.toast-pushed')).toHaveText('pushed', { timeout: COLD_READ_MS });
    const subject = 'wf(task): approve task-001-login-form [pending → approved]';
    await expectLastCommit(kanban, subject);
    const sha = (await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim();
    await expect(toast.locator('.toast-commits li')).toHaveText(
      `${sha.slice(0, 7)} ${await lastCommitSubject(kanban)}`,
    );
    await expect(toast.locator('.toast-commits code')).toHaveText(sha.slice(0, 7));
    expect(await page.evaluate(() => (window as unknown as { wfuiClicks: number }).wfuiClicks)).toBe(2);
    expect(await remoteHead(kanban)).toBe(sha);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-04.3 — Open the gate footer with the reason focused', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    await todayAction(page, 'task-001-login-form').click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-001-login-form`);
    await expect(gate(page)).toBeVisible({ timeout: COLD_READ_MS });
    await expect(reasonField(page)).toBeFocused();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-04.2 — Cancel without running the CLI', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const before = await lastCommitSubject(kanban);
    const c = await consoles.start({ projects: [kanban] });
    const writes = recordWrites(page);
    await openToday(page, c);
    await todayAction(page, 'task-001-login-form').click();
    await gate(page).getByRole('button', { name: 'Cancel' }).click({ timeout: COLD_READ_MS });
    await expect(drawer(page)).toHaveCount(0);
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/today`);
    expect(writes).toEqual([]);
    expect(await lastCommitSubject(kanban)).toBe(before);
  });
});

test.describe('US-G-05 — every outcome side by side', () => {
  test('G-05.1 — Show approve and the reject target of a bug gate', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Morgan')] });
    await openPanel(page, c, 'bug-001-toast-overlap');
    await expect(gate(page)).toBeVisible({ timeout: COLD_READ_MS });
    expect(await outcomes(page)).toEqual(['Approve → triaged', 'Reject → closed']);
    await expect(outcome(page, 'Approve → triaged')).toHaveClass(/button-primary/);
    await expect(outcome(page, 'Reject → closed')).not.toHaveClass(/button-primary/);
    // Side by side: one row of buttons.
    const [a, r] = [
      await outcome(page, 'Approve → triaged').boundingBox(),
      await outcome(page, 'Reject → closed').boundingBox(),
    ];
    expect(a && r && Math.abs(a.y - r.y) < 2).toBe(true);
    expect(await scanThemes(page)).toEqual([]);
  });

  test("G-05.2 — Reject to the gate's target", async ({ page, fixtures, consoles }) => {
    const custom = await copyAs(fixtures, 'custom', 'Morgan');
    const c = await consoles.start({ projects: [custom] });
    await openPanel(page, c, 'bug-001-toast-overlap');
    await reasonField(page).fill('Cannot reproduce', { timeout: COLD_READ_MS });
    await outcome(page, 'Reject → closed').click();
    await expectLastCommit(custom, 'wf(bug): reject bug-001-toast-overlap [open → closed]');
    await expect(drawer(page).locator('.history-entry').filter({ hasText: '“Cannot reproduce”' })).toHaveCount(1, {
      timeout: COLD_READ_MS,
    });
  });

  test("G-05.3 — Derive the outcomes of an unknown type's gate", async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'unknown', 'Morgan')] });
    await openPanel(page, c, 'story-001-onboarding');
    await expect(gate(page)).toBeVisible({ timeout: COLD_READ_MS });
    expect(await outcomes(page)).toEqual(['Approve → ready-to-build', 'Reject → idea']);
  });
});

test.describe('US-G-06 — the reason, required and pre-filled', () => {
  test('G-06.1 — Pre-fill the reason for approve', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(reasonField(page)).toHaveValue(DEFAULT_REASON, { timeout: COLD_READ_MS });
    await reasonField(page).focus();
    const selection = await reasonField(page).evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]);
    expect(selection).toEqual([0, DEFAULT_REASON.length]);
    // Typing replaces it.
    await page.keyboard.type('OK');
    await expect(reasonField(page)).toHaveValue('OK');
  });

  test('G-06.2 — Use the reason I typed', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    await reasonField(page).fill('Matches the mock-up', { timeout: COLD_READ_MS });
    await outcome(page, 'Approve → approved').click();
    await expectLastCommit(kanban, 'wf(task): approve task-001-login-form [pending → approved]');
    await expect(drawer(page).locator('.history-entry').filter({ hasText: '“Matches the mock-up”' })).toHaveCount(1, {
      timeout: COLD_READ_MS,
    });
  });

  test('G-06.3 — Clear an untouched default when a reject is chosen', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(reasonField(page)).toHaveValue(DEFAULT_REASON, { timeout: COLD_READ_MS });
    await outcome(page, 'Reject → draft').focus();
    await expect(reasonField(page)).toHaveValue('');
    await expect(reasonField(page)).toHaveAttribute('placeholder', 'Reason (required)');
    await expect(outcome(page, 'Reject → draft')).toBeFocused();
  });

  test('G-06.4 — Keep a reason I typed when a reject is chosen', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openPanel(page, c, 'task-001-login-form');
    await reasonField(page).fill('Looks wrong', { timeout: COLD_READ_MS });
    await outcome(page, 'Reject → draft').focus();
    await expect(reasonField(page)).toHaveValue('Looks wrong');
  });
});

test.describe('US-G-07 — an empty reason', () => {
  test('G-07.1 — Disable the outcomes while the reason is empty', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openPanel(page, c, 'task-001-login-form');
    await reasonField(page).fill('', { timeout: COLD_READ_MS });
    for (const name of ['Approve → approved', 'Reject → draft']) {
      await expect(outcome(page, name)).toBeDisabled();
      await expect(outcome(page, name)).toHaveAccessibleDescription('A reason is required');
    }
    await expect(gate(page).getByText('A reason is required', { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-07.2 — Treat a reason of only spaces as empty', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const before = await lastCommitSubject(kanban);
    const c = await consoles.start({ projects: [kanban] });
    const writes = recordWrites(page);
    await openPanel(page, c, 'task-001-login-form');
    await reasonField(page).fill('   ', { timeout: COLD_READ_MS });
    for (const name of ['Approve → approved', 'Reject → draft']) {
      await expect(outcome(page, name)).toBeDisabled();
      // A disabled outcome keeps its place in the tab order (D37-3): a click is a no-op.
      await outcome(page, name).click({ force: true });
    }
    expect(writes).toEqual([]);
    expect(await lastCommitSubject(kanban)).toBe(before);
  });
});

test.describe('US-G-09 — informational footer without approver (TT-SEC-07)', () => {
  test('G-09.1 — Show an informational footer to a reviewer without approver', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Sam')] });
    await openPanel(page, c, 'task-001-cli-adapter');
    await expect(footer(page)).toHaveText('Reserved to approver — Morgan, Alex can act', { timeout: COLD_READ_MS });
    await expect(drawer(page).getByRole('button', { name: /→/ })).toHaveCount(0);
    await expect(drawer(page).getByRole('textbox')).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('G-09.2 — Show the outcomes to the same reviewer once they hold approver', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const custom = await copyAs(fixtures, 'custom', 'Sam', (fx) => setRoles(fx, 'Sam', 'reviewer, approver'));
    const c = await consoles.start({ projects: [custom] });
    await openPanel(page, c, 'task-001-cli-adapter');
    await expect(gate(page)).toBeVisible({ timeout: COLD_READ_MS });
    expect(await outcomes(page)).toEqual(['Approve → approved', 'Reject → in-progress']);
  });

  test('G-09.3 — Show an informational footer to a product owner without approver', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Casey')] });
    await openPanel(page, c, 'dl-002-use-fastify');
    await expect(footer(page)).toHaveText('Reserved to approver — Morgan, Alex can act', { timeout: COLD_READ_MS });
    await expect(drawer(page).getByRole('button', { name: /→/ })).toHaveCount(0);
  });
});

test.describe('US-S-24 — terminal and engine-waiting states', () => {
  test('S-24.1 — Offer no action on a terminal state', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Morgan')] });
    await openPanel(page, c, 'dl-001-initialise-wingfoil-before-inception');
    await expect(footer(page)).toHaveText('Final state: no action is possible', { timeout: COLD_READ_MS });
    await expect(drawer(page).getByRole('button')).toHaveText(['Close']);
    await expect(drawer(page).locator('.state-machine [aria-current="step"] .visually-hidden')).toHaveText(
      'ready, final state',
    );
  });

  test('S-24.2 — Show an engine-waiting state as waiting', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Alex')] });
    await openPanel(page, c, 'minor-v0.1');
    await expect(footer(page)).toHaveText('Waiting for the workflow engine (state: planning)', {
      timeout: COLD_READ_MS,
    });
    await expect(drawer(page).getByRole('button')).toHaveText(['Close']);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('S-24.3 — Treat a declared waiting state of an unknown type the same way', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'unknown', 'Alex')] });
    await openPanel(page, c, 'story-002-billing');
    await expect(footer(page)).toHaveText('Waiting for the workflow engine (state: ready-to-build)', {
      timeout: COLD_READ_MS,
    });
  });

  test('S-24.4 — Offer only the reject of a state that is both a gate and a waiting state', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const custom = await copyAs(fixtures, 'custom', 'Morgan', (fx) =>
      cli(fx, ['memory', 'approve', 'bug-001-toast-overlap', '--reason', 'Confirmed']),
    );
    const c = await consoles.start({ projects: [custom] });
    await openPanel(page, c, 'bug-001-toast-overlap');
    await expect(gate(page)).toBeVisible({ timeout: COLD_READ_MS });
    expect(await outcomes(page)).toEqual(['Reject → closed']);
    await expect(gate(page).getByText('Waiting for the workflow engine to advance', { exact: true })).toBeVisible();
    await openToday(page, c);
    await expect(page.getByRole('region', { name: 'Requires you' }).locator('li[data-eid]').first()).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Requires you' }).locator('li[data-eid="bug-001-toast-overlap"]'),
    ).toHaveCount(0);
  });
});

test.describe('TT-SEC-08 (UI side) — no governed action for an unidentified user', () => {
  test('S-13.2 — Offer no governed action to a user who is not in the team', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Riley')] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(footer(page)).toHaveText('Read-only: riley@example.test is not in the team — How to join', {
      timeout: COLD_READ_MS,
    });
    await expect(drawer(page).getByRole('button', { name: /→/ })).toHaveCount(0);
    await expect(drawer(page).getByRole('textbox')).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
    await footer(page).getByRole('button', { name: 'How to join' }).click();
    await expect(page.getByRole('dialog', { name: 'How to join this project' })).toBeVisible();
  });

  test('S-15.2 — Offer no governed action under an ambiguous identity', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    for (const [name, roles] of [
      ['Jordan', 'developer'],
      ['Sam', 'reviewer'],
    ] as const) {
      await cli(kanban, ['dna', 'remove', 'team.members', '--value', name]);
      await cli(kanban, [
        'dna',
        'add',
        'team.members',
        '--value',
        name,
        '--entry-email',
        'shared@example.test',
        '--entry-roles',
        roles,
      ]);
    }
    await git(kanban.dir, ['config', 'user.email', 'shared@example.test'], kanban.env);
    const c = await consoles.start({ projects: [kanban] });
    await openPanel(page, c, 'task-001-login-form');
    await expect(footer(page)).toHaveText('Read-only: see the notice above the view', { timeout: COLD_READ_MS });
    await expect(drawer(page).getByRole('button', { name: /→/ })).toHaveCount(0);
    await expect(drawer(page).getByRole('textbox')).toHaveCount(0);
  });
});

test.describe('US-X-06 — keyboard (TT-PERF-10)', () => {
  test('X-06.2 — Decide a gate with the keyboard only', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban] });
    await openToday(page, c);
    const action = todayAction(page, 'task-001-login-form');
    await tabUntil(page, action);
    await expectFocusVisible(action);
    await page.keyboard.press('Enter');
    await expect(reasonField(page)).toBeFocused({ timeout: COLD_READ_MS });
    const approve = outcome(page, 'Approve → approved');
    await tabUntil(page, approve);
    await expectFocusVisible(approve);
    await expect(reasonField(page)).toHaveValue(DEFAULT_REASON);
    await page.keyboard.press('Enter');
    await expectLastCommit(kanban, 'wf(task): approve task-001-login-form [pending → approved]');
    // The focus stays in the panel once the outcome is gone (D37-9).
    await expect(footer(page)).toHaveText('Final state: no action is possible', { timeout: COLD_READ_MS });
    expect(await page.evaluate(() => document.activeElement?.closest('.drawer') !== null)).toBe(true);
  });
  // task-043 AC-3 (gap G4): Reject of the gate footer by keyboard only, from Today.
  test('X-06.2 — Reject a gate with the keyboard only (G4)', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [kanban], settings: { autoFetch: false } });
    await openToday(page, c);
    const action = todayAction(page, 'task-001-login-form');
    await tabUntil(page, action);
    await expectFocusVisible(action);
    await page.keyboard.press('Enter');
    await expect(reasonField(page)).toBeFocused({ timeout: COLD_READ_MS });
    // The default is selected on focus: typing replaces it (D37-4).
    const reason = 'Acceptance criteria are not met (task-043)';
    await page.keyboard.type(reason);
    await expect(reasonField(page)).toHaveValue(reason);
    const reject = outcome(page, 'Reject → draft');
    await tabUntil(page, reject);
    await expectFocusVisible(reject);
    // A typed reason is kept when a reject takes the focus (G-06.4).
    await expect(reasonField(page)).toHaveValue(reason);
    await page.keyboard.press('Enter');
    await expect(
      page.locator('.toasts [aria-live="polite"] .toast-title').filter({ hasText: 'Rejected task-001-login-form' }),
    ).toHaveCount(1, { timeout: COLD_READ_MS });
    await expectLastCommit(kanban, 'wf(task): reject task-001-login-form [pending → draft]');
    const { stdout: body } = await git(kanban.dir, ['log', '-1', '--format=%B'], kanban.env);
    expect(body).toContain(reason);
    // What the user sees: the rejection banner of the panel, with the reason. The name is the commit's
    // author, which e2e identities do not set (they set only `user.email`; ES2-3): not asserted.
    await expect(
      drawer(page).getByText(new RegExp(`^Rejected by .+: ${reason.replace(/[()]/g, '\\$&')}$`)),
    ).toBeVisible({
      timeout: COLD_READ_MS,
    });
  });
});
