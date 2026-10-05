// spec-006 §2 — `contracts/state/state.schema.json`: the shape of `state.json`.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StateFile } from '../../contracts/src/state.js';
import { REPO_ROOT } from '../harness/cli.js';

const schema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/state/state.schema.json'), 'utf8')) as object;
const validate = new Ajv({ allErrors: true }).compile(schema);

/** The example of spec-006 §2, typed with the contract type (a type drift fails `typecheck`). */
const example: StateFile = {
  version: 1,
  projects: [
    {
      id: 'p_7kq2m9x4r1tz',
      path: '/home/alex/projects/kanban',
      name: 'kanban',
      remote: 'https://github.com/acme/kanban.git',
      addedAt: '2026-10-03T09:12:44Z',
      roleView: 'developer',
    },
  ],
  settings: {},
  actionLog: [],
};

function withProject(patch: Record<string, unknown>): unknown {
  return { ...example, projects: [{ ...example.projects[0], ...patch }] };
}

describe('state.schema.json', () => {
  it('accepts the example of spec-006 §2 and an empty state', () => {
    expect(validate(example)).toBe(true);
    expect(validate({ version: 1, projects: [], settings: {}, actionLog: [] })).toBe(true);
  });

  it('accepts a Windows path, an empty remote and the default role view', () => {
    expect(validate(withProject({ path: 'C:\\Users\\alex\\kanban', remote: '', roleView: '' }))).toBe(true);
    expect(validate(withProject({ remote: 'git@github.com:acme/kanban.git' }))).toBe(true);
  });

  it('keeps settings and actionLog open for v0.2 (no version bump)', () => {
    expect(validate({ ...example, settings: { theme: 'dark' }, actionLog: [{ sha: 'abc' }] })).toBe(true);
  });

  it.each([
    ['an id not of the p_ + 12 base32 form', { id: 'p_7KQ2M9X4R1TZ' }],
    ['an id with a path in it', { id: '../../etc' }],
    ['an id with a letter outside Crockford base32', { id: 'p_7kq2m9x4r1tu' }],
    ['a relative path', { path: 'projects/kanban' }],
    ['a remote holding credentials', { remote: 'https://alex:ghp_secret@github.com/acme/kanban.git' }],
    ['a remote holding a user name', { remote: 'ssh://git@github.com/acme/kanban.git' }],
    ['a local time', { addedAt: '2026-10-03T09:12:44+02:00' }],
    ['an unknown field', { token: 'x' }],
  ])('refuses %s', (_label, patch) => {
    expect(validate(withProject(patch))).toBe(false);
  });

  it.each([
    ['a missing field', { version: 1, projects: [] }],
    ['a non-integer version', { ...example, version: 1.5 }],
    ['a version 0', { ...example, version: 0 }],
    ['an unknown top-level field', { ...example, sessions: [] }],
  ])('refuses %s', (_label, data) => {
    expect(validate(data)).toBe(false);
  });
});
