#!/usr/bin/env node
// The approver's command for a gate (directive runner): it checks again that the gate is what the
// notice says, then runs the project's own verb. Never run by an agent: it refuses an agent's shell.
// Usage: node scripts/runner/gate.mjs --line <line> <N-id> --reason "<ruling>" [--reject] [--config <file>]
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from './lib.mjs';
import { versionLine } from '../lib/version.mjs';

console.log(versionLine());

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name) => { const at = process.argv.indexOf(name); return at === -1 ? null : process.argv[at + 1]; };
const stop = (message) => { console.error(`gate: ${message}`); process.exit(2); };
const id = process.argv.slice(2).find((a) => /^N-\d+$/.test(a));
const reason = arg('--reason');
const lineName = arg('--line');
if (!id || !reason?.trim() || !lineName) stop('usage: gate.mjs --line <line> <N-id> --reason "<ruling>" [--reject]');
const marker = lib.AGENT_MARKERS.find((name) => process.env[name]);
if (marker) stop(`${marker} is set: a gate is ruled from the approver's own terminal, never from an agent`);

const config = lib.readConfig(arg('--config') ?? join(REPO, 'config/runner.yaml'));
let line;
try { line = lib.lineConfig(config, lineName); } catch (error) { stop(error.message); }
const set = lib.settings(config);
const co = line.checkout;
// The checkout is written by agents, and this command runs as the approver: git runs without hooks
// or fsmonitor (also inside the CLI), the CLI is the runner home's copy, and a checkout whose git
// config would run a program is refused (H1).
const HOME = lib.expandHome(config.paths?.runner) ?? REPO;
Object.assign(process.env, lib.safeGitEnv(process.env));
const cli = lib.trustedCli(set.cli, HOME);
const program = cli[0] === 'node' ? cli[1] : cli[0];
if (program.startsWith('/') && !existsSync(program)) stop(`the WingFoil CLI is not installed in the runner home: ${program}`);
const git = (...args) => spawnSync('git', ['-C', co, ...args], { encoding: 'utf8' }).stdout.trim();
// Run from the runner home, the approver's own checkout: never a line's, matching the trusted ref, its
// git config running nothing (N3, N4, E); the checkout's git config runs nothing either (N1).
const homeProblems = lib.homeTrustProblems({ config, home: HOME, repo: REPO, git: (args) => spawnSync('git', ['-C', HOME, ...args], { encoding: 'utf8' }) });
if (homeProblems.length) stop(homeProblems.join('\ngate: '));
const checkoutUnsafe = lib.unsafeGitConfig(spawnSync('git', ['-C', co, ...lib.GIT_CONFIG_LIST], { encoding: 'utf8' }).stdout);
if (checkoutUnsafe.length) stop(`${co}: its git config runs programs, so nothing is ruled from here: ${checkoutUnsafe.join(', ')}`);
const project = JSON.parse(readFileSync(join(HOME, 'package.json'), 'utf8')).name;
const noticesPath = join(co, set.notices);
{ // no symbolic link on the way from the checkout to the notices (L2)
  let at = co;
  for (const part of set.notices.split('/')) { at = join(at, part); if (lstatSync(at).isSymbolicLink()) stop(`${at} is a symbolic link`); }
}
const ledger = (entry) => lib.appendLedger(project, { line: lineName, ...entry });

const entry = lib.notices(readFileSync(noticesPath, 'utf8')).find((n) => n.open && n.id === id);
if (!entry) stop(`${id} is not an open notice of line ${lineName}`);
const kind = lib.noticeKind(entry.key);
if (!['gate', 'decision'].includes(kind)) stop(`${id} is a ${kind} notice, not a gate or a decision`);
// The line's own lock, taken atomically: no run of the line starts while the gate is ruled (L1).
const lockFile = join(co, '.git', 'dfd-runner.lock');
try { writeFileSync(lockFile, JSON.stringify({ pid: process.pid, started: new Date().toISOString(), gate: id }), { flag: 'wx' }); } catch { stop(`a run of line ${lineName} is in progress: try again when it ends`); }
process.on('exit', () => rmSync(lockFile, { force: true }));
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== line.branch) stop(`${co} is not on ${line.branch}`);
const dirty = git('status', '--porcelain');
if (dirty) stop(`${co} has uncommitted files:\n${dirty}`);
const reject = process.argv.includes('--reject');

if (kind === 'decision') {
  // A decision a step asked for: the ruling closes the notice in a commit the step's next run reads.
  const run = entry.key.slice(`decision-${lineName}-`.length);
  const question = /\*\*Reason:\*\* decision \(run [^)]*\): (.*)/.exec(entry.text)?.[1]?.trim() ?? run;
  const file = noticesPath;
  const how = `${reject ? 'rejected' : 'approved'} by the approver: ${reason.trim()}`;
  const closed = lib.closeNotice(readFileSync(file, 'utf8'), entry.key, { at: new Date().toISOString(), how });
  if (!closed.closed) stop(`${id} could not be closed`);
  writeFileSync(file, closed.text);
  const approver = git('var', 'GIT_AUTHOR_IDENT').replace(/\s*<.*$/, '') || 'approver'; // the commit's own author
  const message = lib.decisionMessage({ id, run, question, ruling: reject ? 'reject' : 'approve', reason: reason.trim(), approver });
  const done = spawnSync('git', ['-C', co, 'commit', '-q', '-m', message, '--', set.notices], { encoding: 'utf8' });
  if (done.status !== 0) stop(`git commit failed: ${done.stderr.trim()}`);
  ledger({ kind: 'decision', notice: id, run, question, ruling: reject ? 'reject' : 'approve', reason: reason.trim() });
  console.log(`${id} ${reject ? 'rejected' : 'approved'}: the step resumes on the runner's next run`);
  process.exit(0);
}

const status = spawnSync(cli[0], [...cli.slice(1), 'workflow', 'status', '--format', 'json'], { cwd: co, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const step = lib.frontier(JSON.parse(status.stdout)).steps.find((s) => lib.gateKey(lineName, s) === entry.key && lib.waitsForApprover(s));
if (!step) stop(`${id} no longer waits: ${entry.key} is not on the frontier`);

for (const argv of lib.gateArgv(step, reason, { reject })) {
  const run = spawnSync(cli[0], [...cli.slice(1), ...argv], { cwd: co, stdio: 'inherit' });
  if (run.status !== 0) stop(`wingfoil ${argv.slice(0, 2).join(' ')} failed (exit ${run.status})`);
}
ledger({ kind: 'gate', notice: id, instance: step.instance, step: step.key, element: lib.stepElement(step).ref, ruling: reject ? 'reject' : 'approve', reason: reason.trim() });
console.log(`${id} ruled: the runner closes the notice on its next run`);
