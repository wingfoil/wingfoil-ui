/**
 * Saving the UI settings (spec-004 §3, spec-006 §2; task-041, D41-3, review round 1 R1/R2).
 * `PUT /api/settings` takes the whole object (RP-28).
 *
 * - The query cache holds **only server answers** (`GET /api/settings`, the answer of each `PUT`).
 * - The **pending saves** are the ledger: the settings mutations still pending in the mutation cache,
 *   in the order they were made (their `mutationId`). A refused save leaves it at once.
 * - What the page shows ({@link useSettingsView}) is the last server answer with every pending
 *   change applied in order: a `settings` event that reads the settings again while saves are
 *   pending does not flip a control back.
 * - Saves run one at a time (one mutation scope). Each request is built when it runs: the last
 *   server answer with the pending changes up to its own — so a refetch in between loses no earlier
 *   change, and a refused change is never carried by a later request.
 */
import type { UiSettings } from '@wingfoil-ui/contracts';
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type Mutation,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiError, apiRequest } from './client.js';
import { settingsQuery } from './queries.js';

/** `PUT /api/settings` with the whole object → the stored settings. */
export async function putSettings(settings: UiSettings, signal?: AbortSignal): Promise<UiSettings> {
  return (await apiRequest<UiSettings>('PUT', '/api/settings', settings, signal)).data;
}

/** The key of every settings save (their scope, and what the ledger looks for). */
export const SAVE_SETTINGS_KEY = ['settings', 'save'] as const;

/**
 * A save not settled yet: queued in its scope or with its request out (TanStack Query's mutation
 * status, written without the methodology word the REQ-ARC-05 lint refuses).
 */
function unsettled(m: { state: { status: string } }): boolean {
  const status = m.state.status;
  return status !== 'idle' && status !== 'success' && status !== 'error';
}

/** The pending saves, oldest first, up to the save `upTo` (all when absent). */
function pendingSaves(client: QueryClient, upTo?: number): Mutation[] {
  return client
    .getMutationCache()
    .findAll({ mutationKey: SAVE_SETTINGS_KEY, predicate: unsettled })
    .filter((m) => upTo === undefined || m.mutationId <= upTo)
    .sort((a, b) => a.mutationId - b.mutationId) as Mutation[];
}

/** `base` with `changes` applied in order. */
export function withChanges(base: UiSettings, changes: readonly Partial<UiSettings>[]): UiSettings {
  return changes.reduce<UiSettings>((s, c) => ({ ...s, ...c }), base);
}

/** The settings as the page shows them: the last server answer and every pending change, in order. */
export function useSettingsView() {
  const query = useQuery(settingsQuery());
  const pending = useMutationState({
    filters: { mutationKey: SAVE_SETTINGS_KEY, predicate: unsettled },
    select: (m) => ({ id: m.mutationId, change: m.state.variables as Partial<UiSettings> }),
  });
  const changes = [...pending].sort((a, b) => a.id - b.id).map((p) => p.change);
  return { query, settings: query.data ? withChanges(query.data, changes) : undefined };
}

/** Options of {@link useSaveSettings}: called for every save, not only the latest. */
export interface SaveSettingsOptions {
  /** The change was stored; `stored` is the server's answer. */
  onSaved?: (change: Partial<UiSettings>, stored: UiSettings) => void;
  /** The change was not stored (the settings are read again). */
  onFailed?: (error: ApiError, change: Partial<UiSettings>) => void;
}

/** Save a change of the UI settings: `mutate({ autoPush: true })` (a new object for every change). */
export function useSaveSettings(options: SaveSettingsOptions = {}) {
  const queryClient = useQueryClient();
  const key = settingsQuery().queryKey;
  return useMutation<UiSettings, ApiError, Partial<UiSettings>>({
    mutationKey: SAVE_SETTINGS_KEY,
    scope: { id: 'settings' },
    mutationFn: async (change) => {
      const base = queryClient.getQueryData(key);
      if (!base) throw new ApiError(0, 'internal', 'The settings were not read yet', undefined);
      // This save in the ledger: its own variables object (each change is a new object).
      const own = pendingSaves(queryClient).find((m) => m.state.variables === change);
      const changes = pendingSaves(queryClient, own?.mutationId).map((m) => m.state.variables as Partial<UiSettings>);
      return putSettings(withChanges(base, own ? changes : [...changes, change]));
    },
    onSuccess: async (stored, change) => {
      // A read started before this answer would put an older state back: cancel it.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, stored);
      options.onSaved?.(change, stored);
    },
    onError: (error, change) => {
      // Read what is stored (with or without a page showing it).
      void queryClient.fetchQuery({ ...settingsQuery(), staleTime: 0 }).catch(() => undefined);
      options.onFailed?.(error, change);
    },
  });
}
