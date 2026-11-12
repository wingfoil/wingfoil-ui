/**
 * The side panel's controller (task-077 D77-2 … D77-7; spec-011 §2, §6): rendered by the project
 * layout while `panel=` is present and the element page is not shown, keyed by the project. It reads
 * the element named by `panel=` — only ever as an element id of this project, through `elementPath`
 * (`encodeURIComponent`, the refusal of `''`, `.`, `..`, D62-9) — and its history, the project's
 * directives and header (the element page's reads, task-062); rewrites a short value to the server's
 * full id in place (the answer seeded, D77-3); and closes: Back when the console pushed the entry,
 * else a replace without `panel=`, every other parameter kept (D77-5). When it unmounts — whatever
 * closed it — it signals `panelClosed`, so the focus returns to the opener or the main region (D77-7).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { directivesQuery, projectHeaderQuery } from '../api/queries.js';
import { ElementSidePanel } from './ElementSidePanel.js';
import { elementKeys, elementQuery, historyQuery, isPathSyntaxId, notFound } from './queries.js';
import { trackPanel, withoutPanel } from './side-panel.js';

/** The panel's error for an answered id that is no address (task-062 N-2). */
const NOT_FOUND = notFound();

/** Props of {@link SidePanel}. */
export interface SidePanelProps {
  pid: string;
  /** The value of `panel=` as `panelSearch` read it. */
  eid: string;
}

/** The side panel of project `pid`, showing `eid`. */
export function SidePanel({ pid, eid }: SidePanelProps): ReactNode {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const pushed = useRouterState({ select: (s) => s.location.state.panelPushed === true });
  const focusReason = useRouterState({ select: (s) => s.location.state.gateFocus === true });
  const read = useQuery(elementQuery(pid, eid));
  const answered = read.data;
  const unusable = answered !== undefined && answered.element.id !== eid && isPathSyntaxId(answered.element.id);
  const element = unusable ? { data: undefined, error: NOT_FOUND } : read;

  // A short value: seed the full id's query and replace only the value (spec-011 §2, D77-3). The
  // target is the server's `element.id` in this view's `panel=` (spec-011 §6).
  useEffect(() => {
    if (answered === undefined || answered.element.id === eid || isPathSyntaxId(answered.element.id)) return;
    const full = answered.element.id;
    queryClient.setQueryData(elementKeys.detail(pid, full), answered);
    void router.navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, panel: full }),
      state: (prev) => prev,
      hash: (prev) => prev ?? '',
      replace: true,
      resetScroll: false,
    });
  }, [answered, eid, pid, queryClient, router]);

  // The gate-focus request is used once: the entry is replaced without it (task-037 review F7).
  const forgetFocusReason = useCallback(() => {
    const { href, state } = router.state.location;
    const next: Record<string, unknown> = { ...state };
    delete next['gateFocus'];
    router.history.replace(href, next);
  }, [router]);

  // One close at a time: a second Escape or *Close* before the first resolves does nothing (N-3).
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [pid, eid]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (pushed && canGoBack) router.history.back();
    else
      void router.navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => withoutPanel(prev),
        replace: true,
        resetScroll: false,
      });
  }, [canGoBack, pushed, router]);

  // Whatever closes the panel (D77-7): the focus goes back to its opener, or to the main region.
  useEffect(() => trackPanel(pid), [pid]);

  return (
    <ElementSidePanel
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
