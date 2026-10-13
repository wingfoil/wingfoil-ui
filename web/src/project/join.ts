/**
 * The pure part of *How to join* (task-035; US-C-08, US-C-09; decisions D35-4, D35-6, D35-7,
 * D35-8): who gets the panel, the tech leads the DNA declares, and the exact
 * `wingfoil dna add team.members …` command for the user's email. The command is data, not a
 * catalogue text (spec-008 §6, D35-3): its words are WingFoil's CLI and are never translated; only
 * its two placeholders come from the catalogue.
 */
import type { DnaShow, ProjectHeader } from '@wingfoil-ui/contracts';

/**
 * The role whose holders *How to join* names: WingFoil's own vocabulary (spec-003 §4), the same
 * name as `TECH_LEAD_ROLE` of `server/src/presets/wingfoil.ts` (a unit test pins the two, D35-4).
 */
export const TECH_LEAD_ROLE = 'tech-lead';

/** A tech lead as the panel names it. */
export interface JoinLead {
  name: string;
  /** Absent when the DNA gives none (WingFoil 0.2.2: optional). */
  email?: string;
}

/**
 * What the panel says about the team: the tech leads, that none is declared (C-09.1), or that the
 * team is empty (C-09.2 — then only that, D35-6); with the roles `team.roles` declares, which the
 * CLI accepts for `--entry-roles` (D35-6).
 */
export type JoinTeam =
  | { kind: 'leads'; leads: JoinLead[]; roles: string[] }
  | { kind: 'noLead'; roles: string[] }
  | { kind: 'noMember'; roles: string[] };

/**
 * The email *How to join* is for: a user not in the team, with a DNA that could be read (D35-8).
 * A member, no identity (no email for the command), an ambiguous identity (already a member) and
 * an unreadable DNA (*team unknown*) get no panel.
 */
export function joinEmail(header: ProjectHeader): string | undefined {
  return header.identity.kind === 'not-in-team' && !header.dnaError ? header.identity.email : undefined;
}

/** The team part of the panel, from `dna.team`. */
export function joinTeam(team: DnaShow['team']): JoinTeam {
  const roles = team.roles.map((r) => r.name);
  if (team.members.length === 0) return { kind: 'noMember', roles };
  const leads = team.members
    .filter((m) => m.roles.includes(TECH_LEAD_ROLE))
    .map((m) => (m.email !== undefined ? { name: m.name, email: m.email } : { name: m.name }));
  return leads.length > 0 ? { kind: 'leads', leads, roles } : { kind: 'noLead', roles };
}

/** Characters a POSIX shell takes literally in a word. */
const PLAIN_WORD = /^[A-Za-z0-9@%+=:,./_-]+$/;

/**
 * `value` as one POSIX shell word (D35-7): bare when it holds only plain characters (the scenario's
 * `riley@example.test`), else single-quoted — a git email is free text and the command is pasted
 * into a shell.
 */
export function shellWord(value: string): string {
  return PLAIN_WORD.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The parts of the command: the user's email and the two placeholders (catalogue texts). */
export interface JoinCommandParts {
  /** The name placeholder, e.g. `<Your Name>`, written in double quotes. */
  name: string;
  email: string;
  /** The roles placeholder, e.g. `<roles>`, written as is. */
  roles: string;
}

/** The command a member runs to add the user to `dna.team.members` (C-08.1). */
export function joinCommand({ name, email, roles }: JoinCommandParts): string {
  return `wingfoil dna add team.members --value "${name}" --entry-email ${shellWord(email)} --entry-roles ${roles}`;
}
