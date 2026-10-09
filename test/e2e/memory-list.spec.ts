// task-017 — the Memory list and its live refresh on the real bin (US-M-01, US-M-02, US-S-25,
// US-S-26, US-S-28), on the built kanban, custom and unknown fixtures (copies when a test mutates
// one). Assertions are on what the user sees; the CLI process counts of S-26.3 stay in the
// server-side process audit (test/server/snapshot/process-audit.test.ts). The scenarios' "I am
// Alex" is the fixtures' own identity.
import type { Locator, Page, Request } from '@playwright/test';
import type { MemorySearch } from '@wingfoil-ui/contracts';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Fixture } from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { scanThemes } from './support/axe.js';
import { COLD_READ_MS, expectFirstLoad, LIVE_REFRESH_TAG, refreshClock } from './support/cold-read.js';
import { openConsole, type RunningConsole } from './support/console.js';
import { cli, mutateAndWait, recordServerEvents } from './support/events.js';
import { expect, test } from './support/fixtures.js';
import { expectFocusVisible } from './support/keyboard.js';

// The fixtures of this spec, built before its first test (shared support, bug-004).
test.use({ prebuild: ['kanban', 'custom', 'unknown'] });

/** Open the Memory list of the console's project `i` (optionally with a query string). */
async function openList(page: Page, c: RunningConsole, query = '', i = 0): Promise<void> {
  await openConsole(page, c, { path: `/p/${c.pids[i]}/memory${query}` });
  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
  // The first read of a cold console runs the CLI (≤ 6 processes): slower than the default 5 s
  // expectation on a loaded machine; later assertions keep the default.
  await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
}

/**
 * The page's API requests (the event stream aside): the reads of the element list, and a settled
 * point — no request in flight and none started or ended for 500 ms (review F7).
 */
function trackApi(page: Page): { listReads: string[]; settled(): Promise<void> } {
  const inflight = new Set<Request>();
  const listReads: string[] = [];
  let last = Date.now();
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!url.pathname.startsWith('/api/') || url.pathname === '/api/events') return;
    inflight.add(r);
    last = Date.now();
    if (/^\/api\/p\/[^/]+\/elements$/.test(url.pathname)) listReads.push(r.url());
  });
  const done = (r: Request) => {
    if (inflight.delete(r)) last = Date.now();
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return {
    listReads,
    settled: () =>
      expect
        .poll(() => inflight.size === 0 && Date.now() - last >= 500, { timeout: COLD_READ_MS, intervals: [100] })
        .toBe(true),
  };
}

function typeList(page: Page): Locator {
  return page.getByRole('list', { name: 'Element types' });
}

function stateList(page: Page): Locator {
  return page.getByRole('list', { name: 'States' });
}

function rows(page: Page): Locator {
  return page.getByRole('list', { name: 'Elements' }).getByRole('link');
}

/** The row of `eid`. */
function row(page: Page, eid: string): Locator {
  return page.locator(`.memory-row[data-eid="${eid}"]`);
}

/** The filter names of a filter list, without the "All …" entry, as the user reads them. */
async function filterNames(list: Locator): Promise<string[]> {
  const names = await list
    .getByRole('link')
    .evaluateAll((links) =>
      links.map((a) => a.querySelector('span:not(.filter-count):not(.filter-dot)')?.textContent ?? ''),
    );
  return names.slice(1);
}

/** The listed element ids, in order. */
async function listed(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((links) => links.map((a) => (a as HTMLElement).dataset['eid'] ?? ''));
}

/** Rewrite the title of the element file `file` in the working tree, without committing. */
async function editTitle(fx: Fixture, file: string, title: string): Promise<void> {
  const full = path.join(fx.dir, file);
  const text = await readFile(full, 'utf8');
  await writeFile(full, text.replace(/^title: .*$/m, `title: "${title}"`));
}

test.describe('US-M-01 — Memory list', () => {
  test('M-01.1 — Filter by type with counts', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    // The project opens on its Memory list (W3-22).
    await openConsole(page, c, { path: `/p/${c.pids[0]}` });
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/memory`);
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible({ timeout: COLD_READ_MS });
    await expect(typeList(page).getByRole('link', { name: 'task, 4 elements' })).toBeVisible();
    await expect(typeList(page).getByRole('link', { name: 'bug, 1 element' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Memory' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('kanban · Memory — WingFoil UI');
    expect(await scanThemes(page)).toEqual([]);
  });

  test('M-01.5 — List one type with its real states', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openList(page, c);
    // Keyboard: the type filter is a link reached and followed from the keyboard.
    const task = typeList(page).getByRole('link', { name: 'task, 4 elements' });
    await task.focus();
    await expectFocusVisible(task);
    await page.keyboard.press('Enter');
    await expect(task).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(() => listed(page))
      .toEqual(['task-001-login-form', 'task-002-password-reset', 'task-003-logout', 'task-004-session-timeout']);
    expect(await filterNames(stateList(page))).toEqual(['draft', 'pending', 'approved']);
    // Each state pill carries its state name (not colour alone) and the descriptor's tone.
    await expect(row(page, 'task-001-login-form').locator('.state-pill')).toHaveText('pending');
    await expect(row(page, 'task-001-login-form').locator('.state-pill')).toHaveClass(/\btone-human\b/);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('M-01.2 — Filter all types by bucket', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openList(page, c);
    await typeList(page)
      .getByRole('link', { name: /^All types,/ })
      .click();
    await stateList(page)
      .getByRole('link', { name: /^To approve,/ })
      .click();
    await expect.poll(() => listed(page)).toEqual(['bug-001-crash-on-save', 'task-001-login-form']);
    await expect(page).toHaveURL(/\?bucket=toApprove$/);
    expect(await scanThemes(page)).toEqual([]);
  });

  test('M-01.3 — Open the element panel from the list', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openList(page, c, '?type=task');
    const logout = row(page, 'task-003-logout');
    await logout.focus();
    await expectFocusVisible(logout);
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Logout', exact: true });
    // The panel's first read (bug-004): until it answers, the dialog is named by the id.
    await expectFirstLoad(panel.locator('.type-tag'));
    await expect(panel.getByText('task-003-logout', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/e/task-003-logout`);
    // Close: back to the list with its filter, the focus on the row it was opened from (W3-23).
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(`${c.origin}/p/${c.pids[0]}/memory?type=task`);
    // The row is focused once the list is complete, archived elements included (a cold read).
    await expect(row(page, 'task-003-logout')).toBeFocused({ timeout: COLD_READ_MS });
    await expectFocusVisible(row(page, 'task-003-logout'));
  });

  test('M-01.4 — Show a type with no element', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    await openList(page, c);
    const adr = typeList(page).getByRole('link', { name: 'adr, 0 elements' });
    await expect(adr).toBeVisible();
    await adr.click();
    await expect(page.getByText('No adr yet', { exact: true })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });
});

test.describe('US-M-02 — unknown types and states', () => {
  test('M-02.1 — List unknown types under their own names', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openList(page, c);
    expect(await filterNames(typeList(page))).toEqual(['story', 'note']);
    await expect(typeList(page).getByRole('link', { name: 'story, 2 elements' })).toBeVisible();
    await expect(typeList(page).getByRole('link', { name: 'note, 2 elements' })).toBeVisible();
    expect(await scanThemes(page)).toEqual([]);
  });

  test('M-02.3 — Show the declared states of an unknown type', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openList(page, c);
    await typeList(page)
      .getByRole('link', { name: /^story,/ })
      .click();
    await expect(typeList(page).getByRole('link', { name: /^story,/ })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => filterNames(stateList(page))).toEqual(['idea', 'shaping', 'ready-to-build', 'shipped']);
  });

  for (const [bucket, elements] of [
    ['To approve', ['story-001-onboarding']],
    ['In progress', ['note-002-retro']],
    ['Waiting/drafts/closed', ['note-001-kickoff', 'story-002-billing']],
    ['Done', []],
  ] as const) {
    test(`M-02.2 — Group unknown states in generic buckets: ${bucket}`, async ({ page, fixtures, consoles }) => {
      const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
      await openList(page, c);
      await stateList(page)
        .getByRole('link', { name: new RegExp(`^${bucket.replace('/', '\\/')},`) })
        .click();
      await expect(
        stateList(page).getByRole('link', { name: new RegExp(`^${bucket.replace('/', '\\/')},`) }),
      ).toHaveAttribute('aria-current', 'page');
      await expect.poll(async () => (await listed(page)).sort()).toEqual([...elements].sort());
      if (elements.length === 0) {
        await expect(page.getByText('No element matches these filters.', { exact: true })).toBeVisible();
      }
    });
  }
});

test.describe('US-S-25 — working tree and local changes', () => {
  const FILE = 'docs/memory/task/task-001-login-form.md';

  test('S-25.1 — Mark an element with uncommitted changes', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    await editTitle(kanban, FILE, 'Login form v2');
    const c = await consoles.start({ projects: [kanban] });
    await openList(page, c);
    const r = row(page, 'task-001-login-form');
    await expect(r.locator('.memory-title')).toHaveText('Login form v2');
    await expect(r.getByText('local changes', { exact: true })).toBeVisible();
    await expect(row(page, 'task-002-password-reset').getByText('local changes')).toHaveCount(0);
    expect(await scanThemes(page)).toEqual([]);
  });

  test(
    'S-25.2 — Remove the marker once the change is committed',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const kanban = await fixtures.copy('kanban');
      await editTitle(kanban, FILE, 'Login form v2');
      const c = await consoles.start({ projects: [kanban] });
      await recordServerEvents(page);
      await openList(page, c);
      const marker = row(page, 'task-001-login-form').getByText('local changes', { exact: true });
      await expect(marker).toBeVisible();
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      // By itself, without a reload; within 5 s of the commit under `npm run test:timing` (W3-47).
      const clock = refreshClock();
      await mutateAndWait(
        page,
        async () => {
          await git(kanban.dir, ['add', '--', FILE], kanban.env);
          clock.start();
          await git(kanban.dir, ['commit', '--quiet', '-m', 'docs: retitle the login form'], kanban.env);
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(marker).toBeHidden({ timeout: clock.timeout() });
      clock.done('S-25.2 marker removed');
      await expect(row(page, 'task-001-login-form').locator('.memory-title')).toHaveText('Login form v2');
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    },
  );

  test('S-25.3 — Show an uncommitted new element', async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const source = await readFile(path.join(kanban.dir, 'docs/memory/task/task-004-session-timeout.md'), 'utf8');
    await writeFile(
      path.join(kanban.dir, 'docs/memory/task/task-009-draft-idea.md'),
      source
        .replace(/^id: .*$/m, 'id: task-009-draft-idea')
        .replace(/^title: .*$/m, 'title: "Draft idea"')
        .replace(/^status: .*$/m, 'status: draft'),
    );
    const c = await consoles.start({ projects: [kanban] });
    await openList(page, c);
    const r = row(page, 'task-009-draft-idea');
    await expect(r).toBeVisible();
    await expect(r.getByText('local changes', { exact: true })).toBeVisible();
  });
});

test.describe('US-S-26 — refresh by itself', () => {
  test(
    'S-26.1 — Refresh after a commit made outside the UI',
    { tag: LIVE_REFRESH_TAG },
    async ({ page, fixtures, consoles }) => {
      const kanban = await fixtures.copy('kanban');
      const c = await consoles.start({ projects: [kanban] });
      await recordServerEvents(page);
      await openList(page, c);
      const pill = row(page, 'task-001-login-form').locator('.state-pill');
      await expect(pill).toHaveText('pending');
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      // From the start of the CLI verb that commits (W3-47).
      const clock = refreshClock();
      await mutateAndWait(
        page,
        () => {
          clock.start();
          return cli(kanban, ['memory', 'approve', 'task-001-login-form', '--reason', 'Looks good']);
        },
        { event: 'repo', pid: c.pids[0]! },
      );
      await expect(pill).toHaveText('approved', { timeout: clock.timeout() });
      clock.done('S-26.1 state pill refreshed');
      // Without a page reload: the marker set before the change is still there.
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
      await expect(page.getByRole('status', { name: 'Memory list updates' })).toHaveText('The list was updated.');
    },
  );

  test('S-26.2 — Refresh an open element panel', { tag: LIVE_REFRESH_TAG }, async ({ page, fixtures, consoles }) => {
    const kanban = await fixtures.copy('kanban');
    const c = await consoles.start({ projects: [kanban] });
    await recordServerEvents(page);
    await openList(page, c);
    await row(page, 'task-001-login-form').click();
    const panel = page.getByRole('dialog', { name: 'Login form', exact: true });
    await expectFirstLoad(panel.getByRole('listitem').filter({ hasText: 'submitted by Jordan' }));
    const clock = refreshClock();
    await mutateAndWait(
      page,
      () => {
        clock.start();
        return cli(kanban, ['memory', 'approve', 'task-001-login-form', '--reason', 'Looks good']);
      },
      { event: 'repo', pid: c.pids[0]! },
    );
    const line = panel.getByRole('listitem').filter({ hasText: 'signed off by Alex' });
    await expect(line).toBeVisible({ timeout: clock.timeout() });
    clock.done('S-26.2 open panel refreshed');
    const head = (await git(kanban.dir, ['rev-parse', 'HEAD'], kanban.env)).stdout.trim();
    await expect(line).toContainText(head.slice(0, 7));
    await expect(line).toContainText('“Looks good”');
  });

  test('S-26.3 — Read the CLI once per state of the repository', async ({ page, fixtures, consoles }) => {
    // The screen half: the list opened again with no change shows the same list without a new read
    // (the server-side CLI count is the process audit's: test/server/snapshot/process-audit.test.ts).
    const c = await consoles.start({ projects: [await fixtures.get('kanban')] });
    const api = trackApi(page);
    await openList(page, c);
    await api.settled();
    const first = await listed(page);
    expect(api.listReads).toHaveLength(1);
    // Away (the element panel) and back to the list.
    await row(page, 'task-002-password-reset').click();
    await expectFirstLoad(page.getByRole('dialog').locator('.type-tag'));
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible();
    await api.settled();
    expect(await listed(page)).toEqual(first);
    expect(api.listReads).toHaveLength(1);
  });
});

test.describe('US-S-28 — three fixtures, no UI change', () => {
  const TYPES = {
    kanban: ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec'],
    custom: ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug', 'plan', 'service'],
    unknown: ['story', 'note'],
  } as const;

  for (const kind of ['kanban', 'custom', 'unknown'] as const) {
    test(`S-28.1 — Render each fixture with the same UI build: ${kind}`, async ({ page, fixtures, consoles }) => {
      const fx = await fixtures.get(kind);
      const c = await consoles.start({ projects: [fx] });
      await openList(page, c);
      expect(await filterNames(typeList(page))).toEqual([...TYPES[kind]]);
      // Every element of the fixture (as the CLI lists it) with its own state name.
      const search = JSON.parse(await cli(fx, ['--format', 'json', 'memory', 'search'])) as MemorySearch;
      expect((await listed(page)).sort()).toEqual(search.matches.map((m) => m.id).sort());
      for (const m of search.matches) {
        await expect(row(page, m.id).locator('.state-pill')).toHaveText(m.status);
      }
      if (kind === 'custom') expect(await scanThemes(page)).toEqual([]);
    });
  }

  test('S-28.2 — Derive the state machine of an unknown type', async ({ page, fixtures, consoles }) => {
    const c = await consoles.start({ projects: [await fixtures.get('unknown')] });
    await openList(page, c);
    await row(page, 'story-001-onboarding').click();
    const machine = page.getByRole('dialog').getByRole('list', { name: 'State machine' });
    await expectFirstLoad(page.getByRole('dialog').locator('.type-tag'));
    const chips = machine.getByRole('listitem');
    await expect(chips.locator('[aria-hidden="true"]')).toHaveText(['idea', 'shaping', 'ready-to-build', 'shipped']);
    const current = chips.filter({ has: page.locator('[aria-hidden="true"]', { hasText: /^shaping$/ }) });
    await expect(current).toHaveAttribute('aria-current', 'step');
    await expect(current.locator('.visually-hidden')).toHaveText('shaping, current state');
  });
});
