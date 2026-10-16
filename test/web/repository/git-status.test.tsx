// @vitest-environment jsdom
// task-039 — the git status of the sidebar (`web/src/repository/GitStatus.tsx`; spec-010 §3, §7;
// D39-4 … D39-9, D39-13): the head line, the copy line, local changes, Fetch with Cancel, the
// failure lines with git's message on hover and focus, the refusal alert, the sync part hidden
// without `has-remote`, and every text from the catalogue.
import type { ProjectHeader, RepositoryStatus } from '@wingfoil-ui/contracts';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyCatalogue } from '../../../web/scripts/catalogue.mjs';
import { createQueryClient, projectHeaderQuery } from '../../../web/src/api/queries.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { AppIntlProvider, type MessageId } from '../../../web/src/i18n/index.js';
import { GitStatus } from '../../../web/src/repository/GitStatus.js';
import { header } from '../project/header-data.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HEAD = '41c0e2a' + '9'.repeat(33);

function repo(over: Partial<RepositoryStatus> = {}): RepositoryStatus {
  return { ...header().repository, head: HEAD, ...over };
}

function withRepo(over: Partial<RepositoryStatus> = {}, conditions: ProjectHeader['conditions'] = ['has-remote']) {
  return header({ repository: repo(over), conditions });
}

/** Render the git status of `p_a` with `h` in the cache. */
function show(h: ProjectHeader, messages?: Record<string, string>): { queryClient: QueryClient } {
  const queryClient = createQueryClient();
  queryClient.setQueryData(projectHeaderQuery('p_a').queryKey, h);
  render(
    <AppIntlProvider {...(messages ? { messages: messages as Record<MessageId, string> } : {})}>
      <QueryClientProvider client={queryClient}>
        <GitStatus pid="p_a" />
      </QueryClientProvider>
    </AppIntlProvider>,
  );
  return { queryClient };
}

const region = () => screen.getByRole('region', { name: 'Git status' });

type Answer = { status: number; body?: unknown } | 'hang';

/** Stub `fetch`: the POSTs answered in order by `answers`; GETs of the header answer `h`. */
function stubApi(h: () => ProjectHeader, answers: Answer[]) {
  const posts: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(h()), { status: 200 }));
    }
    posts.push({ url, ...(init ? { init } : {}) });
    const a = answers.shift() ?? 'hang';
    if (a === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }
    return Promise.resolve(
      new Response(a.body === undefined ? null : JSON.stringify(a.body), {
        status: a.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return posts;
}

describe('what the sidebar shows', () => {
  it('Y-01.1 — branch, ahead/behind and local changes', () => {
    show(withRepo({ copy: 'diverged', ahead: 1, behind: 2, localChanges: 3 }));
    const r = region();
    expect(within(r).getByText('main')).toBeTruthy();
    expect(within(r).getByText('41c0e2a')).toBeTruthy();
    expect(within(r).getByText('1 ahead · 2 behind')).toBeTruthy();
    expect(within(r).getByText('3 local changes')).toBeTruthy();
  });

  it('Y-01.2 — an up-to-date copy: in sync, no local-changes line', () => {
    show(withRepo());
    expect(within(region()).getByText('In sync with git')).toBeTruthy();
    expect(within(region()).queryByText(/local change/)).toBeNull();
  });

  it.each([
    [{ copy: 'ahead', ahead: 1 }, '1 ahead'],
    [{ copy: 'behind', behind: 2 }, '2 behind'],
    [{ copy: 'no-upstream', upstream: null }, 'No upstream branch on the remote'],
    [{ copy: 'no-upstream', upstream: 'origin/feature' }, 'origin/feature is not on the remote yet — Fetch reads it'],
    [{ localChanges: 1 }, '1 local change'],
  ] as const)('%o shows %s', (over, text) => {
    show(withRepo(over));
    expect(within(region()).getByText(text)).toBeTruthy();
  });

  it('Y-01.3 — a detached HEAD with the short hash, Fetch still offered', () => {
    show(withRepo({ copy: 'detached', branch: null }));
    // The hash is in a <code> of its own inside the sentence.
    expect(region().querySelector('.git-head')?.textContent).toBe('Detached HEAD at 41c0e2a');
    expect(within(region()).queryByText('main')).toBeNull();
    expect(within(region()).getByRole('button', { name: 'Fetch' })).toBeTruthy();
  });

  it('Y-04.1 / S-11.2 — no remote: branch and local changes, no sync control or count', () => {
    show(withRepo({ copy: 'no-remote', upstream: null, localChanges: 2 }, []));
    const r = region();
    expect(within(r).getByText('main')).toBeTruthy();
    expect(within(r).getByText('2 local changes')).toBeTruthy();
    expect(within(r).queryByRole('button')).toBeNull();
    expect(within(r).queryByText(/ahead|behind|In sync/)).toBeNull();
  });

  it('with a remote, Fetch is offered (the positive control of Y-04.1)', () => {
    show(withRepo());
    expect(within(region()).getByRole('button', { name: 'Fetch' })).toBeTruthy();
  });

  it('renders nothing before the header is read', () => {
    const queryClient = createQueryClient();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(
      <AppIntlProvider>
        <QueryClientProvider client={queryClient}>
          <GitStatus pid="p_a" />
        </QueryClientProvider>
      </AppIntlProvider>,
    );
    expect(screen.queryByRole('region', { name: 'Git status' })).toBeNull();
  });

  it('every text is a catalogue key (X-09.1)', () => {
    show(
      withRepo({
        copy: 'diverged',
        ahead: 1,
        behind: 2,
        localChanges: 3,
        sync: {
          fetch: { lastSuccessAt: null, lastError: { code: 'fetch-timeout', message: 'm', at: 'x' } },
          update: { lastError: { code: 'diverged', at: 'x' } },
        },
      }),
      keyCatalogue(en),
    );
    const r = screen.getByRole('region', { name: 'shell.git.label' });
    const text = r.textContent ?? '';
    expect(text).toContain('shell.git.diverged');
    expect(text).toContain('shell.git.localChanges');
    expect(text).toContain('shell.git.fetchFailed');
    expect(text).toContain('error.fetchTimeout');
    expect(text).toContain('error.diverged');
    expect(text).not.toMatch(/ahead|behind|Fetch failed/);
  });
});

describe('failure lines (Y-03.1, Y-03.2, D39-4, D39-6, D39-8, D39-9)', () => {
  const failed = (lastSuccessAt: string | null, code?: 'fetch-timeout') =>
    withRepo({
      sync: {
        fetch: {
          lastSuccessAt,
          lastError: { ...(code ? { code } : {}), message: 'fatal: could not read Username', at: 'x' },
        },
        update: { lastError: null },
      },
    });

  it('Y-03.1 — the time of the last success, today', () => {
    const at = new Date();
    at.setHours(10, 2, 0, 0);
    show(failed(at.toISOString()));
    const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(at);
    expect(within(region()).getByText(`Fetch failed — last fetched at ${time}`)).toBeTruthy();
  });

  it('another day: date and time', () => {
    const at = new Date(2020, 0, 2, 10, 2);
    show(failed(at.toISOString()));
    const when = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(at);
    expect(within(region()).getByText(`Fetch failed — last fetched on ${when}`)).toBeTruthy();
  });

  it('never fetched since the start', () => {
    show(failed(null));
    expect(within(region()).getByText('Fetch failed — not fetched since the console started')).toBeTruthy();
  });

  it("Y-03.2 — git's message is the info button's description and shows on keyboard focus", async () => {
    show(failed(null));
    const info = within(region()).getByRole('button', { name: "Git's message" });
    expect(info.getAttribute('aria-describedby')).toBeTruthy();
    const described = document.getElementById(info.getAttribute('aria-describedby')!.split(' ')[0]!);
    expect(described?.textContent).toBe('fatal: could not read Username');
    const user = userEvent.setup();
    await user.tab();
    if (document.activeElement !== info) await user.tab();
    expect(document.activeElement).toBe(info);
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toBe('fatal: could not read Username');
  });

  it('a coded fetch error adds its catalogue text', () => {
    show(failed(null, 'fetch-timeout'));
    expect(within(region()).getByText(en['error.fetchTimeout'])).toBeTruthy();
  });

  it('the update error shows its catalogue text (diverged, files in the way)', () => {
    show(
      withRepo({
        sync: {
          fetch: { lastSuccessAt: null, lastError: null },
          update: {
            lastError: { code: 'local-changes-in-the-way', detail: { files: ['docs/a.md', 'b.md'] }, at: 'x' },
          },
        },
      }),
    );
    expect(
      within(region()).getByText(
        'Cannot fast-forward: local changes to a.md and b.md are in the way — commit or stash them in a terminal',
      ),
    ).toBeTruthy();
  });

  it("a git-refused update: 'Update failed' and git's message", () => {
    show(
      withRepo({
        sync: {
          fetch: { lastSuccessAt: null, lastError: null },
          update: { lastError: { code: 'git-refused', message: 'error: x', at: 'x' } },
        },
      }),
    );
    expect(within(region()).getByText('Update failed')).toBeTruthy();
    expect(within(region()).getByRole('button', { name: "Git's message" })).toBeTruthy();
  });
});

describe('Fetch (Y-02.2, D39-5, D39-13)', () => {
  it('posts the fetch and shows the answer', async () => {
    let h = withRepo();
    const posts = stubApi(() => h, [{ status: 200, body: { repository: repo({ copy: 'behind', behind: 1 }) } }]);
    show(h);
    h = withRepo({ copy: 'behind', behind: 1 });
    await userEvent.click(within(region()).getByRole('button', { name: 'Fetch' }));
    expect(await within(region()).findByText('1 behind')).toBeTruthy();
    expect(posts[0]?.url).toBe('/api/p/p_a/git/fetch');
    expect(posts[0]?.init?.body).toBeUndefined();
  });

  it('while it runs: Fetch aria-disabled "Fetching…", Cancel aborts without an error, focus back on Fetch', async () => {
    const posts = stubApi(() => withRepo(), ['hang']);
    show(withRepo());
    const user = userEvent.setup();
    await user.click(within(region()).getByRole('button', { name: 'Fetch' }));
    const busy = await within(region()).findByRole('button', { name: 'Fetching…' });
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(within(region()).getByRole('status').textContent).toBe('Fetching…');
    // A second press while it runs sends nothing.
    await user.click(busy);
    expect(posts).toHaveLength(1);
    await user.click(within(region()).getByRole('button', { name: 'Cancel' }));
    const fetchButton = await within(region()).findByRole('button', { name: 'Fetch' });
    expect(within(region()).queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(document.activeElement).toBe(fetchButton);
    expect(within(region()).queryByRole('alert')).toBeNull();
    expect(posts[0]?.init?.signal?.aborted).toBe(true);
  });

  it('a refusal (409, not recorded) shows in the alert, cleared when the next fetch starts', async () => {
    stubApi(() => withRepo(), [{ status: 409, body: { error: { code: 'no-fetch-target', message: 'x' } } }, 'hang']);
    show(withRepo());
    const user = userEvent.setup();
    await user.click(within(region()).getByRole('button', { name: 'Fetch' }));
    expect((await within(region()).findByRole('alert')).textContent).toBe(en['error.noFetchTarget']);
    await user.click(within(region()).getByRole('button', { name: 'Fetch' }));
    await waitFor(() => expect(within(region()).queryByRole('alert')).toBeNull());
  });

  it('a refusal is cleared once a later fetch succeeded (lastSuccessAt moved)', async () => {
    stubApi(() => withRepo(), [{ status: 409, body: { error: { code: 'remote-unreadable', message: 'x' } } }]);
    const { queryClient } = show(withRepo());
    await userEvent.click(within(region()).getByRole('button', { name: 'Fetch' }));
    expect((await within(region()).findByRole('alert')).textContent).toBe(en['error.remoteUnreadable']);
    act(() => {
      queryClient.setQueryData(
        projectHeaderQuery('p_a').queryKey,
        withRepo({
          sync: { fetch: { lastSuccessAt: '2026-10-16T10:00:00.000Z', lastError: null }, update: { lastError: null } },
        }),
      );
    });
    await waitFor(() => expect(within(region()).queryByRole('alert')).toBeNull());
  });

  it('a git failure (422) is not an alert: the recorded lastError shows after the header read', async () => {
    let h = withRepo();
    stubApi(() => h, [{ status: 422, body: { error: { code: 'git-refused', message: 'fatal: x' } } }]);
    show(h);
    h = withRepo({
      sync: {
        fetch: { lastSuccessAt: null, lastError: { message: 'fatal: x', at: 'x' } },
        update: { lastError: null },
      },
    });
    await userEvent.click(within(region()).getByRole('button', { name: 'Fetch' }));
    expect(await within(region()).findByText('Fetch failed — not fetched since the console started')).toBeTruthy();
    expect(within(region()).queryByRole('alert')).toBeNull();
  });
});
