/**
 * The query client and the shell's queries. Data stays fresh until the event stream says otherwise
 * (`staleTime: Infinity`, no refetch on focus or reconnect of the window): pages never poll
 * (REQ-INT-09); `repo`, `projects` and a stream reconnect invalidate (`api/events.ts`).
 */
import type { ElementList, ProjectListResponse, ServerInfo } from '@wingfoil-ui/contracts';
import { QueryClient, queryOptions } from '@tanstack/react-query';
import { ApiError, apiGet } from './client.js';
import { queryKeys } from './query-keys.js';

/** The application's query client. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // A refusal is an answer, not a glitch: only a transport failure is retried, once.
        retry: (count, error) => !(error instanceof ApiError) && count < 1,
      },
    },
  });
}

/** `GET /api/server`: UI version, range, capabilities, shell warnings. */
export function serverQuery() {
  return queryOptions({
    queryKey: queryKeys.server(),
    queryFn: ({ signal }) => apiGet<ServerInfo>('/api/server', signal),
  });
}

/** `GET /api/projects`: the project list (task-015 renders it). */
export function projectsQuery() {
  return queryOptions({
    queryKey: queryKeys.projects(),
    queryFn: ({ signal }) => apiGet<ProjectListResponse>('/api/projects', signal),
  });
}

/** `GET /api/p/:pid/elements[?archived=true]`: the Memory elements (shared by the views that need them). */
export function elementsQuery(pid: string, archived: boolean) {
  const path = `/api/p/${encodeURIComponent(pid)}/elements${archived ? '?archived=true' : ''}`;
  return queryOptions({
    queryKey: queryKeys.project(pid, 'elements', { archived }),
    queryFn: ({ signal }) => apiGet<ElementList>(path, signal),
  });
}
