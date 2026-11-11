/**
 * The reads of an element (spec-004 §3, spec-011 §2, §3): its detail and its history, keyed under
 * `queryKeys.project` (the `repo` event refreshes them, S-26.2). Shared by the element page and,
 * from task-077, the side panel.
 */
import type { ElementDetail, MemoryHistory } from '@wingfoil-ui/contracts';
import { queryOptions } from '@tanstack/react-query';
import { ApiError, apiGet } from '../api/client.js';
import { queryKeys } from '../api/query-keys.js';

/** Query keys of an element's reads. */
export const elementKeys = {
  detail: (pid: string, eid: string) => queryKeys.project(pid, 'element', eid),
  history: (pid: string, eid: string) => queryKeys.project(pid, 'element', eid, 'history'),
};

/**
 * The API path of element `eid` of project `pid`, each id one encoded segment. An id that the URL
 * parser reads as path syntax — `''`, `.`, `..`: `encodeURIComponent` keeps dots, and the parser
 * removes dot segments, so `/elements/..` would reach `/api/p/<pid>/` (task-062 D62-9, P1) — is
 * refused as an unknown id, before any request (spec-011 §6). WingFoil makes no such id.
 */
export function elementPath(pid: string, eid: string): string {
  if (eid === '' || eid === '.' || eid === '..') throw new ApiError(404, 'not-found', 'Not found', undefined);
  return `/api/p/${encodeURIComponent(pid)}/elements/${encodeURIComponent(eid)}`;
}

/** `GET /api/p/:pid/elements/:eid` — a full id, or a short id the server resolves (spec-011 §3). */
export function elementQuery(pid: string, eid: string) {
  return queryOptions({
    queryKey: elementKeys.detail(pid, eid),
    queryFn: async ({ signal }) => apiGet<ElementDetail>(elementPath(pid, eid), signal),
  });
}

/** `GET /api/p/:pid/elements/:eid/history` — the full id only (spec-011 §3). */
export function historyQuery(pid: string, eid: string) {
  return queryOptions({
    queryKey: elementKeys.history(pid, eid),
    queryFn: async ({ signal }) => apiGet<MemoryHistory>(`${elementPath(pid, eid)}/history`, signal),
  });
}
