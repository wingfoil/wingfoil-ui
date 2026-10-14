/**
 * The pure part of the project header (task-016; ux-reference §3, decisions W4-17…W4-22): who the
 * user is, the read-only notices of the identity and the version against the supported range. The
 * header data is `GET /api/p/:pid` (`projectHeaderQuery`); nothing here is re-derived from the DNA.
 */
import type { ApiRange, ApiWingfoilVersion, ProjectHeader } from '@wingfoil-ui/contracts';

/**
 * The current user as the global header shows it (W4-17): a member with one role shows the role
 * too (`memberRole`); with several roles the role is in the selector (`member`); `teamUnknown` is a
 * user matched against no member because `dna show` failed (W4-22).
 */
export type UserView =
  | { kind: 'memberRole'; name: string; role: string; initials: string }
  | { kind: 'member'; name: string; initials: string }
  | { kind: 'notInTeam' | 'teamUnknown' | 'ambiguous'; email: string; initials: string }
  | { kind: 'noIdentity'; initials: string };

/** A read-only notice of the identity (W4-19); the version's is the version line itself (W4-18). */
export type ReadOnlyNotice =
  | { kind: 'notInTeam'; email: string }
  | { kind: 'teamUnknown' }
  | { kind: 'noIdentity' }
  | { kind: 'ambiguous'; email: string; members: string[] };

/** The avatar's text when the user is not one member (also read by the X-09.1 check, D35-10). */
export const NO_INITIALS = '?';

/** The initials of `name`: the first letter of its first two words, `?` when it has none. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase());
  return letters.length > 0 ? letters.join('') : NO_INITIALS;
}

/** Who the user is, for the global header. */
export function userView(header: ProjectHeader): UserView {
  const { identity } = header;
  switch (identity.kind) {
    case 'member':
      return identity.roles.length === 1
        ? { kind: 'memberRole', name: identity.name, role: identity.roles[0]!, initials: initials(identity.name) }
        : { kind: 'member', name: identity.name, initials: initials(identity.name) };
    case 'not-in-team':
      return {
        kind: header.dnaError ? 'teamUnknown' : 'notInTeam',
        email: identity.email,
        initials: NO_INITIALS,
      };
    case 'ambiguous':
      return { kind: 'ambiguous', email: identity.email, initials: NO_INITIALS };
    case 'no-identity':
      return { kind: 'noIdentity', initials: NO_INITIALS };
  }
}

/** The notices that make the project read-only because of who the user is. */
export function readOnlyNotices(header: ProjectHeader): ReadOnlyNotice[] {
  const { identity } = header;
  switch (identity.kind) {
    case 'member':
      return [];
    case 'not-in-team':
      return [header.dnaError ? { kind: 'teamUnknown' } : { kind: 'notInTeam', email: identity.email }];
    case 'ambiguous':
      return [{ kind: 'ambiguous', email: identity.email, members: identity.members }];
    case 'no-identity':
      return [{ kind: 'noIdentity' }];
  }
}

/** The version to show: the semantic version, else what `--version` answered, else none. */
export function versionOf(wingfoil: ApiWingfoilVersion): string | undefined {
  return wingfoil.version ?? wingfoil.text ?? undefined;
}

/** The supported range carried by the capabilities of a project out of range (`unsupported-version`). */
export function supportedRange(header: ProjectHeader): ApiRange | undefined {
  for (const c of header.capabilities.capabilities) {
    if (c.reason?.code === 'unsupported-version') return c.reason.range;
  }
  return undefined;
}
