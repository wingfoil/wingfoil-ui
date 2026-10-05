// REQ-STATE-05 (identity from git) and REQ-STATE-06 (role views): the pure rules, on the standard
// team of the fixtures (`02_bdd/00_conventions.md`).
import type { DirectiveEntry, DnaMember } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { directivesForRoleView, identityView, matchIdentity } from '../../../server/src/identity/identity.js';
import { STANDARD_TEAM } from '../../harness/fixtures/index.js';

const TEAM: DnaMember[] = STANDARD_TEAM.map((m) => ({ name: m.name, email: m.email, roles: [...m.roles] }));

describe('matchIdentity — REQ-STATE-05', () => {
  it('S-12.1 recognises a single-role member', () => {
    expect(matchIdentity('jordan@example.test', TEAM)).toEqual({
      kind: 'member',
      email: 'jordan@example.test',
      name: 'Jordan',
      roles: ['developer'],
    });
  });

  it('S-12.2 matches the email regardless of letter case (and surrounding spaces)', () => {
    const identity = matchIdentity('  Jordan@Example.TEST ', TEAM);
    expect(identity).toMatchObject({ kind: 'member', name: 'Jordan', email: 'Jordan@Example.TEST' });
    const upperDna = TEAM.map((m) => (m.name === 'Sam' ? { ...m, email: 'SAM@EXAMPLE.TEST' } : m));
    expect(matchIdentity('sam@example.test', upperDna)).toMatchObject({ kind: 'member', name: 'Sam' });
  });

  it('S-13.1 marks a user who is not in the team', () => {
    expect(matchIdentity('riley@example.test', TEAM)).toEqual({ kind: 'not-in-team', email: 'riley@example.test' });
  });

  it('S-14.1 has no identity without an email, or with a blank one', () => {
    for (const email of [undefined, '', '   ']) {
      expect(matchIdentity(email, TEAM), String(email)).toEqual({ kind: 'no-identity' });
    }
  });

  it('S-15.1 is ambiguous when the email matches two members, named in DNA order', () => {
    const shared = TEAM.map((m) => (m.name === 'Jordan' || m.name === 'Sam' ? { ...m, email: 'shared@example.test' } : m));
    expect(matchIdentity('Shared@example.test', shared)).toEqual({
      kind: 'ambiguous',
      email: 'Shared@example.test',
      members: ['Jordan', 'Sam'],
    });
  });

  it('never matches a member without an email (optional in WingFoil 0.2.2)', () => {
    const noEmail: DnaMember[] = [{ name: 'Ghost', roles: ['developer'] }, ...TEAM];
    expect(matchIdentity('jordan@example.test', noEmail)).toMatchObject({ kind: 'member', name: 'Jordan' });
    expect(matchIdentity('ghost@example.test', noEmail)).toEqual({ kind: 'not-in-team', email: 'ghost@example.test' });
    expect(matchIdentity('x@example.test', [])).toEqual({ kind: 'not-in-team', email: 'x@example.test' });
  });

  it('keeps the roles in DNA order without duplicates', () => {
    const twice: DnaMember[] = [{ name: 'Morgan', email: 'morgan@example.test', roles: ['approver', 'tech-lead', 'approver'] }];
    expect(matchIdentity('morgan@example.test', twice)).toMatchObject({ roles: ['approver', 'tech-lead'] });
  });
});

describe('identityView — REQ-STATE-06 role views', () => {
  const morgan = matchIdentity('morgan@example.test', TEAM);
  const alex = matchIdentity('alex@example.test', TEAM);
  const jordan = matchIdentity('jordan@example.test', TEAM);

  it("S-22.2 offers exactly the member's roles", () => {
    expect(identityView(morgan, '').roleViews).toEqual(['approver', 'tech-lead']);
  });

  it('defaults to the first role in the DNA (stored "")', () => {
    expect(identityView(morgan, '')).toEqual({ identity: morgan, roleViews: ['approver', 'tech-lead'], roleView: 'approver' });
    expect(identityView(alex, '').roleView).toBe('tech-lead');
  });

  it('keeps a stored role the member holds (S-22.1, S-22.3)', () => {
    expect(identityView(alex, 'developer').roleView).toBe('developer');
    expect(identityView(alex, 'approver').roleView).toBe('approver');
  });

  it('falls back to the first role when the stored one is no longer held', () => {
    expect(identityView(jordan, 'approver').roleView).toBe('developer');
    expect(identityView(morgan, 'qa').roleView).toBe('approver');
  });

  it('S-12.1 a single-role member has one role view (no selector)', () => {
    expect(identityView(jordan, '').roleViews).toEqual(['developer']);
  });

  it('has no role view without a member', () => {
    for (const identity of [
      matchIdentity('riley@example.test', TEAM),
      matchIdentity(undefined, TEAM),
      matchIdentity('shared@example.test', [
        { name: 'A', email: 'shared@example.test', roles: ['qa'] },
        { name: 'B', email: 'shared@example.test', roles: ['qa'] },
      ]),
    ]) {
      expect(identityView(identity, 'qa')).toEqual({ identity, roleViews: [], roleView: null });
    }
  });

  it('has no role view for a member without roles', () => {
    const none = matchIdentity('n@example.test', [{ name: 'N', email: 'n@example.test', roles: [] }]);
    expect(identityView(none, '')).toEqual({ identity: none, roleViews: [], roleView: null });
  });
});

function entry(id: string, roles: string[], global = false): DirectiveEntry {
  return {
    path: `directives/custom/${id}.md`,
    frontmatter: { id, name: id, type: 'directive', kind: 'custom', title: id },
    roles,
    global,
    assignment: global ? 'global (all roles)' : roles.join(', '),
  };
}

describe('directivesForRoleView — "only mine" (S-22.1, R-06.1, R-06.4)', () => {
  const entries = [entry('a', ['developer']), entry('b', ['approver']), entry('c', [], true), entry('d', ['developer', 'qa'])];

  it('lists the directives bound to the role and the global ones, in list order', () => {
    expect(directivesForRoleView(entries, 'developer').map((e) => e.frontmatter.id)).toEqual(['a', 'c', 'd']);
    expect(directivesForRoleView(entries, 'approver').map((e) => e.frontmatter.id)).toEqual(['b', 'c']);
  });

  it('lists nothing without a role view', () => {
    expect(directivesForRoleView(entries, null)).toEqual([]);
  });
});
