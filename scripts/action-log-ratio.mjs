// The dogfooding ratio of TT-SEC-10 (REQ-SEC-10, RP-45, task-032 D32-9): of the approve and reject
// commits of a range of this repository's history (every commit of the range, including those of
// task branches merged with `--no-ff`; the `wf(<type>): approve|reject <id> …` subjects WingFoil
// writes, W-15), how many have their hash in the action log of a WingFoil
// UI state file (spec-006 §2 `actionLog`). Hand transitions are not counted (RP-13).
//
//   node scripts/action-log-ratio.mjs --state <state.json> <rev-range> [--json] [--repo <folder>]
//
// Prints `<logged>/<total> (<pct> %)` and the hashes not in the log; `--json` prints
// `{ range, total, logged, ratio, unlogged }` (`ratio` is `null` when the range has none).
// Exit 0; 2 on a usage error or an unreadable input. Git runs with an argument array, no shell.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** A decision commit: `wf(<type>): approve <id> …` or `wf(<type>): reject <id> …`. */
export const DECISION_SUBJECT = /^wf\([^)]+\): (?:approve|reject) \S/;

const USAGE = 'usage: node scripts/action-log-ratio.mjs --state <state.json> <rev-range> [--json] [--repo <folder>]';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parse(argv) {
  const options = { json: false, repo: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--state' || arg === '--repo') {
      const value = argv[(i += 1)];
      if (value === undefined) fail(USAGE);
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('-') || options.range !== undefined) fail(USAGE);
    else options.range = arg;
  }
  if (options.state === undefined || options.range === undefined) fail(USAGE);
  return options;
}

const options = parse(process.argv.slice(2));
let logged;
try {
  const state = JSON.parse(readFileSync(options.state, 'utf8'));
  logged = new Set((Array.isArray(state.actionLog) ? state.actionLog : []).map((entry) => entry?.sha));
} catch (error) {
  fail(`cannot read the state file: ${error.message}`);
}
let out;
try {
  // `--end-of-options`: the range is never read as an option.
  out = execFileSync('git', ['log', '--format=%H%x1f%s', '--end-of-options', options.range], {
    cwd: options.repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  fail(`git log failed: ${String(error.stderr ?? error.message).trim()}`);
}
const decisions = out
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\x1f'))
  .filter(([, subject = '']) => DECISION_SUBJECT.test(subject))
  .map(([sha]) => sha);
const unlogged = decisions.filter((sha) => !logged.has(sha));
const total = decisions.length;
const count = total - unlogged.length;
const ratio = total === 0 ? null : count / total;
if (options.json) {
  process.stdout.write(`${JSON.stringify({ range: options.range, total, logged: count, ratio, unlogged })}\n`);
} else {
  const pct = ratio === null ? 'no approve or reject commit' : `${(ratio * 100).toFixed(1)} %`;
  process.stdout.write(`${count}/${total} (${pct})\n`);
  for (const sha of unlogged) process.stdout.write(`not in the action log: ${sha}\n`);
}
