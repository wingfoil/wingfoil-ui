// task-016 — the pure part of the project header: who the user is (W4-17, W4-22), the read-only
// notices (W4-19), the version and its range (W4-18).
import { describe, expect, it } from 'vitest';
import { initials, readOnlyNotices, supportedRange, userView, versionOf } from '../../../web/src/project/model.js';
import { header, morgan, outOfRange, riley } from './header-data.js';

const DNA_ERROR = { code: 'cli-refused', message: 'invalid dna.yaml' };

describe('initials', () => {
  it.each([
    ['Jordan', 'J'],
    ['Morgan Reyes', 'MR'],
    ['ada lovelace byron', 'AL'],
    ['  ', '?'],
  ])('%s → %s', (name, expected) => expect(initials(name)).toBe(expected));
});

describe('userView', () => {
  it('a single-role member: name and role', () => {
    expect(userView(header())).toEqual({ kind: 'memberRole', name: 'Jordan', role: 'developer', initials: 'J' });
  });
  it('a member with several roles: name only (the role is in the selector)', () => {
    expect(userView(morgan())).toEqual({ kind: 'member', name: 'Morgan Reyes', initials: 'MR' });
  });
  it('not in team: the email', () => {
    expect(userView(riley())).toEqual({ kind: 'notInTeam', email: 'riley@example.test', initials: '?' });
  });
  it('not in team with an unreadable DNA: team unknown (W4-22)', () => {
    expect(userView({ ...riley(), dnaError: DNA_ERROR })).toEqual({
      kind: 'teamUnknown',
      email: 'riley@example.test',
      initials: '?',
    });
  });
  it('no identity', () => {
    expect(userView(header({ identity: { kind: 'no-identity' }, roleViews: [], roleView: null }))).toEqual({
      kind: 'noIdentity',
      initials: '?',
    });
  });
  it('ambiguous', () => {
    const h = header({
      identity: { kind: 'ambiguous', email: 'shared@example.test', members: ['Jordan', 'Sam'] },
      roleViews: [],
      roleView: null,
    });
    expect(userView(h)).toEqual({ kind: 'ambiguous', email: 'shared@example.test', initials: '?' });
  });
});

describe('readOnlyNotices', () => {
  it('none for a member', () => expect(readOnlyNotices(header())).toEqual([]));
  it('not in team', () =>
    expect(readOnlyNotices(riley())).toEqual([{ kind: 'notInTeam', email: 'riley@example.test' }]));
  it('team unknown when the DNA could not be read', () =>
    expect(readOnlyNotices({ ...riley(), dnaError: DNA_ERROR })).toEqual([{ kind: 'teamUnknown' }]));
  it('no identity, even with an unreadable DNA', () =>
    expect(
      readOnlyNotices(
        header({ identity: { kind: 'no-identity' }, roleViews: [], roleView: null, dnaError: DNA_ERROR }),
      ),
    ).toEqual([{ kind: 'noIdentity' }]));
  it('ambiguous, with the members', () =>
    expect(
      readOnlyNotices(
        header({
          identity: { kind: 'ambiguous', email: 's@x.test', members: ['Jordan', 'Sam'] },
          roleViews: [],
          roleView: null,
        }),
      ),
    ).toEqual([{ kind: 'ambiguous', email: 's@x.test', members: ['Jordan', 'Sam'] }]));
  it('the version is not a notice of its own (it is the version line, W4-18)', () =>
    expect(readOnlyNotices(outOfRange('0.4.0'))).toEqual([]));
});

describe('versionOf and supportedRange', () => {
  it('the semantic version first, else the text, else nothing', () => {
    expect(versionOf(header().wingfoil)).toBe('0.2.2');
    expect(versionOf({ ...header().wingfoil, version: null, text: 'nightly' })).toBe('nightly');
    expect(versionOf({ ...header().wingfoil, version: null, text: null })).toBeUndefined();
  });
  it('the range from the capability reasons', () => {
    expect(supportedRange(outOfRange('0.4.0'))).toEqual({ min: '0.2.2', max: '0.2.x' });
    expect(supportedRange(header())).toBeUndefined();
  });
});
