/**
 * Fake API answers of the task-019 component tests (DNA, Directives, Team, panel directives): a
 * neutral project (no fixture type, state or role vocabulary needed by the screens).
 */
import type {
  DirectiveDetail,
  DirectiveList,
  DnaShow,
  Identity,
  ProjectConfig,
  ProjectHeader,
} from '@wingfoil-ui/contracts';
import { serverInfo, type FakeApi } from '../shell/render.js';

export const PID = 'p_fx';
export const BASE = `/api/p/${PID}`;

export const DNA: DnaShow = {
  version: 1,
  project: { name: 'demo', description: 'A demo project', methodology: 'Flow' },
  modules: [{ name: 'mod-a', description: 'First module', path: 'a/' }, { name: 'mod-b' }],
  stacks: {
    technologies: [{ name: 'Lang', category: 'language', version: '5.x', notes: 'pinned' }, { name: 'Tool' }],
    methodologies: [{ name: 'Method One', phase: 'phase-1' }, { name: 'Method Two' }],
  },
  team: {
    members: [
      { name: 'Ann Lee', email: 'ann@x.test', roles: ['r-approve', 'r-lead'] },
      { name: 'Bo', email: 'bo@x.test', roles: ['r-dev'] },
      { name: 'Cy', roles: ['r-dev', 'r-qa'] },
    ],
    roles: [{ name: 'r-dev', description: 'Writes code' }, { name: 'r-qa' }, { name: 'r-approve' }, { name: 'r-lead' }],
    agents: [{ name: 'Bot', executes_as: ['r-dev', 'r-qa'], approval_authority: false }],
  },
  paths: { sources: ['a/', 'b/'], docs: [] },
};

/** `GET /config` with `dna` (the other sections failing does not matter to these views). */
export function config(dna: ProjectConfig['dna'] = { data: DNA }): ProjectConfig {
  const failed = { error: { code: 'internal', message: 'x' } };
  return { dna, paths: failed, workflows: failed, types: failed };
}

/** `GET /api/p/:pid` for `identity` (role view `roleView`). */
export function header(identity: Identity, roleView: string | null = null): ProjectHeader {
  return {
    id: PID,
    name: 'demo',
    wingfoil: { text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'project' },
    capabilities: { capabilities: [], missing: [] },
    readOnly: identity.kind === 'member' ? [] : [{ code: 'not-in-team' }],
    repository: { state: 's', head: '0'.repeat(40), localChanges: 0 },
    identity,
    roleViews: identity.kind === 'member' ? identity.roles : [],
    roleView,
  };
}

export const BO: Identity = { kind: 'member', email: 'bo@x.test', name: 'Bo', roles: ['r-dev'] };
export const OUTSIDER: Identity = { kind: 'not-in-team', email: 'zed@x.test' };

type Entry = DirectiveList['entries'][number];

function entry(id: string, roles: string[], mine: boolean, dir = 'custom'): Entry {
  const global = roles.length === 0;
  return {
    path: `directives/${dir}/${id}.md`,
    frontmatter: { id, name: id, type: 'directive', kind: dir, title: `Title of ${id}` },
    roles,
    global,
    assignment: global ? 'global (all roles)' : roles.join(', '),
    mine,
  };
}

/** Bo's view (`r-dev`): `d-dev` and the global `d-all` are his. */
export const DIRECTIVES: DirectiveList = {
  entries: [
    entry('d-dev', ['r-dev', 'r-qa'], true),
    entry('d-qa', ['r-qa'], false, 'built-in'),
    entry('d-all', [], true),
  ],
  warnings: [],
};

/** The same list for someone with no role view: nothing is theirs. */
export const DIRECTIVES_NONE: DirectiveList = {
  entries: DIRECTIVES.entries.map((e) => ({ ...e, mine: false })),
  warnings: [],
};

export const D_DEV: DirectiveDetail = {
  entry: DIRECTIVES.entries[0]!,
  frontmatter: DIRECTIVES.entries[0]!.frontmatter,
  body: [
    '# Title of d-dev',
    '',
    'Rules for [the QA directive](../built-in/d-qa.md) and [the DNA](../../dna.yaml).',
    'See [below](#known-behaviours) or [the site](https://example.test/x).',
    '',
    '## Known behaviours',
    '',
    '| Case | Behaviour |',
    '|------|-----------|',
    '| one | does one |',
    '',
  ].join('\n'),
};

/** The common answers of a project page. */
export function projectApi(over: FakeApi = {}): FakeApi {
  return {
    '/api/server': serverInfo(),
    '/api/projects': {
      status: 200,
      body: { projects: [{ id: PID, name: 'demo', path: '/x', remote: null, availability: 'available' }] },
    },
    ...over,
  };
}
