/**
 * Query keys of TanStack Query (adr-002). **Rule: every project-scoped key starts with
 * `['p', pid]`**, built by {@link queryKeys.project}: a `repo` event of the event stream invalidates
 * exactly that prefix (spec-004 §6), so a key built otherwise would never refresh.
 *
 * Each view keeps its own factory in its route file (`routes/<view>.tsx`, merge-friendly), built on
 * `queryKeys.project`:
 *
 * ```ts
 * // routes/memory.tsx
 * export const memoryKeys = {
 *   elements: (pid: string, archived: boolean) => queryKeys.project(pid, 'elements', { archived }),
 * };
 * ```
 */

/** A key of one project's query: `['p', pid, …resource]`. */
export type ProjectQueryKey = readonly ['p', string, ...unknown[]];

export const queryKeys = {
  /** `GET /api/server`. */
  server: () => ['server'] as const,
  /** `GET /api/projects`, refetched on the `projects` event. */
  projects: () => ['projects'] as const,
  /** Every query of project `pid`; `rest` names the resource under it. */
  project: <R extends readonly unknown[]>(pid: string, ...rest: R): readonly ['p', string, ...R] =>
    ['p', pid, ...rest] as const,
  /** `GET /api/settings`: the UI settings, global to every project (task-041), refetched on the `settings` event. */
  settings: () => ['settings'] as const,
};
