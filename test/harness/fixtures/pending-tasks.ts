/**
 * The Given step of T-02.6 (task-061, RP3-16 P4; D61-12): on a copy of the `kanban` fixture, `count`
 * more tasks in the state `pending` — each added and submitted by Jordan with the pinned CLI (W-34:
 * no hand-set `status:`), dated after the fixture's own commits (its clock + 30 min), so that they
 * follow the fixture's two pending elements in the *Requires you* order. Scenario-local: the base
 * fixture and its figures stay as they are.
 */
import { pinnedCli, pinnedVersion } from '../cli.js';
import type { Fixture } from './builder.js';
import { FixtureProject } from './project.js';

/** Add `count` (1 … 100) tasks to the kanban `fixture` and submit them; returns their ids in order. */
export async function addPendingTasks(fixture: Fixture, count: number): Promise<string[]> {
  if (fixture.kind !== 'kanban')
    throw new Error(`the pending tasks are added to a kanban fixture, not ${fixture.kind}`);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error(`1 to 100 tasks, not ${count}`);
  const p = new FixtureProject({
    dir: fixture.dir,
    cli: pinnedCli(),
    cliVersion: pinnedVersion(),
    now: new Date(fixture.now.getTime() + 30 * 60 * 1000),
    env: fixture.env,
  });
  const ids: string[] = [];
  for (let n = 1; n <= count; n += 1) {
    const el = await p.add('Jordan', 'task', `Pending task ${n}`);
    await p.submit('Jordan', el.id);
    ids.push(el.id);
  }
  // As the fixture builder leaves it: the identity of a copy is set afterwards (`actAs`).
  await p.as('Alex');
  return ids;
}
