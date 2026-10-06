/**
 * Types of the HTTP API bodies (spec-004 §3), matching the schemas of `contracts/api/` (checked by
 * `test/contracts/api-identity-schema.test.ts`).
 */

/**
 * Who the user is in a project (REQ-STATE-05): the effective `git config user.email` matched,
 * case-insensitively, against `dna.team.members[].email`. Every kind but `member` is read-only.
 */
export type Identity =
  | {
      /** The email matches exactly one member. */
      kind: 'member';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
      /** The member's `name`. */
      name: string;
      /** The member's roles, in DNA order, without duplicates. */
      roles: string[];
    }
  | {
      /** The email matches no member (S-13.1, S-13.3). */
      kind: 'not-in-team';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
    }
  | {
      /** Neither the repository nor the global git configuration sets `user.email` (S-14.1). */
      kind: 'no-identity';
    }
  | {
      /** The email matches several members (S-15.1). */
      kind: 'ambiguous';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
      /** The names of the matching members, in DNA order (at least two). */
      members: string[];
    };

/** The identity part of `GET /api/p/:pid` (`contracts/api/identity.schema.json`). */
export interface IdentityView {
  identity: Identity;
  /**
   * The role views offered (REQ-STATE-06): the member's roles, in DNA order; `[]` without a member.
   * The selector is shown only when there are several.
   */
  roleViews: string[];
  /**
   * The current role view: the remembered one (spec-006 `roleView`) when the member still holds
   * it, else the first role; `null` without a member or roles.
   */
  roleView: string | null;
}

/** Body of `PUT /api/p/:pid/role-view` (`contracts/api/role-view.request.schema.json`). */
export interface RoleViewRequest {
  /** One of the member's roles. */
  role: string;
}
