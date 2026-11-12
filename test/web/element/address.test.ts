// task-062 D62-9 (spec-011 §2, §6) — the API path of an element: every id placed with
// `encodeURIComponent`, and an id that the URL parser would read as path syntax (`''`, `.`, `..`)
// refused before any request — `/api/p/<pid>/elements/..` would reach `/api/p/<pid>/` (probe P1).
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../web/src/api/client.js';
import { elementPath, elementQuery, historyQuery } from '../../../web/src/element/queries.js';

describe('elementPath', () => {
  it.each([
    ['task-001-login-form', '/api/p/p_x/elements/task-001-login-form'],
    ['../x', '/api/p/p_x/elements/..%2Fx'],
    ['https://example.test/x', '/api/p/p_x/elements/https%3A%2F%2Fexample.test%2Fx'],
    ['%2e%2e', '/api/p/p_x/elements/%252e%252e'],
    ['a/..', '/api/p/p_x/elements/a%2F..'],
    ['...', '/api/p/p_x/elements/...'],
    ['a b#?', '/api/p/p_x/elements/a%20b%23%3F'],
  ])('places %j as one encoded segment', (eid, path) => {
    expect(elementPath('p_x', eid)).toBe(path);
    // One segment under `elements/`: the URL parser keeps it as written.
    expect(new URL(path, 'http://127.0.0.1').pathname).toBe(path);
  });

  it('encodes the project id too', () => {
    expect(elementPath('p/x', 'e')).toBe('/api/p/p%2Fx/elements/e');
  });

  it.each(['', '.', '..'])('refuses %j as not found, without building a path', (eid) => {
    let error: unknown;
    try {
      elementPath('p_x', eid);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('not-found');
  });
});

describe('the element queries', () => {
  it.each(['', '.', '..'])('read nothing for %j: a local not-found', async (eid) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      const signal = new AbortController().signal;
      for (const query of [elementQuery('p_x', eid), historyQuery('p_x', eid)]) {
        const run = query.queryFn as (c: { signal: AbortSignal }) => Promise<unknown>;
        await expect(run({ signal })).rejects.toMatchObject({ status: 404, code: 'not-found' });
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
