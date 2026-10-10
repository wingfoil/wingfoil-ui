/**
 * The browser tab title (US-X-10, spec-008 §3): composed by a `title.*` message of the catalogue.
 * Each page sets its own while it is shown; when it leaves, the title goes back to `title.app`, the
 * static title the build writes into `index.html` (W5-2), until the next page sets one. A project
 * page names the project and its view with {@link useProjectTitle} (W5-4): the view is a label of
 * the catalogue, or project data for a document (its path) and a directive (its id, W5-5).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { projectsQuery } from '../api/queries.js';

/** The page titles of the shell. */
export const TITLES = defineMessages({
  app: { id: 'title.app' },
  projects: { id: 'title.projects' },
  projectElement: { id: 'title.projectElement' },
  projectView: { id: 'title.projectView' },
  notFound: { id: 'title.notFound' },
  sessionLost: { id: 'title.sessionLost' },
});

/** Set `document.title` to the message `title` while the calling page is shown. */
export function usePageTitle(title: MessageDescriptor, values?: Record<string, string>): void {
  const intl = useIntl();
  const text = intl.formatMessage(title, values);
  const fallback = intl.formatMessage(TITLES.app);
  useEffect(() => {
    document.title = text;
    // Cleanups run before the next page's effects: a page that sets no title shows `title.app`.
    return () => {
      document.title = fallback;
    };
  }, [text, fallback]);
}

/** The name of project `pid` from the project list (`dna.project.name`), the pid until it is read. */
export function useProjectName(pid: string): string {
  return useQuery(projectsQuery()).data?.projects.find((p) => p.id === pid)?.name ?? pid;
}

/** Title a page of project `pid` "{project} · {view} — WingFoil UI" (`title.projectView`). */
export function useProjectTitle(pid: string, view: string): void {
  usePageTitle(TITLES.projectView, { project: useProjectName(pid), view });
}
