/**
 * Entry point: fonts and theme, then the session bootstrap (spec-004 §2) before the first render,
 * so that the router never sees the token fragment.
 */
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';
import './theme/tokens.css';
import './theme/base.css';
import './theme/tones.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createQueryClient } from './api/queries.js';
import { App } from './app.js';
import { createAppRouter } from './routes/tree.js';
import { bootstrapSession } from './session/session.js';

void bootstrapSession().then(() => {
  const queryClient = createQueryClient();
  const router = createAppRouter({ queryClient });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App queryClient={queryClient} router={router} />
    </StrictMode>,
  );
});
