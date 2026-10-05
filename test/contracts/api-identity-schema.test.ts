// spec-004 §3 — `contracts/api/identity.schema.json` (the identity part of `GET /api/p/:pid`) and
// `contracts/api/role-view.request.schema.json` (the body of `PUT /api/p/:pid/role-view`).
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IdentityView, RoleViewRequest } from '../../contracts/src/api.js';
import { identityView, matchIdentity } from '../../server/src/identity/identity.js';
import { REPO_ROOT } from '../harness/cli.js';
import { STANDARD_TEAM } from '../harness/fixtures/index.js';

const load = (file: string): object =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api', file), 'utf8')) as object;
const ajv = new Ajv({ allErrors: true });
const validIdentity = ajv.compile(load('identity.schema.json'));
const validRequest = ajv.compile(load('role-view.request.schema.json'));
const TEAM = STANDARD_TEAM.map((m) => ({ name: m.name, email: m.email, roles: [...m.roles] }));

describe('identity.schema.json', () => {
  const views: IdentityView[] = [
    identityView(matchIdentity('alex@example.test', TEAM), 'developer'),
    identityView(matchIdentity('jordan@example.test', TEAM), ''),
    identityView(matchIdentity('riley@example.test', TEAM), ''),
    identityView(matchIdentity(undefined, TEAM), ''),
    identityView(
      matchIdentity('shared@example.test', [
        { name: 'Jordan', email: 'shared@example.test', roles: ['developer'] },
        { name: 'Sam', email: 'shared@example.test', roles: ['reviewer'] },
      ]),
      '',
    ),
  ];

  it.each(views.map((v) => [v.identity.kind, v] as const))('accepts what the server computes: %s', (_kind, view) => {
    expect(validIdentity(view), JSON.stringify(validIdentity.errors)).toBe(true);
  });

  it.each([
    ['an unknown kind', { identity: { kind: 'guest' }, roleViews: [], roleView: null }],
    [
      'a member without roles field',
      { identity: { kind: 'member', email: 'a@b', name: 'A' }, roleViews: [], roleView: null },
    ],
    [
      'an ambiguous identity with one member',
      { identity: { kind: 'ambiguous', email: 'a@b', members: ['A'] }, roleViews: [], roleView: null },
    ],
    ['a missing roleView', { identity: { kind: 'no-identity' }, roleViews: [] }],
    ['a not-in-team identity without email', { identity: { kind: 'not-in-team' }, roleViews: [], roleView: null }],
  ])('refuses %s', (_name, data) => {
    expect(validIdentity(data)).toBe(false);
  });
});

describe('role-view.request.schema.json', () => {
  const ok: RoleViewRequest = { role: 'developer' };

  it('accepts { role }', () => {
    expect(validRequest(ok)).toBe(true);
  });

  it.each([[{}], [{ role: '' }], [{ role: 1 }], [{ role: 'x', other: 1 }], ['developer']])('refuses %j', (data) => {
    expect(validRequest(data)).toBe(false);
  });
});
