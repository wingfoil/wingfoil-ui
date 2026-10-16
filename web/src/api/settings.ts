/**
 * Saving the UI settings (spec-004 §3, spec-006 §2; task-041, D41-3). `PUT /api/settings` takes the
 * whole object (RP-28): the body is the cached settings with the change. Saves run one at a time
 * (one mutation scope): a change made while another is on its way waits, and its request carries
 * every change made so far. The cache shows a change at once (optimistic) and takes the server's
 * answer when no other save is waiting; a refusal reads the settings again, so the controls show
 * what is stored.
 */
import type { UiSettings } from '@wingfoil-ui/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from './client.js';
import { settingsQuery } from './queries.js';

/** `PUT /api/settings` with the whole object → the stored settings. */
export async function putSettings(settings: UiSettings, signal?: AbortSignal): Promise<UiSettings> {
  return (await apiRequest<UiSettings>('PUT', '/api/settings', settings, signal)).data;
}

/** The key of every settings save (their scope, and what `isMutating` counts). */
export const SAVE_SETTINGS_KEY = ['settings', 'save'] as const;

/** Options of {@link useSaveSettings}: called for every save, not only the latest. */
export interface SaveSettingsOptions {
  /** The change was stored. */
  onSaved?: (change: Partial<UiSettings>, stored: UiSettings) => void;
  /** The change was not stored (the settings are read again). */
  onFailed?: (error: ApiError, change: Partial<UiSettings>) => void;
}

/** Save a change of the UI settings: `mutate({ autoPush: true })`. */
export function useSaveSettings(options: SaveSettingsOptions = {}) {
  const queryClient = useQueryClient();
  const key = settingsQuery().queryKey;
  return useMutation<UiSettings, ApiError, Partial<UiSettings>>({
    mutationKey: SAVE_SETTINGS_KEY,
    scope: { id: 'settings' },
    onMutate: (change) => {
      const current = queryClient.getQueryData(key);
      if (current) queryClient.setQueryData(key, { ...current, ...change });
    },
    mutationFn: async (change) => {
      // Built when this save runs: the cache holds every change made so far (and the answers).
      const current = queryClient.getQueryData(key);
      if (!current) throw new ApiError(0, 'internal', 'The settings were not read yet', undefined);
      return putSettings({ ...current, ...change });
    },
    onSuccess: (stored, change) => {
      // Another save is waiting: its own answer comes later, and taking this one would hide its change.
      if (queryClient.isMutating({ mutationKey: SAVE_SETTINGS_KEY }) <= 1) queryClient.setQueryData(key, stored);
      options.onSaved?.(change, stored);
    },
    onError: (error, change) => {
      // Read what is stored (with or without a page showing it): the controls show it again.
      void queryClient.fetchQuery({ ...settingsQuery(), staleTime: 0 }).catch(() => undefined);
      options.onFailed?.(error, change);
    },
  });
}
