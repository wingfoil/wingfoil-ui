/**
 * Identity and role views (REQ-STATE-05, REQ-STATE-06): pure rules, no process and no file. The
 * user is the effective `git config user.email` matched case-insensitively against
 * `dna.team.members[].email` (directive `cli-only-writes` rule 6: the project's git identity, no
 * login); role views are the member's roles, the remembered one applied only while it is held
 * (spec-006 §3: the fallback is applied on read, never stored).
 */
import type { DirectiveEntry, DnaMember, Identity, IdentityView } from '@wingfoil-ui/contracts';

/** The comparable form of an email: trimmed and lower-cased (locale independent). */
function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Match `email` (the effective `user.email`, `undefined` when unset) against `members`. A blank
 * email is no identity; a member without `email` (optional in WingFoil 0.2.2) never matches.
 */
export function matchIdentity(email: string | undefined, members: readonly DnaMember[]): Identity {
  const shown = email?.trim() ?? '';
  if (shown === '') return { kind: 'no-identity' };
  const key = emailKey(shown);
  const matches = members.filter((m) => typeof m.email === 'string' && emailKey(m.email) === key);
  if (matches.length === 0) return { kind: 'not-in-team', email: shown };
  if (matches.length > 1) return { kind: 'ambiguous', email: shown, members: matches.map((m) => m.name) };
  const member = matches[0]!;
  return { kind: 'member', email: shown, name: member.name, roles: [...new Set(member.roles)] };
}

/**
 * The role views of `identity` and the current one: `stored` (spec-006 `roleView`, `""` = the
 * default) when the member holds it, else the member's first role in the DNA.
 */
export function identityView(identity: Identity, stored: string): IdentityView {
  const roleViews = identity.kind === 'member' ? [...identity.roles] : [];
  const roleView = roleViews.includes(stored) ? stored : (roleViews[0] ?? null);
  return { identity, roleViews, roleView };
}

/**
 * "Only mine" of the Directives view for the role view `role` (S-22.1, R-06.1): the directives
 * bound to `role` in `roles.yaml` and the global ones, in list order; none without a role view
 * (R-06.4).
 */
export function directivesForRoleView(entries: readonly DirectiveEntry[], role: string | null): DirectiveEntry[] {
  if (role === null) return [];
  return entries.filter((e) => e.global || e.roles.includes(role));
}
