// spec-010 §3–§5, §7 (RP-43; task-033): `repository.schema.json`, `git.response.schema.json`,
// `git.refusal.schema.json`, and the `repository` / `conditions` parts of `project.schema.json`.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitRefusalCode, GitResponse, RepositoryCopy, RepositoryStatus } from '../../contracts/src/git.js';
import { REPO_ROOT } from '../harness/cli.js';

const ajv = new Ajv({ allErrors: true });
for (const dir of ['api', 'cli', 'files']) {
  for (const file of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) {
    if (file.endsWith('.schema.json')) {
      ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', dir, file), 'utf8')) as object);
    }
  }
}
ajv.addSchema(
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'capabilities.schema.json'), 'utf8')) as object,
);
const byId = (file: string) => ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
const repository = byId('repository.schema.json');
const response = byId('git.response.schema.json');
const refusal = byId('git.refusal.schema.json');
const project = byId('project.schema.json');

const AT = '2026-10-15T09:00:00Z';
const STATUS: RepositoryStatus = {
  state: `${'a'.repeat(40)}.${'b'.repeat(16)}`,
  head: 'a'.repeat(40),
  localChanges: 0,
  branch: 'main',
  copy: 'in-sync',
  ahead: 0,
  behind: 0,
  upstream: 'origin/main',
  sync: { fetch: { lastSuccessAt: null, lastError: null }, update: { lastError: null } },
};

describe('repository.schema.json (spec-010 §3)', () => {
  it.each<RepositoryCopy>(['in-sync', 'ahead', 'behind', 'diverged', 'detached', 'no-remote', 'no-upstream'])(
    'accepts copy %s',
    (copy) => {
      expect(repository({ ...STATUS, copy }), JSON.stringify(repository.errors)).toBe(true);
    },
  );

  it('accepts a detached HEAD without upstream and every sync shape', () => {
    const status: RepositoryStatus = {
      ...STATUS,
      branch: null,
      copy: 'detached',
      upstream: null,
      sync: {
        fetch: { lastSuccessAt: AT, lastError: { message: 'fatal: unable to access', at: AT } },
        update: { lastError: { code: 'local-changes-in-the-way', detail: { files: ['a.md', '../b.md'] }, at: AT } },
      },
    };
    expect(repository(status), JSON.stringify(repository.errors)).toBe(true);
    for (const lastError of [
      { code: 'git-refused', message: 'fatal: x', at: AT },
      { code: 'diverged', at: AT },
      { code: 'remote-not-owned', at: AT },
    ]) {
      expect(repository({ ...STATUS, sync: { ...STATUS.sync, update: { lastError } } })).toBe(true);
    }
  });

  it.each([
    ['a v0.1 body (no copy)', { state: STATUS.state, head: STATUS.head, localChanges: 0 }],
    ['an unknown copy', { ...STATUS, copy: 'stale' }],
    ['a negative behind', { ...STATUS, behind: -1 }],
    ['an extra key', { ...STATUS, remotes: ['origin'] }],
    [
      'a fetch error without at',
      { ...STATUS, sync: { ...STATUS.sync, fetch: { lastSuccessAt: null, lastError: { message: 'x' } } } },
    ],
    [
      'a local time',
      { ...STATUS, sync: { ...STATUS.sync, fetch: { lastSuccessAt: '2026-10-15 09:00', lastError: null } } },
    ],
    [
      'an absolute file in the way (D33-11)',
      {
        ...STATUS,
        sync: {
          ...STATUS.sync,
          update: { lastError: { code: 'local-changes-in-the-way', detail: { files: ['/x/a.md'] }, at: AT } },
        },
      },
    ],
    [
      'a no-fetch-target update error (fetch only)',
      { ...STATUS, sync: { ...STATUS.sync, update: { lastError: { code: 'no-fetch-target', at: AT } } } },
    ],
  ])('refuses %s', (_label, body) => {
    expect(repository(body)).toBe(false);
  });
});

describe('git.response.schema.json (spec-010 §4)', () => {
  it('accepts {repository}', () => {
    const body: GitResponse = { repository: STATUS };
    expect(response(body), JSON.stringify(response.errors)).toBe(true);
    expect(response({ repository: STATUS, push: { status: 'off' } })).toBe(false);
  });
});

describe('git.refusal.schema.json (spec-010 §5, §8)', () => {
  const envelope = (code: GitRefusalCode, detail?: object) => ({
    error: { code, message: 'm', ...(detail ? { detail } : {}) },
  });

  it.each<GitRefusalCode>([
    'not-found',
    'invalid-request',
    'not-in-team',
    'no-remote',
    'no-fetch-target',
    'detached-head',
    'no-upstream',
    'diverged',
    'remote-not-owned',
    'remote-unreadable',
    'git-refused',
    'internal',
  ])('accepts %s without detail', (code) => {
    expect(refusal(envelope(code))).toBe(true);
    expect(refusal(envelope(code, { files: ['a'] }))).toBe(false);
  });

  it('local-changes-in-the-way needs its relative files', () => {
    expect(refusal(envelope('local-changes-in-the-way', { files: ['docs/a.md'] }))).toBe(true);
    expect(refusal(envelope('local-changes-in-the-way'))).toBe(false);
    expect(refusal(envelope('local-changes-in-the-way', { files: [] }))).toBe(false);
    expect(refusal(envelope('local-changes-in-the-way', { files: [['C:', 'x', 'a.md'].join('\\')] }))).toBe(false);
  });

  it('refuses a governed-write code', () => {
    expect(refusal({ error: { code: 'stale-copy', message: 'm' } })).toBe(false);
  });
});

describe('project.schema.json — repository and conditions (spec-010 §3, §7)', () => {
  const header = {
    id: 'p_7kq2m9x4r1tz',
    name: 'k',
    wingfoil: { text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'project' },
    capabilities: { capabilities: [], missing: [] },
    readOnly: [],
    repository: STATUS,
    conditions: ['has-remote'],
    identity: { kind: 'no-identity' },
    roleViews: [],
    roleView: null,
  };

  it('accepts the v0.2 header', () => {
    expect(project(header), JSON.stringify(project.errors)).toBe(true);
    expect(project({ ...header, conditions: [] })).toBe(true);
  });

  it('refuses a missing conditions list, an unknown condition and a v0.1 repository', () => {
    const { conditions: _conditions, ...without } = header;
    expect(project(without)).toBe(false);
    expect(project({ ...header, conditions: ['has-upstream'] })).toBe(false);
    expect(project({ ...header, repository: { state: STATUS.state, head: STATUS.head, localChanges: 0 } })).toBe(false);
  });
});
