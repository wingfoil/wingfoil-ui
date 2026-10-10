// @vitest-environment jsdom
// US-X-10 (spec-008 §3; W5-2, W5-4, W5-5, decided by the user 2026-10-10): the tab title of a
// project page names the project (its name from the project list, the pid until it is read) and
// the view; a page that leaves restores `title.app`, the static title of `index.html`, which the
// build writes from the catalogue (the key build: the key).
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { keyCatalogue, withAppTitle } from '../../../web/scripts/catalogue.mjs';
import { createQueryClient, projectsQuery } from '../../../web/src/api/queries.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { AppIntlProvider, type MessageId } from '../../../web/src/i18n/index.js';
import { TITLES, usePageTitle, useProjectName, useProjectTitle } from '../../../web/src/shell/page-title.js';

afterEach(() => cleanup());

function wrap(client: ReturnType<typeof createQueryClient>, children: ReactNode, messages?: Record<string, string>) {
  return (
    <QueryClientProvider client={client}>
      <AppIntlProvider {...(messages ? { messages: messages as Record<MessageId, string> } : {})}>
        {children}
      </AppIntlProvider>
    </QueryClientProvider>
  );
}

function ProjectPage({ pid, view }: { pid: string; view: string }): ReactNode {
  useProjectTitle(pid, view);
  return <p>{useProjectName(pid)}</p>;
}

it('names the project by the pid until the list is read, then by its name', () => {
  const client = createQueryClient();
  const { rerender } = render(wrap(client, <ProjectPage pid="p_kanban" view="Memory" />));
  expect(document.title).toBe('p_kanban · Memory — WingFoil UI');
  client.setQueryData(projectsQuery().queryKey, {
    projects: [{ id: 'p_kanban', name: 'kanban', path: '/x/kanban', remote: '', availability: 'ok' }],
  });
  rerender(wrap(client, <ProjectPage pid="p_kanban" view="Memory" />));
  expect(document.title).toBe('kanban · Memory — WingFoil UI');
});

it('takes a document path or a directive id as the view (W5-5)', () => {
  const client = createQueryClient();
  client.setQueryData(projectsQuery().queryKey, {
    projects: [{ id: 'p_c', name: 'custom', path: '/x/custom', remote: '', availability: 'ok' }],
  });
  render(wrap(client, <ProjectPage pid="p_c" view="docs/01_vision/02_product-vision.md" />));
  expect(document.title).toBe('custom · docs/01_vision/02_product-vision.md — WingFoil UI');
});

function Projects(): ReactNode {
  usePageTitle(TITLES.projects);
  return null;
}

it('restores title.app when the page that set the title leaves (W5-2)', () => {
  const client = createQueryClient();
  const { rerender } = render(wrap(client, <Projects />));
  expect(document.title).toBe('Projects — WingFoil UI');
  rerender(wrap(client, null));
  expect(document.title).toBe('WingFoil UI');
});

it('renders the titles as keys with the key catalogue', () => {
  const client = createQueryClient();
  const { rerender } = render(wrap(client, <ProjectPage pid="p_kanban" view="x" />, keyCatalogue(en)));
  expect(document.title).toBe('title.projectView p_kanban x');
  rerender(wrap(client, null, keyCatalogue(en)));
  expect(document.title).toBe('title.app');
});

it('writes title.app into the static <title> of index.html, escaped', () => {
  const html = '<head>\n    <title>anything</title>\n  </head>';
  expect(withAppTitle(html, en)).toBe('<head>\n    <title>WingFoil UI</title>\n  </head>');
  expect(withAppTitle(html, keyCatalogue(en))).toContain('<title>title.app</title>');
  expect(withAppTitle(html, { 'title.app': 'A & <B>' })).toContain('<title>A &amp; &lt;B&gt;</title>');
  expect(() => withAppTitle('<head></head>', en)).toThrow(/<title>/);
});
