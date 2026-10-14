// task-035 — the pure part of *How to join* (US-C-08, US-C-09; D35-4, D35-6, D35-7, D35-8): who
// gets the panel, the tech leads of the DNA, and the command with the user's email.
import type { DnaShow } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { TECH_LEAD_ROLE as SERVER_TECH_LEAD } from '../../../server/src/presets/wingfoil.js';
import {
  doubleQuoted,
  joinCommand,
  joinEmail,
  joinTeam,
  shellWord,
  TECH_LEAD_ROLE,
} from '../../../web/src/project/join.js';
import { header, riley } from './header-data.js';

type Team = DnaShow['team'];

const ROLES = [{ name: 'developer' }, { name: 'tech-lead' }, { name: 'approver' }];

describe('TECH_LEAD_ROLE (D35-4)', () => {
  it("is the server preset's role name (WingFoil vocabulary, spec-003 §4)", () => {
    expect(TECH_LEAD_ROLE).toBe(SERVER_TECH_LEAD);
  });
});

describe('joinEmail (D35-8)', () => {
  it('is the email of a user not in the team, with a readable DNA', () => {
    expect(joinEmail(riley())).toBe('riley@example.test');
  });

  it('is undefined for a member, no identity, an ambiguous identity or an unreadable DNA', () => {
    expect(joinEmail(header())).toBeUndefined();
    expect(joinEmail(header({ identity: { kind: 'no-identity' } }))).toBeUndefined();
    expect(
      joinEmail(header({ identity: { kind: 'ambiguous', email: 'a@x.test', members: ['A', 'B'] } })),
    ).toBeUndefined();
    expect(joinEmail({ ...riley(), dnaError: { code: 'cli-refused', message: 'x' } })).toBeUndefined();
  });
});

describe('joinTeam', () => {
  it('lists the members holding the tech-lead role, in DNA order, with their email when given (C-08.1)', () => {
    const team: Team = {
      members: [
        { name: 'Morgan', email: 'morgan@example.test', roles: ['approver', 'tech-lead'] },
        { name: 'Jordan', email: 'jordan@example.test', roles: ['developer'] },
        { name: 'Pat', roles: ['tech-lead'] },
        { name: 'Alex', email: 'alex@example.test', roles: ['tech-lead', 'developer'] },
      ],
      roles: ROLES,
    };
    expect(joinTeam(team)).toEqual({
      kind: 'leads',
      leads: [
        { name: 'Morgan', email: 'morgan@example.test' },
        { name: 'Pat' },
        { name: 'Alex', email: 'alex@example.test' },
      ],
      roles: ['developer', 'tech-lead', 'approver'],
    });
  });

  it('says no tech lead is declared when no member holds the role (C-09.1)', () => {
    const team: Team = { members: [{ name: 'Jordan', roles: ['developer'] }], roles: ROLES };
    expect(joinTeam(team)).toEqual({ kind: 'noLead', roles: ['developer', 'tech-lead', 'approver'] });
  });

  it('says the team is empty when no member is declared, not also that no lead is (C-09.2, D35-6)', () => {
    expect(joinTeam({ members: [], roles: [] })).toEqual({ kind: 'noMember', roles: [] });
  });
});

describe('shellWord (D35-7)', () => {
  it('leaves a plain email bare', () => {
    expect(shellWord('riley@example.test')).toBe('riley@example.test');
    expect(shellWord('first.last+tag@sub-domain.example.test')).toBe('first.last+tag@sub-domain.example.test');
  });

  it('single-quotes anything else, escaping a single quote', () => {
    expect(shellWord('a b@x.test')).toBe("'a b@x.test'");
    expect(shellWord('$(id)@x.test')).toBe("'$(id)@x.test'");
    expect(shellWord("o'neil@x.test")).toBe("'o'\\''neil@x.test'");
    expect(shellWord('a;b`c`@x.test')).toBe("'a;b`c`@x.test'");
    expect(shellWord('')).toBe("''");
  });
});

describe('doubleQuoted (review F4)', () => {
  it('quotes a plain text as is', () => {
    expect(doubleQuoted('<Your Name>')).toBe('"<Your Name>"');
  });

  it('escapes what ends or expands inside double quotes', () => {
    expect(doubleQuoted('a"b')).toBe(String.raw`"a\"b"`);
    expect(doubleQuoted('$(id) `id` $HOME')).toBe(String.raw`"\$(id) \`id\` \$HOME"`);
    expect(doubleQuoted(String.raw`back\slash`)).toBe(String.raw`"back\\slash"`);
  });
});

describe('joinCommand', () => {
  it('is the scenario command, with the placeholders as given (C-08.1)', () => {
    expect(joinCommand({ name: '<Your Name>', email: 'riley@example.test', roles: '<roles>' })).toBe(
      'wingfoil dna add team.members --value "<Your Name>" --entry-email riley@example.test --entry-roles <roles>',
    );
  });

  it('escapes a name placeholder a translation could break out of (F4)', () => {
    expect(joinCommand({ name: 'N" $(x)', email: 'a@b.test', roles: 'R' })).toBe(
      String.raw`wingfoil dna add team.members --value "N\" \$(x)" --entry-email a@b.test --entry-roles R`,
    );
  });

  it('quotes an email a shell would split or expand', () => {
    expect(joinCommand({ name: 'N', email: 'x y@z.test', roles: 'R' })).toBe(
      'wingfoil dna add team.members --value "N" --entry-email \'x y@z.test\' --entry-roles R',
    );
  });
});
