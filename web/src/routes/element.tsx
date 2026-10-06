/**
 * The element panel route `/p/$pid/e/$eid` (US-G-01; ux-reference §2 overlay, §4.2): reachable by
 * URL (G-01.4), opened from the Memory list (task-017) and from document links (task-020). It has
 * no sidebar entry — the panel is an overlay, not a view. Two reads, nothing per reference
 * (TT-PERF-05): the element and its history; both keys sit under `['p', pid]`, so the `repo` event
 * refreshes an open panel (S-26.2).
 */
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createRoute, useCanGoBack, useRouter } from '@tanstack/react-router';
import { useCallback, type ReactNode } from 'react';
import { apiGet } from '../api/client.js';
import { projectsQuery } from '../api/queries.js';
import { queryKeys } from '../api/query-keys.js';
import { ElementPanel } from '../element/ElementPanel.js';
import { TITLES, usePageTitle } from '../shell/page-title.js';
import { projectRoute } from './project.js';

/** Query keys of the element panel (on `queryKeys.project`, refreshed by `repo`). */
export const elementKeys = {
  detail: (pid: string, eid: string) => queryKeys.project(pid, 'element', eid),
  history: (pid: string, eid: string) => queryKeys.project(pid, 'element', eid, 'history'),
};

/** The API path of element `eid` of project `pid`. */
function elementPath(pid: string, eid: string): string {
  return `/api/p/${encodeURIComponent(pid)}/elements/${encodeURIComponent(eid)}`;
}

/** `GET /api/p/:pid/elements/:eid`. */
export function elementQuery(pid: string, eid: string) {
  return queryOptions({
    queryKey: elementKeys.detail(pid, eid),
    queryFn: ({ signal }) => apiGet<ElementDetail>(elementPath(pid, eid), signal),
  });
}

/** `GET /api/p/:pid/elements/:eid/history`. */
export function historyQuery(pid: string, eid: string) {
  return queryOptions({
    queryKey: elementKeys.history(pid, eid),
    queryFn: ({ signal }) => apiGet<MemoryHistory>(`${elementPath(pid, eid)}/history`, signal),
  });
}

function ElementPage(): ReactNode {
  const { pid, eid } = elementRoute.useParams();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const project = useQuery(projectsQuery()).data?.projects.find((p) => p.id === pid);
  usePageTitle(TITLES.projectElement, { project: project?.name ?? pid, element: eid });
  // Back to where the panel was opened from inside the application, else to the project.
  const close = useCallback(() => {
    if (canGoBack) router.history.back();
    else void router.navigate({ to: '/p/$pid', params: { pid } });
  }, [canGoBack, router, pid]);
  return (
    <ElementPanel
      eid={eid}
      element={useQuery(elementQuery(pid, eid))}
      history={useQuery(historyQuery(pid, eid))}
      onClose={close}
    />
  );
}

/** `/p/$pid/e/$eid`: the element panel. */
export const elementRoute = createRoute({ getParentRoute: () => projectRoute, path: 'e/$eid', component: ElementPage });
