/**
 * The Given step of S-24.7 (task-073 D73-9; RP3-16 P4) on a copy of the `custom` fixture built with
 * a CLI ≥ 0.3 (the packs' governance, where `sprint` declares `limits: { active: 1 }`): two Sprints
 * added by Alex, each with its `goal` written into the file before its first submit (`memory add
 * --set goal=` is refused: `goal` is no token of the id pattern), then moved by WingFoil's verbs only
 * (W-34: no hand-set `status:`), dated after the fixture's own commits.
 */
import { pinnedCli, pinnedVersion } from '../cli.js';
import { customGovernance, type Fixture } from './builder.js';
import { FixtureProject } from './project.js';

/** The Sprint {@link fillSprints} leaves in `active` (the state's one slot). */
export const ACTIVE_SPRINT = 'sprint-001';
/** The Sprint {@link fillSprints} leaves in `planned`: its submit leads into the full `active`. */
export const PLANNED_SPRINT = 'sprint-002';

/** A copy-bound driver of the fixture, `minutes` after its clock. */
export function stateLimitProject(fixture: Fixture, minutes = 60): FixtureProject {
  if (fixture.kind !== 'custom') throw new Error(`the full Sprint is a custom fixture variant, not ${fixture.kind}`);
  if (customGovernance(pinnedVersion()) !== 'packs') throw new Error('the full Sprint needs the packs’ governance');
  return new FixtureProject({
    dir: fixture.dir,
    cli: pinnedCli(),
    cliVersion: pinnedVersion(),
    now: new Date(fixture.now.getTime() + minutes * 60 * 1000),
    env: fixture.env,
  });
}

async function addSprint(p: FixtureProject, title: string, expected: string): Promise<{ id: string; path: string }> {
  const sprint = await p.add('Alex', 'sprint', title);
  if (sprint.id !== expected) throw new Error(`the Sprint is ${sprint.id}, not ${expected}`);
  await p.editFrontmatter(sprint.path, { goal: `"${title} goal"` });
  return sprint;
}

/** Both Sprints added and submitted by Alex `draft → planned`: `active` still has its slot free. */
export async function planSprints(fixture: Fixture): Promise<void> {
  const p = stateLimitProject(fixture);
  for (const [title, id] of [
    ['Sprint one', ACTIVE_SPRINT],
    ['Sprint two', PLANNED_SPRINT],
  ] as const) {
    const sprint = await addSprint(p, title, id);
    await p.submit('Alex', sprint.id);
  }
}

/**
 * S-24.7: {@link planSprints}, then `sprint-001` submitted by Alex `planned → active`; the next
 * submit of `sprint-002` is refused by WingFoil 0.3.x ("WIP limit reached for 'active' …", design
 * probe P1).
 */
export async function fillSprints(fixture: Fixture): Promise<void> {
  await planSprints(fixture);
  await stateLimitProject(fixture, 70).submit('Alex', ACTIVE_SPRINT);
}
