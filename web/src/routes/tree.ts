/**
 * The route tree and the router (TanStack Router, code-based routes: adr-002). Pages: `/` (start
 * page) and `/p/$pid` (project layout) with the views registered in {@link PROJECT_ROUTES}.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { elementRoute } from './element.js';
import { memoryRoute, projectIndexRoute } from './memory.js';
import { projectRoute } from './project.js';
import { rootRoute } from './root.js';
import { startRoute } from './start.js';

/**
 * The views under `/p/$pid`. **Adding a view:** write `routes/<view>.tsx` exporting
 * `createRoute({ getParentRoute: () => projectRoute, path: '<view>', component, staticData: { nav } })`
 * (the sidebar entry, `routes/nav.ts`), its query-key factory in the same route file (built on `queryKeys.project`, `api/query-keys.ts`), and
 * add one line below — one route per line, trailing comma, so that parallel tasks merge cleanly;
 * the order of the lines does not matter (the sidebar follows `NAV_ORDER`).
 */
export const PROJECT_ROUTES = [
  memoryRoute,
  projectIndexRoute,
  elementRoute,
] as const;

/** Every route of the application. */
export const routeTree = rootRoute.addChildren([startRoute, projectRoute.addChildren([...PROJECT_ROUTES])]);

/** Options of {@link createAppRouter}. */
export interface AppRouterOptions {
  queryClient: QueryClient;
  /** History (default: the browser's; tests: a memory history). */
  history?: RouterHistory;
}

/** The application's router. */
export function createAppRouter({ queryClient, history }: AppRouterOptions) {
  return createRouter({ routeTree, context: { queryClient }, ...(history ? { history } : {}) });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
