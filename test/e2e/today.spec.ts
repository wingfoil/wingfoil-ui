// task-036 — Today on the real bin (US-T-01…US-T-06, US-T-11, TT-PERF-09; `requires-you.feature`,
// `waiting-on-others.feature`; decisions D36-1…D36-11): a project opens on Today, the greeting
// counts what requires the user in the role view, Requires you lists the rows with one action each
// (opening the element panel: no write here), Waiting on others says who must act. The user is set
// with `actAs` on a fixture copy; DNA variants are made with the pinned CLI before the console
// starts. Today reads the project header, then `GET /today` for its role view: every first read is
// waited for with `COLD_READ_MS`, lists with retrying expects (bug-009). T-03.2 and T-04.2 are
// live refreshes (`refreshClock`: COLD_READ_MS by default, 5 s under `test:timing`).
import type { Locator, Page } from '@playwright/test';
import type { ProjectHeader, Today } from '@wingfoil-ui/contracts';
import type { Fixture, FixtureKind, MemberName } from '../harness/fixtures/index.js';
import { STANDARD_TEAM as MEMBERS } from '../harness/fixtures/index.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';

test.use({ prebuild: ['kanban', 'custom', 'unknown'] });

/** Today's heading: the greeting, or "Today". */
const heading = (page: Page): Locator => page.locator('.today').getByRole('heading', { level: 1 });

/** The Requires you card. */
const requiresYou = (page: Page): Locator => page.getByRole('region', { name: 'Requires you' });

/** The Waiting on others card. */
const waiting = (page: Page): Locator => page.getByRole('region', { name: 'Waiting on others' });

/** The row of element `eid` in `card`. */
const rowOf = (card: Locator, eid: string): Locator => card.locator(`li[data-eid="${eid}"]`);

/** The ids of the rows of `card`, in order. */
async function idsOf(card: Locator): Promise<string[]> {
  return card.locator('li[data-eid]').evaluateAll((els) => els.map((el) => el.getAttribute('data-eid') ?? ''));
}

/** The role view selector's button (React Aria names it by the value, then the label). */
const roleView = (page: Page): Locator => page.getByRole('banner').getByRole('button', { name: /Role view$/ });

/** A copy of `kind` where the user is `name`, after `prepare` (CLI changes to its DNA). */
async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName | 'Riley',
  prepare: (fx: Fixture) => Promise<void> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await actAs(fx, name);
  await prepare(fx);
  return fx;
}

/** Open project `pid` by its root URL (0 navigation: it lands on Today) and wait for Today's first read. */
async function openToday(page: Page, c: RunningConsole, pid = c.pids[0]!): Promise<void> {
  await openConsole(page, c, { path: `/p/${pid}` });
  await expect(page).toHaveURL(`${c.origin}/p/${pid}/today`, { timeout: COLD_READ_MS });
  await expect(page.locator('.today').getByRole('status').filter({ hasText: 'Reading Today…' })).toHaveCount(0, {
    timeout: COLD_READ_MS,
  });
  await expect(heading(page)).toBeVisible({ timeout: COLD_READ_MS });
}

/** Choose `role` in the role view selector and wait for its Today. */
async function selectRoleView(page: Page, role: string): Promise<void> {
  await roleView(page).click();
  await page.getByRole('listbox').getByRole('option', { name: role, exact: true }).click();
  await expect(page.locator('.today').getByText(`Role view: ${role}`, { exact: true })).toBeVisible({
    timeout: COLD_READ_MS,
  });
  await expect(page.locator('.today').getByRole('status').filter({ hasText: 'Reading Today…' })).toHaveCount(0, {
    timeout: COLD_READ_MS,
  });
}

/** `GET` a JSON read of the console with the page's session. */
async function apiJson<T>(page: Page, c: RunningConsole, path: string): Promise<T> {
  const res = await page.request.get(`${c.origin}${path}`);
  expect(res.status(), path).toBe(200);
  return (await res.json()) as T;
}

test.describe('US-T-01 — open on Today', () => {
  test('T-01.1 — Open a newly added project on Today', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start();
    await openConsole(page, c);
    await page.getByRole('main').getByRole('button', { name: 'Add project…' }).click();
    const dialog = page.locator('.modal .dialog');
    await dialog.getByRole('textbox', { name: 'Folder path' }).fill(kanban.dir);
    await dialog.getByRole('textbox', { name: 'Folder path' }).press('Enter');
    await expect(page).toHaveURL(/\/p\/p_[0-9a-z]{12}\/today$/, { timeout: COLD_READ_MS });
    await expect(heading(page)).toHaveText('Morgan, 2 things require you', { timeout: COLD_READ_MS });
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: approver');
    await expect(
      page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Today', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('kanban · Today — WingFoil UI');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('T-01.2 — Open on Today read-only for a user who is not in the team', async ({ page, fixtures, consoles }) => {
    const kanban = await copyAs(fixtures, 'kanban', 'Riley');
    const c = await consoles.start();
    await openConsole(page, c);
    await page.getByRole('main').getByRole('button', { name: 'Add project…' }).click();
    const dialog = page.locator('.modal .dialog');
    await dialog.getByRole('textbox', { name: 'Folder path' }).fill(kanban.dir);
    await dialog.getByRole('textbox', { name: 'Folder path' }).press('Enter');
    await expect(page).toHaveURL(/\/p\/p_[0-9a-z]{12}\/today$/, { timeout: COLD_READ_MS });
    const sentence = page.locator('.today-identity');
    await expect(sentence).toHaveText("You are not in this project's team — How to join", { timeout: COLD_READ_MS });
    await expect(heading(page)).toHaveText('Today');
    await expect(requiresYou(page)).toHaveCount(0);
    // Waiting on others is still computed (RP-27).
    await expect(rowOf(waiting(page), 'task-002-password-reset')).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
    // How to join, from the keyboard: the panel of task-035.
    const join = sentence.getByRole('button', { name: 'How to join' });
    await tabUntil(page, join);
    await expectFocusVisible(join);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'How to join this project' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(join).toBeFocused();
  });
});

test.describe('US-T-02 — Requires you', () => {
  test('T-02.1 — List the items requiring the approver', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    await expect(heading(page)).toHaveText('Morgan, 2 things require you');
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: approver');
    expect((await idsOf(requiresYou(page))).sort()).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
    const row = rowOf(requiresYou(page), 'task-001-login-form');
    await expect(row.locator('.type-tag')).toHaveText('task');
    await expect(row.getByRole('link', { name: 'Login form', exact: true })).toBeVisible();
    await expect(row.locator('.today-reason')).toHaveText('pending for 3 days');
    await expect(row.locator('.state-pill')).toHaveText('pending');
    await expect(row.getByRole('button')).toHaveText('Approve');
    await expect(row.getByRole('button')).toHaveAccessibleName('Approve task-001-login-form');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('T-02.2 — Show one primary action per row', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    const rows = requiresYou(page).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) await expect(row.getByRole('button')).toHaveCount(1);
    // The action opens the element panel, from the keyboard (D36-3: no write from Today).
    const action = rowOf(requiresYou(page), 'task-001-login-form').getByRole('button');
    await tabUntil(page, action);
    await expectFocusVisible(action);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname.startsWith('/api/p/')) posts.push(r.url());
    });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-001-login-form`);
    await expect(page.getByRole('dialog', { name: 'Login form', exact: true })).toBeVisible({ timeout: COLD_READ_MS });
    expect(posts).toEqual([]);
  });

  test('T-02.3 — Follow the role view', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Alex')] });
    await openToday(page, c);
    await selectRoleView(page, 'approver');
    await expect(requiresYou(page).getByRole('listitem')).toHaveCount(2);
    await selectRoleView(page, 'product-owner');
    await expect(requiresYou(page).getByRole('listitem')).toHaveCount(0);
    await expect(requiresYou(page).getByText('Nothing requires you')).toBeVisible();
    await expect(heading(page)).toHaveText('Alex, nothing requires you');
  });
});

test.describe('US-T-03 — rejected work first', () => {
  test('T-03.1 — List my rejected work first, with the reason', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Jordan')] });
    await openToday(page, c);
    expect(await idsOf(requiresYou(page))).toEqual(['task-002-password-reset', 'task-004-session-timeout']);
    const first = rowOf(requiresYou(page), 'task-002-password-reset');
    await expect(first.locator('.today-reason')).toHaveText('Rejected by Morgan: Missing acceptance criteria');
    // Shown as a rejection: the danger colour of the theme.
    await expect(first.locator('.today-reason')).toHaveClass(/today-reason-rejection/);
    await expect(rowOf(requiresYou(page), 'task-004-session-timeout').getByRole('button')).toHaveText('Submit');
  });

  test(
    'T-03.2 — Drop the rejection once the work is submitted again',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const kanban = await copyAs(fixtures, 'kanban', 'Jordan');
      const c = await consoles.start({ projects: [kanban] });
      await recordServerEvents(page);
      await openToday(page, c);
      await expect(rowOf(requiresYou(page), 'task-002-password-reset')).toBeVisible();
      const clock = refreshClock();
      await mutateAndWait(
        page,
        () => {
          clock.start();
          return cli(kanban, ['memory', 'submit', 'task-002-password-reset']);
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect
        .poll(() => idsOf(requiresYou(page)), { timeout: clock.timeout() })
        .toEqual(['task-004-session-timeout']);
      clock.done('T-03.2 Requires you refreshed');
      await expect(page.getByRole('status', { name: 'Today updates' })).toHaveText('Requires you updated: 1 item');
    },
  );
});

test.describe('US-T-04 — reviewer queue', () => {
  /** The custom fixture where Sam holds reviewer and approver. */
  const samApprover = (fixtures: { copy(kind: FixtureKind): Promise<Fixture> }) =>
    copyAs(fixtures, 'custom', 'Sam', (fx) =>
      cli(fx, ['dna', 'update', 'team.members', '--value', 'Sam', '--entry-roles', 'reviewer, approver']).then(
        () => undefined,
      ),
    );

  test('T-04.1 — List the items in a review state for a reviewer holding approver', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await samApprover(fixtures)] });
    await openToday(page, c);
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: reviewer');
    const row = rowOf(requiresYou(page), 'task-001-cli-adapter');
    await expect(row.locator('.today-reason')).toHaveText('in-review for 3 days');
    await expect(row.getByRole('button')).toHaveText('Review');
  });

  test(
    'T-04.2 — Drop an item that leaves the review state',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const custom = await samApprover(fixtures);
      const c = await consoles.start({ projects: [custom] });
      await recordServerEvents(page);
      await openToday(page, c);
      await expect(rowOf(requiresYou(page), 'task-001-cli-adapter')).toBeVisible();
      const clock = refreshClock();
      await mutateAndWait(
        page,
        () => {
          clock.start();
          return cli(custom, ['memory', 'approve', 'task-001-cli-adapter', '--reason', 'Looks good']);
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(rowOf(requiresYou(page), 'task-001-cli-adapter')).toHaveCount(0, { timeout: clock.timeout() });
      clock.done('T-04.2 Requires you refreshed');
    },
  );
});

test.describe('US-T-05 — unknown state', () => {
  test('T-05.1 — List an undeclared state as "Action required"', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'unknown', 'Morgan')] });
    await openToday(page, c);
    await selectRoleView(page, 'tech-lead');
    const row = rowOf(requiresYou(page), 'note-002-retro');
    await expect(row.locator('.today-reason')).toHaveText('Action required — state on-hold is not declared for note');
    await expect(row.getByRole('button')).toHaveText('Open');
  });

  test('T-05.2 — Derive the actions of a declared but unfamiliar gate', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'unknown', 'Morgan')] });
    await openToday(page, c);
    await expect(page.locator('.today .page-intro')).toHaveText('Role view: approver');
    const row = rowOf(requiresYou(page), 'story-001-onboarding');
    await expect(row.locator('.today-reason')).toHaveText('shaping for 3 days');
    await expect(row.getByRole('button')).toHaveText('Approve');
  });
});

test.describe('US-T-06 — informational gate without approver', () => {
  test('T-06.1 — Show a gate as informational to a reviewer without approver', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Sam')] });
    await openToday(page, c);
    await expect(rowOf(requiresYou(page), 'task-001-cli-adapter')).toHaveCount(0);
    await expect(rowOf(waiting(page), 'task-001-cli-adapter').locator('.today-who')).toHaveText(
      'Reserved to approver — Morgan, Alex',
    );
  });

  test('T-06.2 — Show the same gate as informational to a product owner without approver', async ({
    page,
    fixtures,
    consoles,
  }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Casey')] });
    await openToday(page, c);
    await expect(rowOf(waiting(page), 'dl-002-use-fastify').locator('.today-who')).toHaveText(
      'Reserved to approver — Morgan, Alex',
    );
  });
});

test.describe('US-T-11 — Waiting on others', () => {
  test('T-11.1 — List the items blocked on another member', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    await expect(rowOf(waiting(page), 'task-002-password-reset').locator('.today-who')).toHaveText(
      'Jordan (submitter) must act',
    );
    await expect(rowOf(waiting(page), 'task-004-session-timeout').locator('.today-who')).toHaveText(
      'Jordan (creator) must act',
    );
    // A row opens the element panel.
    await rowOf(waiting(page), 'task-002-password-reset').getByRole('link').click();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-002-password-reset`);
  });

  test('T-11.2 — Name the workflow engine for an engine-waiting state', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Morgan')] });
    await openToday(page, c);
    await expect(rowOf(waiting(page), 'minor-v0.1').locator('.today-who')).toHaveText(
      'Waiting for the workflow engine',
    );
    expect(await scanThemes(page)).toEqual([]);
  });

  test('T-11.3 — Do not repeat an item that requires me', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    await expect(rowOf(requiresYou(page), 'task-001-login-form')).toBeVisible();
    await expect(rowOf(waiting(page), 'task-001-login-form')).toHaveCount(0);
  });
});

test.describe('TT-PERF-09 — zero navigation to what requires me (D36-10)', () => {
  for (const kind of ['kanban', 'custom', 'unknown'] as const) {
    test(`TT-PERF-09 — every role view lists the API's Requires you (${kind})`, async ({
      page,
      fixtures,
      consoles,
    }) => {
      const copies = await Promise.all(MEMBERS.map((m) => copyAs(fixtures, kind, m.name)));
      const c = await consoles.start({ projects: copies });
      let session = false;
      for (const [i, member] of MEMBERS.entries()) {
        const pid = c.pids[i]!;
        // Opened by the project's URL: Today is the landing view, no navigation step.
        if (session) {
          await page.goto(`${c.origin}/p/${pid}`, { timeout: COLD_READ_MS });
          await expect(page).toHaveURL(`${c.origin}/p/${pid}/today`, { timeout: COLD_READ_MS });
          await expect(heading(page)).toBeVisible({ timeout: COLD_READ_MS });
        } else {
          await openToday(page, c, pid);
          session = true;
        }
        const header = await apiJson<ProjectHeader>(page, c, `/api/p/${pid}`);
        expect(header.roleViews, member.name).toEqual([...member.roles]);
        for (const view of header.roleViews) {
          if (header.roleViews.length > 1) await selectRoleView(page, view);
          const today = await apiJson<Today>(page, c, `/api/p/${pid}/today?view=${encodeURIComponent(view)}`);
          const expected = (today.requiresYou ?? []).map((r) => r.element.id);
          await expect
            .poll(() => idsOf(requiresYou(page)), { timeout: COLD_READ_MS, message: `${member.name} · ${view}` })
            .toEqual(expected);
        }
      }
    });
  }
});
