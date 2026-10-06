/**
 * The route tree and the router (TanStack Router, code-based routes: adr-002). Pages: `/` (start
 * page) and `/p/$pid` (project layout) with the views registered in {@link PROJECT_ROUTES}.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { projectRoute } from './project.js';
import { rootRoute } from './root.js';
import { startRoute } from './start.js';

/** The views under `/p/$pid` — each view task appends its route (see `routes/project.tsx`). */
export const PROJECT_ROUTES = [] as const;

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
