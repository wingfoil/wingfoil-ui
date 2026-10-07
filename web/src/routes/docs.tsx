/**
 * The Documentation view (US-R-08, US-R-09; ux-reference §2 *Rules and context*, §4.9):
 * `/p/$pid/docs` (the index) and `/p/$pid/docs/<repository path>` (a document, the splat). Reads:
 * `GET /docs`, `GET /files/content?path=` of the document; only when the document links to
 * repository paths outside the index, `GET /elements` (Memory files open their element panel) and
 * `GET /files/content` once per remaining distinct target (W3-30: the server says served, missing,
 * outside or not shown). Every key sits under `['p', pid]`: a `repo` event refreshes the open page.
 */
import type { DocumentationIndex, FileContent } from '@wingfoil-ui/contracts';
import { queryOptions } from '@tanstack/react-query';
import { createRoute, lazyRouteComponent, Outlet } from '@tanstack/react-router';
import { defineMessages } from 'react-intl';
import { apiGet } from '../api/client.js';
import { queryKeys } from '../api/query-keys.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

/** The view's name (sidebar entry, page title). */
export const DOCS_LABELS = defineMessages({ nav: { id: 'shell.nav.documentation' } });

/** Query keys of the Documentation view (on `queryKeys.project`, refreshed by `repo`). */
export const docsKeys = {
  index: (pid: string) => queryKeys.project(pid, 'docs'),
  content: (pid: string, path: string) => queryKeys.project(pid, 'docs', 'content', path),
};

/** `GET /api/p/:pid/docs`. */
export function docsIndexQuery(pid: string) {
  return queryOptions({
    queryKey: docsKeys.index(pid),
    queryFn: ({ signal }) => apiGet<DocumentationIndex>(`/api/p/${encodeURIComponent(pid)}/docs`, signal),
  });
}

/** `GET /api/p/:pid/files/content?path=`: a document, or why the path is refused. */
export function documentContentQuery(pid: string, path: string) {
  return queryOptions({
    queryKey: docsKeys.content(pid, path),
    queryFn: ({ signal }) =>
      apiGet<FileContent>(`/api/p/${encodeURIComponent(pid)}/files/content?path=${encodeURIComponent(path)}`, signal),
  });
}

/** `/p/$pid/docs`: the view's layout (its sidebar entry). */
const docsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'docs',
  component: Outlet,
  staticData: { nav: { group: 'rules', order: NAV_ORDER.documentation, label: DOCS_LABELS.nav } },
});

/** `/p/$pid/docs/`: the index. */
// The pages load on first use (review F6): markdown-it and DOMPurify stay out of the entry chunk.
const docsIndexRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../docs/pages.js'), 'DocsIndexPage'),
});

/** `/p/$pid/docs/<path>`: a document. */
const documentRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '$',
  component: lazyRouteComponent(() => import('../docs/pages.js'), 'DocumentPage'),
});

/** The Documentation routes, for `PROJECT_ROUTES`. */
export const documentationRoute = docsRoute.addChildren([docsIndexRoute, documentRoute]);
