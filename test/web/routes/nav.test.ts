// The sidebar registry (routes/nav.ts): built from the routes' `staticData.nav`, ordered by group
// (ux-reference §2) and by NAV_ORDER whatever the order of the routes in the tree (merge-friendly).
import { expect, it } from 'vitest';
import { NAV_ORDER, navGroups, type NavRoute } from '../../../web/src/routes/nav.js';

const route = (id: string, group: 'work' | 'rules' | 'repository', order: number): NavRoute => ({
  id,
  fullPath: id,
  options: { staticData: { nav: { group, order, label: { id: `shell.nav.${id}` } } } },
});

it('groups and orders the views independently of the route order', () => {
  const routes = [
    route('/p/$pid/team', 'rules', NAV_ORDER.team),
    route('/p/$pid/memory', 'work', NAV_ORDER.memory),
    route('/p/$pid/dna', 'rules', NAV_ORDER.dna),
    { id: '/p/$pid', fullPath: '/p/$pid', options: {} },
    route('/p/$pid/workflow', 'work', NAV_ORDER.workflow),
  ];
  const shape = (rs: NavRoute[]) => navGroups(rs).map((g) => [g.id, g.items.map((i) => i.to)]);
  expect(shape(routes)).toEqual([
    ['work', ['/p/$pid/workflow', '/p/$pid/memory']],
    ['rules', ['/p/$pid/dna', '/p/$pid/team']],
  ]);
  expect(shape([...routes].reverse())).toEqual(shape(routes));
});

it('drops empty groups and routes without a sidebar entry', () => {
  expect(navGroups([{ id: '/', fullPath: '/', options: {} }])).toEqual([]);
});

it('follows ux-reference §2 in each group', () => {
  expect(NAV_ORDER.workflow < NAV_ORDER.memory && NAV_ORDER.memory < NAV_ORDER.traceability).toBe(true);
  expect(NAV_ORDER.traceability < NAV_ORDER.timeline).toBe(true);
  expect(NAV_ORDER.dna < NAV_ORDER.directives && NAV_ORDER.directives < NAV_ORDER.team).toBe(true);
  expect(NAV_ORDER.team < NAV_ORDER.documentation && NAV_ORDER.files < NAV_ORDER.artifacts).toBe(true);
});
