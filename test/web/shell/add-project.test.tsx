// @vitest-environment jsdom
// The Add project dialog (task-014; ux-reference §3, spec-006 §3, decisions W4-9…W4-15): a local
// folder or a remote git repository with the working directory auto-filled, the field checks, every
// refusal of spec-006 §3 rendered from the catalogue (git's output verbatim), the link to an entry
// already listed, the request in progress (cancel = abort), the opening of the new project on the
// Memory list, a new project that is not available, and the keyboard.
import type { ProjectListItem } from '@wingfoil-ui/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { stopEventStream } from '../../../web/src/api/events.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { projectsQuery } from '../../../web/src/api/queries.js';
import { resetSession } from '../../../web/src/session/session.js';
import { renderApp, serverInfo } from './render.js';

const ALPHA: ProjectListItem = {
  id: 'p_alpha',
  name: 'alpha',
  path: '/home/test/projects/alpha',
  remote: '',
  availability: 'ok',
};
const KANBAN: ProjectListItem = {
  id: 'p_kanban',
  name: 'kanban',
  path: '/home/test/projects/kanban',
  remote: 'file:///srv/remotes/kanban.git',
  availability: 'ok',
};

/** An answer of a POST: a status and body, no answer at all, or no answer until aborted. */
type Answer = { status: number; body?: unknown } | 'unreachable' | 'hang';

interface Call {
  method: string;
  url: string;
  body: unknown;
  signal: AbortSignal | undefined;
}

/** A fake API: the list, and the answers of the add and the clone. */
function fakeApi(projects: ProjectListItem[], answers: { add?: Answer; clone?: Answer } = {}) {
  const list = [...projects];
  const calls: Call[] = [];
  const respond = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });
  const answer = async (a: Answer | undefined, signal: AbortSignal | undefined): Promise<Response> => {
    if (a === undefined) return respond(500, { error: { code: 'internal', message: 'x' } });
    if (a === 'unreachable') throw new TypeError('Failed to fetch');
    if (a === 'hang') {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }
    if (a.status === 201) list.push(a.body as ProjectListItem);
    return respond(a.status, a.body);
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ method, url, body, signal: init?.signal ?? undefined });
      if (url === '/api/server') return respond(200, serverInfo().body);
      if (url === '/api/projects' && method === 'GET') return respond(200, { projects: list });
      if (url === '/api/projects' && method === 'POST') return answer(answers.add, init?.signal ?? undefined);
      if (url === '/api/projects/clone' && method === 'POST') return answer(answers.clone, init?.signal ?? undefined);
      return respond(404, { error: { code: 'not-found', message: 'Not found' } });
    }),
  );
  return { calls, posts: () => calls.filter((c) => c.method === 'POST') };
}

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

type User = ReturnType<typeof userEvent.setup>;

/** Open the dialog from the start page's *Add project…*. */
async function openDialog(user: User): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Add project…' }));
  return screen.findByRole('dialog', { name: 'Add project' });
}

/** Choose *Remote git repository* with the keyboard (arrow key in the radio group). */
async function chooseRemote(user: User, dialog: HTMLElement): Promise<void> {
  within(dialog).getByRole('radio', { name: 'Local folder' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(within(dialog).getByRole('radio', { name: 'Remote git repository' })).toHaveProperty('checked', true);
}

describe('the form', () => {
  it('shows the title, the subtitle, the source and the local folder field, focus inside', async () => {
    fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    expect(within(dialog).getByText('A git repository with a .wingfoil/ folder at its root.')).toBeTruthy();
    const source = within(dialog).getByRole('radiogroup', { name: 'Source' });
    expect(within(source).getByRole('radio', { name: 'Local folder' })).toHaveProperty('checked', true);
    expect(within(source).getByRole('radio', { name: 'Remote git repository' })).toHaveProperty('checked', false);
    const path = within(dialog).getByRole('textbox', { name: 'Folder path' });
    expect(path.getAttribute('placeholder')).toBe('~/projects/my-app');
    expect(within(dialog).queryByRole('textbox', { name: 'Repository URL' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('opens from the switcher\'s "Add project…" too', async () => {
    fakeApi([ALPHA]);
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Projects' }));
    const switcher = await screen.findByRole('dialog', { name: 'Projects' });
    await user.click(within(switcher).getByRole('button', { name: 'Add project…' }));
    expect(await screen.findByRole('dialog', { name: 'Add project' })).toBeTruthy();
  });

  it('shows the URL and the working directory for a remote, with the hint', async () => {
    fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    const url = within(dialog).getByRole('textbox', { name: 'Repository URL' });
    expect(url.getAttribute('placeholder')).toBe('https://github.com/org/repo.git · git@github.com:org/repo.git');
    const directory = within(dialog).getByRole('textbox', {
      name: 'Local working directory',
      description: 'The repository is cloned here; WingFoil works on this copy.',
    });
    expect(directory.getAttribute('placeholder')).toBe('~/projects/repo');
    expect(within(dialog).queryByRole('textbox', { name: 'Folder path' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Clone and add' })).toBeTruthy();
  });

  it('auto-fills the working directory from the URL until I type in it (S-04.1, S-04.2)', async () => {
    fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    const url = within(dialog).getByRole('textbox', { name: 'Repository URL' });
    const directory = within(dialog).getByRole('textbox', { name: 'Local working directory' });
    await user.type(url, 'file:///srv/remotes/kanban.git');
    expect(directory).toHaveProperty('value', '~/projects/kanban');
    await user.clear(directory);
    await user.type(directory, '~/work/kanban-copy');
    await user.type(url, '-other');
    expect(directory).toHaveProperty('value', '~/work/kanban-copy');
  });

  it('starts empty at every opening', async () => {
    fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    let dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/tmp/x');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    dialog = await openDialog(user);
    expect(within(dialog).getByRole('textbox', { name: 'Folder path' })).toHaveProperty('value', '');
  });

  it('closes with Cancel, Close and Escape without a request, the focus given back', async () => {
    const api = fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    for (const how of ['Close', 'Cancel', 'Escape']) {
      const dialog = await openDialog(user);
      if (how === 'Escape') await user.keyboard('{Escape}');
      else await user.click(within(dialog).getByRole('button', { name: how }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() =>
        expect(document.activeElement, how).toBe(screen.getByRole('button', { name: 'Add project…' })),
      );
    }
    expect(api.posts()).toEqual([]);
  });
});

describe('field checks (W4-13)', () => {
  it.each([
    ['', 'Enter the folder path.'],
    ['relative/dir', 'Enter an absolute path, for example ~/projects/my-app.'],
  ])('refuses the folder path %j: %s, no request', async (value, text) => {
    const api = fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    const path = within(dialog).getByRole('textbox', { name: 'Folder path' });
    if (value) await user.type(path, value);
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText(text)).toBeTruthy();
    expect(path.getAttribute('aria-invalid')).toBe('true');
    expect(api.posts()).toEqual([]);
  });

  it.each([
    ['', '', 'Enter the repository URL.'],
    ['--upload-pack=x', '/tmp/x', 'A repository URL cannot start with -.'],
    ['https://h/..', '', 'Enter the local working directory.'],
    [
      'file:///srv/remotes/kanban.git',
      'projects/kanban',
      'Enter an absolute working directory, for example ~/projects/repo.',
    ],
  ])('refuses the URL %j with the directory %j: %s, no request', async (url, directory, text) => {
    const api = fakeApi([]);
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    if (url) await user.type(within(dialog).getByRole('textbox', { name: 'Repository URL' }), url);
    const dir = within(dialog).getByRole('textbox', { name: 'Local working directory' });
    await user.clear(dir);
    if (directory) await user.type(dir, directory);
    await user.click(within(dialog).getByRole('button', { name: 'Clone and add' }));
    expect(await within(dialog).findByText(text)).toBeTruthy();
    expect(api.posts()).toEqual([]);
  });
});

describe('a successful add', () => {
  it('adds a local folder with Enter, puts it in the list and opens it on the Memory list (S-03.1)', async () => {
    const api = fakeApi([], { add: { status: 201, body: KANBAN } });
    const user = userEvent.setup();
    const { router, queryClient } = renderApp('/');
    const dialog = await openDialog(user);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Folder path' }),
      '  /home/test/projects/kanban{Enter}',
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/p_kanban/memory'));
    expect(api.posts()).toEqual([
      expect.objectContaining({ url: '/api/projects', body: { path: '/home/test/projects/kanban' } }),
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add project' })).toBeNull());
    // No toast in v0.1 (W4-15): a polite announcement outside the closed dialog.
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('kanban added');
    expect(queryClient.getQueryData(projectsQuery().queryKey)?.projects.map((p) => p.id)).toContain('p_kanban');
  });

  it('clones a remote into the auto-filled working directory (S-04.3)', async () => {
    const api = fakeApi([], { clone: { status: 201, body: KANBAN } });
    const user = userEvent.setup();
    const { router } = renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Repository URL' }), 'file:///srv/remotes/kanban.git');
    await user.click(within(dialog).getByRole('button', { name: 'Clone and add' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/p_kanban/memory'));
    expect(api.posts()).toEqual([
      expect.objectContaining({
        url: '/api/projects/clone',
        body: { url: 'file:///srv/remotes/kanban.git', directory: '~/projects/kanban' },
      }),
    ]);
  });

  it('keeps the dialog for a new project that is not available, with the reason and Close only (W4-12)', async () => {
    const gone: ProjectListItem = {
      ...KANBAN,
      availability: 'cli-not-found',
      command: 'npm install --save-dev wingfoil',
    };
    fakeApi([], { clone: { status: 201, body: gone } });
    const user = userEvent.setup();
    const { router } = renderApp('/');
    const dialog = await openDialog(user);
    // The status region is there from the start, so that the message is announced (review R5).
    const status = within(dialog).getByRole('status');
    await chooseRemote(user, dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Repository URL' }), 'file:///srv/remotes/kanban.git');
    await user.click(within(dialog).getByRole('button', { name: 'Clone and add' }));
    expect(
      await within(dialog).findByText('kanban was added but is unavailable — WingFoil CLI not found'),
    ).toBeTruthy();
    expect(within(dialog).getByRole('status')).toBe(status);
    expect(status.textContent).toBe(
      'kanban was added but is unavailable — WingFoil CLI not foundInstall it with: npm install --save-dev wingfoil',
    );
    expect(within(dialog).getByText('npm install --save-dev wingfoil')).toBeTruthy();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Clone and add' })).toBeNull();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await waitFor(() => expect(document.activeElement).toBe(close));
    expect(router.state.location.pathname).toBe('/');
    await user.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('refusals from the catalogue', () => {
  const refusal = (code: string, detail?: unknown, message = 'x') => ({
    status: 422,
    body: { error: { code, message, ...(detail === undefined ? {} : { detail }) } },
  });

  it.each([
    ['folder-not-found', { path: '/tmp/does-not-exist' }, 'Folder not found: /tmp/does-not-exist'],
    ['not-wingfoil', { path: '/tmp/plain-repo' }, 'Not a WingFoil project: no .wingfoil/ folder in /tmp/plain-repo'],
    ['already-listed', { pid: 'p_alpha', name: 'alpha', sameRemote: false }, 'Already in the list: alpha'],
    ['already-listed', { pid: 'p_alpha', name: 'alpha', sameRemote: true }, 'Already in the list: alpha (same remote)'],
    [
      'cli-not-found',
      { path: '/tmp/kanban', command: 'npm install --save-dev wingfoil' },
      'WingFoil CLI not found for this project. Install it with: npm install --save-dev wingfoil',
    ],
    [
      'state-dir-inside-project',
      { path: '/tmp/p', stateDir: '/tmp/p/state' },
      'The state directory /tmp/p/state of WingFoil UI lies inside the project /tmp/p',
    ],
  ])('local add: %s %j', async (code, detail, text) => {
    fakeApi([ALPHA], { add: refusal(code, detail) });
    const user = userEvent.setup();
    const { router } = renderApp('/');
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/tmp/x{Enter}');
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain(text);
    expect(router.state.location.pathname).toBe('/');
    // The form stays usable for a corrected value.
    expect(within(dialog).getByRole('textbox', { name: 'Folder path' })).toHaveProperty('value', '/tmp/x');
  });

  it.each([
    ['not-wingfoil', { source: 'clone' }, 'Not a WingFoil project: no .wingfoil/ folder in the cloned repository'],
    ['directory-not-empty', { path: '~/projects/kanban' }, 'The working directory is not empty: ~/projects/kanban'],
    [
      'directory-inside-project',
      { path: '~/projects/alpha/x' },
      'The working directory ~/projects/alpha/x lies inside a project already in the list',
    ],
    [
      'inside-state-dir',
      { path: '/tmp/state/x' },
      'The working directory /tmp/state/x lies inside the state directory of WingFoil UI',
    ],
  ])('clone: %s %j', async (code, detail, text) => {
    fakeApi([ALPHA], { clone: refusal(code, detail) });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Repository URL' }),
      'file:///srv/remotes/kanban.git{Enter}',
    );
    expect((await within(dialog).findByRole('alert')).textContent).toContain(text);
  });

  it("shows git's output verbatim inside the catalogue frame (S-07.1, S-07.3)", async () => {
    const git =
      "Cloning into '/home/test/projects/project'...\nfatal: unable to access 'https://git.invalid/team/project.git/': Could not resolve host: git.invalid";
    fakeApi([], { clone: refusal('git-refused', undefined, git) });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Repository URL' }),
      'https://git.invalid/team/project.git{Enter}',
    );
    const alert = await within(dialog).findByRole('alert');
    expect(within(alert).getByText('Git refused the action:')).toBeTruthy();
    expect(alert.querySelector('pre')?.textContent).toBe(git);
  });

  it('links an entry already listed: "Open <name>" closes the dialog and opens it (S-06.1)', async () => {
    fakeApi([ALPHA], { add: refusal('already-listed', { pid: 'p_alpha', name: 'alpha', sameRemote: false }) });
    const user = userEvent.setup();
    const { router } = renderApp('/');
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/home/test/projects/alpha{Enter}');
    const link = await within(dialog).findByRole('link', { name: 'Open alpha' });
    expect(link.getAttribute('href')).toBe('/p/p_alpha');
    await user.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/p_alpha/memory'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add project' })).toBeNull());
  });

  it('renders a 400 and an unanswered request', async () => {
    fakeApi([], {
      add: { status: 400, body: { error: { code: 'invalid-request', message: 'x' } } },
      clone: 'unreachable',
    });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/x{Enter}');
    expect((await within(dialog).findByRole('alert')).textContent).toContain('The console refused an invalid request');
    await chooseRemote(user, dialog);
    // Changing the source clears the previous refusal.
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: 'Repository URL' }), 'file:///x.git{Enter}');
    expect((await within(dialog).findByRole('alert')).textContent).toContain('The console cannot be reached');
  });
});

describe('a request in progress (W4-11)', () => {
  it('never shows nor announces a password typed in the URL (review R1)', async () => {
    fakeApi([], { clone: 'hang' });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Repository URL' }),
      'http://alex:s3cret@127.0.0.1:8080/private.git{Enter}',
    );
    const text = 'Cloning http://127.0.0.1:8080/private.git into ~/projects/private… This can take a while.';
    expect(await within(dialog).findByRole('progressbar', { name: text })).toBeTruthy();
    expect(within(dialog).getByRole('status').textContent).toBe(text);
    expect(document.body.textContent).not.toContain('s3cret');
  });

  it('sends no working directory when the field is empty and the URL gives a name (W4-13, review R4)', async () => {
    const api = fakeApi([], { clone: 'hang' });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(within(dialog).getByRole('textbox', { name: 'Repository URL' }), 'file:///srv/remotes/kanban.git');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Local working directory' }));
    await user.click(within(dialog).getByRole('button', { name: 'Clone and add' }));
    expect(
      await within(dialog).findByRole('progressbar', {
        name: 'Cloning file:///srv/remotes/kanban.git into ~/projects/kanban… This can take a while.',
      }),
    ).toBeTruthy();
    expect(api.posts()).toEqual([
      expect.objectContaining({ url: '/api/projects/clone', body: { url: 'file:///srv/remotes/kanban.git' } }),
    ]);
  });

  it('shows the clone progress, disables the form, and Cancel aborts the request and closes', async () => {
    const api = fakeApi([], { clone: 'hang' });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await chooseRemote(user, dialog);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Repository URL' }),
      'file:///srv/remotes/kanban.git{Enter}',
    );
    const text = 'Cloning file:///srv/remotes/kanban.git into ~/projects/kanban… This can take a while.';
    const bar = await within(dialog).findByRole('progressbar', { name: text });
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(within(dialog).getByRole('status').textContent).toContain(text);
    expect(within(dialog).getByRole('textbox', { name: 'Repository URL' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByRole('textbox', { name: 'Local working directory' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByRole('radio', { name: 'Local folder' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByRole('button', { name: 'Clone and add' })).toHaveProperty('disabled', true);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    const signal = api.posts()[0]!.signal!;
    expect(signal.aborted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(signal.aborted).toBe(true);
  });

  it('shows "Adding…" for a local folder, and Escape aborts it and closes', async () => {
    const api = fakeApi([], { add: 'hang' });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/tmp/x{Enter}');
    expect(await within(dialog).findByRole('progressbar', { name: 'Adding…' })).toBeTruthy();
    // The focused field is disabled: the focus moves to Cancel, the one action left, so that Escape
    // still reaches the dialog.
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.posts()[0]!.signal!.aborted).toBe(true);
  });

  it('Close aborts too', async () => {
    const api = fakeApi([], { add: 'hang' });
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Folder path' }), '/tmp/x{Enter}');
    await within(dialog).findByRole('progressbar');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.posts()[0]!.signal!.aborted).toBe(true);
  });
});

it('shows only catalogue keys with the key catalogue (spec-008 §6, X-09.1)', async () => {
  fakeApi([], { clone: 'hang' });
  const user = userEvent.setup();
  renderApp('/', keyCatalogue(en));
  await user.click(await screen.findByRole('button', { name: 'projects.start.add' }));
  const dialog = await screen.findByRole('dialog', { name: 'projects.add.title' });
  expect(within(dialog).getByText('projects.add.subtitle')).toBeTruthy();
  within(dialog).getByRole('radio', { name: 'projects.add.sourceLocal' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(within(dialog).getByRole('radiogroup', { name: 'projects.add.source' })).toBeTruthy();
  const url = within(dialog).getByRole('textbox', { name: 'projects.add.url' });
  expect(url.getAttribute('placeholder')).toBe('projects.add.urlPlaceholder');
  expect(within(dialog).getByText('projects.add.directoryHint')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'projects.add.submitClone' }));
  expect(await within(dialog).findByText('projects.add.error.urlRequired')).toBeTruthy();
  await user.type(url, 'file:///x.git{Enter}');
  expect(
    await within(dialog).findByRole('progressbar', { name: 'projects.add.cloning file:///x.git ~/projects/x' }),
  ).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'projects.add.cancel' })).toBeTruthy();
});
