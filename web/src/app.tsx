/**
 * The application: catalogue, server state and routes (adr-002). The page's single event stream
 * starts once the session is connected (`main.tsx` bootstraps it before the first render).
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { startEventStream } from './api/events.js';
import { AppIntlProvider, type MessageId } from './i18n/index.js';
import type { createAppRouter } from './routes/tree.js';
import { useSessionStatus } from './session/session.js';

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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppIntlProvider>
  );
}
