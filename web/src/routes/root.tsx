/** The root route: the shell around every page, and the page of an unknown path. */
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { NotFoundPage } from '../shell/pages.js';
import { Shell } from '../shell/Shell.js';

/** What every route's loader receives. */
export interface RouterContext {
  queryClient: QueryClient;
}

/** The root route. */
export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Shell,
  notFoundComponent: NotFoundPage,
});
