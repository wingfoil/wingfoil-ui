/**
 * The preset write (spec-004 §3, spec-005 §5; task-060's route `POST /api/p/:pid/ui-config/preset`
 * `{ preset }`), used by *Use preset* on Configuration › Taxonomy (task-079, D79-7). The result is a
 * toast of the shell, raised by the mutation's own callbacks — they run even when the dialog that
 * started the write is gone (D38-11) —, and the project's queries are read again once it settles
 * (not awaited: the caller's callbacks must not wait for the reads, Wave 4 lesson).
 */
import type { UiConfigPresetRequest, UiPresetId, WriteResponse } from '@wingfoil-ui/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presetRefusalToast, presetSuccessToast } from '../configuration/preset-toast.js';
import { showToast } from '../shell/toasts.js';
import { ApiError, apiRequest } from './client.js';
import { queryKeys } from './query-keys.js';

/** Variables of {@link useUiPresetWrite}: the project in them (Wave 4 lesson). */
export interface UiPresetWriteVariables {
  pid: string;
  preset: UiPresetId;
}

/** `POST /api/p/:pid/ui-config/preset` with `{ preset }`. */
export async function postUiPreset(pid: string, preset: UiPresetId, signal?: AbortSignal): Promise<WriteResponse> {
  const body: UiConfigPresetRequest = { preset };
  const path = `/api/p/${encodeURIComponent(pid)}/ui-config/preset`;
  return (await apiRequest<WriteResponse>('POST', path, body, signal)).data;
}

/** The preset write as a mutation; the project's queries are read again once it settles. */
export function useUiPresetWrite() {
  const queryClient = useQueryClient();
  return useMutation<WriteResponse, ApiError, UiPresetWriteVariables>({
    mutationFn: (v) => postUiPreset(v.pid, v.preset),
    onSuccess: (data, v) => void showToast(presetSuccessToast(v.pid, v.preset, data)),
    onError: (error, v) => void showToast(presetRefusalToast(v.pid, v.preset, error)),
    onSettled: (_data, _error, v) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(v.pid) });
    },
  });
}
