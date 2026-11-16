/**
 * The v0.1 screens (task-021; W5-11, decided by the user 2026-10-10): every screen of the release
 * with how to reach it and when it is ready, shared by the axe scan of X-06.4 (normal build) and
 * the catalogue check of X-09.1 (key-rendering build). A screen is reached by its URL and by
 * structure (roles, classes), never by an English text, so the same list runs on the key build.
 * The console holds the kanban fixture and the custom fixture, the user is Morgan in both
 * (`startScreensConsole`), and a second kanban copy where the user is Riley, not in the team
 * (`pids[2]`, the *How to join* panel — task-035, D35-5; Today not in the team — task-036); state variants (refusals, notices of other identities, the unreachable
 * banner, a lost session) are scanned in the specs of their tasks (closure table of task-021).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { COLD_READ_MS } from './cold-read.js';
import type { Fixture } from '../../harness/fixtures/index.js';
import type { RunningConsole } from './console.js';
import type { Consoles, FixtureBuilds } from './fixtures.js';
import { actAs } from './identity.js';
import { installLoadingCheck, type LoadingCheckWindow } from './loading.js';
import { fetchCopy, remoteCommit, setRemoteUrl } from './remote.js';

/** An `origin` nothing listens on: every fetch fails (task-039, the "fetch failed" screen). */
export const UNREACHABLE_ORIGIN = 'http://127.0.0.1:9/kanban.git';

/** A kanban copy as Morgan whose `origin` git cannot reach (task-039, D39-12; `pids[3]`). */
export async function offlineCopy(fixtures: FixtureBuilds): Promise<Fixture> {
  const offline = await fixtures.copy('kanban');
  await actAs(offline, 'Morgan');
  await setRemoteUrl(offline, UNREACHABLE_ORIGIN);
  return offline;
}

/**
 * A kanban copy as Morgan one commit behind its fetched remote (task-040, D40-10; `pids[4]`): the
 * sidebar offers *Update*, the gate footer's copy-behind reason ends with *Update*. Auto-update is off
 * by default, so the screens console never moves it.
 */
export async function behindCopy(fixtures: FixtureBuilds): Promise<Fixture> {
  const behind = await fixtures.copy('kanban');
  await actAs(behind, 'Morgan');
  await remoteCommit(behind, 'outside.txt', 'pushed by someone else\n');
  await fetchCopy(behind);
  return behind;
}

/**
 * The console of the screens: kanban (`pids[0]`) and custom (`pids[1]`), Morgan in both; a kanban
 * copy where the user is Riley (`pids[2]`, task-035); a kanban copy as Morgan whose remote cannot be
 * reached (`pids[3]`, task-039); a kanban copy as Morgan one commit behind (`pids[4]`, task-040).
 */
export async function startScreensConsole(fixtures: FixtureBuilds, consoles: Consoles): Promise<RunningConsole> {
  const kanban = await fixtures.copy('kanban');
  const custom = await fixtures.copy('custom');
  const outsider = await fixtures.copy('kanban');
  await actAs(kanban, 'Morgan');
  await actAs(custom, 'Morgan');
  await actAs(outsider, 'Riley');
  const offline = await offlineCopy(fixtures);
  const behind = await behindCopy(fixtures);
  return consoles.start({ projects: [kanban, custom, outsider, offline, behind] });
}

/** Wait until no loading status is shown (every first read answered), whatever the build. */
export async function expectSettled(page: Page): Promise<void> {
  await installLoadingCheck(page);
  await page.waitForFunction(() => (window as unknown as LoadingCheckWindow).wfuiNoLoading(), undefined, {
    timeout: COLD_READ_MS,
  });
}

/** One screen of the release. */
export interface Screen {
  /** Its name in the reports. */
  name: string;
  /** Reach it from anywhere and wait until it is ready. */
  open(page: Page, c: RunningConsole): Promise<void>;
}

/** Go to `path` of the console (the session cookie set by the first opening) and wait for the shell. */
async function go(page: Page, c: RunningConsole, path: string): Promise<void> {
  await page.goto(`${c.origin}${path}`, { timeout: COLD_READ_MS });
  await page.getByRole('banner').waitFor({ timeout: COLD_READ_MS });
}

/** Open a project page and wait for its header and its content `ready`. */
async function project(page: Page, c: RunningConsole, path: string, ready: (page: Page) => Locator): Promise<void> {
  await go(page, c, path);
  await expect(page.locator('.project-header .project-version')).toBeVisible({ timeout: COLD_READ_MS });
  await expect(ready(page).first()).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
}

const trigger = (page: Page) => page.locator('.switcher-trigger');
const addDialog = (page: Page) => page.locator('.modal .dialog');

/** Open the switcher popover and wait for its rows. */
async function openSwitcherPopover(page: Page): Promise<void> {
  await trigger(page).click();
  await expect(page.locator('.switcher-row').first()).toBeVisible({ timeout: COLD_READ_MS });
  await expectSettled(page);
}

/** Every v0.1 screen (ux-reference 1.0 §3–§4, v0.1 parts). */
export const SCREENS: readonly Screen[] = [
  {
    name: 'start page (no project open)',
    open: async (page, c) => {
      await go(page, c, '/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
      await expect(trigger(page)).toBeVisible();
    },
  },
  {
    name: 'project switcher',
    open: async (page, c) => {
      await go(page, c, '/');
      await openSwitcherPopover(page);
    },
  },
  {
    name: 'remove project confirmation',
    open: async (page, c) => {
      await go(page, c, '/');
      await openSwitcherPopover(page);
      await page.locator('.switcher-remove').first().click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'add project dialog — local folder',
    open: async (page, c) => {
      await go(page, c, '/');
      await page.getByRole('main').getByRole('button').first().click();
      await expect(addDialog(page)).toBeVisible();
    },
  },
  {
    name: 'add project dialog — remote repository',
    open: async (page, c) => {
      await go(page, c, '/');
      await page.getByRole('main').getByRole('button').first().click();
      await addDialog(page).locator('.segmented-option').nth(1).click();
      await expect(addDialog(page).getByRole('textbox')).toHaveCount(2);
    },
  },
  {
    name: 'memory list',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/memory`, (p) => p.locator('.memory-row')),
  },
  {
    name: 'memory list filtered by type',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/memory?type=task`, (p) => p.locator('.memory-row')),
  },
  {
    // The element page since task-062 (the address opens it in the main region; the name is kept).
    name: 'element panel',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/e/task-001-login-form`, (p) => p.locator('[data-element-view] .type-tag')),
  },
  {
    name: 'role view selector open',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/team`, (p) => p.locator('.member-card'));
      await page.locator('.role-view-button').click();
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'DNA',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/dna`, (p) => p.locator('.rules-name')),
  },
  {
    name: 'directives',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/directives`, (p) => p.locator('.directive-row')),
  },
  {
    name: 'directive page',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/directives/wingfoil-cli`, (p) => p.locator('article h1')),
  },
  {
    name: 'team',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/team`, (p) => p.locator('.member-card')),
  },
  {
    name: 'documentation index',
    open: (page, c) => project(page, c, `/p/${c.pids[1]}/docs`, (p) => p.locator('.docs-index .docs-path')),
  },
  {
    name: 'document',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[1]}/docs/docs/01_vision/02_product-vision.md`, (p) => p.locator('article h1')),
  },
  {
    name: 'how to join panel',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[2]}/team`, (p) => p.locator('.member-card'));
      await page.locator('button.current-user-badge').click();
      const dialog = page.locator('.modal .dialog.how-to-join');
      await expect(dialog.locator('.how-to-join-leads li').first()).toBeVisible({ timeout: COLD_READ_MS });
      await expect(dialog.locator('code.cli-command')).toBeVisible();
      await expectSettled(page);
    },
  },
  {
    name: 'page not found',
    open: async (page, c) => {
      await go(page, c, '/no/such/page');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COLD_READ_MS });
    },
  },
  {
    // task-036: Today as Morgan (Requires you, Waiting on others), the landing view of a project.
    name: 'today',
    open: (page, c) => project(page, c, `/p/${c.pids[0]}/today`, (p) => p.locator('.today-row')),
  },
  {
    // task-036: Today as Riley, not in the team (the identity sentence with How to join, D36-8).
    name: 'today — not in team',
    open: (page, c) => project(page, c, `/p/${c.pids[2]}/today`, (p) => p.locator('.today-identity button')),
  },
  {
    // task-037 (D37-12): the gate footer with its reason cleared — outcomes disabled, the hint shown.
    name: 'element panel — gate footer, reason empty',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/e/task-001-login-form`, (p) =>
        p.locator('[data-element-view] .gate-reason-field'),
      );
      await page.locator('[data-element-view] .gate-reason-field').fill('');
      await expect(page.locator('[data-element-view] .gate-hint')).toBeVisible();
    },
  },
  {
    // task-037: a state the workflow engine leaves (custom `release` `planning`, S-24.2, RP-13).
    name: 'element panel — waiting for the workflow engine',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[1]}/e/minor-v0.1`, (p) => p.locator('[data-element-view] .element-footer')),
  },
  {
    // task-037: Riley, not in the team — the read-only line with How to join (S-13.2).
    name: 'element panel — read-only, not in team',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[2]}/e/task-001-login-form`, (p) =>
        p.locator('[data-element-view] .element-footer button'),
      ),
  },
  {
    // task-042 (D42-8): the notification bell's panel as Morgan — To unblock and Updates.
    name: 'notification panel',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/today`, (p) => p.locator('.today-row'));
      await page.locator('.bell-trigger').click();
      await expect(page.locator('.bell-panel .bell-item').first()).toBeVisible({ timeout: COLD_READ_MS });
      await expect(page.locator('.bell-panel .bell-update').first()).toBeVisible({ timeout: COLD_READ_MS });
      await expectSettled(page);
    },
  },
  {
    // task-038 (D38-13): the single-action footer, Submit enabled (a draft of the kanban fixture).
    name: 'element panel — submit footer',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/e/task-004-session-timeout`, (p) =>
        p.locator('[data-element-view] .submit-footer'),
      ),
  },
  {
    // task-039 (D39-12): the sidebar's git status after a failed fetch, git's message open.
    name: 'git status — fetch failed',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[3]}/team`, (p) => p.locator('.member-card'));
      const status = page.locator('.git-status');
      const answer = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/git/fetch'),
        { timeout: COLD_READ_MS },
      );
      await status.locator('.git-fetch').click();
      await answer;
      await expect(status.locator('.git-error')).toBeVisible({ timeout: COLD_READ_MS });
      await status.locator('.git-info').first().hover();
      await expect(page.locator('.git-tooltip')).toBeVisible();
      await expectSettled(page);
    },
  },
  {
    // task-041 (D41-1): Configuration › UI settings as Morgan; opened only — no setting is changed on
    // this shared console (C9: no forced theme).
    name: 'configuration — UI settings',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/configuration/ui-settings`, (p) => p.getByRole('switch').first()),
  },
  {
    // task-040 (D40-10): a copy one commit behind — the gate footer's reason with *Update* and the
    // sidebar's *Update*; opened only (nothing is updated on this shared console).
    name: 'git status — behind, Update in the sidebar and the footer',
    open: async (page, c) => {
      // The reason's paragraph, not its link: the key-rendering build drops rich-text tags (X-09.1).
      await project(page, c, `/p/${c.pids[4]}/e/task-001-login-form`, (p) =>
        p.locator('[data-element-view] .gate-blocked'),
      );
      await expect(page.locator('.git-status .git-update')).toBeVisible({ timeout: COLD_READ_MS });
    },
  },
  {
    // task-062 (D62-5): the element page of an ambiguous short id — its candidates. The screens console
    // holds no ambiguous id (its figures stay as they are), so the element read answers the contract's
    // 409 G-01.6 sets up (`task-001-login-form` and a hand-made copy; the real 409 and its axe scan are
    // G-01.6's, `element-page.spec.ts`).
    name: 'element page — candidates',
    open: async (page, c) => {
      await page.route(`**/api/p/${c.pids[0]}/elements/task-001`, (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'ambiguous-id',
              message: 'Ambiguous id',
              detail: {
                candidates: [
                  {
                    id: 'task-001-login-form',
                    shortId: 'task-001',
                    title: 'Login form',
                    type: 'task',
                    status: 'pending',
                  },
                  {
                    id: 'task-001-login-form-copy',
                    shortId: 'task-001',
                    title: 'Login form copy',
                    type: 'task',
                    status: 'pending',
                  },
                ],
                more: 0,
              },
            },
          }),
        }),
      );
      await project(page, c, `/p/${c.pids[0]}/e/task-001`, (p) => p.locator('[data-element-view] .candidate-link'));
    },
  },
  {
    // task-061 (D61-13): Today as Morgan with the Requires you card's type filter open (its listbox
    // of options with counts); the short ids and the entry dates are on the "today" screen.
    name: 'today — card filter open',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/today`, (p) => p.locator('.today-row'));
      await page.locator('.today-card .today-filter-button').first().click();
      await expect(page.locator('.today-filter-popover [role="option"]').first()).toBeVisible();
      await expectSettled(page);
    },
  },
  {
    // task-077 (D77-9): Today as Morgan with the side panel of `task-001-login-form` opened from its
    // Requires you title (`?panel=`, the view under it).
    name: 'element side panel (Today)',
    open: async (page, c) => {
      await project(page, c, `/p/${c.pids[0]}/today`, (p) => p.locator('.today-row'));
      await page.locator('.today-row[data-eid="task-001-login-form"] .today-title').click();
      await expect(page.locator('[role="dialog"][data-element-view] .type-tag')).toBeVisible({ timeout: COLD_READ_MS });
      await expectSettled(page);
    },
  },
  {
    // task-077 (D77-3, D77-9): the side panel of an ambiguous short value over Today — its candidates,
    // `?panel=` links on the view; the element read answers the 409 of "element page — candidates".
    name: 'element side panel — candidates',
    open: async (page, c) => {
      await page.route(`**/api/p/${c.pids[0]}/elements/task-001`, (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'ambiguous-id',
              message: 'Ambiguous id',
              detail: {
                candidates: [
                  {
                    id: 'task-001-login-form',
                    shortId: 'task-001',
                    title: 'Login form',
                    type: 'task',
                    status: 'pending',
                  },
                  {
                    id: 'task-001-login-form-copy',
                    shortId: 'task-001',
                    title: 'Login form copy',
                    type: 'task',
                    status: 'pending',
                  },
                ],
                more: 0,
              },
            },
          }),
        }),
      );
      await project(page, c, `/p/${c.pids[0]}/today?panel=task-001`, (p) =>
        p.locator('[role="dialog"][data-element-view] .candidate-link'),
      );
    },
  },
  {
    // task-078 (D78-10): the document dialog of a decision-log, rendered — its body answered with
    // headings, a table, a link of each class and a code block (the screens console holds the
    // template's body), through `page.route` on the element read. No image: its alternative text is
    // a word of a long body, which X-09.1 does not count as data (the images are AC-3's e2e).
    name: 'element document — rendered',
    open: (page, c) => openDocumentScreen(page, c, 'rendered'),
  },
  {
    name: 'element document — source',
    open: (page, c) => openDocumentScreen(page, c, 'source'),
  },
  {
    // task-064 (D64-4): Configuration › Taxonomy of the kanban project, every value inferred.
    name: 'configuration — taxonomy',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/configuration/taxonomy`, (p) => p.locator('table.config-types')),
  },
  {
    // task-064 (D64-5): Configuration › Progress of the custom project, every value inferred.
    name: 'configuration — progress',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[1]}/configuration/progress`, (p) => p.locator('table.config-progress')),
  },
  {
    // task-066 (D66-3, D66-7): the kanban list with *All types*, the bucket "To approve" narrowed to
    // its state `pending` — the sub-row and the active filter.
    name: 'memory list — bucket narrowed to a state',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/memory?bucket=toApprove&state=pending`, (p) => p.locator('.memory-active')),
  },
  {
    // task-066 (D66-4 … D66-6): the custom list filtered on the missing references, its rows badged and
    // its notes. The screens console holds no preset (not changed, RP-43): the list's answer gains the
    // flag section, one flagged row and one unreadable id through `page.route`, as the document screens.
    name: 'memory list — missing required references',
    open: (page, c) => openMissingScreen(page, c),
  },
  {
    // task-066 (D66-8, D66-9): the kanban list filtered on the figure "Pending gates" of `/progress`.
    name: 'memory list — figure filter',
    open: (page, c) =>
      project(page, c, `/p/${c.pids[0]}/memory?figure=pending-gates`, (p) => p.locator('.memory-active')),
  },
  {
    // task-065 (D65-4 … D65-8, D65-16): Today's progress card on the custom project with every figure
    // shown and both notes — `/progress` answered through `page.route` (the screens console has no
    // preset and is not changed, RP-43).
    name: 'today — progress card',
    open: (page, c) => openProgressScreen(page, c, PROGRESS_SCREEN_BODY),
  },
  {
    // task-065 (D65-7, D65-16): the completion's explanation open by keyboard focus (a key pressed
    // first: React Aria opens a tooltip on a focus it sees as the keyboard's).
    name: 'today — completion explanation open',
    open: async (page, c) => {
      await openProgressScreen(page, c, PROGRESS_SCREEN_BODY);
      await page.keyboard.press('Shift');
      await page.locator('.progress-completion-link').focus();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await expectSettled(page);
    },
  },
  {
    // task-065 (D65-5, D65-6, D65-9): the ui.yaml warning, the completion's reason and the phase
    // figures read-only on WingFoil 0.2.2 — the project header answered with 0.2.2 too, so the phase
    // text names the version it shows (review round 1, F-7).
    name: 'today — progress read-only and ui.yaml ignored',
    open: (page, c) => openProgressScreen(page, c, PROGRESS_READ_ONLY_BODY, '0.2.2'),
  },
];

/** The `/progress` answer of the progress card screens (task-065, D65-16): every figure shown. */
const PROGRESS_SCREEN_BODY = {
  ui: { source: 'file' },
  mode: 'sequence',
  scope: {
    type: 'release',
    current: { id: 'minor-v0.1', title: 'Minor v0.1', type: 'release', status: 'planning', tone: 'active' },
    basis: 'derived',
  },
  figures: {
    completion: {
      state: 'shown',
      value: 0.25,
      percent: 25,
      references: [
        { id: 'US-M-01', done: 1, total: 2, percent: 50 },
        { id: 'US-S-01', done: 0, total: 1, percent: 0 },
      ],
      referencesCount: 2,
      ids: ['task-001-cli-adapter'],
    },
    phase: { state: 'read-only', reason: { code: 'not-in-release' } },
    phaseCompletion: { state: 'read-only', reason: { code: 'not-in-release' } },
    iterated: { state: 'shown', type: 'task', done: 1, total: 4, ids: ['task-001-cli-adapter'], doneIds: [] },
    openDefects: { state: 'shown', type: 'bug', count: 1, ids: ['bug-001-toast-overlap'] },
    pendingGates: { state: 'shown', count: 3, ids: ['bug-001-toast-overlap'] },
  },
  unreadable: ['dl-002-use-fastify'],
  capped: ['task-004-themes'],
};

/** The read-only variant (task-065, D65-16): the file ignored, no reference category, WingFoil 0.2.2. */
const PROGRESS_READ_ONLY_BODY = {
  ...PROGRESS_SCREEN_BODY,
  ui: {
    source: 'ignored',
    warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found spiral)' },
  },
  mode: 'flow',
  scope: { type: null, current: null, basis: null },
  figures: {
    ...PROGRESS_SCREEN_BODY.figures,
    completion: { state: 'unavailable', reason: { code: 'no-reference-categories' } },
    phase: { state: 'read-only', reason: { code: 'needs-version', minVersion: '0.3.0' } },
    phaseCompletion: { state: 'read-only', reason: { code: 'needs-version', minVersion: '0.3.0' } },
  },
  unreadable: [],
  capped: [],
};

/**
 * Today of the custom project with `/progress` answered by `body` and, with `version`, the project
 * header's WingFoil version answered as `version` (task-065, D65-16).
 */
async function openProgressScreen(page: Page, c: RunningConsole, body: unknown, version?: string): Promise<void> {
  const pid = c.pids[1]!;
  if (version !== undefined) {
    await page.route(`**/api/p/${pid}`, async (route) => {
      const response = await route.fetch();
      const header = (await response.json()) as { wingfoil: Record<string, unknown> };
      await route.fulfill({ response, json: { ...header, wingfoil: { ...header.wingfoil, text: version, version } } });
    });
  }
  await page.route(`**/api/p/${pid}/progress`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: body });
  });
  await project(page, c, `/p/${pid}/today`, (p) => p.locator('.today-progress-figures'));
}

/** The body the document screens answer for `dl-002-use-fastify` (task-078, D78-10). */
const DOCUMENT_SCREEN_BODY = [
  '## Context',
  '',
  '<!-- The situation. -->',
  '',
  'We need a *fast* server: see [the first decision](dl-001-initialise-wingfoil-before-inception.md),',
  '[the index](../../../01_vision/00_index.md), [the guide](https://example.test/guide),',
  '[a missing file](missing.md) and [the decision](#decision).',
  '',
  '## Decision',
  '',
  '| Option | Kept |',
  '|---|:---:|',
  '| Fastify | yes |',
  '',
  '```',
  'npm install fastify',
  '```',
  '',
].join('\n');

/** Open the document dialog of `dl-002-use-fastify` of the custom project, in `mode`. */
async function openDocumentScreen(page: Page, c: RunningConsole, mode: 'rendered' | 'source'): Promise<void> {
  const pid = c.pids[1]!;
  await page.route(`**/api/p/${pid}/elements/dl-002-use-fastify`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { body: string };
    await route.fulfill({ response, json: { ...body, body: DOCUMENT_SCREEN_BODY } });
  });
  await project(page, c, `/p/${pid}/e/dl-002-use-fastify`, (p) =>
    p.locator('[data-element-view] .element-document-open'),
  );
  await page.locator('[data-element-view] .element-document-open').click();
  const dialog = page.locator('[role="dialog"].element-document');
  await expect(dialog.locator('.doc-article')).toBeVisible({ timeout: COLD_READ_MS });
  if (mode === 'source') {
    await dialog.locator('.element-document-mode [role="radio"]').nth(1).click();
    await expect(dialog.locator('pre.element-document-source')).toBeVisible();
  }
  await expectSettled(page);
}

/** Open the custom list on `?missing=refs`, its answer given a flagged row and the notes (task-066). */
async function openMissingScreen(page: Page, c: RunningConsole): Promise<void> {
  const pid = c.pids[1]!;
  await page.route(`**/api/p/${pid}/elements`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { elements: { id: string }[] };
    await route.fulfill({
      response,
      json: {
        ...body,
        elements: body.elements.map((e) =>
          e.id === 'task-004-themes' ? { ...e, missingCategories: ['requirement'] } : e,
        ),
        missingReferences: { shown: true, unreadable: ['dl-002-use-fastify'], capped: [] },
      },
    });
  });
  await project(page, c, `/p/${pid}/memory?missing=refs`, (p) => p.locator('.memory-badge-missing'));
}
