// @vitest-environment jsdom
// task-039 — the sidebar of the project layout (D39-1, C3): the views navigation and, below it in
// the same sticky wrapper, the "Git status" region — never inside the navigation landmark.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stopEventStream } from '../../../web/src/api/events.js';
import { resetSession } from '../../../web/src/session/session.js';
import { header } from '../project/header-data.js';
import { renderApp, serverInfo, stubApi } from '../shell/render.js';

beforeEach(() => {
  resetSession();
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener(): void {}
      close(): void {}
    },
  );
});
afterEach(() => {
  cleanup();
  stopEventStream();
  vi.unstubAllGlobals();
});

it('shows the git status below the views, outside the navigation landmark', async () => {
  stubApi({
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: 'p_a', name: 'kanban', path: '/x/kanban', remote: '', availability: 'ok' }] },
    },
    '/api/p/p_a': { status: 200, body: header() },
  });
  renderApp('/p/p_a/team');
  const region = await screen.findByRole('region', { name: 'Git status' });
  const nav = screen.getByRole('navigation', { name: 'Project views' });
  expect(nav.contains(region)).toBe(false);
  const sidebar = nav.parentElement;
  expect(sidebar?.classList.contains('project-sidebar')).toBe(true);
  expect(region.closest('.sidebar-foot')?.parentElement).toBe(sidebar);
});
