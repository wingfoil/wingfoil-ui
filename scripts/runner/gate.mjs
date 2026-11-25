#!/usr/bin/env node
// The approver's command for a gate (directive runner): it checks again that the gate is what the
// notice says, then runs the project's own verb. Never run by an agent: it refuses an agent's shell.
// Usage: node scripts/runner/gate.mjs --line <line> <N-id> --reason "<ruling>" [--reject] [--unsigned <seal>] [--config <file>]
// An element: --element <id> --reason "<ruling>" [--reject | --amend [--diff <sha>]] [--expect <status>]
// Container mode (its caller only, with WINGFOIL_RUNNER_CONTAINER=1): --container, and --step <instance>/<step key>
// in place of the N-id for a gate.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import * as lib from './lib.mjs';
import { versionLine } from '../lib/version.mjs';

console.log(versionLine());

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name) => { const at = process.argv.indexOf(name); return at === -1 ? null : process.argv[at + 1]; };
const stop = (message) => { console.error(`gate: ${message}`); process.exit(2); };
const id = process.argv.slice(2).find((a) => /^N-\d+$/.test(a));
const element = arg('--element');
const CONTAINER = process.argv.includes('--container');
const stepRef = arg('--step');
const reason = arg('--reason');
const lineName = arg('--line');
if ([id, element, stepRef].filter(Boolean).length !== 1 || !reason?.trim() || !lineName) {
  stop('usage: gate.mjs --line <line> <N-id> --reason "<ruling>" [--reject]\n       gate.mjs --line <line> --element <id> --reason "<ruling>" [--reject | --amend] [--expect <status>]\n       gate.mjs --container --line <line> --step <instance>/<step key> --reason "<ruling>" [--reject]');
}
if (element && !lib.safeId(element)) stop(`${element} is not a plain element id`);
if (process.argv.includes('--amend') && !element) stop('--amend is a verb on an element: use --element <id>, never a notice');
const marker = lib.AGENT_MARKERS.find((name) => process.env[name]);
if (marker) stop(`${marker} is set: a gate is ruled from the approver's own terminal, never from an agent`);

const config = lib.readConfig(arg('--config') ?? join(REPO, 'config/runner.yaml'));
// A state folder that would give a new key and an empty ledger is refused (1.2.3, F-5).
const stateProblems = lib.stateFolderProblems(process.env);
if (stateProblems.length) stop(stateProblems.join('\ngate: '));
// Container mode is its caller's, never a configuration's (lib.containerProblems, 1.2.0).
const containerProblems = lib.containerProblems({ flag: CONTAINER, env: process.env, config });
if (containerProblems.length) stop(containerProblems.join('\ngate: '));
if (stepRef && !CONTAINER) stop('--step rules a gate in container mode only: outside it, a gate is ruled by its notice');
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
const program = lib.cliProgram(cli);
if (program.startsWith('/') && !existsSync(program)) stop(`the WingFoil CLI is not installed in the runner home: ${program}`);
const git = (...args) => spawnSync('git', ['-C', co, ...args], { encoding: 'utf8' }).stdout.trim();
// Run from the runner home, a clone used by the runner only: never a line's, matching the trusted ref, its
// git config running nothing (N3, N4, E); the checkout's git config runs nothing either (N1).
// The line's own lock comes first, and the checks after it (1.2.1, L-6): no run of the line
// starts, and none rewrites the checkout, between the judgement and the use.
// A lock file whose process is gone, or which is older than the limit, holds nothing (1.2.3, F-10).
const lockFile = join(co, '.git', lib.markName('.lock'));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const lockLimits = { staleMinutes: config.limits?.lock_stale_minutes ?? 120, alive };
if (lib.liveLock(join(co, '.git', lib.markName('.lock', true)), lockLimits)) stop(`a run of line ${lineName} by an older runner holds ${lib.markName('.lock', true)}: try again when it ends`);
if (existsSync(lockFile) && !lib.liveLock(lockFile, lockLimits)) rmSync(lockFile, { force: true });
try { writeFileSync(lockFile, JSON.stringify({ pid: process.pid, started: new Date().toISOString(), gate: id ?? element ?? stepRef }), { flag: 'wx' }); } catch { stop(`a run of line ${lineName} is in progress: try again when it ends`); }
process.on('exit', () => rmSync(lockFile, { force: true }));
// In container mode only the home's drift from the trusted ref is the caller's (1.2.2, C-2), as in run.mjs.
const homeProblems = lib.homeTrustProblems({ config, home: HOME, repo: REPO, git: (args) => spawnSync('git', ['-C', HOME, ...args], { encoding: 'utf8' }), drift: !CONTAINER });
if (homeProblems.length) stop(homeProblems.join('\ngate: '));
/** The checkout's git config, judged here and again right before each command that uses it (L-6). */
function judgeCheckout() {
  const checkoutConfig = spawnSync('git', ['-C', co, ...lib.GIT_CONFIG_LIST], { encoding: 'utf8' });
  // A config git cannot read is not judged safe (1.1.19, L-3, as run.mjs since 1.1.14).
  if (checkoutConfig.status !== 0) stop(`${co}: git cannot read its config, so nothing is ruled from here: ${(checkoutConfig.stderr || '').trim().split('\n')[0]}`);
  const checkoutUnsafe = lib.unsafeGitConfig(checkoutConfig.stdout);
  if (checkoutUnsafe.length) stop(`${co}: its git config runs programs, so nothing is ruled from here: ${checkoutUnsafe.join(', ')}`);
}
judgeCheckout();
/** The project's CLI in the checkout, its config judged again first. */
const runCli = (args, options = {}) => { judgeCheckout(); return spawnSync(cli[0], [...cli.slice(1), ...args], { cwd: co, ...options }); };
const head = () => git('rev-parse', 'HEAD') || null;
const project = JSON.parse(readFileSync(join(HOME, 'package.json'), 'utf8')).name;
const noticesPath = join(co, set.notices);
{ // no symbolic link on the way from the checkout to the notices (L2)
  let at = co;
  for (const part of set.notices.split('/')) { at = join(at, part); if (lstatSync(at).isSymbolicLink()) stop(`${at} is a symbolic link`); }
}
// Every container ruling says so inside its signature, and governance never reads one (1.2.2, C-1).
const ledger = (entry) => lib.appendLedger(project, { line: lineName, ...entry, container: CONTAINER || undefined });

const noticesText = readFileSync(noticesPath, 'utf8');
// An N-id names one notice only, and a ruling binds to the notice the runner opened and signed
// in the ledger, never to text an agent wrote in the checkout (1.2.3, F-1).
if (id && lib.duplicateNoticeIds(noticesText).includes(id)) stop(`${id} is carried by more than one notice in ${set.notices}: nothing is ruled. The runner gives every number once, so one of them was written by someone else; look with: git -C ${co} log -p -- ${set.notices}`);
const entry = id ? lib.notices(noticesText).find((n) => n.open && n.id === id) : null;
if (id && !entry) stop(`${id} is not an open notice of line ${lineName}`);
const kind = entry ? lib.noticeKind(entry.key) : stepRef ? 'gate' : 'element';
if (!['gate', 'decision', 'element'].includes(kind)) stop(`${id} is a ${kind} notice, not a gate or a decision`);
const ruledRun = kind === 'decision' ? entry.key.slice(`decision-${lineName}-`.length) : null;
const ruledQuestion = kind === 'decision' ? (/\*\*Reason:\*\* decision \(run [^)]*\): (.*)/.exec(entry.text)?.[1]?.trim() ?? ruledRun) : null;
let unsigned = false;
if (entry) {
  if (kind === 'decision' && !entry.key.startsWith(`decision-${lineName}-`)) stop(`${id} is a decision of another line (${entry.key})`);
  const ruledElement = /\*\*Element:\*\* (.*)/.exec(entry.text)?.[1]?.trim() ?? '?';
  console.log(lib.plainText([`${id} is:`, `  key       ${entry.key}`, `  element   ${ruledElement}`, ...(ruledRun ? [`  run       ${ruledRun}`, `  question  ${ruledQuestion}`] : [])].join('\n')));
  const signedLedger = lib.ledgerForMode(lib.readLedger(project), CONTAINER);
  if (signedLedger.some((e) => e.kind === 'notice-closed' && e.key === entry.key && e.notice === id)) stop(`${id} was closed by the runner: a copy of it under Open is not the runner's, and nothing is ruled`);
  const problem = lib.noticeTrust(lib.openedNotices(signedLedger), entry);
  if (problem) {
    // A notice from a runner older than 1.2.3 has no signed entry: the approver who has read it above
    // and finds it is the one the runner printed rules it with its seal, as --amend with its diff.
    const seal = lib.noticeSeal(entry.text).slice(0, 16);
    // Only a notice older than the first one the runner signed on this line may be ruled unsigned
    // (1.2.6, G-2): any later one is not the runner's, and its seal is not offered.
    if (!lib.legacyNotice(signedLedger, lineName, id)) stop(`${id}: ${problem}. It is newer than the first notice the runner signed on line ${lineName}, so the runner did not open it: nothing is ruled. Read it, remove it from the notices if it is not the runner's, and run the line again`);
    if (arg('--unsigned') !== seal) stop(`${id}: ${problem}. If it was opened by a runner older than 1.2.3 and says what the runner printed, run the same command again with --unsigned ${seal}; otherwise close it (node scripts/runner/run.mjs --line ${lineName} --close ${id} --how "not the runner's") and let the runner open it again`);
    unsigned = true;
  }
  if (kind === 'decision' && signedLedger.some((e) => ['decision', 'close'].includes(e.kind) && e.line === lineName && e.notice === id)) stop(`${id} was ruled or closed already: nothing is ruled twice`);
}
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== line.branch) stop(`${co} is not on ${line.branch}`);
const amend = process.argv.includes('--amend');
const reject = process.argv.includes('--reject');
// An amendment commits the element's own edited file, and nothing else may be uncommitted. The
// file is one tracked path, modified and not staged, and the approver rules on the diff shown
// (1.2.1, L-2): the first run prints it with its hash, the run with --diff <hash> amends.
// Not trimmed: the first column of the first line is a status letter or a space.
const porcelain = spawnSync('git', ['-C', co, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
// The element's file is where Memory keeps it, read from the runner home's memory.yaml (1.2.3, F-4).
let memoryYaml = {};
try { memoryYaml = yaml.load(readFileSync(join(HOME, '.wingfoil/memory.yaml'), 'utf8')) ?? {}; } catch { memoryYaml = {}; }
// A path pattern may span folders (1.2.6, G-3): the element's file is the only tracked one that matches.
const tracked = spawnSync('git', ['-C', co, 'ls-files', '-z'], { encoding: 'utf8' }).stdout.split('\0').filter(Boolean);
const memoryFile = (l, of) => l.startsWith(' M ') && !l.includes(' -> ') && !l.slice(3).startsWith('"') && lib.ownMemoryFile(memoryYaml, tracked, of) === l.slice(3);
const amended = amend ? porcelain.filter((l) => memoryFile(l, element)) : [];
if (amend && amended.length !== 1) stop(`--amend needs exactly one modified, unstaged Memory file of ${element} in ${co}; found ${amended.length}`);
// A decision may be ruled while the element it is about has its own file modified (1.2.2): the ruling
// commits the notices only, and the step it resumes is told to commit that file.
const decided = kind === 'decision' ? lib.runElement(ruledRun) : null;
const own = (l) => decided && memoryFile(l, decided) && l.slice(3) !== set.notices;
const dirty = porcelain.filter((l) => !amended.includes(l) && !own(l));
if (dirty.length) stop(lib.dirtyRefusal(co, dirty, { home: HOME, line: lineName }));
const kept = porcelain.filter(own);
if (kept.length) console.log(`${kept[0].slice(3)} stays uncommitted: the ruling commits ${set.notices} only, and the step it resumes commits that file`);
if (amend) {
  const file = amended[0].slice(3);
  // As text whatever the attributes say, without colour, and printed without control characters
  // (1.2.3, F-2); the hash covers the diff and the file's own content.
  const diff = spawnSync('git', ['-C', co, ...lib.SAFE_GIT_FLAGS.split(' ').filter(Boolean), 'diff', '--text', '--no-color', '--no-ext-diff', '--no-textconv', '--', file], { encoding: 'utf8' }).stdout;
  const blob = spawnSync('git', ['-C', co, ...lib.SAFE_GIT_FLAGS.split(' ').filter(Boolean), 'hash-object', '--no-filters', '--', file], { encoding: 'utf8' }).stdout.trim();
  const hash = createHash('sha256').update(`${diff}\0${blob}`).digest('hex').slice(0, 16);
  if (arg('--diff') !== hash) {
    const shown = lib.plainText(diff);
    console.log(`${file}, the change --amend would commit:\n\n${shown}`);
    if (shown !== diff.replace(/\r\n?/g, '\n')) console.log(`(${[...diff].length - [...shown].length} control character(s) removed from the display: read the file with cat -v ${join(co, file)})`);
    stop(`read the diff above; to amend it, run the same command again with --diff ${hash}`);
  }
}

if (kind === 'element') {
  // The approver's own verb on an element (approve, reject, amend), run with the home's CLI in the
  // line's checkout after the same checks as a gate: never the checkout's own node_modules (1.1.17).
  if (amend && reject) stop('--amend and --reject are two different verbs');
  const expect = arg('--expect');
  if (expect) {
    // A convenience guard, read from the checkout's history (I-7): the CLI still checks the transition.
    const history = runCli(['memory', 'history', element, '--format', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let status;
    try { status = JSON.parse(history.stdout.slice(history.stdout.indexOf('{'))).entries.filter((e) => e.to).at(-1)?.to ?? null; } catch { status = null; }
    if (status !== expect) stop(`${element} is ${status ?? 'unknown'}, not ${expect}: nothing done`);
  }
  const verb = amend ? 'amend' : reject ? 'reject' : 'approve';
  const run = runCli(['memory', verb, element, '--reason', reason.trim()], { stdio: 'inherit' });
  if (run.status !== 0) stop(`wingfoil memory ${verb} ${element} failed (exit ${run.status})`);
  ledger({ kind: 'element', element, verb, reason: reason.trim(), commit: head() });
  console.log(`${element}: memory ${verb} done with the runner home's CLI`);
  process.exit(0);
}

if (kind === 'decision') {
  // A decision a step asked for: the ruling closes the notice in a commit the step's next run reads.
  const run = ruledRun;
  const question = ruledQuestion;
  const file = noticesPath;
  const how = `${reject ? 'rejected' : 'approved'} by the approver: ${reason.trim()}`;
  const closed = lib.closeNotice(readFileSync(file, 'utf8'), entry.key, { at: new Date().toISOString(), how });
  if (!closed.closed) stop(`${id} could not be closed`);
  writeFileSync(file, closed.text);
  const approver = git('var', 'GIT_AUTHOR_IDENT').replace(/\s*<.*$/, '') || 'approver'; // the commit's own author
  const message = lib.decisionMessage({ id, run, question, ruling: reject ? 'reject' : 'approve', reason: reason.trim(), approver });
  judgeCheckout();
  const done = spawnSync('git', ['-C', co, 'commit', '-q', '-m', message, '--', set.notices], { encoding: 'utf8' });
  if (done.status !== 0) stop(`git commit failed: ${done.stderr.trim()}`);
  ledger({ kind: 'decision', notice: id, run, question, ruling: reject ? 'reject' : 'approve', reason: reason.trim(), commit: head(), unsigned: unsigned || undefined });
  console.log(`${id} ${reject ? 'rejected' : 'approved'}: the step resumes on the runner's next run`);
  process.exit(0);
}

const status = runCli(['workflow', 'status', '--format', 'json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const wanted = entry ? entry.key : `gate-${lineName}-${stepRef.replace('/', '-')}`;
const step = lib.frontier(JSON.parse(status.stdout)).steps.find((s) => lib.gateKey(lineName, s) === wanted && lib.waitsForApprover(s));
if (!step) stop(`${id ?? stepRef} no longer waits: ${wanted} is not on the frontier`);

for (const argv of lib.gateArgv(step, reason, { reject })) {
  const run = runCli(argv, { stdio: 'inherit' });
  if (run.status !== 0) stop(`wingfoil ${argv.slice(0, 2).join(' ')} failed (exit ${run.status})`);
}
ledger({ kind: 'gate', notice: id ?? null, unsigned: unsigned || undefined, container: CONTAINER || undefined, instance: step.instance, step: step.key, element: lib.stepElement(step).ref, ruling: reject ? 'reject' : 'approve', reason: reason.trim(), commit: head() });
console.log(`${id ?? stepRef} ruled: the runner closes the notice on its next run`);
