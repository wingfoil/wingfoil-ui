/**
 * The governed writes on an element (spec-004 §3, §5; task-032's routes): `POST
 * /api/p/:pid/elements/:eid/submit`, `/approve`, `/reject`. One mutation for the three verbs
 * (decision D37-10): the gate footer (task-037) decides with `approve`/`reject`, the single-action
 * footer (task-038) submits with the same hook and reads its `data` / `error` for the toasts.
 *
 * Whatever the answer, the project's queries are invalidated (`['p', pid]`): after a success the
 * server's state has already moved (the `repo` event would refetch too), and after a refusal such
 * as 409 `element-changed` the panel must show what the repository holds now (RP-12).
 *
 * The result is a toast of the shell (task-038, D38-11), raised by the mutation's own callbacks:
 * they run even when the panel that started the write was closed before the answer.
 */
import type { ElementDecisionRequest, ElementSubmitRequest, WriteResponse } from '@wingfoil-ui/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from './client.js';
import { writeRefusalToast, writeSuccessToast } from '../element/write-toast.js';
import { showToast } from '../shell/toasts.js';
import { queryKeys } from './query-keys.js';

/** A governed verb on an element. */
export type ElementWriteVerb = 'submit' | 'approve' | 'reject';

/** Variables of {@link useElementWrite}: the project and element in them (Wave 4 lesson). */
export interface ElementWriteVariables {
  pid: string;
  eid: string;
  verb: ElementWriteVerb;
  /** The status the page showed (spec-004 §4 row 9). */
  expectedStatus: string;
  /** Required by `approve` and `reject`, ignored for `submit`. */
  reason?: string;
}

/** `POST /api/p/:pid/elements/:eid/<verb>` with its body. */
export async function postElementWrite(
  pid: string,
  eid: string,
  verb: ElementWriteVerb,
  body: ElementSubmitRequest | ElementDecisionRequest,
  signal?: AbortSignal,
): Promise<WriteResponse> {
  const path = `/api/p/${encodeURIComponent(pid)}/elements/${encodeURIComponent(eid)}/${verb}`;
  return (await apiRequest<WriteResponse>('POST', path, body, signal)).data;
}

/** The body of a write: the reason only for a decision. */
function bodyOf(v: ElementWriteVariables): ElementSubmitRequest | ElementDecisionRequest {
  return v.verb === 'submit'
    ? { expectedStatus: v.expectedStatus }
    : { expectedStatus: v.expectedStatus, reason: v.reason ?? '' };
}

/** A governed write as a mutation; the project's queries are read again once it settles. */
export function useElementWrite() {
  const queryClient = useQueryClient();
  return useMutation<WriteResponse, ApiError, ElementWriteVariables>({
    mutationFn: (v) => postElementWrite(v.pid, v.eid, v.verb, bodyOf(v)),
    onSuccess: (data, v) => void showToast(writeSuccessToast(v, data)),
    onError: (error, v) => void showToast(writeRefusalToast(v, error)),
    onSettled: (_data, _error, v) => {
      // Not awaited: the caller's onSuccess / onError must not wait for the reads (Wave 4 lesson).
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(v.pid) });
    },
  });
}
