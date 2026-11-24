#!/usr/bin/env node
// Bound check red-tests-untouched (severity reject): the test files red wrote are unchanged since
// red. Red's range comes from the element's red run records (docs/runs/<element>.jsonl under
// MEMORY_ROOT, the line's checkout the runner gives in WINGFOIL_RUNNER_CHECKOUT): the base is the state_ref of
// its first red run, whatever its result, and the head the head= of its last completed one, so a
// red run again with nothing left to commit does not narrow it. Red's test files are those the
// commits reachable from the head, and from neither the base nor the line's branch
// (WINGFOIL_RUNNER_LINE_BRANCH), changed: the line's commits a rebase brings in are not red's. --base/--head
// override the range. Red's test files are compared with the working tree, which tests-green runs.
// A range with no test file fails: a completed red run, the first or an amendment, wrote or amended
// red's test files, so the range is wrong.
// Usage: node scripts/checks/red-tests-untouched.mjs [--element <id>] [--base <rev> --head <rev>] [--line-branch <ref>]
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { elementArg, verdict, fail, MEMORY_ROOT, versionLine } from '../lib/memory.mjs';
import { parseRunRecords, parseNotes } from '../runner/lib.mjs';

console.log(versionLine());

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lineBranch = arg('--line-branch') ?? process.env.WINGFOIL_RUNNER_LINE_BRANCH ?? process.env.DFD_LINE_BRANCH ?? null;

let base = arg('--base');
let head = arg('--head');
if (!base || !head) {
  const id = elementArg();
  if (!id) fail('no element: pass --element <id> or set WINGFOIL_ELEMENT, or --base and --head');
  const log = join(MEMORY_ROOT, process.env.WINGFOIL_RUNNER_RUNS ?? process.env.DFD_RUNS ?? 'docs/runs', `${id}.jsonl`);
  if (!existsSync(log)) fail(`${log} is absent: no red run recorded for ${id}`);
  const reds = parseRunRecords(readFileSync(log, 'utf8'), log).filter((run) => run.phase === 'red');
  const last = reds.filter((run) => run.result === 'completed').at(-1);
  if (!last) fail(`no completed red run in ${log}`);
  base = reds[0].state_ref;
  head = parseNotes(last.notes).head;
  if (!base) fail(`${reds[0].id} records no state_ref`);
  if (!head) fail(`${last.id} records no head= in its notes`);
}
const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const exclude = [base, ...(lineBranch ? [lineBranch] : [])];
const written = [...new Set(git('log', '--no-merges', '--format=', '--name-only', head, '--not', ...exclude, '--')
  .split('\n').filter((f) => f && TEST_FILE.test(f)))];
const range = `${base.slice(0, 8)}..${head.slice(0, 8)}${lineBranch ? ` (not in ${lineBranch})` : ''}`;
if (written.length === 0) verdict([`no test file written by red in ${range}: the red range is wrong`], '');
const changed =
  // Against the working tree, not HEAD: tests-green runs the files as they are, committed or not.
  git('diff', '--name-only', head, '--', ...written).split('\n').filter(Boolean);
verdict(changed.map((file) => `${file}, written by red, changed since ${head.slice(0, 8)}`),
  `${written.length} red test file(s) of ${range} unchanged since ${head.slice(0, 8)}`);
