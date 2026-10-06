/**
 * The application: catalogue, server state and routes (adr-002). The page's single event stream
 * starts once the session is connected (`main.tsx` bootstraps it before the first render).
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type NavigateOptions, type ToOptions } from '@tanstack/react-router';
import { RouterProvider as AriaRouterProvider } from 'react-aria-components';
import { useEffect, type ReactNode } from 'react';
import { startEventStream } from './api/events.js';
import { AppIntlProvider, type MessageId } from './i18n/index.js';
import type { createAppRouter } from './routes/tree.js';
import { useSessionStatus } from './session/session.js';

declare module 'react-aria-components' {
  interface RouterConfig {
    // The router's paths, or a concrete path such as `/p/<pid>` (task-015's switcher).
    href: NonNullable<ToOptions['to']> | (string & {});
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

/** Props of {@link App}. */
export interface AppProps {
  queryClient: QueryClient;
  router: ReturnType<typeof createAppRouter>;
  /** Another catalogue (tests: the key catalogue). */
  messages?: Readonly<Record<MessageId, string>>;
}

/** The whole application. */
export function App({ queryClient, router, messages }: AppProps): ReactNode {
  const connected = useSessionStatus() === 'connected';
  useEffect(() => {
    if (connected) startEventStream(queryClient);
  }, [connected, queryClient]);
  return (
    <AppIntlProvider {...(messages ? { messages } : {})}>
      <QueryClientProvider client={queryClient}>
        {/* React Aria links and menu items navigate through the router (client side, no reload). */}
        <AriaRouterProvider
          navigate={(to, options) => router.navigate({ ...options, to })}
          useHref={(to) => router.buildLocation({ to }).href}
        >
          <RouterProvider router={router} />
        </AriaRouterProvider>
      </QueryClientProvider>
    </AppIntlProvider>
  );
}
