/**
 * The standard team of every fixture (`02_bdd/00_conventions.md` *Standard team*).
 */

/** Names of the standard team's members. */
export type MemberName = 'Morgan' | 'Casey' | 'Jordan' | 'Sam' | 'Alex';

/** One member of `dna.team.members`. */
export interface Member {
  name: MemberName;
  email: string;
  roles: readonly string[];
}

/** The standard team, in `dna.team.members` order. */
export const STANDARD_TEAM: readonly Member[] = [
  { name: 'Morgan', email: 'morgan@example.test', roles: ['approver', 'tech-lead'] },
  { name: 'Casey', email: 'casey@example.test', roles: ['product-owner'] },
  { name: 'Jordan', email: 'jordan@example.test', roles: ['developer'] },
  { name: 'Sam', email: 'sam@example.test', roles: ['reviewer'] },
  {
    name: 'Alex',
    email: 'alex@example.test',
    roles: ['tech-lead', 'architect', 'developer', 'reviewer', 'product-owner', 'approver', 'qa'],
  },
];

/** The agent of `dna.team.agents`. */
export const STANDARD_AGENT = { name: 'Build agent', executesAs: ['developer'], approvalAuthority: false } as const;

/** Someone who is not in the team. */
export const OUTSIDER = { name: 'Riley', email: 'riley@example.test' } as const;

/** The member called `name`. */
export function memberByName(name: MemberName): Member {
  const member = STANDARD_TEAM.find((m) => m.name === name);
  if (!member) throw new Error(`unknown member ${name}`);
  return member;
}
