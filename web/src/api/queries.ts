/**
 * The query client and the shell's queries. Data stays fresh until the event stream says otherwise
 * (`staleTime: Infinity`, no refetch on focus or reconnect of the window): pages never poll
 * (REQ-INT-09); `repo`, `projects` and a stream reconnect invalidate (`api/events.ts`).
 */
import type {
  DirectiveList,
  ElementList,
  ProjectConfig,
  ProjectHeader,
  ProjectListResponse,
  ServerInfo,
} from '@wingfoil-ui/contracts';
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

/** The API path of project `pid`. */
function projectPath(pid: string): string {
  return `/api/p/${encodeURIComponent(pid)}`;
}

/** `GET /api/p/:pid/config`: DNA, paths, workflows and resolved types (Memory list, DNA view). */
export function projectConfigQuery(pid: string) {
  return queryOptions({
    queryKey: queryKeys.project(pid, 'config'),
    queryFn: ({ signal }) => apiGet<ProjectConfig>(`${projectPath(pid)}/config`, signal),
  });
}

/**
 * `GET /api/p/:pid/elements[?archived=true]`: the elements with their descriptor and marker. Shared
 * by the Memory list and the documentation index (same key, one read per repository state); the
 * archived read costs two more CLI processes, so it is made only when a view needs it (spec-001).
 */
export function elementsQuery(pid: string, archived: boolean) {
  return queryOptions({
    queryKey: queryKeys.project(pid, 'elements', { archived }),
    queryFn: ({ signal }) =>
      apiGet<ElementList>(`${projectPath(pid)}/elements${archived ? '?archived=true' : ''}`, signal),
  });
}

/**
 * `GET /api/p/:pid`: the project header — identity, role views, version (W3-40). Read by the views
 * that depend on who the user is (Directives, Team, the element panel); task-016's header shares it.
 */
export function projectHeaderQuery(pid: string) {
  return queryOptions({
    queryKey: queryKeys.project(pid, 'header'),
    queryFn: ({ signal }) => apiGet<ProjectHeader>(projectPath(pid), signal),
  });
}

/**
 * `GET /api/p/:pid/directives`: every directive with `mine` for the current role view. Shared by
 * the Directives view and the element panel: one read per repository state, never per element.
 */
export function directivesQuery(pid: string) {
  return queryOptions({
    queryKey: queryKeys.project(pid, 'directives'),
    queryFn: ({ signal }) => apiGet<DirectiveList>(`${projectPath(pid)}/directives`, signal),
  });
}
