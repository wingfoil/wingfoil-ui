/**
 * The Directives view's pure helpers (US-R-06, US-G-02; W3-38, W3-42, W3-43). "Only mine" is the
 * server's `mine` (bound to the current role view or global, `directivesForRoleView`), never
 * recomputed here from the roles.
 */
import type { DirectiveEntry, DirectiveList } from '@wingfoil-ui/contracts';
import { resolveLink, type LinkClass } from '../docs/links.js';

/** A directive of `GET /directives`. */
export type ListedDirective = DirectiveList['entries'][number];

/** What the list shows. */
export type DirectiveShow = 'mine' | 'all';

/** The value of `?show=` that selects every directive. */
export const SHOW_ALL = 'all';

/** The list's search parameters: `?show=all`, or nothing (the default). */
export function directivesSearch(search: Record<string, unknown>): { show?: typeof SHOW_ALL } {
  return search['show'] === SHOW_ALL ? { show: SHOW_ALL } : {};
}

/** What is shown: "only mine" by default for a member, always "all" outside the team (R-06.4). */
export function effectiveShow(requested: typeof SHOW_ALL | undefined, member: boolean): DirectiveShow {
  return requested === SHOW_ALL || !member ? 'all' : 'mine';
}

/** The entries shown for `show`. */
export function shownDirectives(entries: readonly ListedDirective[], show: DirectiveShow): ListedDirective[] {
  return show === 'all' ? [...entries] : entries.filter((e) => e.mine);
}

/** The element panel's directives (W3-38): the role view's, or the global ones outside the team. */
export function panelDirectives(entries: readonly ListedDirective[], member: boolean): ListedDirective[] {
  return entries.filter((e) => (member ? e.mine : e.global));
}

/** The repository path of a directive (`directives list` paths are relative to `.wingfoil/`). */
export function directiveRepoPath(entry: Pick<DirectiveEntry, 'path'>): string {
  return `.wingfoil/${entry.path}`;
}

/** The in-UI URL of the directive `id` of project `pid`, with a heading fragment. */
export function directiveHref(pid: string, id: string, fragment = ''): string {
  return `/p/${encodeURIComponent(pid)}/directives/${encodeURIComponent(id)}${
    fragment ? `#${encodeURIComponent(fragment)}` : ''
  }`;
}

/**
 * A link of the directive at `path` (W3-42): `http(s)` in a new tab, an in-page anchor, another
 * directive (by repository path, `byPath`) opened in the UI; every other repository path "not
 * shown in the UI", without a request. While the directive list is not read (`byPath`
 * `undefined`), a repository path waits (`unresolved`) instead of being marked (review F3).
 */
export function classifyDirectiveLink(
  href: string,
  path: string,
  byPath: ReadonlyMap<string, string> | undefined,
): LinkClass {
  const target = resolveLink(href, path);
  switch (target.kind) {
    case 'external':
    case 'anchor':
      return target;
    case 'outside':
    case 'unsupported':
      return { kind: 'refused', mark: target.kind };
    case 'path':
      if (byPath === undefined) return { kind: 'unresolved', path: target.path };
      return byPath.has(target.path)
        ? { kind: 'document', path: target.path, fragment: target.fragment }
        : { kind: 'refused', mark: 'hidden' };
  }
}
