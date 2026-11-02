/**
 * The WingFoil 0.3 Memory operations on a fixture (task-048, bug-026): on a copy of the `custom`
 * fixture built with a CLI ≥ 0.3 (the packs' governance), one commit of each operation 0.3.x's
 * `memory history` reads besides the five of 0.2.2 — `finalize` (a phase plan closed by hand,
 * directive `wingfoil-cli` W-04), `start` (one element, then two grouped ids), `park`, `sync` (a
 * chained bracket), `amend` and `assign` (two grouped ids). The base fixtures stay as they are.
 */
import { pinnedCli, pinnedVersion, type CliBuild } from '../cli.js';
import { customGovernance, type Fixture } from './builder.js';
import { FixtureProject } from './project.js';

/** Options of {@link addOperations}. */
export interface OperationsOptions {
  /** The CLI build the fixture was made with (default: the pinned one). */
  cli?: CliBuild;
  /** Its version (default: the pinned one). */
  cliVersion?: string;
}

/** The elements {@link addOperations} touched, by role. */
export interface OperationIds {
  /** A phase plan `draft → active` by the CLI, then `active → done` by a hand `finalize` (W-04). */
  plan: string;
  /** A task started by hand, then parked (`memory park`, with a reason). */
  parked: string;
  /** Two tasks started by one grouped `start` commit; the second then `sync`ed along a chained bracket. */
  grouped: [string, string];
  /** A decision-log amended by the approver (`memory amend`, with a reason). */
  amended: string;
  /** Two bugs whose `release` one grouped `assign` commit sets. */
  assigned: [string, string];
}

/** Reason of the park. */
export const PARK_REASON = 'Blocked on the build server';
/** Reason of the amend. */
export const AMEND_REASON = 'Title names the server';

/**
 * Commit the 0.3 operations on `fixture` (a `custom` fixture, or a copy of one, on a CLI ≥ 0.3).
 * The commits are dated after the fixture's own (its clock + 20 min, one second apart).
 */
export async function addOperations(fixture: Fixture, options: OperationsOptions = {}): Promise<OperationIds> {
  const cli = options.cli ?? pinnedCli();
  const cliVersion = options.cliVersion ?? pinnedVersion();
  if (fixture.kind !== 'custom')
    throw new Error(`the 0.3 operations are added to a custom fixture, not ${fixture.kind}`);
  if (customGovernance(cliVersion) !== 'packs') throw new Error(`WingFoil ${cliVersion} has no park or amend verb`);
  const p = new FixtureProject({
    dir: fixture.dir,
    cli,
    cliVersion,
    now: new Date(fixture.now.getTime() + 20 * 60 * 1000),
    env: fixture.env,
  });

  // A phase plan, closed by hand (W-04).
  const plan = await p.add('Alex', 'plan', 'History probe', { workflow: 'history', phase: 'probe', scope: 'rl-v1' });
  await p.submit('Alex', plan.id);
  await p.handCommit('Alex', plan.path, { status: 'done' }, `wf(plan): finalize ${plan.id} [active → done]`);

  // Tasks in `backlog` (the custom fixture's recipe), then the practised and the new verbs.
  const backlog = async (title: string) => {
    const el = await p.add('Jordan', 'task', title, { release: 'v0.1' });
    await p.editFrontmatter(el.path, { sprint: '"n/a — no Sprint in the fixture"' });
    await p.submit('Jordan', el.id);
    await p.approve('Morgan', el.id);
    return el;
  };
  const parked = await backlog('Parked work');
  await p.handCommit(
    'Jordan',
    parked.path,
    { status: 'in-progress' },
    `wf(task): start ${parked.id} [backlog → in-progress]`,
  );
  await p.wingfoilAs('Jordan', ['memory', 'park', parked.id, '--reason', PARK_REASON]);

  const first = await backlog('Grouped one');
  const second = await backlog('Grouped two');
  await p.editFrontmatter(first.path, { status: 'in-progress' });
  await p.handCommit(
    'Jordan',
    second.path,
    { status: 'in-progress' },
    `wf(task): start ${first.id}, ${second.id} [backlog → in-progress]`,
  );
  await p.handCommit(
    'Jordan',
    second.path,
    { status: 'approved' },
    `wf(task): sync ${second.id} [in-progress → in-review → approved]`,
  );

  // An amend of a committed decision-log, by the approver.
  const amended = 'dl-002-use-fastify';
  await p.editFrontmatter('docs/04_memory/design/dls/dl-002-use-fastify.md', { title: '"Use Fastify for the server"' });
  await p.wingfoilAs('Morgan', ['memory', 'amend', amended, '--reason', AMEND_REASON]);

  // One grouped `assign` of two bugs (the `release` field only, no state change).
  const bug = await p.add('Sam', 'bug', 'Focus ring');
  await p.editFrontmatter(bug.path, { severity: '"low"' });
  await p.submit('Sam', bug.id);
  const other = 'bug-001-toast-overlap';
  await p.editFrontmatter(`docs/04_memory/bugs/${other}.md`, { release: '"v0.1"' });
  await p.handCommit('Alex', bug.path, { release: '"v0.1"' }, `wf(bug): assign release v0.1 to ${other}, ${bug.id}`);

  return { plan: plan.id, parked: parked.id, grouped: [first.id, second.id], amended, assigned: [other, bug.id] };
}
