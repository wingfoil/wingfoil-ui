#!/usr/bin/env node
// Bound checks tests-red / tests-green of `backlog-item` (dl-028, `.wingfoil/workflows/bindings.yaml`).
// This repository's own check, outside the script runner's manifest: the runner's common
// `scripts/checks/tests.mjs` runs `npm test` (vitest) only, while a red-first criterion here is often
// a Playwright spec. Run in the task's worktree with the variables the runner gives (lib.checkEnv).
//
// Red's test files: for `--expect red`, the test files the step's commits changed (reachable from
// HEAD, from neither WINGFOIL_RUNNER_BASE, the worktree's HEAD before the launch, nor the line's
// branch); for `--expect green`, those of the element's red runs, as `scripts/checks/red-tests-untouched.mjs`
// reads them (docs/runs/<id>.jsonl in the line's checkout: the first red run's state_ref to the last
// completed one's head=). Files deleted since are left out. Each is run by its tool:
// - `test/e2e/**.spec.*` through `npm run -s test:e2e:chromium -- <files>` (Playwright, Chromium);
// - every other `test/**.test.ts(x)` but timing and smoke through `npm test -- <files>` (vitest).
//
// --expect red: red wrote at least one file a tool runs, and each tool's run of red's files fails.
// --expect green: `npm test` passes, and so do red's specs on Chromium. With no red run (a red the
// runner skipped for `flow: direct`, or none) only `npm test` runs; red-tests-untouched judges that.
// The heavy gates (coverage, the three engines, the smokes) stay on gates.yml (dl-016).
// Usage: node scripts/project-checks/task-tests.mjs --expect red|green [--element <id>] [--base <rev>] [--line-branch <ref>]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { elementArg, verdict, fail, MEMORY_ROOT, versionLine } from '../lib/memory.mjs';
import { parseRunRecords, parseNotes, runnerEnv } from '../runner/lib.mjs';

console.log(versionLine());

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const expect = arg('--expect');
if (expect !== 'red' && expect !== 'green') fail('pass --expect red or --expect green');
const lineBranch = arg('--line-branch') ?? runnerEnv('LINE_BRANCH') ?? null;

const SPEC = /^test\/e2e\/.+\.spec\.[cm]?[jt]sx?$/;
const UNIT = /^test\/(?!e2e\/|timing\/|smoke\/).+\.test\.tsx?$/;
const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** The test files the commits reachable from `head`, and from neither `base` nor the line's branch, changed. */
function changedTests(base, head) {
  const exclude = [base, ...(lineBranch ? [lineBranch] : [])];
  const names = git('log', '--no-merges', '--format=', '--name-only', head, '--not', ...exclude, '--').split('\n');
  return [...new Set(names.filter((f) => f && TEST_FILE.test(f)))];
}

/** Red's range from the element's red run records, or null when red never ran. */
function redRange(id) {
  const log = join(MEMORY_ROOT, runnerEnv('RUNS') ?? 'docs/runs', `${id}.jsonl`);
  const reds = existsSync(log)
    ? parseRunRecords(readFileSync(log, 'utf8'), log).filter((run) => run.phase === 'red')
    : [];
  const last = reds.filter((run) => run.result === 'completed').at(-1);
  if (!last) return null;
  const base = reds[0].state_ref;
  const head = parseNotes(last.notes).head;
  if (!base) fail(`${reds[0].id} records no state_ref`);
  if (!head) fail(`${last.id} records no head= in its notes`);
  return { base, head };
}

function runTool(argv) {
  console.log(`$ npm ${argv.join(' ')}`);
  return spawnSync('npm', argv, { stdio: 'inherit' }).status;
}

let files;
if (expect === 'red') {
  const base = arg('--base') ?? runnerEnv('BASE');
  if (!base) fail('no base: the runner gives WINGFOIL_RUNNER_BASE, or pass --base <rev>');
  files = changedTests(base, 'HEAD');
} else {
  const id = elementArg();
  if (!id) fail('no element: pass --element <id> or set WINGFOIL_ELEMENT');
  const range = redRange(id);
  files = range ? changedTests(range.base, range.head) : [];
}
files = files.filter((file) => existsSync(file));
const specs = files.filter((file) => SPEC.test(file));
const units = files.filter((file) => UNIT.test(file));
const other = files.filter((file) => !SPEC.test(file) && !UNIT.test(file));
if (other.length) console.log(`not run by this check: ${other.join(', ')}`);

if (expect === 'red') {
  if (!specs.length && !units.length) {
    verdict(
      [
        `red wrote no test file a tool runs (vitest test/**.test.ts(x), Playwright test/e2e/**.spec.*)${files.length ? `: ${files.join(', ')}` : ''}`,
      ],
      '',
    );
  }
  const problems = [];
  if (units.length && runTool(['test', '--silent', '--', ...units]) === 0)
    problems.push(`vitest passes on red's files (${units.join(', ')}): red expects them to fail`);
  if (specs.length && runTool(['run', '-s', 'test:e2e:chromium', '--', ...specs]) === 0)
    problems.push(`Playwright passes on red's specs (${specs.join(', ')}): red expects them to fail`);
  verdict(problems, `red's tests fail, as red expects (${[...units, ...specs].join(', ')})`);
}

const problems = [];
const unitStatus = runTool(['test', '--silent']);
if (unitStatus !== 0) problems.push(`npm test failed (exit ${unitStatus})`);
if (specs.length) {
  const specStatus = runTool(['run', '-s', 'test:e2e:chromium', '--', ...specs]);
  if (specStatus !== 0) problems.push(`red's specs fail on Chromium (exit ${specStatus}): ${specs.join(', ')}`);
}
verdict(
  problems,
  specs.length
    ? `npm test passes, and red's specs on Chromium (${specs.join(', ')})`
    : `npm test passes${files.length ? '' : ' (no red test file to run)'}`,
);
