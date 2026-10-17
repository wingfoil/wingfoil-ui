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
 *   sidebar's buttons, the element footer's *Update* link — which one runs for a project;
 *   {@link startGitOperation} refuses a second one at once (a synchronous guard) and keeps the
 *   `AbortController` of a fetch or a push outside any component (review round 1 S2): a push goes on
 *   when its project is left and only *Cancel* ({@link cancelGitOperation}) or the page's unload
 *   stops it; the sidebar cancels a fetch itself when its project is left (task-039).
 * - The push's outcome is the mutation's own (review round 1 R1): a push that starts removes the
 *   previous "Not pushed" toast of its project, a failed one raises it — also after the sidebar that
 *   started it is gone.
 * - {@link useLastGitError}: the last transport of a project and its error, whoever started it, so
 *   the sidebar's alert shows a refusal of the footer's *Update* too (review round 1 R2).
 */
import type { GitOperation, GitResponse, ProjectHeader } from '@wingfoil-ui/contracts';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { pushFailureToast, pushToastKey } from '../repository/push-toast.js';
import { dismissToastKey, showToast } from '../shell/toasts.js';
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
  /** Push: the commits it sends ("Not pushed — N commits stay local"). */
  commits?: number;
  /** The run of {@link startGitOperation} it belongs to. */
  run?: number;
}

/** A transport started with {@link startGitOperation} and not settled yet. */
interface Transport {
  run: number;
  op: GitOperation;
  controller: AbortController | undefined;
}

/** The transport running per project (one at a time, D40-4), kept outside any component (S2). */
const transports = new Map<string, Transport>();
let nextRun = 1;

/** The transport started for `pid` and not settled yet, if any. */
export function runningGitOperation(pid: string): GitOperation | undefined {
  return transports.get(pid)?.op;
}

/** Abort the running fetch or push of `pid` (Cancel; a fetch when its project is left). */
export function cancelGitOperation(pid: string, ops: readonly GitOperation[] = ['fetch', 'push']): void {
  const t = transports.get(pid);
  if (t?.controller && ops.includes(t.op)) t.controller.abort();
}

/** Forget every running transport (tests: a page has one store). */
export function resetGitOperations(): void {
  transports.clear();
}

/**
 * Start `op` on `pid` with `mutate` (of {@link useGitOperation}), unless a transport of that project
 * runs already: then nothing is sent and `false` is answered. A fetch and a push get an
 * `AbortController` (Cancel, RP-37); an update none (not cancellable).
 */
export function startGitOperation(
  mutate: (v: GitOperationVariables, callbacks?: { onSuccess?: () => void; onError?: (e: ApiError) => void }) => void,
  v: { pid: string; op: GitOperation; commits?: number },
  callbacks?: { onSuccess?: () => void; onError?: (e: ApiError) => void },
): boolean {
  if (transports.has(v.pid)) return false;
  const controller = v.op === 'update' ? undefined : new AbortController();
  const run = nextRun++;
  transports.set(v.pid, { run, op: v.op, controller });
  mutate({ ...v, run, ...(controller ? { signal: controller.signal } : {}) }, callbacks);
  return true;
}

/** `POST /api/p/:pid/git/<op>` with no body. */
export async function postGitOperation(pid: string, op: GitOperation, signal?: AbortSignal): Promise<GitResponse> {
  return (await apiRequest<GitResponse>('POST', `/api/p/${encodeURIComponent(pid)}/git/${op}`, undefined, signal)).data;
}

/** A git transport as a mutation (see the module comment). */
export function useGitOperation() {
  const queryClient = useQueryClient();
  return useMutation<GitResponse, ApiError, GitOperationVariables, GitOperationContext>({
    mutationKey: GIT_MUTATION_KEY,
    mutationFn: async (v) => {
      try {
        return await postGitOperation(v.pid, v.op, v.signal);
      } catch (error) {
        if (v.signal?.aborted) throw new ApiError(0, CANCELLED, 'cancelled by the page', undefined);
        throw error;
      }
    },
    onMutate: (v): GitOperationContext => {
      if (v.op === 'push') dismissToastKey(pushToastKey(v.pid));
      // The read the operation starts from: a refusal shown against it clears once the state moves,
      // also after the sidebar was gone and shown again (review round 2 R2-2).
      const header = queryClient.getQueryData<ProjectHeader>(projectHeaderQuery(v.pid).queryKey);
      return header
        ? { state: header.repository.state, lastSuccessAt: header.repository.sync.fetch.lastSuccessAt }
        : {};
    },
    onSettled: (_data, _error, v) => {
      if (v.run !== undefined && transports.get(v.pid)?.run === v.run) transports.delete(v.pid);
    },
    onSuccess: (data, v) => {
      queryClient.setQueryData<ProjectHeader>(projectHeaderQuery(v.pid).queryKey, (old) =>
        old ? { ...old, repository: data.repository } : old,
      );
    },
    onError: (error, v) => {
      if (v.op === 'push' && error.code !== CANCELLED) {
        // Named when the user has gone to another project meanwhile (review round 2 R2-4).
        const project = shownProject() === v.pid ? undefined : projectName(queryClient, v.pid);
        showToast(pushFailureToast(v.pid, v.commits ?? 1, error, project));
      }
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

/** The read an operation started from (`onMutate`'s context, R2-2): empty when none was cached. */
export interface GitOperationContext {
  state?: string;
  lastSuccessAt?: string | null;
}

/** The project the page shows (`/p/<pid>/…`), if any. */
function shownProject(): string | undefined {
  const [, first, pid] = window.location.pathname.split('/');
  return first === 'p' && pid ? decodeURIComponent(pid) : undefined;
}

/** The name of project `pid` from its cached header, else its id. */
function projectName(queryClient: ReturnType<typeof useQueryClient>, pid: string): string {
  return queryClient.getQueryData<ProjectHeader>(projectHeaderQuery(pid).queryKey)?.name ?? pid;
}

/** The last transport of a project and its error, if it failed (R2). */
export interface LastGitError {
  op: GitOperation;
  error: ApiError;
  /** When it was submitted: tells one failure from the next. */
  at: number;
  /** The read it started from (R2-2). */
  from: GitOperationContext;
}

/** The last transport started for `pid` (any component), with its error when it failed (R2). */
export function useLastGitError(pid: string): LastGitError | undefined {
  const all = useMutationState({
    filters: {
      mutationKey: GIT_MUTATION_KEY,
      predicate: (m) => (m.state.variables as GitOperationVariables | undefined)?.pid === pid,
    },
    select: (m) => ({
      op: (m.state.variables as GitOperationVariables).op,
      error: m.state.error as ApiError | null,
      at: m.state.submittedAt,
      from: (m.state.context ?? {}) as GitOperationContext,
    }),
  });
  const last = all.reduce<(typeof all)[number] | undefined>(
    (a, b) => (a === undefined || b.at >= a.at ? b : a),
    undefined,
  );
  return last?.error ? { op: last.op, error: last.error, at: last.at, from: last.from } : undefined;
}
