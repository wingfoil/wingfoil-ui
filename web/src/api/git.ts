/**
 * The git transport routes (spec-010 §4, §8; task-033): `POST /api/p/:pid/git/fetch`, `/git/update`,
 * `/git/push`, no body. One mutation for the three (decision D39-2): the sidebar's *Fetch*
 * (task-039) and *Update* / *Push* (task-040).
 *
 * - A 200 answers `{ repository }`: it replaces the project header's `repository` in the cache, so
 *   the sidebar shows the result without another read (a moved state also sends `repo`).
 * - Any other outcome reads the header again: a 422 `git-refused` is recorded in
 *   `sync.*.lastError`, and after a cancel the next status read shows where the refs stand.
 * - Cancel (fetch and push, RP-37): the caller owns the `AbortController` and passes its signal; the
 *   page's own abort is reported as {@link CANCELLED}, never as the server's answer (the server
 *   answers 500 `internal` to a client that has left and records nothing).
 * - One transport at a time per project (task-040, D40-4): every transport mutation carries
 *   {@link GIT_MUTATION_KEY}, so {@link useRunningGitOperation} tells any component of the page — the
 *   sidebar's buttons, the element footer's *Update* link — which one runs for a project.
 */
import type { GitOperation, GitResponse, ProjectHeader } from '@wingfoil-ui/contracts';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from './client.js';
import { projectHeaderQuery } from './queries.js';

/** Client-side code of a transport the page cancelled itself. */
export const CANCELLED = 'cancelled';

/** The mutation key of every git transport (D40-4). */
export const GIT_MUTATION_KEY = ['git'] as const;

/** Variables of {@link useGitOperation}: the project in them (Wave 4 lesson). */
export interface GitOperationVariables {
  pid: string;
  op: GitOperation;
  /** Aborts the request (Cancel). */
  signal?: AbortSignal;
}

/** `POST /api/p/:pid/git/<op>` with no body. */
export async function postGitOperation(pid: string, op: GitOperation, signal?: AbortSignal): Promise<GitResponse> {
  return (await apiRequest<GitResponse>('POST', `/api/p/${encodeURIComponent(pid)}/git/${op}`, undefined, signal)).data;
}

/** A git transport as a mutation (see the module comment). */
export function useGitOperation() {
  const queryClient = useQueryClient();
  return useMutation<GitResponse, ApiError, GitOperationVariables>({
    mutationKey: GIT_MUTATION_KEY,
    mutationFn: async (v) => {
      try {
        return await postGitOperation(v.pid, v.op, v.signal);
      } catch (error) {
        if (v.signal?.aborted) throw new ApiError(0, CANCELLED, 'cancelled by the page', undefined);
        throw error;
      }
    },
    onSuccess: (data, v) => {
      queryClient.setQueryData<ProjectHeader>(projectHeaderQuery(v.pid).queryKey, (old) =>
        old ? { ...old, repository: data.repository } : old,
      );
    },
    onError: (_error, v) => {
      // Not awaited: the caller's onError must not wait for the read (Wave 4 lesson).
      void queryClient.invalidateQueries({ queryKey: projectHeaderQuery(v.pid).queryKey });
    },
  });
}

/** The transport running for project `pid`, from any component of the page (D40-4). */
export function useRunningGitOperation(pid: string): GitOperation | undefined {
  // A transport still running: submitted, with neither an answer nor an error yet (TanStack Query's
  // status names are not compared as literals here: REQ-ARC-05 reserves them for project states).
  const running = useMutationState({
    filters: {
      mutationKey: GIT_MUTATION_KEY,
      predicate: (m) => m.state.submittedAt > 0 && m.state.data === undefined && m.state.error === null,
    },
    select: (mutation) => mutation.state.variables as GitOperationVariables | undefined,
  });
  return running.find((v) => v?.pid === pid)?.op;
}
