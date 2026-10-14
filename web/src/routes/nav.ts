/**
 * The project views sidebar (ux-reference §2), built from the routes themselves: each view route
 * declares its entry in `staticData.nav` — group, order and label — so that two view tasks merged in
 * any order still give the sidebar of ux-reference §2 (the order comes from {@link NAV_ORDER}, not
 * from the order of the routes in the tree).
 *
 * ```ts
 * const LABELS = defineMessages({ memory: { id: 'shell.nav.memory' } });
 * export const memoryRoute = createRoute({
 *   getParentRoute: () => projectRoute,
 *   path: 'memory',
 *   component: MemoryList,
 *   staticData: { nav: { group: 'work', order: NAV_ORDER.memory, label: LABELS.memory } },
 * });
 * ```
 */
import type { StaticDataRouteOption, ToOptions } from '@tanstack/react-router';
import { defineMessages, type MessageDescriptor } from 'react-intl';

/**
 * The sidebar groups, in their order (ux-reference §2). `start` is the heading-less first group that
 * holds *Today* above the three named groups (task-036, D36-2).
 */
export type NavGroupId = 'start' | 'work' | 'rules' | 'repository';

/** The sidebar entry a view route declares in `staticData.nav`. */
export interface NavEntry {
  group: NavGroupId;
  /** Position inside the group: a value of {@link NAV_ORDER}. */
  order: number;
  /** The entry's text (from `defineMessages`, so that the catalogue check sees the id). */
  label: MessageDescriptor;
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Sidebar entry of a project view (`routes/nav.ts`). */
    nav?: NavEntry;
  }
}

/** In-group order of every view of ux-reference §2 (v0.1 builds Memory, DNA, Directives, Team, Documentation; v0.2 Today). */
export const NAV_ORDER = {
  today: 10,
  workflow: 10,
  memory: 20,
  traceability: 30,
  timeline: 40,
  dna: 10,
  directives: 20,
  team: 30,
  documentation: 40,
  files: 10,
  artifacts: 20,
} as const;

/** Group headings, in sidebar order; the `start` group has none (D36-2). */
export const NAV_GROUPS: readonly { id: NavGroupId; label?: MessageDescriptor }[] = (() => {
  const m = defineMessages({
    work: { id: 'shell.nav.group.work' },
    rules: { id: 'shell.nav.group.rules' },
    repository: { id: 'shell.nav.group.repository' },
  });
  return [
    { id: 'start' },
    { id: 'work', label: m.work },
    { id: 'rules', label: m.rules },
    { id: 'repository', label: m.repository },
  ];
})();

/** A path of the project layout or one of its views. */
export type ProjectViewPath = Extract<NonNullable<ToOptions['to']>, '/p/$pid' | `/p/$pid/${string}`>;

/** One view of the sidebar. */
export interface NavItem {
  /** Route id (stable key). */
  id: string;
  label: MessageDescriptor;
  /** The view's path (its `$pid` is filled from the current project). */
  to: ProjectViewPath;
  order: number;
}

/** A group of the sidebar with its views. */
export interface NavGroup {
  id: NavGroupId;
  /** The group's heading; absent for the `start` group (D36-2). */
  label?: MessageDescriptor;
  items: NavItem[];
}

/** What {@link navGroups} reads of a route. */
export interface NavRoute {
  id: string;
  fullPath: string;
  options: { staticData?: StaticDataRouteOption };
}

/** The sidebar groups for `routes` (e.g. the router's `routesById`): ordered, empty groups dropped. */
export function navGroups(routes: Iterable<NavRoute>): NavGroup[] {
  const items = new Map<NavGroupId, NavItem[]>();
  for (const route of routes) {
    const nav = route.options.staticData?.nav;
    if (!nav) continue;
    const list = items.get(nav.group) ?? [];
    // The path comes from the route tree itself, so it is one of the registered paths.
    list.push({ id: route.id, label: nav.label, to: route.fullPath as ProjectViewPath, order: nav.order });
    items.set(nav.group, list);
  }
  return NAV_GROUPS.flatMap((g) => {
    const list = (items.get(g.id) ?? []).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return list.length > 0 ? [{ ...g, items: list }] : [];
  });
}
