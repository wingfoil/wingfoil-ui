// @vitest-environment jsdom
// task-016 — the project header (ux-reference §3, W4-16…W4-22) on the whole application with a
// stubbed API: the version line and its notice, the current user in the global header for every
// identity state, the read-only notices, the role view selector (PUT then the header read again),
// and the catalogue (every text a key).
import type { ProjectHeader } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo, type FakeApi } from '../shell/render.js';
import { header, morgan, outOfRange, riley } from './header-data.js';

beforeEach(() => {
  resetSession();
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener(): void {}
      close(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

const BASE = '/api/p/p_a';

/** The fake API: GETs by path, a PUT answered by `put`; every request recorded. */
function stub(h: ProjectHeader | (() => ProjectHeader), put?: { status: number; body?: unknown }) {
  const api: FakeApi = {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: 'p_a', name: 'kanban', path: '/x/kanban', remote: '', availability: 'ok' }] },
    },
  };
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    let a: { status: number; body?: unknown } | undefined;
    if (method === 'PUT') a = put ?? { status: 204 };
    else if (url === BASE) a = { status: 200, body: typeof h === 'function' ? h() : h };
    else a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), {
      status: a.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const strip = () => screen.getByRole('region', { name: 'Project header' });

it('shows the version, the notice and a single-role member with the role; no selector (S-08.1, S-12.1)', async () => {
  stub(header());
  renderApp('/p/p_a/dna');
  expect(
    await within(await screen.findByRole('region', { name: 'Project header' })).findByText('WingFoil 0.2.2'),
  ).toBeTruthy();
  expect(within(strip()).getByText('Every capability of this release is available')).toBeTruthy();
  const chip = await screen.findByRole('group', { name: 'Current user: Jordan, developer' });
  expect(within(chip).getByText('Jordan')).toBeTruthy();
  expect(within(chip).getByText('developer')).toBeTruthy();
  // In the global header (W4-16), not in the page.
  expect(screen.getByRole('banner').contains(chip)).toBe(true);
  expect(screen.queryByRole('button', { name: /Role view/ })).toBeNull();
  expect(within(strip()).queryByText(/Read-only/)).toBeNull();
});

it('says "(from PATH)" for a CLI found on the PATH (S-08.2)', async () => {
  stub(header({ wingfoil: { text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'path' } }));
  renderApp('/p/p_a/dna');
  expect(await screen.findByText('WingFoil 0.2.2 (from PATH)')).toBeTruthy();
});

it('lists the capabilities the version lacks', async () => {
  stub(
    header({
      capabilities: {
        capabilities: [],
        missing: [
          { id: 'workflow-next-step', minVersion: '0.3.0' },
          { id: 'odd', minVersion: '0.4.0' },
        ],
      },
    }),
  );
  renderApp('/p/p_a/dna');
  expect(await screen.findByText('Next workflow step — needs WingFoil 0.3.0')).toBeTruthy();
  // An id the catalogue does not know is shown as written.
  expect(screen.getByText('odd — needs WingFoil 0.4.0')).toBeTruthy();
  expect(screen.queryByText('Every capability of this release is available')).toBeNull();
});

it.each([
  ['0.4.0', 'above'],
  ['0.2.0', 'below'],
] as const)('shows WingFoil %s out of range as read-only with the range (S-09)', async (version, state) => {
  stub(outOfRange(version, state));
  renderApp('/p/p_a/dna');
  expect(await screen.findByText(`WingFoil ${version} — read-only: supported 0.2.2 to 0.2.x`)).toBeTruthy();
  expect(screen.queryByText('Every capability of this release is available')).toBeNull();
});

it('takes the range from GET /api/server when no capability carries it', async () => {
  stub({ ...outOfRange('0.4.0'), capabilities: { capabilities: [], missing: [] } });
  renderApp('/p/p_a/dna');
  expect(await screen.findByText('WingFoil 0.4.0 — read-only: supported 0.2.2 to 0.2.x')).toBeTruthy();
});

it('shows the --version text, or an unknown version', async () => {
  stub(header({ wingfoil: { text: null, version: null, state: 'unrecognised', inRange: false, source: 'project' } }));
  renderApp('/p/p_a/dna');
  expect(await screen.findByText('WingFoil (unknown version) — read-only: supported 0.2.2 to 0.2.x')).toBeTruthy();
});

it('marks a user not in the team with the email, the badge and the notice (S-13.1)', async () => {
  stub(riley());
  renderApp('/p/p_a/dna');
  const chip = await screen.findByRole('group', { name: 'Current user: riley@example.test, not in team' });
  expect(within(chip).getByText('riley@example.test')).toBeTruthy();
  expect(within(chip).getByText('not in team')).toBeTruthy();
  expect(
    await within(strip()).findByText('Read-only: riley@example.test is not in the team of this project.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Role view/ })).toBeNull();
});

it('says the team is unknown when the DNA could not be read (W4-22)', async () => {
  stub({ ...riley(), dnaError: { code: 'cli-refused', message: 'x' } });
  renderApp('/p/p_a/dna');
  const chip = await screen.findByRole('group', { name: 'Current user: riley@example.test, team unknown' });
  expect(within(chip).getByText('team unknown')).toBeTruthy();
  expect(
    await within(strip()).findByText('Read-only: the DNA could not be read, so the team is unknown.'),
  ).toBeTruthy();
});

it('shows "No identity" with the command to set it (S-14.1)', async () => {
  stub(
    header({ identity: { kind: 'no-identity' }, roleViews: [], roleView: null, readOnly: [{ code: 'not-in-team' }] }),
  );
  renderApp('/p/p_a/dna');
  const chip = await screen.findByRole('group', { name: 'Current user: no identity' });
  expect(within(chip).getByText('No identity')).toBeTruthy();
  const notice = await within(strip()).findByText(/git has no user\.email/);
  expect(within(notice).getByText('git config user.email <your email>').tagName).toBe('CODE');
});

it('shows "Ambiguous identity" with the members (S-15.1)', async () => {
  stub(
    header({
      identity: { kind: 'ambiguous', email: 'shared@example.test', members: ['Jordan', 'Sam'] },
      roleViews: [],
      roleView: null,
      readOnly: [{ code: 'not-in-team' }],
    }),
  );
  renderApp('/p/p_a/dna');
  const chip = await screen.findByRole('group', { name: 'Current user: shared@example.test, ambiguous identity' });
  expect(within(chip).getByText('Ambiguous identity')).toBeTruthy();
  expect(
    await within(strip()).findByText(
      'Read-only: shared@example.test matches 2 members: Jordan, Sam. Give each member an email of their own in the DNA.',
    ),
  ).toBeTruthy();
});

it('offers the member roles in DNA order and switches the role view (S-22.1, S-22.2)', async () => {
  let current = 'tech-lead';
  const calls = stub(() => morgan(current));
  const u = userEvent.setup();
  renderApp('/p/p_a/dna');
  const chip = await screen.findByRole('group', { name: 'Current user: Morgan Reyes' });
  expect(within(chip).getByText('MR')).toBeTruthy();
  const button = await screen.findByRole('button', { name: /Role view$/ });
  expect(button.textContent).toContain('tech-lead');
  // React Aria names the button by the value, then the label.
  expect(button.getAttribute('aria-labelledby')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'tech-lead Role view' })).toBe(button);
  await u.click(button);
  const listbox = await screen.findByRole('listbox');
  expect(
    within(listbox)
      .getAllByRole('option')
      .map((o) => o.textContent),
  ).toEqual(['approver', 'tech-lead']);
  expect(screen.getByText('You hold several roles: choose the view')).toBeTruthy();
  current = 'approver';
  const headerReads = calls.filter((c) => c.url === BASE).length;
  await u.click(within(listbox).getByRole('option', { name: 'approver' }));
  await waitFor(() =>
    expect(calls).toContainEqual({ method: 'PUT', url: `${BASE}/role-view`, body: { role: 'approver' } }),
  );
  // The header is read again after the 204, and its answer is what the selector shows.
  await waitFor(() => expect(calls.filter((c) => c.url === BASE).length).toBeGreaterThan(headerReads));
  await waitFor(() => expect(screen.getByRole('button', { name: /Role view$/ }).textContent).toContain('approver'));
});

it('does not send a PUT when the current role is picked again', async () => {
  const calls = stub(morgan());
  const u = userEvent.setup();
  renderApp('/p/p_a/dna');
  await u.click(await screen.findByRole('button', { name: /Role view$/ }));
  await u.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'tech-lead' }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(calls.filter((c) => c.method === 'PUT')).toEqual([]);
});

it('shows a refused role view change and keeps the role from the header', async () => {
  stub(morgan(), { status: 403, body: { error: { code: 'not-in-team', message: 'x' } } });
  const u = userEvent.setup();
  renderApp('/p/p_a/dna');
  await u.click(await screen.findByRole('button', { name: /Role view$/ }));
  await u.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'approver' }));
  const alert = await within(strip()).findByRole('alert');
  expect(alert.textContent).toMatch(/team/i);
  expect(screen.getByRole('button', { name: /Role view$/ }).textContent).toContain('tech-lead');
});

it('shows a failed header read in the strip', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === BASE
        ? new Response(JSON.stringify({ error: { code: 'internal', message: 'x' } }), { status: 500 })
        : new Response(JSON.stringify({ error: { code: 'not-found', message: 'x' } }), { status: 404 }),
    ),
  );
  renderApp('/p/p_a/dna');
  expect(await within(await screen.findByRole('region', { name: 'Project header' })).findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('group', { name: /^Current user:/ })).toBeNull();
});

it('has no current user outside a project', async () => {
  stub(header());
  renderApp('/');
  expect(await screen.findByRole('button', { name: 'Projects' })).toBeTruthy();
  expect(screen.queryByRole('group', { name: /^Current user:/ })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Project header' })).toBeNull();
});

it('renders every text from the catalogue (key build)', async () => {
  stub(riley());
  renderApp('/p/p_a/dna', keyCatalogue(en));
  expect(await screen.findByText(/^shell\.header\.version 0\.2\.2 /)).toBeTruthy();
  expect(screen.getByText('shell.header.allCapabilities')).toBeTruthy();
  expect(await screen.findByText('shell.user.badge.notInTeam')).toBeTruthy();
  expect(screen.getByText(/^shell\.header\.notice\.notInTeam riley@example\.test/)).toBeTruthy();
  expect(screen.getByRole('group', { name: /^shell\.user\.label / })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'shell.header.label' })).toBeTruthy();
});
