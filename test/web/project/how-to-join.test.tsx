// @vitest-environment jsdom
// task-035 — the *How to join* panel (US-C-08, US-C-09; D35-1, D35-2, D35-6, D35-8, D35-9) on the
// whole application with a stubbed API: opened from the "not in team" badge and from the header
// notice, the tech leads or the no-lead / no-member sentence, the command, *Copy command*, Close
// and Escape giving the focus back, a DNA read error, the panel following a refetch, and the
// catalogue (every text a key, the command's words data).
import type { DnaShow, ProjectConfig, ProjectHeader } from '@wingfoil-ui/contracts';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo } from '../shell/render.js';
import { header, riley } from './header-data.js';

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

const COMMAND =
  'wingfoil dna add team.members --value "<Your Name>" --entry-email riley@example.test --entry-roles <roles>';

const ROLES = [{ name: 'developer' }, { name: 'tech-lead' }, { name: 'approver' }];

/** The DNA's team: Morgan and Alex tech leads (the kanban fixture's shape). */
const TEAM: DnaShow['team'] = {
  members: [
    { name: 'Morgan', email: 'morgan@example.test', roles: ['approver', 'tech-lead'] },
    { name: 'Jordan', email: 'jordan@example.test', roles: ['developer'] },
    { name: 'Alex', email: 'alex@example.test', roles: ['tech-lead', 'developer'] },
  ],
  roles: ROLES,
};

/** `GET /config` with `team` (or a DNA read error). */
function config(team: DnaShow['team'] | 'error' = TEAM): ProjectConfig {
  const failed = { error: { code: 'internal', message: 'x' } };
  const dna: ProjectConfig['dna'] =
    team === 'error'
      ? { error: { code: 'cli-refused', message: 'dna.yaml is broken' } }
      : { data: { version: 1, modules: [], stacks: {}, team, paths: {} } as unknown as DnaShow };
  return { dna, paths: failed, workflows: failed, types: failed };
}

/** The fake API of projects `p_a` and `p_b`; the header and config answers may change between reads. */
function stub(h: () => ProjectHeader, c: () => ProjectConfig = () => config()) {
  const reads: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      reads.push(url);
      let a: { status: number; body?: unknown };
      if (url === '/api/server') a = serverInfo();
      else if (url === '/api/projects') {
        a = {
          status: 200,
          body: {
            projects: [
              { id: 'p_a', name: 'kanban', path: '/x/kanban', remote: '', availability: 'ok' },
              { id: 'p_b', name: 'other', path: '/x/other', remote: '', availability: 'ok' },
            ],
          },
        };
      } else if (url === '/api/p/p_a' || url === '/api/p/p_b') a = { status: 200, body: h() };
      else if (url === '/api/p/p_a/config' || url === '/api/p/p_b/config') a = { status: 200, body: c() };
      else a = { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
      return new Response(JSON.stringify(a.body), {
        status: a.status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return reads;
}

const badge = () => screen.findByRole('button', { name: 'Not in team — how to join' });
const dialog = () => screen.findByRole('dialog', { name: 'How to join this project' });

it('opens from the badge: the tech leads, the command and the declared roles (C-08.1, D35-6)', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  expect(within(d).getByText('riley@example.test is not in the team of this project.', { exact: false })).toBeTruthy();
  // The intro sentence describes the dialog (F7).
  const describedBy = d.getAttribute('aria-describedby');
  expect(describedBy && document.getElementById(describedBy)?.textContent).toMatch(
    /^riley@example\.test is not in the team of this project\./,
  );
  expect(await within(d).findByText('Ask a tech lead to run it:')).toBeTruthy();
  const leads = within(d).getByRole('list', { name: 'Tech leads' });
  expect(
    within(leads)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['Morgan <morgan@example.test>', 'Alex <alex@example.test>']);
  const command = d.querySelector('code.cli-command');
  expect(command?.textContent).toBe(COMMAND);
  expect(command?.getAttribute('translate')).toBe('no');
  const roles = within(d).getByText('Roles this project declares:').parentElement!;
  expect(
    within(roles)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['developer', 'tech-lead', 'approver']);
});

it('reads the configuration only once the panel opens', async () => {
  const reads = stub(riley);
  const user = userEvent.setup();
  // The Directives view does not read the configuration itself.
  renderApp('/p/p_a/directives');
  const b = await badge();
  expect(reads).not.toContain('/api/p/p_a/config');
  await user.click(b);
  await waitFor(() => expect(reads).toContain('/api/p/p_a/config'));
});

it('closes with Escape and gives the focus back to the badge', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  const b = await badge();
  act(() => b.focus());
  await user.keyboard('{Enter}');
  await dialog();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(b));
});

it('opens from the notice button too, and closes with Close (D35-2)', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  const strip = await screen.findByRole('region', { name: 'Project header' });
  const open = await within(strip).findByRole('button', { name: 'How to join' });
  act(() => open.focus());
  await user.keyboard('{Enter}');
  const d = await dialog();
  await user.click(within(d).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(open));
});

it('copies the command and says so (C-08.2)', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  await within(d).findByText('Ask a tech lead to run it:');
  await user.click(within(d).getByRole('button', { name: 'Copy command' }));
  expect(await navigator.clipboard.readText()).toBe(COMMAND);
  // Announced: the text is in a polite status region.
  expect((await within(d).findByText('Command copied')).closest('[role="status"]')).not.toBeNull();
});

it('says when the clipboard refuses the copy', async () => {
  stub(riley);
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  await user.click(within(d).getByRole('button', { name: 'Copy command' }));
  expect((await within(d).findByRole('alert')).textContent).toBe(
    'The command could not be copied: select it and copy it yourself.',
  );
});

it('says that no tech lead is declared, and still gives the command (C-09.1)', async () => {
  stub(riley, () => config({ members: [{ name: 'Jordan', roles: ['developer'] }], roles: ROLES }));
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  expect(
    await within(d).findByText('This project declares no tech lead — ask any member to run the command'),
  ).toBeTruthy();
  expect(within(d).queryByRole('list', { name: 'Tech leads' })).toBeNull();
  expect(d.querySelector('code.cli-command')?.textContent).toBe(COMMAND);
});

it('explains an empty team, and only that (C-09.2, D35-6)', async () => {
  stub(riley, () => config({ members: [], roles: [] }));
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  expect(
    await within(d).findByText(
      'This project declares no team member — anyone with write access to the repository can run the command',
    ),
  ).toBeTruthy();
  expect(within(d).queryByText(/declares no tech lead/)).toBeNull();
  expect(within(d).queryByText(/Roles this project declares/)).toBeNull();
  expect(d.querySelector('code.cli-command')?.textContent).toBe(COMMAND);
});

it('shows a DNA read error in place of the leads, and still the command', async () => {
  stub(riley, () => config('error'));
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const d = await dialog();
  expect(await within(d).findByText('dna.yaml is broken')).toBeTruthy();
  expect(d.querySelector('code.cli-command')?.textContent).toBe(COMMAND);
});

it('names a tech lead without an email by the name alone', async () => {
  stub(riley, () => config({ members: [{ name: 'Pat Doe', roles: ['tech-lead'] }], roles: ROLES }));
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  await user.click(await badge());
  const leads = await within(await dialog()).findByRole('list', { name: 'Tech leads' });
  expect(
    within(leads)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['Pat Doe']);
});

it('offers no panel for a team unknown, no identity or a member (D35-8, F7)', async () => {
  stub(() => ({ ...riley(), dnaError: { code: 'cli-refused', message: 'x' } }));
  renderApp('/p/p_a/memory');
  const chip = await screen.findByRole('group', { name: 'Current user: riley@example.test, team unknown' });
  expect(within(chip).queryByRole('button')).toBeNull();
  expect(screen.queryByRole('button', { name: 'How to join' })).toBeNull();
  cleanup();
  stub(() => header({ identity: { kind: 'no-identity' }, roleViews: [], roleView: null }));
  renderApp('/p/p_a/memory');
  const none = await screen.findByRole('group', { name: 'Current user: no identity' });
  expect(within(none).queryByRole('button')).toBeNull();
  expect(screen.queryByRole('button', { name: /how to join/i })).toBeNull();
  cleanup();
  stub(() => header());
  renderApp('/p/p_a/memory');
  await screen.findByRole('group', { name: 'Current user: Jordan, developer' });
  expect(screen.queryByRole('button', { name: /how to join/i })).toBeNull();
});

/** Open the panel as Riley, then answer the header with `next` and refetch (D35-9). */
async function openThenChange(next: ProjectHeader) {
  let current: ProjectHeader = riley();
  stub(() => current);
  const user = userEvent.setup();
  const { queryClient } = renderApp('/p/p_a/memory');
  const b = await badge();
  act(() => b.focus());
  await user.keyboard('{Enter}');
  const d = await dialog();
  await within(d).findByText('Ask a tech lead to run it:');
  // The status region exists before the change, so that the change is announced (F2).
  expect(d.querySelector('[role="status"].how-to-join-change')).not.toBeNull();
  current = next;
  await act(() => queryClient.invalidateQueries({ queryKey: ['p', 'p_a'] }));
  return { d, user };
}

/** `text` is shown in the panel's status region and the command is gone. */
async function expectChange(d: HTMLElement, text: string) {
  const shown = await within(d).findByText(text);
  expect(shown.closest('[role="status"]')).not.toBeNull();
  expect(d.querySelector('code.cli-command')).toBeNull();
  expect(within(d).getByRole('button', { name: 'Close' })).toBeTruthy();
}

const NOW_MEMBER = 'You are now a member of this team.';
const NOT_APPLICABLE =
  'How to join no longer applies to you: the notice above the view says why this project is read-only.';

it('follows the data: says the user is now a member after a refetch, announced (D35-9, F2)', async () => {
  const { d } = await openThenChange(
    header({ identity: { kind: 'member', email: 'riley@example.test', name: 'Riley', roles: ['developer'] } }),
  );
  await expectChange(d, NOW_MEMBER);
  // No intro sentence any more, so no description pointing at it (review round 2, N2).
  await waitFor(() => expect(d.hasAttribute('aria-describedby')).toBe(false));
});

it('says "now a member" when the email now matches several members (F1)', async () => {
  const { d } = await openThenChange(
    header({ identity: { kind: 'ambiguous', email: 'riley@example.test', members: ['Riley', 'Rob'] } }),
  );
  await expectChange(d, NOW_MEMBER);
});

it('says How to join no longer applies when git has no email any more (F1)', async () => {
  const { d } = await openThenChange(header({ identity: { kind: 'no-identity' } }));
  await expectChange(d, NOT_APPLICABLE);
});

it('says How to join no longer applies when the DNA can no longer be read (F1)', async () => {
  const { d } = await openThenChange({ ...riley(), dnaError: { code: 'cli-refused', message: 'x' } });
  await expectChange(d, NOT_APPLICABLE);
});

it('gives the focus to the main region when the opener has gone (F3)', async () => {
  const { d, user } = await openThenChange(
    header({ identity: { kind: 'member', email: 'riley@example.test', name: 'Riley', roles: ['developer'] } }),
  );
  await within(d).findByText(NOW_MEMBER);
  // The badge is gone: Riley is a member now.
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Not in team — how to join' })).toBeNull());
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
});

it('gives the focus to the main region when a click focused no opener (WebKit, review round 2 N3)', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory');
  const b = await badge();
  // A click that does not move the focus (WebKit does not focus a clicked button): body is the opener.
  expect(document.activeElement).toBe(document.body);
  fireEvent.click(b);
  const d = await dialog();
  await user.click(within(d).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
});

it('closes the panel of one project when another opens (keyed by the project)', async () => {
  stub(riley);
  const user = userEvent.setup();
  const { router } = renderApp('/p/p_a/memory');
  await user.click(await badge());
  await dialog();
  await act(() => router.navigate({ to: '/p/$pid/memory', params: { pid: 'p_b' } }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('renders every text from the catalogue; the command words are data (key build, D35-3)', async () => {
  stub(riley);
  const user = userEvent.setup();
  renderApp('/p/p_a/memory', keyCatalogue(en));
  await user.click(await screen.findByRole('button', { name: 'shell.howToJoin.badgeLabel' }));
  const d = await screen.findByRole('dialog', { name: 'shell.howToJoin.title' });
  expect(await within(d).findByText('shell.howToJoin.leads')).toBeTruthy();
  expect(within(d).getByText('shell.howToJoin.lead Morgan morgan@example.test')).toBeTruthy();
  expect(within(d).getByText(/^shell\.howToJoin\.intro riley@example\.test/)).toBeTruthy();
  expect(d.querySelector('code.cli-command')?.textContent).toBe(
    'wingfoil dna add team.members --value "shell.howToJoin.placeholderName" --entry-email riley@example.test --entry-roles shell.howToJoin.placeholderRoles',
  );
  expect(within(d).getByRole('button', { name: 'shell.howToJoin.copy' })).toBeTruthy();
});
