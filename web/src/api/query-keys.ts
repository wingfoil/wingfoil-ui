/**
 * Query keys of TanStack Query (adr-002), one factory per resource. **Every project-scoped key
 * starts with `['p', pid]`** ({@link queryKeys.project}): a `repo` event of the event stream
 * invalidates exactly that prefix (spec-004 §6). View tasks add their factories here, e.g.
 * `queryKeys.project(pid, 'elements', { archived })`.
 */
export const queryKeys = {
  /** `GET /api/server`. */
  server: () => ['server'] as const,
  /** `GET /api/projects`, refetched on the `projects` event. */
  projects: () => ['projects'] as const,
  /** Every query of project `pid`; `rest` names the resource under it. */
  project: <R extends readonly unknown[]>(pid: string, ...rest: R) => ['p', pid, ...rest] as const,
};
