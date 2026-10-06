/** Renders the whole application (providers, router, shell) on a memory history for the web tests. */
import { createMemoryHistory } from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../../../web/src/app.js';
import type { MessageId } from '../../../web/src/i18n/index.js';
import { createQueryClient } from '../../../web/src/api/queries.js';
import { createAppRouter } from '../../../web/src/routes/tree.js';

/** Answers of the fake API, by path. */
export type FakeApi = Record<string, { status: number; body?: unknown }>;

/** Stub `fetch` with `api` (unknown paths → 404 envelope) and return the stub. */
export function stubApi(api: FakeApi): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (url: string) => {
    const a = api[url] ?? { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), {
      status: a.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** A `GET /api/server` answer with `warnings`. */
export function serverInfo(warnings: { key: string; args: Record<string, string> }[] = []): FakeApi[string] {
  return { status: 200, body: { version: '0.0.0', range: { min: '0.2.2', max: '0.2.x' }, capabilities: [], warnings } };
}

/** Render the application at `path`, optionally with another catalogue (the key build). */
export function renderApp(
  path = '/',
  messages?: Record<string, string>,
): RenderResult & { router: ReturnType<typeof createAppRouter>; queryClient: ReturnType<typeof createQueryClient> } {
  const queryClient = createQueryClient();
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [path] }) });
  const result = render(
    <App
      queryClient={queryClient}
      router={router}
      {...(messages ? { messages: messages as Record<MessageId, string> } : {})}
    />,
  );
  return { ...result, router, queryClient };
}
