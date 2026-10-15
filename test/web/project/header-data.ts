/** `GET /api/p/:pid` answers for the project header tests (task-016). */
import type { ProjectHeader } from '@wingfoil-ui/contracts';

const RANGE = { min: '0.2.2', max: '0.2.x' };

/** A header of project `p_a` for Jordan (developer), WingFoil 0.2.2 pinned, nothing missing. */
export function header(over: Partial<ProjectHeader> = {}): ProjectHeader {
  return {
    id: 'p_a',
    name: 'kanban',
    identity: { kind: 'member', email: 'jordan@example.test', name: 'Jordan', roles: ['developer'] },
    roleViews: ['developer'],
    roleView: 'developer',
    wingfoil: { text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'project' },
    capabilities: {
      capabilities: [
        { id: 'type-definitions', state: 'enabled' },
        { id: 'field-editing', state: 'read-only', reason: { code: 'not-released' } },
      ],
      missing: [],
    },
    readOnly: [],
    repository: {
      state: 's1',
      head: '0'.repeat(40),
      localChanges: 0,
      // spec-010 §3 (task-033).
      branch: 'main',
      copy: 'in-sync',
      ahead: 0,
      behind: 0,
      upstream: 'origin/main',
      sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: null } },
    },
    conditions: ['has-remote'],
    ...over,
  };
}

/** Morgan: two roles, the role view `tech-lead`. */
export function morgan(roleView = 'tech-lead'): ProjectHeader {
  return header({
    identity: { kind: 'member', email: 'morgan@example.test', name: 'Morgan Reyes', roles: ['approver', 'tech-lead'] },
    roleViews: ['approver', 'tech-lead'],
    roleView,
  });
}

/** A header whose WingFoil is `version` (out of range: every capability read-only). */
export function outOfRange(version: string, state: 'above' | 'below' = 'above'): ProjectHeader {
  return header({
    wingfoil: { text: version, version, state, inRange: false, source: 'project' },
    capabilities: {
      capabilities: [
        { id: 'type-definitions', state: 'read-only', reason: { code: 'unsupported-version', range: RANGE } },
      ],
      missing: [],
    },
    readOnly: [{ code: 'version-unsupported', range: '0.2.2 to 0.2.x' }],
  });
}

/** Riley, not in the team. */
export function riley(): ProjectHeader {
  return header({
    identity: { kind: 'not-in-team', email: 'riley@example.test' },
    roleViews: [],
    roleView: null,
    readOnly: [{ code: 'not-in-team' }],
  });
}
