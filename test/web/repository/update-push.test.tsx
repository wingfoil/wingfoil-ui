// @vitest-environment jsdom
// task-040 — *Update* and *Push* in the sidebar's git status (`web/src/repository/GitStatus.tsx`;
// spec-010 §4, §5, §7; D40-1 … D40-5): when they show, "N commits to push", one transport at a time
// with the focus kept, Push's Cancel (RP-37), what each outcome shows (the recorded update line, the
// block's alert, the red push toast) and the read-only state of a user who is not one member.
import type { ProjectHeader, RepositoryStatus } from '@wingfoil-ui/contracts';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { createQueryClient, projectHeaderQuery } from '../../../web/src/api/queries.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { AppIntlProvider, type MessageId } from '../../../web/src/i18n/index.js';
import { GitStatus } from '../../../web/src/repository/GitStatus.js';
import { UpdateLink } from '../../../web/src/repository/UpdateLink.js';
import { getToasts, resetToasts } from '../../../web/src/shell/toasts.js';
import { Toasts } from '../../../web/src/shell/Toasts.js';
import { header, riley } from '../project/header-data.js';

beforeEach(() => resetToasts());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HEAD = '41c0e2a' + '9'.repeat(33);

function repo(over: Partial<RepositoryStatus> = {}): RepositoryStatus {
  return { ...header().repository, head: HEAD, ...over };
}

function withRepo(over: Partial<RepositoryStatus> = {}, base: ProjectHeader = header()): ProjectHeader {
  return { ...base, repository: { ...base.repository, head: HEAD, ...over }, conditions: ['has-remote'] };
}

const behind = (n = 1) => withRepo({ copy: 'behind', behind: n });
const ahead = (n = 1) => withRepo({ copy: 'ahead', ahead: n });

/** Render the git status of `p_a` (and, with `link`, an Update link of the same project) with `h` cached. */
function show(
  h: ProjectHeader,
  options: { messages?: Record<string, string>; link?: boolean } = {},
): { queryClient: QueryClient } {
  const queryClient = createQueryClient();
  queryClient.setQueryData(projectHeaderQuery('p_a').queryKey, h);
  render(
    <AppIntlProvider {...(options.messages ? { messages: options.messages as Record<MessageId, string> } : {})}>
      <QueryClientProvider client={queryClient}>
        <GitStatus pid="p_a" />
        {options.link && (
          <p data-testid="reason">
            Blocked — <UpdateLink pid="p_a">Update</UpdateLink>
          </p>
        )}
        <Toasts />
      </QueryClientProvider>
    </AppIntlProvider>,
  );
  return { queryClient };
}

const region = () => screen.getByRole('region', { name: 'Git status' });
const button = (name: string) => within(region()).getByRole('button', { name });

type Answer = { status: number; body?: unknown } | 'hang';

/** Stub `fetch`: the POSTs answered in order by `answers`; GETs of the header answer `h()`. */
function stubApi(h: () => ProjectHeader, answers: Answer[]) {
  const posts: { url: string; init?: RequestInit }[] = [];
  const release: (() => void)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(new Response(JSON.stringify(h()), { status: 200 }));
      }
      posts.push({ url, ...(init ? { init } : {}) });
      const a = answers.shift() ?? 'hang';
      if (a === 'hang') {
        return new Promise<Response>((resolve, reject) => {
          release.push(() => resolve(new Response(JSON.stringify({ repository: h().repository }), { status: 200 })));
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      return Promise.resolve(
        new Response(a.body === undefined ? null : JSON.stringify(a.body), {
          status: a.status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
  return { posts, release };
}

describe('when Update and Push show (D40-1)', () => {
  it.each([
    ['in sync', withRepo(), false, null],
    ['behind', behind(2), true, null],
    [
      'diverged: Update (its refusal names the terminal commands), no Push',
      withRepo({ copy: 'diverged', ahead: 1, behind: 1 }),
      true,
      null,
    ],
    ['ahead: Push with "N commits to push"', ahead(1), false, '1 commit to push'],
    ['ahead by 3', ahead(3), false, '3 commits to push'],
    ['detached', withRepo({ copy: 'detached', branch: null }), false, null],
    ['no upstream', withRepo({ copy: 'no-upstream', upstream: null }), false, null],
  ] as const)('%s', (_name, h, update, toPush) => {
    show(h);
    expect(within(region()).queryByRole('button', { name: 'Update' }) !== null).toBe(update);
    expect(within(region()).queryByRole('button', { name: 'Push' }) !== null).toBe(toPush !== null);
    if (toPush) expect(within(region()).getByText(toPush)).toBeTruthy();
    else expect(within(region()).queryByText(/to push/)).toBeNull();
  });

  it('Y-08.1 / Y-07.2 — an ahead copy reads both "1 ahead" and "1 commit to push"', () => {
    show(ahead(1));
    expect(within(region()).getByText('1 ahead')).toBeTruthy();
    expect(within(region()).getByText('1 commit to push')).toBeTruthy();
  });

  it('without has-remote: neither (spec-010 §7)', () => {
    show({ ...behind(), conditions: [] });
    expect(within(region()).queryByRole('button')).toBeNull();
  });

  it('every new text is a catalogue key (X-09.1)', () => {
    show(ahead(1), { messages: keyCatalogue(en) });
    const r = screen.getByRole('region', { name: 'shell.git.label' });
    expect(within(r).getByRole('button', { name: 'shell.git.push' })).toBeTruthy();
    expect(r.textContent).toContain('shell.git.toPush');
    cleanup();
    show(behind(1), { messages: keyCatalogue(en) });
    expect(
      within(screen.getByRole('region', { name: 'shell.git.label' })).getByRole('button', { name: 'shell.git.update' }),
    ).toBeTruthy();
  });
});

describe('Update (Y-05.1, Y-06.x, D40-4, D40-5)', () => {
  it('posts the update with no body; while it runs Update reads "Updating…", everything is aria-disabled, no Cancel', async () => {
    const { posts } = stubApi(() => behind(), ['hang']);
    show(behind());
    const user = userEvent.setup();
    await user.click(button('Update'));
    const busy = await within(region()).findByRole('button', { name: 'Updating…' });
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(button('Fetch').getAttribute('aria-disabled')).toBe('true');
    expect(within(region()).queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(within(region()).getByRole('status').textContent).toBe('Updating…');
    expect(posts[0]?.url).toBe('/api/p/p_a/git/update');
    expect(posts[0]?.init?.body).toBeUndefined();
    // Neither a second press nor Fetch sends anything while it runs.
    await user.click(busy);
    await user.click(button('Fetch'));
    expect(posts).toHaveLength(1);
  });

  it('a success shows the answer; the focus Update held moves to Fetch (Update is gone)', async () => {
    let h = behind();
    stubApi(() => h, [{ status: 200, body: { repository: repo({ copy: 'in-sync' }) } }]);
    show(h);
    h = withRepo();
    const user = userEvent.setup();
    button('Update').focus();
    await user.keyboard('{Enter}');
    expect(await within(region()).findByText('In sync with git')).toBeTruthy();
    expect(within(region()).queryByRole('button', { name: 'Update' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button('Fetch')));
    expect(getToasts()).toHaveLength(0);
  });

  it('a refusal the server records (409 diverged): no toast, no alert; the header is read again and shows its line', async () => {
    let h = withRepo({ copy: 'diverged', ahead: 1, behind: 1 });
    stubApi(() => h, [{ status: 409, body: { error: { code: 'diverged', message: 'x' } } }]);
    show(h);
    h = withRepo({
      copy: 'diverged',
      ahead: 1,
      behind: 1,
      sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: { code: 'diverged', at: 'x' } } },
    });
    await userEvent.click(button('Update'));
    expect(await within(region()).findByText(en['error.diverged'])).toBeTruthy();
    expect(within(region()).queryByRole('alert')).toBeNull();
    expect(getToasts()).toHaveLength(0);
  });

  it('a refusal the server does not record (403) shows in the block’s alert, no toast', async () => {
    stubApi(() => behind(), [{ status: 403, body: { error: { code: 'not-in-team', message: 'x' } } }]);
    show(behind());
    await userEvent.click(button('Update'));
    expect((await within(region()).findByRole('alert')).textContent).toBe(en['error.notInTeam']);
    expect(getToasts()).toHaveLength(0);
  });

  it('a git failure (422) is recorded: no alert, no toast', async () => {
    stubApi(() => behind(), [{ status: 422, body: { error: { code: 'git-refused', message: 'fatal: x' } } }]);
    show(behind());
    await userEvent.click(button('Update'));
    await waitFor(() => expect(button('Update').getAttribute('aria-disabled')).toBeNull());
    expect(within(region()).queryByRole('alert')).toBeNull();
    expect(getToasts()).toHaveLength(0);
  });
});

describe('Push (Y-07.1, Y-08.2, RP-37, D40-4, D40-5)', () => {
  it('posts the push with no body; a success shows the answer, no toast, the focus moves to Fetch', async () => {
    let h = ahead();
    const { posts } = stubApi(() => h, [{ status: 200, body: { repository: repo({ copy: 'in-sync' }) } }]);
    show(h);
    h = withRepo();
    button('Push').focus();
    await userEvent.keyboard('{Enter}');
    expect(await within(region()).findByText('In sync with git')).toBeTruthy();
    expect(posts[0]?.url).toBe('/api/p/p_a/git/push');
    expect(posts[0]?.init?.body).toBeUndefined();
    await waitFor(() => expect(document.activeElement).toBe(button('Fetch')));
    expect(getToasts()).toHaveLength(0);
  });

  it('while it runs: "Pushing…" aria-disabled and Cancel; Cancel aborts with no toast and the focus back on Push', async () => {
    const { posts } = stubApi(() => ahead(), ['hang']);
    show(ahead());
    const user = userEvent.setup();
    await user.click(button('Push'));
    const busy = await within(region()).findByRole('button', { name: 'Pushing…' });
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(button('Fetch').getAttribute('aria-disabled')).toBe('true');
    expect(within(region()).getByRole('status').textContent).toBe('Pushing…');
    await user.click(button('Cancel'));
    const push = await within(region()).findByRole('button', { name: 'Push' });
    await waitFor(() => expect(document.activeElement).toBe(push));
    expect(posts[0]?.init?.signal?.aborted).toBe(true);
    expect(getToasts()).toHaveLength(0);
    expect(within(region()).queryByRole('alert')).toBeNull();
  });

  it('Y-08.2 — a refused push (422) is a red sticky toast: "Not pushed" and git\'s text verbatim', async () => {
    stubApi(
      () => ahead(),
      [
        {
          status: 422,
          body: {
            error: { code: 'git-refused', message: ' ! [remote rejected] HEAD -> main (pre-receive hook declined)' },
          },
        },
      ],
    );
    show(ahead());
    await userEvent.click(button('Push'));
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(getToasts()[0]).toMatchObject({ key: 'push:p_a', tone: 'error', sticky: true });
    const toast = document.querySelector('.toast')!;
    expect(toast.textContent).toContain('Not pushed — the commit stays local');
    expect(toast.querySelector('pre.verbatim')?.textContent).toContain('(pre-receive hook declined)');
    // The sidebar still offers the push.
    expect(within(region()).getByText('1 commit to push')).toBeTruthy();
  });

  it.each([
    [409, 'no-upstream', 'error.noUpstream'],
    [403, 'not-in-team', 'error.notInTeam'],
    [500, 'internal', 'error.internal'],
  ] as const)('a push answered %i %s is a red toast with the catalogue text', async (status, code, key) => {
    stubApi(() => ahead(2), [{ status, body: { error: { code, message: 'x' } } }]);
    show(ahead(2));
    await userEvent.click(button('Push'));
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    const toast = document.querySelector('.toast')!;
    expect(toast.textContent).toContain('Not pushed — 2 commits stay local');
    expect(toast.textContent).toContain(en[key]);
    expect(within(region()).queryByRole('alert')).toBeNull();
  });

  it('a new push replaces the previous push toast (one key per project)', async () => {
    const fail = { status: 422, body: { error: { code: 'git-refused', message: 'fatal: one' } } };
    stubApi(() => ahead(), [fail, { ...fail, body: { error: { code: 'git-refused', message: 'fatal: two' } } }]);
    show(ahead());
    await userEvent.click(button('Push'));
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    await waitFor(() => expect(button('Push').getAttribute('aria-disabled')).toBeNull());
    await userEvent.click(button('Push'));
    await waitFor(() => expect(document.querySelector('.toast pre')?.textContent).toContain('fatal: two'));
    expect(getToasts()).toHaveLength(1);
  });
});

describe('one transport at a time, shared with the footer link (D40-2, D40-4)', () => {
  it('while a fetch runs, Update and Push are aria-disabled and send nothing', async () => {
    const { posts } = stubApi(() => behind(), ['hang']);
    show(behind());
    const user = userEvent.setup();
    await user.click(button('Fetch'));
    await within(region()).findByRole('button', { name: 'Fetching…' });
    expect(button('Update').getAttribute('aria-disabled')).toBe('true');
    await user.click(button('Update'));
    expect(posts).toHaveLength(1);
  });

  it('an update started from the footer link shows in the sidebar ("Updating…") and disables the link', async () => {
    const { posts, release } = stubApi(() => behind(), ['hang']);
    show(behind(), { link: true });
    const user = userEvent.setup();
    const link = within(screen.getByTestId('reason')).getByRole('button', { name: 'Update' });
    await user.click(link);
    expect(await within(region()).findByRole('button', { name: 'Updating…' })).toBeTruthy();
    expect(link.getAttribute('aria-disabled')).toBe('true');
    await user.click(link);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe('/api/p/p_a/git/update');
    act(() => release.forEach((r) => r()));
    await waitFor(() => expect(link.getAttribute('aria-disabled')).toBeNull());
  });

  it('a sidebar fetch disables the footer link too', async () => {
    stubApi(() => behind(), ['hang']);
    show(behind(), { link: true });
    await userEvent.click(button('Fetch'));
    const link = within(screen.getByTestId('reason')).getByRole('button', { name: 'Update' });
    await waitFor(() => expect(link.getAttribute('aria-disabled')).toBe('true'));
  });
});

describe('a user who is not one member (D40-3, RP-14)', () => {
  it('Update and Push are aria-disabled with the reason as description; Fetch stays enabled', async () => {
    const { posts } = stubApi(() => withRepo({ copy: 'behind', behind: 1 }, riley()), []);
    show(withRepo({ copy: 'behind', behind: 1 }, riley()));
    const update = button('Update');
    expect(update.getAttribute('aria-disabled')).toBe('true');
    const describedBy = update.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(en['shell.git.readOnly']);
    await userEvent.click(update);
    expect(posts).toHaveLength(0);
    expect(button('Fetch').getAttribute('aria-disabled')).toBeNull();
    cleanup();
    show(withRepo({ copy: 'ahead', ahead: 1 }, riley()));
    expect(button('Push').getAttribute('aria-disabled')).toBe('true');
  });
});
