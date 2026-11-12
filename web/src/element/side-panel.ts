/**
 * The side panel in the address (task-077; spec-011 §2, §6; ux-reference §4.2 v0.3, RP3-17 E1): a
 * search parameter `panel=<full id>` of the project layout, valid on every view of `/p/<pid>/…` and
 * ignored on the element page. Today's rows and the notification bell's items open it over the
 * current view; this module holds what they share — the parameter's reading (`panelSearch`), the
 * navigation that opens it (`panelLinkOptions`), and the opener whose focus comes back when the
 * panel closes (bug-018; task-062 D62-10, task-077 D77-7).
 */
import { useRouterState, type HistoryState } from '@tanstack/react-router';
import type { MouseEvent } from 'react';

declare module '@tanstack/history' {
  interface HistoryState {
    /** Set when the console opened the side panel by a push: closing it goes back (D77-5). */
    panelPushed?: boolean;
  }
}

/** The project layout's search parameters: the side panel's element, when present. */
export interface PanelSearch {
  panel?: string;
}

/**
 * Read `panel=` (D77-1, Q1 (a)): a string as written — `''` included, which `elementPath` refuses —,
 * any other form the search parser produced (a number, a boolean, `null`, an object, an array of a
 * repeated parameter) as `''`, so that the panel answers *not found* without a request; absent stays
 * absent. The value is only ever looked up as an element id of the current project (spec-011 §6).
 */
export function panelSearch(search: Record<string, unknown>): PanelSearch {
  if (!('panel' in search) || search['panel'] === undefined) return {};
  const value = search['panel'];
  return { panel: typeof value === 'string' ? value : '' };
}

/** `search` without `panel`. */
export function withoutPanel<T extends Record<string, unknown>>(search: T): Omit<T, 'panel'> {
  const { panel: _panel, ...rest } = search;
  void _panel;
  return rest;
}

/** Whether the current address holds `panel=` (an opening then replaces it, Q2 (a)). */
export function usePanelOpen(): boolean {
  return useRouterState({ select: (s) => (s.location.search as PanelSearch).panel !== undefined });
}

/** The navigation options that open `id` in the side panel of the current view (D77-4, Q2 (a)). */
export interface PanelNavigation {
  to: '.';
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
  state: (prev: HistoryState) => HistoryState;
  replace: boolean;
  resetScroll: false;
}

/**
 * Open `id` in the side panel over the current view: the path and every other parameter kept; a
 * push when no panel is open (`panelOpen` false), else a replace that keeps the entry's state, so one
 * *Close* — or one Back — always returns to the view (Q2 (a)). `gateFocus` asks the gate footer's
 * reason to take the focus (task-037, D37-1). The scroll of the view is left as it is.
 */
export function panelLinkOptions(id: string, panelOpen: boolean, gateFocus = false): PanelNavigation {
  return {
    to: '.',
    search: (prev) => ({ ...prev, panel: id }),
    // A replace keeps whether the console pushed the entry: *Close* still goes back to the view.
    state: (prev) => ({
      ...(panelOpen ? prev : {}),
      panelPushed: panelOpen ? prev.panelPushed === true : true,
      gateFocus,
    }),
    replace: panelOpen,
    resetScroll: false,
  };
}

/** The control that opened the side panel: the class `className` inside the row of `eid` of `pid`. */
export interface PanelOpener {
  pid: string;
  eid: string;
  className: string;
}

/** The opener of the open side panel, set by the opener's handler (not by `document.activeElement`). */
let opener: PanelOpener | undefined;

/** Whether a click on a link is followed in this page (primary button, no modifier key). */
function followedHere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Record the control of class `className` in the row of `eid` as the opener of the side panel
 * (bug-018; Safari does not focus a clicked button, so the handler records it). Given the click of
 * a link, only a click followed in this page counts (a modified or middle click opens elsewhere).
 */
export function rememberOpener(
  pid: string,
  eid: string,
  className: string,
  event?: MouseEvent<HTMLAnchorElement>,
): void {
  if (event === undefined || followedHere(event)) opener = { pid, eid, className };
}

/** A view that may give the focus back to an opener; true when it takes the request. */
export type PanelClosedListener = (pid: string, opener: PanelOpener | undefined) => boolean;

const listeners = new Set<PanelClosedListener>();

/** Listen to the side panel's closes (Today, D77-7); returns the unsubscribe. */
export function onPanelClosed(listener: PanelClosedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Focus the main region when the focus was lost with the closed panel (on `<body>`). */
function focusMainWhenLost(): void {
  const active = document.activeElement;
  if (active === null || active === document.body) document.getElementById('main')?.focus();
}

/**
 * The side panel of `pid` closed — by *Close*, Escape, *Cancel*, the browser's Back or a view's own
 * navigation (D77-7): the remembered opener of the same project goes to the views listening; when
 * none takes it, the main region gets the focus if it was lost. The record is used once.
 */
export function panelClosed(pid: string): void {
  const mine = opener?.pid === pid ? opener : undefined;
  opener = undefined;
  let taken = false;
  for (const listener of listeners) if (listener(pid, mine)) taken = true;
  if (!taken) requestAnimationFrame(focusMainWhenLost);
}

/**
 * Forget the opener: the panel is opened by a control that keeps no focus to return to (the bell).
 * Given the click of a link, only a click followed in this page counts: a modified or middle click
 * opens the element elsewhere and leaves this page's panel and its opener as they are (review F-3).
 */
export function forgetOpener(event?: MouseEvent<HTMLAnchorElement>): void {
  if (event === undefined || followedHere(event)) opener = undefined;
}

/** How many side panels of each project are mounted (one; React's strict mode mounts twice in development). */
const mounted = new Map<string, number>();

/**
 * Record a side panel of `pid` as mounted; the returned cleanup signals {@link panelClosed} once no
 * panel of `pid` is mounted any more — checked after the current task, so that an unmount followed
 * at once by a mount (React's strict mode in development) is no close.
 */
export function trackPanel(pid: string): () => void {
  mounted.set(pid, (mounted.get(pid) ?? 0) + 1);
  return () => {
    mounted.set(pid, (mounted.get(pid) ?? 1) - 1);
    queueMicrotask(() => {
      if ((mounted.get(pid) ?? 0) === 0) panelClosed(pid);
    });
  };
}
