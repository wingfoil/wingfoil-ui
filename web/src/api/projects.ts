/**
 * The project list mutations (spec-004 §3, spec-006 §3), shared by the project switcher
 * (task-015: remove) and the *Add project* dialog (task-014: add, clone). The list itself is read
 * by `projectsQuery()` only (`api/queries.ts`), refetched on the `projects` event of the stream.
 *
 * **Adding a mutation (task-014):** a plain function on {@link apiRequest} (`addProject(path)`,
 * `cloneProject(url, directory?)`) and its hook built like {@link useRemoveProject}; after a
 * success, update the `projectsQuery()` cache (the `projects` event refetches it anyway) so the
 * switcher shows the change without waiting for the stream.
 */
import type { ProjectListResponse } from '@wingfoil-ui/contracts';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiError } from './client.js';
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

/** The removal of a project as a mutation (variables: the project id). */
export function useRemoveProject(options: RemoveProjectOptions = {}) {
  const queryClient = useQueryClient();
  const { onRemoved } = options;
  return useMutation<void, ApiError, string>({
    mutationFn: (pid) => removeProject(pid),
    onSuccess: async (_data, pid) => {
      await onRemoved?.(pid);
      forgetProject(queryClient, pid);
    },
  });
}
