/**
 * The element panel route `/p/$pid/e/$eid` (US-G-01; ux-reference §2 overlay, §4.2): reachable by
 * URL (G-01.4), opened from the Memory list (task-017) and from document links (task-020). It has
 * no sidebar entry — the panel is an overlay, not a view. Reads, nothing per reference (TT-PERF-05):
 * the element and its history, plus the project's directives and header (task-019, shared with the
 * Directives view: once per project and repository state); every key sits under `['p', pid]`, so
 * the `repo` event refreshes an open panel (S-26.2).
 */
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createRoute, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback, type ReactNode } from 'react';
import { apiGet } from '../api/client.js';
import { directivesQuery, projectHeaderQuery } from '../api/queries.js';
import { queryKeys } from '../api/query-keys.js';
import { ElementPanel } from '../element/ElementPanel.js';
import { TITLES, usePageTitle, useProjectName } from '../shell/page-title.js';
import { projectRoute } from './project.js';

declare module '@tanstack/history' {
  interface HistoryState {
    /** Set by Today's *Approve* / *Review*: the gate footer's reason takes the focus (task-037, D37-1). */
    gateFocus?: boolean;
  }
}

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

/** Focus the page's `<main>` when the focus was lost with the closed panel (on `<body>`). */
function focusMainWhenLost(): void {
  const active = document.activeElement;
  if (active === null || active === document.body) document.getElementById('main')?.focus();
}

function ElementPage(): ReactNode {
  const { pid, eid } = elementRoute.useParams();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const focusReason = useRouterState({ select: (s) => s.location.state.gateFocus === true });
  usePageTitle(TITLES.projectElement, { project: useProjectName(pid), element: eid });
  // Back to where the panel was opened from inside the application, else to the project; then the
  // focus goes to the destination's main region, unless the destination placed it itself (e.g. the
  // Memory list on the row of this element).
  const close = useCallback(() => {
    const unsubscribe = router.subscribe('onResolved', () => {
      unsubscribe();
      requestAnimationFrame(focusMainWhenLost);
    });
    if (canGoBack) router.history.back();
    else void router.navigate({ to: '/p/$pid', params: { pid } });
  }, [canGoBack, router, pid]);
  return (
    <ElementPanel
      pid={pid}
      eid={eid}
      element={useQuery(elementQuery(pid, eid))}
      history={useQuery(historyQuery(pid, eid))}
      directives={useQuery(directivesQuery(pid))}
      header={useQuery(projectHeaderQuery(pid))}
      focusReason={focusReason}
      onClose={close}
    />
  );
}

/** `/p/$pid/e/$eid`: the element panel. */
export const elementRoute = createRoute({ getParentRoute: () => projectRoute, path: 'e/$eid', component: ElementPage });
