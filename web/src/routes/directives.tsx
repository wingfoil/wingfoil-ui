/**
 * The Directives view (US-R-06, US-G-02; ux-reference §2 *Rules and context*, §4.6; W3-41, W3-43):
 * `/p/$pid/directives` (the list, `?show=all` for every directive, else "only mine") and
 * `/p/$pid/directives/$did` (one directive with its rendered body, loaded on first use so that the
 * Markdown renderer stays out of the entry chunk). Reads: `GET /directives` (shared with the
 * element panel), `GET /api/p/:pid` (identity, role view) and `GET /directives/:did`; every key
 * under `['p', pid]`, refreshed by `repo`.
 */
import type { DirectiveDetail } from '@wingfoil-ui/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createRoute, lazyRouteComponent, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { apiGet } from '../api/client.js';
import { directivesQuery, projectHeaderQuery } from '../api/queries.js';
import { queryKeys } from '../api/query-keys.js';
import { DirectiveList } from '../directives/DirectiveList.js';
import { directivesSearch, SHOW_ALL } from '../directives/model.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { useProjectName } from './dna.js';
import { NAV_ORDER } from './nav.js';
import { projectRoute } from './project.js';

/** The view's name (sidebar entry, page title). */
export const DIRECTIVES_LABELS = defineMessages({ nav: { id: 'shell.nav.directives' } });

/** Query keys of the Directives view (on `queryKeys.project`, refreshed by `repo`). */
export const directiveKeys = {
  list: (pid: string) => directivesQuery(pid).queryKey,
  detail: (pid: string, did: string) => queryKeys.project(pid, 'directives', did),
};

/** `GET /api/p/:pid/directives/:did`: one directive with its body. */
export function directiveQuery(pid: string, did: string) {
  return queryOptions({
    queryKey: directiveKeys.detail(pid, did),
    queryFn: ({ signal }) =>
      apiGet<DirectiveDetail>(`/api/p/${encodeURIComponent(pid)}/directives/${encodeURIComponent(did)}`, signal),
  });
}

/** `/p/$pid/directives`: the view's layout (its sidebar entry). */
const directivesRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'directives',
  component: Outlet,
  staticData: { nav: { group: 'rules', order: NAV_ORDER.directives, label: DIRECTIVES_LABELS.nav } },
});

function DirectiveListPage(): ReactNode {
  const { pid } = directiveListRoute.useParams();
  const { show } = directiveListRoute.useSearch();
  const navigate = directiveListRoute.useNavigate();
  const intl = useIntl();
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view: intl.formatMessage(DIRECTIVES_LABELS.nav) });
  return (
    <DirectiveList
      pid={pid}
      requested={show}
      onShowAll={(all) => void navigate({ search: all ? { show: SHOW_ALL } : {}, replace: true })}
      directives={useQuery(directivesQuery(pid))}
      header={useQuery(projectHeaderQuery(pid))}
    />
  );
}

/** `/p/$pid/directives/`: the list. */
const directiveListRoute = createRoute({
  getParentRoute: () => directivesRoute,
  path: '/',
  validateSearch: directivesSearch,
  component: DirectiveListPage,
});

/** `/p/$pid/directives/$did`: one directive. */
const directiveRoute = createRoute({
  getParentRoute: () => directivesRoute,
  path: '$did',
  component: lazyRouteComponent(() => import('../directives/pages.js'), 'DirectivePage'),
});

/** The Directives routes, for `PROJECT_ROUTES`. */
export const directivesViewRoute = directivesRoute.addChildren([directiveListRoute, directiveRoute]);
