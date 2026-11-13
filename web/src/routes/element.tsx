/**
 * The element page route `/p/$pid/e/$eid` (US-G-01; spec-011 §2; ux-reference §4.2 v0.3, N5):
 * the element in the main region, reached by its address (G-01.4), from the Memory list (task-017),
 * from document, directive and element links (task-020, RP3-16 P2), and from a bell item while the
 * page is shown (task-077, Q1 (a)); Today and the bell elsewhere open the side panel (`?panel=`,
 * `element/SidePanel.tsx`), which this page ignores. It has no sidebar entry. Reads, nothing per reference
 * (TT-PERF-05): the element and its history, plus the project's directives and header (task-019,
 * shared with the Directives view); every key sits under `['p', pid]`, so the `repo` event
 * refreshes an open page (S-26.2).
 *
 * A short id (spec-011 §1, §3) is rewritten to the full id the server answered: the answer seeds the
 * full id's query (no second read) and the history entry is replaced (Back does not return to the
 * short form; D62-4).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoute, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { directivesQuery, projectHeaderQuery } from '../api/queries.js';
import { ElementPage } from '../element/ElementPage.js';
import { elementKeys, elementQuery, historyQuery, isPathSyntaxId, notFound } from '../element/queries.js';
import { TITLES, usePageTitle, useProjectName } from '../shell/page-title.js';
import { projectRoute } from './project.js';

declare module '@tanstack/history' {
  interface HistoryState {
    /** Set by Today's *Approve* / *Review*: the gate footer's reason takes the focus (task-037, D37-1). */
    gateFocus?: boolean;
  }
}

/** The page's error for an answered id that is no address (checker N-2). */
const NOT_FOUND = notFound();

/** The listener of the last close not yet resolved (one at a time, review F-4). */
let pendingClose: (() => void) | undefined;

/** Focus the page's `<main>` when the focus was lost with the closed page (on `<body>`). */
function focusMainWhenLost(): void {
  const active = document.activeElement;
  if (active === null || active === document.body) document.getElementById('main')?.focus();
}

function ElementRoutePage(): ReactNode {
  const { pid, eid } = elementRoute.useParams();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const focusReason = useRouterState({ select: (s) => s.location.state.gateFocus === true });
  // The request is used once: the entry is replaced without it, so a reload or a Back to this
  // panel does not move the focus again (review F7).
  const forgetFocusReason = useCallback(() => {
    const { href, state } = router.state.location;
    const next: Record<string, unknown> = { ...state };
    delete next['gateFocus'];
    router.history.replace(href, next);
  }, [router]);
  usePageTitle(TITLES.projectElement, { project: useProjectName(pid), element: eid });
  const queryClient = useQueryClient();
  const read = useQuery(elementQuery(pid, eid));
  const answered = read.data;
  // An answered id the URL parser would read as path syntax is no address: not found (checker N-2).
  const unusable = answered !== undefined && answered.element.id !== eid && isPathSyntaxId(answered.element.id);
  const element = unusable ? { data: undefined, error: NOT_FOUND } : read;
  // A short id: seed the full id's query with this answer and replace the address (D62-4). The
  // target is the server's `element.id`, under this project's `/e/` (spec-011 §6).
  useEffect(() => {
    if (answered === undefined || answered.element.id === eid || isPathSyntaxId(answered.element.id)) return;
    const full = answered.element.id;
    queryClient.setQueryData(elementKeys.detail(pid, full), answered);
    const { state, hash } = router.state.location;
    void router.navigate({ to: '/p/$pid/e/$eid', params: { pid, eid: full }, hash, state, replace: true });
  }, [answered, eid, pid, queryClient, router]);
  // Back to where the page was opened from inside the application, else to the project's Memory
  // list (spec-011 §2); then the focus goes to the destination's main region, unless the
  // destination placed it itself (e.g. the Memory list on the row of this element).
  // One Back per page: a second Escape or Close before the first resolves does nothing (checker N-3).
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [pid, eid]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // One listener at a time, removed on the first resolve after the close (review F-4). It cannot go
    // with the page's unmount: it has to run once the destination is shown, after the page left.
    pendingClose?.();
    const unsubscribe = router.subscribe('onResolved', () => {
      unsubscribe();
      pendingClose = undefined;
      requestAnimationFrame(focusMainWhenLost);
    });
    pendingClose = unsubscribe;
    if (canGoBack) router.history.back();
    else void router.navigate({ to: '/p/$pid/memory', params: { pid } });
  }, [canGoBack, router, pid]);
  return (
    <ElementPage
      pid={pid}
      eid={eid}
      element={element}
      history={useQuery(historyQuery(pid, eid))}
      directives={useQuery(directivesQuery(pid))}
      header={useQuery(projectHeaderQuery(pid))}
      focusReason={focusReason}
      onFocusReasonUsed={forgetFocusReason}
      onClose={close}
    />
  );
}

/** `/p/$pid/e/$eid`: the element page. */
export const elementRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'e/$eid',
  component: ElementRoutePage,
});
