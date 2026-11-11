// task-061 — the Today cards in v0.3 on the real bin (US-T-02 T-02.4 … T-02.7; ux-reference §4.1 v0.3;
// REQ-PERF-11's 10 rows; decisions D61-4 … D61-10, D61-12): a type and a state filter per card with
// the counts of its rows, the first 10 rows then "Show all (<n>)" / "Show fewer", the date each
// element entered its state (the full time as its accessible description) and the short id the API
// serves. The user is set with `actAs` on a fixture copy; T-02.6's 11 more pending tasks are added
// with the pinned CLI before the console starts (RP3-16 P4). Every first read waits with
// `COLD_READ_MS`, lists with retrying expects (bug-009); assertions are on what the user sees.
import type { Locator, Page } from '@playwright/test';
import type { Fixture, FixtureKind, MemberName } from '../harness/fixtures/index.js';
import { addPendingTasks } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { expect, test } from './support/fixtures.js';
import { actAs } from './support/identity.js';
import { cli, mutateAndWait, recordServerEvents } from './support/events.js';
import { expectFocusVisible, tabUntil } from './support/keyboard.js';
import { expectSettled } from './support/screens.js';
import { recordApiData, screenTextsOutsideCatalogue } from './support/strings.js';

test.use({ prebuild: ['kanban', 'custom'] });

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

/** The filter `label` ("Type" or "State") of `card` (React Aria names it by the value, then the label). */
const filterOf = (card: Locator, label: string): Locator =>
  card.getByRole('button', { name: new RegExp(` ${label}$`) });

/** The names of the options of `filter`, its listbox opened and closed again with Escape. */
async function optionsOf(page: Page, filter: Locator): Promise<string[]> {
  await filter.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const names = await listbox.getByRole('option').allTextContents();
  await page.keyboard.press('Escape');
  await expect(listbox).toHaveCount(0);
  return names;
}

/** A copy of `kind` where the user is `name`, after `prepare` (CLI moves before the identity). */
async function copyAs(
  fixtures: { copy(kind: FixtureKind): Promise<Fixture> },
  kind: FixtureKind,
  name: MemberName,
  prepare: (fx: Fixture) => Promise<unknown> = async () => {},
): Promise<Fixture> {
  const fx = await fixtures.copy(kind);
  await prepare(fx);
  await actAs(fx, name);
  return fx;
}

/** Open project `pid` on Today and wait for its first read. */
async function openToday(page: Page, c: RunningConsole, pid = c.pids[0]!): Promise<void> {
  await openConsole(page, c, { path: `/p/${pid}/today` });
  await expect(page.locator('.today').getByRole('status').filter({ hasText: 'Reading Today…' })).toHaveCount(0, {
    timeout: COLD_READ_MS,
  });
  await expect(requiresYou(page).locator('li[data-eid]').first()).toBeVisible({ timeout: COLD_READ_MS });
}

test.describe('US-T-02 — Requires you (v0.3)', () => {
  test('T-02.4 — Filter a card by type and by state', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'kanban', 'Morgan')] });
    await openToday(page, c);
    await expect(heading(page)).toHaveText('Morgan, 2 things require you');
    await expect.poll(() => idsOf(waiting(page))).toEqual(['task-002-password-reset', 'task-004-session-timeout']);
    // From the keyboard: Tab to the type filter (visible focus), open it, choose "bug (1)".
    const type = filterOf(requiresYou(page), 'Type');
    await tabUntil(page, type);
    await expectFocusVisible(type);
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option')).toHaveText(['All (2)', 'bug (1)', 'task (1)']);
    // The listbox opens on the selection, "All (2)"; the next option is "bug (1)".
    await expect(listbox.getByRole('option', { name: 'All (2)', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => idsOf(requiresYou(page))).toEqual(['bug-001-crash-on-save']);
    await expect(type).toHaveText('bug (1)');
    expect(await optionsOf(page, filterOf(requiresYou(page), 'State'))).toEqual(['All (2)', 'pending (2)']);
    // The Waiting on others card is not filtered.
    expect(await idsOf(waiting(page))).toEqual(['task-002-password-reset', 'task-004-session-timeout']);
    await expect(filterOf(waiting(page), 'Type')).toHaveText('All (2)');
    await expect(filterOf(waiting(page), 'State')).toHaveText('All (2)');
    // The greeting and the bell count every row, unfiltered (S4).
    await expect(heading(page)).toHaveText('Morgan, 2 things require you');
    await expect(page.getByRole('banner').locator('.bell-count')).toHaveText('2');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('T-02.5 — Show when each element entered its current state', async ({ page, fixtures, consoles }) => {
    const fx = await copyAs(fixtures, 'kanban', 'Morgan');
    const c = await consoles.start({ projects: [fx] });
    // The time of task-001-login-form's submit: the commit that moved it into `pending`.
    const submitted = (
      await git(fx.dir, ['log', '-1', '--format=%cI', '--grep=^wf(task): submit task-001-login-form$'], fx.env)
    ).stdout.trim();
    expect(submitted).not.toBe('');
    await openToday(page, c);
    const since = rowOf(requiresYou(page), 'task-001-login-form').locator('time.today-since');
    const shown = await page.evaluate((iso) => {
      const at = new Date(iso);
      return {
        date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(at),
        full: new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' }).format(at),
      };
    }, submitted);
    await expect(since).toHaveText(`since ${shown.date}`);
    await expect(since).toHaveAccessibleDescription(shown.full);
    expect(Date.parse((await since.getAttribute('datetime')) ?? '')).toBe(Date.parse(submitted));
    // The reason of T-02.1 is unchanged.
    await expect(rowOf(requiresYou(page), 'task-001-login-form').locator('.today-reason')).toHaveText(
      'pending for 3 days',
    );
    // The row's link carries the full time too (review round 1 F-3): the title link of Requires you,
    // the whole row's link of Waiting on others (its own `since`, the time of its last move).
    await expect(
      rowOf(requiresYou(page), 'task-001-login-form').getByRole('link', { name: 'Login form' }),
    ).toHaveAccessibleDescription(shown.full);
    const waitingRow = rowOf(waiting(page), 'task-002-password-reset');
    const waitingSince = (await waitingRow.locator('time.today-since').getAttribute('datetime')) ?? '';
    expect(waitingSince).not.toBe('');
    const waitingFull = await page.evaluate(
      (iso) => new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(iso)),
      waitingSince,
    );
    await expect(waitingRow.getByRole('link')).toHaveAccessibleDescription(waitingFull);
  });

  test('T-02.6 — Show the first 10 rows, then all of them on request', async ({ page, fixtures, consoles }) => {
    test.slow(); // 22 CLI commits on the copy before the console starts.
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', (copy) => addPendingTasks(copy, 11));
    const c = await consoles.start({ projects: [fx] });
    await openToday(page, c);
    await expect(heading(page)).toHaveText('Morgan, 13 things require you');
    await expect(requiresYou(page).locator('li[data-eid]')).toHaveCount(10);
    const ids = await idsOf(requiresYou(page));
    expect(ids.slice(0, 2)).toEqual(['task-001-login-form', 'bug-001-crash-on-save']);
    // The toggle by its class: its accessible name changes with its label.
    const toggle = requiresYou(page).locator('.today-toggle');
    await expect(toggle).toHaveAccessibleName('Show all (13)');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // From the keyboard, with visible focus.
    await tabUntil(page, toggle);
    await expectFocusVisible(toggle);
    await page.keyboard.press('Enter');
    await expect(requiresYou(page).locator('li[data-eid]')).toHaveCount(13);
    await expect(toggle).toHaveText('Show fewer');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toBeFocused();
    expect((await idsOf(requiresYou(page))).slice(0, 10)).toEqual(ids);
    // The greeting and the bell still count 13.
    await expect(heading(page)).toHaveText('Morgan, 13 things require you');
    await expect(page.getByRole('banner').locator('.bell-count')).toHaveText('13');
    expect(await scanThemes(page)).toEqual([]);
    await toggle.click();
    await expect(requiresYou(page).locator('li[data-eid]')).toHaveCount(10);
    await expect(toggle).toHaveText('Show all (13)');
  });

  test('T-02.7 — Name each row’s element by its short id', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await copyAs(fixtures, 'custom', 'Morgan')] });
    await openToday(page, c);
    await expect(rowOf(requiresYou(page), 'dl-002-use-fastify').locator('.today-id')).toHaveText('dl-002', {
      timeout: COLD_READ_MS,
    });
    await expect(rowOf(waiting(page), 'minor-v0.1').locator('.today-id')).toHaveText('minor-v0.1', {
      timeout: COLD_READ_MS,
    });
    // The action keeps the full id in its accessible name (Q4 (a)).
    await expect(
      rowOf(requiresYou(page), 'dl-002-use-fastify').getByRole('button', { name: 'Approve dl-002-use-fastify' }),
    ).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('Today cards — the focus when the toggle goes (task-061 review round 1 F-5, round 2 N-1)', () => {
  test('a refetch leaving 10 rows moves the focus from "Show fewer" to the card’s heading', async ({
    page,
    fixtures,
    consoles,
  }) => {
    test.slow(); // 22 CLI commits on the copy, then three approvals while Today is open.
    let added: string[] = [];
    const fx = await copyAs(fixtures, 'kanban', 'Morgan', async (copy) => {
      added = await addPendingTasks(copy, 11);
    });
    const c = await consoles.start({ projects: [fx] });
    await recordServerEvents(page);
    await openToday(page, c);
    const toggle = requiresYou(page).locator('.today-toggle');
    await expect(toggle).toHaveAccessibleName('Show all (13)');
    // From the keyboard: a click does not focus a button in every engine (WebKit).
    await tabUntil(page, toggle);
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText('Show fewer');
    await expect(toggle).toBeFocused();
    // Three approvals made outside the console: 10 rows are left, the toggle goes.
    for (const id of added.slice(-3)) {
      await mutateAndWait(page, () => cli(fx, ['memory', 'approve', id, '--reason', 'Done']), {
        event: 'repo',
        pid: c.pids[0]!,
      });
    }
    await expect(requiresYou(page).locator('li[data-eid]')).toHaveCount(10, { timeout: COLD_READ_MS });
    await expect(toggle).toHaveCount(0);
    await expect(requiresYou(page).getByRole('heading', { name: 'Requires you' })).toBeFocused();
  });
});

test.describe('US-X-09 — the Today cards in the key build (review F-1 round 1, F-4)', () => {
  test('X-09.1 — Render the cards’ strings from the message catalogue', async ({ page, fixtures, consoles }) => {
    test.slow(); // 22 CLI commits on the kanban copy before the console starts.
    const many = await copyAs(fixtures, 'kanban', 'Morgan', (copy) => addPendingTasks(copy, 11));
    const custom = await copyAs(fixtures, 'custom', 'Morgan');
    const c = await consoles.start({ projects: [many, custom] });
    const data = recordApiData(page);
    const check = async (state: string): Promise<void> => {
      await expectSettled(page);
      const outside = (await screenTextsOutsideCatalogue(page, data)).map((text) => `${state} — ${text}`);
      expect(outside).toEqual([]);
    };
    // Thirteen rows: collapsed ("Show all (<n>)"), then expanded ("Show fewer").
    await openConsole(page, c, { path: `/p/${c.pids[0]}/today`, build: 'keys' });
    const card = page.locator('.today-card').filter({ has: page.locator('.today-toggle') });
    await expect(card.locator('li[data-eid]')).toHaveCount(10, { timeout: COLD_READ_MS });
    await check('collapsed');
    await card.locator('.today-toggle').click();
    await expect(card.locator('li[data-eid]')).toHaveCount(13);
    await check('expanded');
    // The custom copy: the type "task" with the state "open" keeps no row of Requires you.
    data.reset({ untilNavigation: true });
    await openConsole(page, c, { path: `/p/${c.pids[1]}/today`, build: 'keys' });
    const first = page
      .locator('.today-card')
      .filter({ has: page.locator('.today-filters') })
      .first();
    await expect(first.locator('li[data-eid="dl-002-use-fastify"]')).toBeVisible({ timeout: COLD_READ_MS });
    const pick = async (filter: number, option: string): Promise<void> => {
      await first.locator('.today-filter-button').nth(filter).click();
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();
      // Options in the key build read as keys: pick by the value the option carries.
      await listbox.getByRole('option').filter({ hasText: option }).click();
      await expect(listbox).toHaveCount(0);
    };
    await pick(0, 'task');
    await pick(1, 'open');
    await expect(first.locator('li[data-eid]')).toHaveCount(0);
    await expect(first.locator('.today-empty')).toBeVisible();
    await check('no row matches');
  });
});
