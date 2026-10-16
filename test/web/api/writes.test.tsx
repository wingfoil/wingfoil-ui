// @vitest-environment jsdom
// task-037 — the governed-write mutation (`web/src/api/writes.ts`, D37-10): the path, method and
// body per verb, and the project's queries read again after a success and after a refusal;
// task-038 — the toast of each answer.
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../web/src/api/queries.js';
import { postElementWrite, useElementWrite } from '../../../web/src/api/writes.js';
import { AppIntlProvider } from '../../../web/src/i18n/index.js';
import { getToasts, resetToasts } from '../../../web/src/shell/toasts.js';
import { Toasts } from '../../../web/src/shell/Toasts.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

const OK = { result: {}, commits: [{ sha: 'a'.repeat(40), subject: 'wf(t): approve e' }], push: { status: 'off' } };

it('posts each verb to its route with its body, the ids encoded', async () => {
  const fetch = stubFetch(200, OK);
  await postElementWrite('p 1', 'e/1', 'approve', { expectedStatus: 's2', reason: 'ok' });
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/p/p%201/elements/e%2F1/approve');
  const init = fetch.mock.calls[0]?.[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({ expectedStatus: 's2', reason: 'ok' });
});

function wrapper() {
  const queryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

it.each([
  ['submit', undefined, { expectedStatus: 's1' }],
  ['reject', 'no', { expectedStatus: 's1', reason: 'no' }],
] as const)('useElementWrite %s sends %o and invalidates the project', async (verb, reason, body) => {
  const fetch = stubFetch(200, OK);
  const { Wrapper, invalidate } = wrapper();
  const { result } = renderHook(() => useElementWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', eid: 'e1', verb, expectedStatus: 's1', ...(reason ? { reason } : {}) });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(OK);
  expect(fetch.mock.calls[0]?.[0]).toBe(`/api/p/p1/elements/e1/${verb}`);
  expect(JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit).body))).toEqual(body);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] });
});

it('a refusal is the ApiError and the project is read again (RP-12)', async () => {
  stubFetch(409, { error: { code: 'element-changed', message: 'x' } });
  const { Wrapper, invalidate } = wrapper();
  const { result } = renderHook(() => useElementWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', eid: 'e1', verb: 'approve', expectedStatus: 's2', reason: 'ok' });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.code).toBe('element-changed');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['p', 'p1'] });
});

// task-038 — the feedback of a write (D38-3 … D38-5, D38-11): one toast per answer, raised by the
// mutation itself (so a panel closed before the answer still gets it), keyed by the element.

function toastWrapper() {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AppIntlProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toasts />
      </QueryClientProvider>
    </AppIntlProvider>
  );
  return { Wrapper };
}

const SHA = '0123456789abcdef0123456789abcdef01234567';
const APPROVED = {
  result: { id: 'e1', from: 's2', to: 's3' },
  commits: [{ sha: SHA, subject: 'wf(task): approve e1 [s2 → s3]' }],
};

const politeText = () => document.querySelector('.toasts [aria-live="polite"]')?.textContent ?? '';
const assertiveText = () => document.querySelector('.toasts [aria-live="assertive"]')?.textContent ?? '';

async function write(
  status: number,
  body: unknown,
  verb: 'submit' | 'approve' | 'reject' = 'approve',
): Promise<void> {
  stubFetch(status, body);
  const { Wrapper } = toastWrapper();
  const { result } = renderHook(() => useElementWrite(), { wrapper: Wrapper });
  result.current.mutate({ pid: 'p1', eid: 'e1', verb, expectedStatus: 's2', reason: 'ok' });
  await waitFor(() => expect(result.current.isIdle || result.current.isPending).toBe(false));
}

describe('task-038 toasts', () => {
  beforeEach(() => resetToasts());
  afterEach(() => cleanup());

  it('G-13.1 — the result, the commit line with its short hash, and "pushed"', async () => {
    await write(200, { ...APPROVED, push: { status: 'pushed' } });
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(getToasts()[0]).toMatchObject({ key: 'write:p1:e1', tone: 'success' });
    expect(politeText()).toContain('Approved e1');
    expect(politeText()).toContain('0123456 wf(task): approve e1 [s2 → s3]');
    expect(document.querySelector('.toasts code')?.textContent).toBe('0123456');
    expect(document.querySelector('.toasts .toast-pushed')?.textContent).toBe('pushed');
    expect(getToasts()[0]?.sticky).toBeFalsy();
  });

  it('G-13.2 — without "pushed" when auto-push is off', async () => {
    await write(200, { ...APPROVED, push: { status: 'off' } }, 'submit');
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(politeText()).toContain('Submitted e1');
    expect(document.querySelector('.toasts .toast-pushed')).toBeNull();
    expect(politeText()).not.toContain('pushed');
  });

  it.each([
    ['push-timeout', 'The push did not finish within 60 s — use Push to try again'],
    ['internal', 'Something went wrong in the console: see its log in the terminal'],
    ['no-upstream', 'This branch has no upstream on the remote — set one with git in a terminal'],
    ['detached-head', 'Blocked: no branch checked out'],
    ['an-unknown-code', 'Something went wrong in the console: see its log in the terminal'],
  ])('D38-4 — a failed push with code %s: sticky, polite, the catalogue text', async (code, text) => {
    await write(200, { ...APPROVED, push: { status: 'failed', code } }, 'reject');
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(getToasts()[0]).toMatchObject({ tone: 'success', sticky: true });
    expect(politeText()).toContain('Rejected e1');
    expect(politeText()).toContain('Not pushed — the commit stays local');
    expect(politeText()).toContain(text);
    expect(document.querySelector('.toasts .toast-pushed')).toBeNull();
  });

  it("D38-4 — a failed push with git's message: verbatim in the git frame", async () => {
    await write(200, { ...APPROVED, push: { status: 'failed', message: '! [rejected] main -> main (fetch first)' } });
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(politeText()).toContain('Not pushed — the commit stays local');
    expect(politeText()).toContain('Git refused the action:');
    expect(document.querySelector('.toasts pre.verbatim')?.textContent).toBe('! [rejected] main -> main (fetch first)');
  });

  it.each([
    [422, { code: 'cli-refused', message: 'Error: required field sard_ref is empty' }, 'WingFoil refused the action:'],
    [409, { code: 'element-changed', message: 'x' }, 'This element changed since you opened it'],
    [409, { code: 'local-changes', message: 'x' }, 'This element has local changes: commit or discard them first'],
    [
      500,
      { code: 'write-incomplete', message: 'x', detail: { file: 'docs/e.md', commit: 'c'.repeat(40) } },
      `WingFoil made the commit ${'c'.repeat(40)}`,
    ],
  ])('G-14.1, G-14.2 — a refusal %i is a red, sticky, assertive toast', async (status, error, text) => {
    await write(status, { error }, 'submit');
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(getToasts()[0]).toMatchObject({ key: 'write:p1:e1', tone: 'error' });
    expect(assertiveText()).toContain('Submit of e1 not done');
    expect(assertiveText()).toContain(text);
    if (error.code === 'cli-refused') {
      expect(document.querySelector('.toasts pre.verbatim')?.textContent).toBe(error.message);
    }
    expect(politeText()).toBe('');
  });

  it('D38-11 — the toast is raised even when the caller unmounted before the answer', async () => {
    let answer: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    const { Wrapper } = toastWrapper();
    const hook = renderHook(() => useElementWrite(), { wrapper: Wrapper });
    hook.result.current.mutate({ pid: 'p1', eid: 'e1', verb: 'submit', expectedStatus: 's1' });
    await waitFor(() => expect(hook.result.current.isPending).toBe(true));
    hook.unmount();
    answer(
      new Response(JSON.stringify({ ...APPROVED, push: { status: 'off' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await waitFor(() => expect(getToasts()).toHaveLength(1));
    expect(getToasts()[0]?.tone).toBe('success');
  });
});
