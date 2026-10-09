/**
 * Where a switch of project lands (decision W4-5, US-S-16 "the same screens"): the same view of the
 * sidebar in the other project. Anything below the view — an element panel, a document, a
 * directive — and the search parameters are dropped, so nothing of the previous project stays on
 * screen (S-16.2); a path that is not a view (the panel `/p/<pid>/e/<eid>`, the start page) lands on
 * the project root, which opens the landing view. Only the opaque id and a view segment make the
 * path (REQ-SEC-04, X-05.1).
 */

/** The prefix of every view path of the route tree (`/p/$pid/<view>`). */
const VIEW_PREFIX = '/p/$pid/';

/**
 * The client path of project `pid` matching `currentPath`, given the sidebar's view paths
 * (`/p/$pid/<view>`, as `routes/nav.ts` lists them).
 */
export function switchTarget(pid: string, currentPath: string, viewPaths: Iterable<string>): string {
  const root = `/p/${encodeURIComponent(pid)}`;
  const segments = currentPath.split('/');
  // ['', 'p', '<old pid>', '<view>', …]
  const view = segments[1] === 'p' ? segments[3] : undefined;
  if (view === undefined || view === '') return root;
  for (const path of viewPaths) {
    if (path.startsWith(VIEW_PREFIX) && path.slice(VIEW_PREFIX.length) === view) return `${root}/${view}`;
  }
  return root;
}
