/**
 * The project list mutations (spec-004 §3, spec-006 §3), shared by the project switcher
 * (task-015: remove) and the *Add project* dialog (task-014: add, clone — {@link useAddLocalProject},
 * {@link useCloneProject}, an aborted request leaving the list alone). The list itself is read
 * by `projectsQuery()` only (`api/queries.ts`), refetched on the `projects` event of the stream.
 *
 * **Adding a mutation (task-014):** a plain function on {@link apiRequest} (`addProject(path)`,
 * `cloneProject(url, directory?)`) and its hook built like {@link useRemoveProject}; after a
 * success, update the `projectsQuery()` cache (the `projects` event refetches it anyway) so the
 * switcher shows the change without waiting for the stream. On a refusal, read the list again
 * (`invalidateQueries(projectsQuery())`) so that the switcher shows what the server holds; a refusal
 * that means "already done" (as `not-found` for a removal) is handled as a success.
 */
import type { ProjectListItem, ProjectListResponse } from '@wingfoil-ui/contracts';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from './client.js';
import { projectsQuery } from './queries.js';
import { queryKeys } from './query-keys.js';

/** The API path of the list entry `pid` (opaque id, encoded: never a file-system path). */
function entryPath(pid: string): string {
  return `/api/projects/${encodeURIComponent(pid)}`;
}

/** `DELETE /api/projects/:pid`: remove the project from the list (no file is touched) → 204. */
export async function removeProject(pid: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<void>('DELETE', entryPath(pid), undefined, signal);
}

/**
 * After project `pid` left the list: drop its entry from the cached list (a list not read yet stays
 * unread) and forget every query of the project (`['p', pid]`).
 */
export function forgetProject(queryClient: QueryClient, pid: string): void {
  queryClient.setQueryData<ProjectListResponse>(projectsQuery().queryKey, (list) =>
    list ? { ...list, projects: list.projects.filter((p) => p.id !== pid) } : list,
  );
  queryClient.removeQueries({ queryKey: queryKeys.project(pid) });
}

/** Options of {@link useRemoveProject}. */
export interface RemoveProjectOptions {
  /**
   * Runs once the server removed the project, before its queries are forgotten — e.g. leave the
   * project's pages first, so that no mounted view reads a project that is gone.
   */
  onRemoved?(pid: string): Promise<void> | void;
}

/**
 * The removal of a project as a mutation (variables: the project id). A 404 `not-found` means the
 * entry is already gone (another tab or console removed it): handled as a removal. Any other
 * failure leaves the list as the server has it — the cached list is read again (review R5).
 */
export function useRemoveProject(options: RemoveProjectOptions = {}) {
  const queryClient = useQueryClient();
  const { onRemoved } = options;
  return useMutation<void, ApiError, string>({
    mutationFn: async (pid) => {
      try {
        await removeProject(pid);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'not-found') return;
        throw error;
      }
    },
    onSuccess: async (_data, pid) => {
      await onRemoved?.(pid);
      forgetProject(queryClient, pid);
    },
    onError: () => queryClient.invalidateQueries({ queryKey: projectsQuery().queryKey }),
  });
}

/** `POST /api/projects {path}`: add a local folder (spec-006 §3) → 201 with the new list item. */
export async function addProject(path: string, signal?: AbortSignal): Promise<ProjectListItem> {
  return (await apiRequest<ProjectListItem>('POST', '/api/projects', { path }, signal)).data;
}

/**
 * `POST /api/projects/clone {url, directory?}`: clone a remote into a new empty folder and add it
 * → 201 with the new list item. An empty `directory` is not sent (the server's default then
 * applies). The clone has no time limit: aborting `signal` is its cancel — the server kills git
 * and removes what it created.
 */
export async function cloneProject(url: string, directory?: string, signal?: AbortSignal): Promise<ProjectListItem> {
  const body = directory ? { url, directory } : { url };
  return (await apiRequest<ProjectListItem>('POST', '/api/projects/clone', body, signal)).data;
}

/** After project `item` joined the list: append it to the cached list (a list not read yet stays unread). */
export function rememberProject(queryClient: QueryClient, item: ProjectListItem): void {
  queryClient.setQueryData<ProjectListResponse>(projectsQuery().queryKey, (list) =>
    list && !list.projects.some((p) => p.id === item.id) ? { ...list, projects: [...list.projects, item] } : list,
  );
}

/** Variables of {@link useAddLocalProject}. */
export interface AddLocalVariables {
  path: string;
  signal?: AbortSignal;
}

/** Variables of {@link useCloneProject}. */
export interface CloneVariables {
  url: string;
  directory?: string;
  signal?: AbortSignal;
}

/** The add mutations' shared handlers: the item remembered; a refusal reads the list again, an abort nothing. */
function useAddHandlers<V extends { signal?: AbortSignal }>() {
  const queryClient = useQueryClient();
  return {
    onSuccess: (item: ProjectListItem) => rememberProject(queryClient, item),
    // Not awaited: the refusal is shown at once, the list is read again meanwhile (review R2).
    onError: (_error: unknown, variables: V) => {
      if (variables.signal?.aborted) return;
      void queryClient.invalidateQueries({ queryKey: projectsQuery().queryKey });
    },
  };
}

/** The add of a local folder as a mutation (task-014, S-03.x). */
export function useAddLocalProject() {
  const handlers = useAddHandlers<AddLocalVariables>();
  return useMutation<ProjectListItem, ApiError, AddLocalVariables>({
    mutationFn: ({ path, signal }) => addProject(path, signal),
    ...handlers,
  });
}

/** The clone of a remote as a mutation (task-014, S-04.x). */
export function useCloneProject() {
  const handlers = useAddHandlers<CloneVariables>();
  return useMutation<ProjectListItem, ApiError, CloneVariables>({
    mutationFn: ({ url, directory, signal }) => cloneProject(url, directory, signal),
    ...handlers,
  });
}
