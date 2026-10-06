/**
 * The browser tab title (US-X-10, spec-008 §3): composed by a `title.*` message of the catalogue.
 * Each page sets its own; the project and element titles of X-10.1/X-10.2 are added by the view
 * tasks (task-021 closes the scenarios).
 */
import { useEffect } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';

/** The page titles of the shell. */
export const TITLES = defineMessages({
  projects: { id: 'title.projects' },
  notFound: { id: 'title.notFound' },
  sessionLost: { id: 'title.sessionLost' },
});

/** Set `document.title` to the message `title` while the calling page is shown. */
export function usePageTitle(title: MessageDescriptor, values?: Record<string, string>): void {
  const intl = useIntl();
  const text = intl.formatMessage(title, values);
  useEffect(() => {
    document.title = text;
  }, [text]);
}
