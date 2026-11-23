#!/usr/bin/env node
// The runner of one line (directive runner; docs/bootstrap.md § 7). One step per run:
//   lock → fetch → notices → weekly mains → workflow status → gates → halts and budget → adapter
//   → worktree → distinct_from → pre checks → headless launch → post checks → finalize → run
//   record → push → unlock.
// The same file runs in every DFD project: the project is read from package.json and dna.yaml.
//
// Usage: node scripts/runner/run.mjs --line <line> [--dry-run] [--config <file>] [--resume] [--until-idle [--max-steps <n>]]
//        node scripts/runner/run.mjs --line <line> --close <N-id> --how "<what solved it>"
//        node scripts/runner/run.mjs --line <line> --renumber <element id>   a number another branch took
//        node scripts/runner/run.mjs --status
//        node scripts/runner/run.mjs --line <line> --doctor   what the project still lacks to run
//          [--red-amend <task id> --files <file>[,<file>…] --because <decision id> [--note "<text>"]]
//   --dry-run  read the next step and print what the run would do; launch and write nothing
//   --config   another runner configuration (default: config/runner.yaml)
//   --resume   close the line's halt notices (two review rejects, errors in a row, a wrong
//              model): the approver's command, after ruling the cause; never the runner's
//   --red-amend  the approver's order: launch, now, a red amendment of the task's named test
//              files, which contradict the accepted decision --because names (directive runner);
//              --note, optional, is quoted verbatim in the amendment prompt as the approver's instruction
// Exit 0 when the run did something; 10 when it only waits; 11 when the line is halted; 1 on an
// unexpected failure; 3 on a bad command line.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync, mkdtempSync } from 'node:fs';
import { cpus, homedir, loadavg, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import * as lib from './lib.mjs';
import { versionLine, VERSION_LINE } from '../lib/version.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Where the approver's commands run: always the governed runner, never a line's clone of it. */
let HOME_REPO = REPO;

function arg(name, fallback = null) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const DRY = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const UNTIL_IDLE = process.argv.includes('--until-idle');
const CLOSE = arg('--close');
const CHECK_GIT = process.argv.includes('--check-git');
const CONTAINER = process.argv.includes('--container');
const RECORD_DIR = arg('--record-dir');
const READ = process.argv.includes('--read') ? process.argv.slice(process.argv.indexOf('--read') + 1) : null;
const RENUMBER = arg('--renumber');
const STATUS = process.argv.includes('--status');
const DOCTOR = process.argv.includes('--doctor');
const AMEND_TASK = arg('--red-amend');
const AMEND_ORDER = AMEND_TASK
  ? { decision: arg('--because'), files: String(arg('--files') ?? '').split(',').map((f) => f.trim()).filter(Boolean), by: 'the approver', note: arg('--note') ?? null }
  : null;

function sh(command, args, options = {}) {
  const run = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  return { status: run.status, signal: run.signal, stdout: run.stdout ?? '', stderr: run.stderr ?? '', error: run.error };
}
function git(cwd, args, env) {
  const run = sh('git', ['-C', cwd, ...args], env ? { env } : {});
  if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr.trim()}`);
  return run.stdout.trim();
}
/** `npx wingfoil … --format json` in a checkout: { status, stdout, stderr, value }. */
let CLI = ['npx', '--no-install', 'wingfoil'];
/** The project's pinned WingFoil, plain: { status, stdout, stderr }. */
/** The CLI the runner itself runs: the runner home's copy, never the checkout's (lib.trustedCli). */
let RUNNER_CLI = CLI;
const wf = (cwd, args) => sh(RUNNER_CLI[0], [...RUNNER_CLI.slice(1), ...args], { cwd });
function wingfoil(cwd, args, env) {
  if (lib.writesWithCli(args)) guardPath(cwd); // the CLI commits: judged right before (C)
  const run = sh(RUNNER_CLI[0], [...RUNNER_CLI.slice(1), ...args, '--format', 'json'], { cwd, ...(env ? { env } : {}) });
  let value = null;
  try { value = run.stdout.trim() ? JSON.parse(run.stdout) : null; } catch { /* not JSON */ }
  return { ...run, value };
}
function firstLine(run) {
  const lines = (text) => String(text ?? '').trim().split('\n').filter((l) => l && !VERSION_LINE.test(l));
  return lines(run.stderr)[0] ?? lines(run.stdout)[0] ?? '';
}
const now = () => new Date().toISOString();
// The versions come first in whatever a run prints, once; a run that prints nothing stays silent.
let versionShown = false;
const showVersion = () => { if (!versionShown) { versionShown = true; console.log(versionLine()); } };
// The line's name is coloured in a terminal only: a journal or a log file stays plain (1.2.0).
const COLOUR = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const print = (ctx, message) => { showVersion(); console.log(`${lib.logStamp()} [${ctx.project} ${lib.lineLabel(ctx.line.name, COLOUR)}] ${message}`); };
/** A line that says the run did something: what the run was waiting on is printed before it. */
const log = (ctx, message) => {
  ctx.acted = true;
  for (const line of (ctx.waiting ?? []).splice(0)) if (!ctx.shown?.has(line)) print(ctx, line);
  print(ctx, message);
};
/** A line that says the run only waits: printed at the end of the run, unless it repeats the last one. */
const waitLine = (ctx, message) => { (ctx.waiting ??= []).push(message); (ctx.waits ??= []).push(message); };

/** At the end of a run: what it waited on, once; a run that acted starts the count again. */
function finishOutput(ctx) {
  const lines = ctx.waiting ?? [];
  const file = plainFile(join(ctx.line.checkout, '.git', 'dfd-runner.waiting'), ctx.line.checkout);
  if (DRY) { lines.forEach((line) => print(ctx, line)); return; }
  if (ctx.acted || lines.length === 0) {
    lines.filter((line) => !ctx.shown?.has(line)).forEach((line) => print(ctx, line));
    // The wait this run has just shown is not shown again by the next one.
    if (ctx.waits?.length) writeFileSync(file, JSON.stringify(lib.repeatedWait(null, ctx.waits, Date.now(), 0).state));
    else rmSync(file, { force: true });
    return;
  }
  let previous = null;
  try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch { /* the first run that waits */ }
  const everyMs = (ctx.config.limits?.log_repeat_minutes ?? 60) * 60000;
  const { print: out, state } = lib.repeatedWait(previous, lines, Date.now(), everyMs);
  out.forEach((line) => print(ctx, line));
  writeFileSync(file, JSON.stringify(state));
}

/**
 * The environment of what the runner runs outside the sandbox on code an agent wrote (npm ci, the
 * checks, the live checks, the scripted integration's tests): no credential to publish with, git
 * without hooks (lib.agentEnv, lib.safeGitEnv).
 */
const toolEnv = (extra = {}) => lib.safeGitEnv(lib.agentEnv(process.env, extra));

function identityEnv(identity, extra = {}) {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email,
    GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email,
    ...extra,
  };
}

// ---- commits and notices ------------------------------------------------------------------

/** Commit these paths only, as the given identity (the line's agent by default). */
function commit(ctx, paths, subject, identity = ctx.lineIdentity) {
  guardCheckout(ctx); // right before every runner commit: nothing since the last check may have planted a filter (C)
  const env = identityEnv(identity);
  git(ctx.line.checkout, ['add', '--', ...paths], env);
  const staged = sh('git', ['-C', ctx.line.checkout, 'diff', '--cached', '--quiet', '--', ...paths]).status !== 0;
  if (!staged) return false;
  git(ctx.line.checkout, ['commit', '-q', '-m', `${subject}\n\nWritten by the runner (directive runner).`, '--', ...paths], env);
  return true;
}

/** The approver's rulings (lib.ledgerFile, outside any repository, signed): written by gate.mjs and --close. */
let PROJECT = 'project';
const readLedger = () => lib.readLedger(PROJECT);
const appendLedger = (entry) => lib.appendLedger(PROJECT, entry);

/**
 * A file the runner writes in the checkout: inside it, and with no symbolic link an agent could have
 * planted on its way, the file itself or any folder above it up to the checkout (L2).
 */
function plainFile(path, root) {
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${path} is outside ${root}: the runner does not write there`);
  let at = root;
  for (const part of rel.split(sep)) {
    at = join(at, part);
    if (existsSync(at) && lstatSync(at).isSymbolicLink()) throw new Error(`${at} is a symbolic link: the runner does not write through it`);
  }
  return path;
}

/** The checkout's git config would run a program: nothing more is done in it, not even a notice's commit (N2). */
class UnsafeCheckout extends Error {}
function guardPath(path) {
  const listed = sh('git', ['-C', path, ...lib.GIT_CONFIG_LIST]);
  // A config git cannot even read is not judged safe (1.1.14, L-b).
  if (listed.status !== 0) throw new UnsafeCheckout(`${path}: git cannot read its config, so the runner does nothing in it: ${firstLine(listed)}`);
  const unsafe = lib.unsafeGitConfig(listed.stdout);
  if (unsafe.length) throw new UnsafeCheckout(`${path}: its git config runs programs, so the runner does nothing in it: ${unsafe.slice(0, 3).join(', ')}. Inspect it with git -C ${path} config --list --show-scope --show-origin, remove what you did not set, then run the line again.`);
}
function guardCheckout(ctx, path = ctx.line.checkout) { guardPath(path); }
/** A task worktree: its git folder is the one the runner made, then its config is judged (1.1.13, B). */
function guardWorktree(ctx, path) {
  if (!path || !existsSync(path)) return;
  const problems = lib.worktreeProblems(path, ctx.line.checkout);
  if (problems.length) throw new UnsafeCheckout(`${path}: the worktree's git folder is not the one the runner made, so the runner does nothing in it: ${problems[0]}. Remove the worktree (git ${lib.SAFE_GIT_FLAGS} -C ${ctx.line.checkout} worktree remove --force ${path}) once you have looked at it.`);
  guardPath(path);
}
/** After code an agent wrote has run outside the sandbox (tests, checks, installs): judged again (1.1.13, C). */
function guardAfterAgentCode(ctx, worktree) {
  guardCheckout(ctx);
  if (worktree && worktree !== ctx.line.checkout) guardWorktree(ctx, worktree);
}

const noticesFile = (ctx) => plainFile(join(ctx.line.checkout, ctx.set.notices), ctx.line.checkout);
const noticesText = (ctx) => readFileSync(noticesFile(ctx), 'utf8');

/** The names that replace this machine's paths in a committed notice (notices.paths: relative). */
function noticePlaces(ctx) {
  const places = { [tmpdir()]: '<tmp>', [homedir()]: '<home>', [HOME_REPO]: '<runner home>' };
  for (const name of Object.keys(ctx.config.lines)) {
    const entry = ctx.config.lines[name];
    places[lib.expandHome(entry.worktrees)] = `<${name} worktrees>`;
    places[lib.expandHome(entry.checkout)] = `<${name} checkout>`;
  }
  return places;
}

function notice(ctx, { key, element, reason, command, packet = null }) {
  const committed = (text) => (ctx.set.noticePaths === 'relative' ? lib.publicText(text, noticePlaces(ctx)) : text);
  const { text, added } = lib.addNotice(noticesText(ctx), { key, at: now(), line: ctx.line.name, element, reason: committed(reason), command: committed(String(command).replaceAll('npx wingfoil', CLI.join(' '))), packet: packet ? { ...packet, evidence: committed(packet.evidence) } : null });
  const entry = lib.notices(added ? text : noticesText(ctx)).find((n) => n.open && n.key === key);
  if (!added) { waitLine(ctx, `${entry?.id ?? key} open: ${reason}`); return; }
  log(ctx, `notice ${entry?.id ?? key}: ${reason}`);
  (ctx.waits ??= []).push(`${entry?.id ?? key} open: ${reason}`); // what the next run would repeat
  const runnable = String(command).replaceAll('{id}', entry?.id ?? '').replaceAll('npx wingfoil', CLI.join(' '));
  print(ctx, `  → ${runnable}`);
  if (DRY) return;
  writeFileSync(noticesFile(ctx), text);
  commit(ctx, [ctx.set.notices], `docs(notices): ${lib.cite(ctx.line.name, element)} ${committed(reason)}`.slice(0, 100));
  if (ctx.config.notify) sh(ctx.config.notify, [`${ctx.project} · ${ctx.line.name}`, `${reason}\n${runnable}`]);
}

function closeNotices(ctx, keys, how) {
  if (keys.length === 0) return;
  let text = noticesText(ctx);
  const closed = [];
  const ids = [];
  const open = lib.notices(text);
  for (const key of keys) {
    const r = lib.closeNotice(text, key, { at: now(), how });
    if (r.closed) { text = r.text; closed.push(key); ids.push(open.find((n) => n.open && n.key === key)?.id ?? key); }
  }
  if (closed.length === 0) return;
  log(ctx, `closed ${ids.join(', ')}: ${how}`);
  if (DRY) return;
  writeFileSync(noticesFile(ctx), text);
  commit(ctx, [ctx.set.notices], `docs(notices): close ${closed.join(', ')}`.slice(0, 100));
}

// ---- lock ----------------------------------------------------------------------------------

function takeLock(ctx) {
  const file = plainFile(join(ctx.line.checkout, '.git', 'dfd-runner.lock'), ctx.line.checkout);
  if (!DRY) {
    // Taken atomically (wx): two runs started together cannot both hold it (L1).
    try { writeFileSync(file, JSON.stringify({ pid: process.pid, started: now() }), { flag: 'wx' }); return file; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  if (existsSync(file)) {
    let lock;
    try { lock = JSON.parse(readFileSync(file, 'utf8')); } catch { lock = { pid: 0, started: '1970-01-01T00:00:00.000Z' }; }
    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    if (lib.lockIsStale(lock, { staleMinutes: ctx.config.limits.lock_stale_minutes, alive })) {
      notice(ctx, { key: `lock-${ctx.line.name}-${lock.started}`, element: 'runner', reason: `stale lock (pid ${lock.pid}, since ${lock.started})`, command: `check that no runner runs (pgrep -af scripts/runner/run.mjs), then rm ${file}` });
    } else {
      log(ctx, `a run is in progress (pid ${lock.pid}); exiting`);
    }
    return null;
  }
  return DRY ? file : null;
}

/** The lock says the run is alive: refreshed before each step of --until-idle, so a long run is never stale (L1). */
function refreshLock(file) {
  if (DRY || !file) return;
  let lock = null;
  try { lock = JSON.parse(readFileSync(file, 'utf8')); } catch { /* unreadable: not ours */ }
  if (lock?.pid !== process.pid) throw new Error(`the lock ${file} is no longer this run's (pid ${lock?.pid ?? 'unknown'})`);
  writeFileSync(file, JSON.stringify({ pid: process.pid, started: now() }));
}

// ---- run records, Memory -------------------------------------------------------------------

/** The project's folders, read once from its dna.yaml and memory.yaml. */
const PATHS = { runs: 'docs/runs', memoryYaml: null, dna: {} };
const dna = () => PATHS.dna;

function walkMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const kind = lstatSync(path);
    if (kind.isSymbolicLink()) return []; // never followed: a link could loop or leave the checkout (L2)
    return kind.isDirectory() ? walkMd(path) : name.endsWith('.md') ? [path] : [];
  });
}

/** An element's Memory file in the checkout, wherever its type's path template puts it. */
function elementFile(checkout, type, id) {
  return walkMd(join(checkout, lib.memoryDir(PATHS.memoryYaml, type))).find((file) => basename(file) === `${id}.md`) ?? null;
}

/** Every release of the checkout: { id, file (relative), releaseLine, text }. */
function releaseFiles(checkout) {
  const root = lib.memoryDir(PATHS.memoryYaml, 'release');
  return walkMd(join(checkout, root)).map((file) => {
    const text = readFileSync(file, 'utf8');
    const declared = /^release-line:\s*"?([^"\n]+?)"?\s*$/m.exec(text)?.[1];
    return { id: basename(file, '.md'), file: relative(checkout, file), releaseLine: declared ?? basename(dirname(file)), text };
  });
}

function readRecords(checkout) {
  const dir = join(checkout, PATHS.runs);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => lib.parseRunRecords(readFileSync(join(dir, f), 'utf8'), join(dir, f)));
}

/** An element's status, read from its Memory file in the checkout, or null. */
function elementFields(checkout, type, id) {
  const file = elementFile(checkout, type, id);
  if (!file) return {};
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'));
  return fm ? yaml.load(fm[1]) ?? {} : {};
}

function elementStatus(checkout, element) {
  return elementFields(checkout, element.type, element.id).status ?? null;
}

/** The ids in a task's needs whose origin is that task. */
function needsTheTaskRaised(checkout, element) {
  const types = { adr: 'adr', dl: 'decision-log', bug: 'bug', task: 'task' };
  const originOf = (id) => elementFields(checkout, types[id.split('-')[0]] ?? 'task', id).origin ?? null;
  return lib.needsItRaised(elementFields(checkout, element.type, element.id).needs, element.id, originOf);
}

// ---- what settles an element ---------------------------------------------------------------

/**
 * The elements that settle `element`, in the line's checkout: those its `needs` lists and those
 * whose `origin` is it, among tasks, adrs, decision-logs and bugs. Each is { type, id, title,
 * status, decidedAt }; decidedAt (from `memory history`) only for one in a decided state.
 */
function settlingElements(line, memoryYaml, element) {
  const front = (file) => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'));
    return match ? (yaml.load(match[1]) ?? {}) : {};
  };
  const all = Object.keys(lib.DECIDED_STATES).flatMap((type) => {
    if (!memoryYaml?.types?.[type]?.path) return [];
    return walkMd(join(line.checkout, lib.memoryDir(memoryYaml, type))).map((file) => ({ type, id: basename(file, '.md'), fm: front(file) }));
  });
  const self = all.find((e) => e.type === element.type && e.id === element.id);
  const needs = new Set(Array.isArray(self?.fm.needs) ? self.fm.needs : []);
  return all.filter((e) => e !== self && (needs.has(e.id) || e.fm.origin === element.id)).map((e) => {
    const status = e.fm.status ?? null;
    let move = null;
    if ((lib.DECIDED_STATES[e.type] ?? []).includes(status)) {
      const history = wf(line.checkout, ['memory', 'history', e.id]);
      try { move = lib.reachedBy(JSON.parse(history.stdout.slice(history.stdout.indexOf('{'))).entries, status); } catch { move = null; }
    }
    return { type: e.type, id: e.id, title: e.fm.title ?? e.id, status, decidedAt: move?.timestamp ?? null, reason: move?.reason ?? null };
  });
}

// ---- worktree ------------------------------------------------------------------------------

/**
 * A worktree's dependencies are complete, or are installed again: an install killed halfway leaves
 * no project CLI, and `npx` would then run another WingFoil. The mark is the lockfile's hash.
 */
function ensureDependencies(ctx, path) {
  const lockfile = join(path, 'package-lock.json');
  const hash = existsSync(lockfile) ? createHash('sha256').update(readFileSync(lockfile)).digest('hex') : 'none';
  const mark = join(git(path, ['rev-parse', '--absolute-git-dir']), 'dfd-dependencies');
  const complete = existsSync(join(path, 'node_modules/.bin/wingfoil')) && existsSync(mark) && readFileSync(mark, 'utf8') === hash;
  if (complete) return;
  rmSync(mark, { force: true });
  const foreign = existsSync(lockfile) ? lib.foreignResolved(readFileSync(lockfile, 'utf8'), ctx.config.integration?.registries ?? ['registry.npmjs.org']) : [];
  if (foreign.length) throw new Error(`package-lock.json in ${path} resolves packages from ${foreign.join(', ')}, outside integration.registries`);
  // Install scripts are code from the lockfile's packages: they run only when the project says so.
  const [command, ...rest] = ctx.config.integration?.setup_command ?? ['npm', 'ci', '--silent', ...(ctx.config.integration?.install_scripts ? [] : ['--ignore-scripts'])];
  const ci = sh(command, rest, { cwd: path, env: toolEnv() });
  if (ci.status !== 0) throw new Error(`${command} ${rest.join(' ')} in ${path}: ${firstLine(ci)}`);
  if (!existsSync(join(path, 'node_modules/.bin/wingfoil'))) throw new Error(`${path} has no node_modules/.bin/wingfoil after ${command} ${rest.join(' ')}`);
  writeFileSync(plainFile(mark, ctx.line.checkout), hash);
}

/** The live checks of a step, run by the runner outside any agent's sandbox, before the launch. */
function runLiveChecks(ctx, step, cwd) {
  return (ctx.config.live_checks ?? []).filter((check) => lib.stepMatches(check.steps, step)).map((check) => {
    const [command, ...rest] = check.run;
    const run = sh(command, rest, { cwd, env: toolEnv(check.env ?? {}), timeout: ctx.config.limits.step_timeout_minutes * 60000 });
    const tail = `${run.stdout}\n${run.stderr}`.trim().split('\n').slice(-20).join('\n');
    log(ctx, `live check ${check.name}: ${run.status === 0 ? 'passed' : `failed (exit ${run.status})`}`);
    return { name: check.name, ok: run.status === 0, status: run.status, tail };
  });
}

/** Where an agent's usage-limit hold is kept, per CLI. */
const limitFile = (ctx, command) => join(ctx.line.checkout, '.git', `dfd-runner.limit-${command}`);

function worktreeFor(ctx, element) {
  if (!(ctx.config.worktree_types ?? ['task', 'bug']).includes(element.type)) return { path: ctx.line.checkout, branch: ctx.line.branch };
  const path = join(ctx.line.worktrees, element.id);
  const prefix = ctx.line.name === 'trunk' ? ctx.line.agent : ctx.line.name;
  const branch = lib.taskBranch(ctx.set.taskBranch, { owner: prefix, id: element.id });
  if (DRY) return { path, branch };
  if (existsSync(path)) {
    guardWorktree(ctx, path); // before any git there: the agent may have repointed its git folder (B)
    // A run killed halfway leaves its edits here: they are kept aside, never inherited by the next step.
    if (sh('git', ['-C', path, 'status', '--porcelain']).stdout.trim()) {
      git(path, ['stash', 'push', '-u', '-q', '-m', `dfd-interrupted ${now()}`], identityEnv(ctx.lineIdentity));
      log(ctx, `${element.ref}: uncommitted work of an interrupted run kept in the stash of ${path}`);
    }
    ensureDependencies(ctx, path);
    guardAfterAgentCode(ctx, path);
    return { path, branch };
  }
  mkdirSync(ctx.line.worktrees, { recursive: true });
  const exists = sh('git', ['-C', ctx.line.checkout, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
  git(ctx.line.checkout, ['worktree', 'add', '-q', ...(exists ? [path, branch] : ['-b', branch, path, ctx.line.branch])]);
  ensureDependencies(ctx, path);
  guardAfterAgentCode(ctx, path);
  return { path, branch };
}

// ---- checks --------------------------------------------------------------------------------

/** The check bindings of the runner's home (.wingfoil/workflows/bindings.yaml): token → { run, severity }. */
function homeBindings() {
  const file = join(HOME_REPO, '.wingfoil/workflows/bindings.yaml');
  return existsSync(file) ? (yaml.load(readFileSync(file, 'utf8'))?.checks ?? {}) : {};
}

/** Red's bound post checks, from the step's own workflow and the home's bindings (a red amendment). */
function redChecks(line, workflow) {
  const file = ['custom', 'built-in'].map((kind) => join(line.checkout, '.wingfoil/workflows', kind, `${workflow}.yaml`)).find(existsSync);
  const red = (yaml.load(readFileSync(file, 'utf8')).phases ?? []).find((p) => p.name === 'red');
  return { checks: red?.checks?.post ?? [], bindings: homeBindings() };
}

/**
 * The bound checks of a step, run in the element's worktree (cwd) but from the line's checkout: a
 * check script is governance, so the copy a task branch carries (older, or changed by the task)
 * is never the one run (lib.checkArgv); lib.checkEnv tells it where Memory and the run records are.
 */
function runChecks(ctx, checks, cwd, element, launch = {}) {
  const done = [];
  const bindings = homeBindings();
  for (const check of checks) {
    // The binding and its script come from the runner's home, whatever the checkout's say (H2).
    const binding = bindings[check.token];
    const bound = binding?.run;
    if (!bound) { done.push({ token: check.token, ok: false, why: check.binding?.argv ? 'not bound in the runner home' : 'not bound' }); continue; }
    const env = toolEnv({ ...lib.checkEnv({ line: ctx.line, element, ...launch }), DFD_RUNS: PATHS.runs, DFD_CLI: JSON.stringify(CLI), ...(launch.role ? { DFD_ROLE: launch.role } : {}) });
    const argv = lib.checkArgv(bound, HOME_REPO, (p) => existsSync(p));
    const run = sh(argv[0], argv.slice(1), { cwd, env });
    const ok = run.status === 0 || binding.severity === 'warn';
    done.push({ token: check.token, ok, why: run.status === 0 ? '' : firstLine(run) });
  }
  return done;
}

// ---- the lines' releases, brought level on the trunk ------------------------------------------

/**
 * A line's release is created on the trunk (scope) and advances on its line only. Before every run
 * the trunk reads, from each line's branch, the state of each release of that line's release-line,
 * and brings the trunk's copy level with `memory submit` (the CLI: directive cli-only-writes), as
 * the line's agent. Its steps stay skipped on the trunk (lib.ownsStep); the trunk's delivery then
 * completes once the lines' releases are released. Needs the lines' branches: lineBranches.
 */
function catchUpLineReleases(ctx) {
  const { line, config } = ctx;
  const memory = yaml.load(readFileSync(join(line.checkout, '.wingfoil/memory.yaml'), 'utf8'));
  const sequence = memory.types?.release?.states?.sequence ?? [];
  for (const [name, entry] of Object.entries(config.lines)) {
    if (name === 'trunk') continue;
    const other = lib.lineConfig(config, name);
    const rl = lib.releaseLineOf(other);
    const ref = `refs/remotes/${name}/${entry.branch}`;
    if (sh('git', ['-C', line.checkout, 'rev-parse', '--verify', '--quiet', ref]).status !== 0) continue;
    for (const release of releaseFiles(line.checkout).filter((r) => r.releaseLine === rl)) {
      const { id } = release;
      const there = sh('git', ['-C', line.checkout, 'show', `${ref}:${release.file}`]);
      if (there.status !== 0) continue;
      const lineStatus = lib.statusOf(there.stdout);
      const trunkStatus = lib.statusOf(release.text);
      const steps = lib.catchUpSteps(sequence, trunkStatus, lineStatus);
      const key = `behind-${name}-${id}`;
      if (lib.isBehind(sequence, trunkStatus, lineStatus)) {
        // The catch-up only moves forward: a reject on the line (release-submit) leaves the trunk
        // ahead until the line passes it again; the approver is told, nothing is moved back.
        notice(ctx, { key, element: `release:${id}`, reason: `${id} is ${trunkStatus} on the trunk but ${lineStatus} on ${name} (a reject on the line); the trunk catches up again once the line passes ${trunkStatus}`, command: `nothing to do: the notice closes once ${name} brings ${id} back to ${trunkStatus}` });
        continue;
      }
      closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), key), `the trunk is level with ${name}`);
      if (steps === 0) continue;
      log(ctx, `${id}: ${trunkStatus} on the trunk, ${lineStatus} on ${name}: ${steps} submit(s)`);
      if (DRY) continue;
      const env = identityEnv({ name: other.agent, email: ctx.agentEmail(other.agent) });
      for (let i = 0; i < steps; i += 1) {
        const run = wingfoil(line.checkout, ['memory', 'submit', id], env);
        if (run.status !== 0) throw new Error(`memory submit ${id} (catching up with ${name}): ${firstLine(run)}`);
      }
    }
  }
}

// ---- a line opens its next release ------------------------------------------------------------

/**
 * On a line: when none of its releases is in development, the next planned one moves to
 * in-development (`memory submit`, the CLI: directive cli-only-writes), as the line's agent; the
 * trunk then catches up (catchUpLineReleases). A workflow phase cannot do it: a phase iterating
 * over line releases pulls every one of them, planned ones included, into delivery.
 */
function openNextLineRelease(ctx) {
  const { line } = ctx;
  const releases = releaseFiles(line.checkout).filter((r) => r.releaseLine === lib.releaseLineOf(line))
    .map((r) => ({ id: r.id, status: lib.statusOf(r.text), scope: lib.scopeOf(r.text) }));
  if (!releases.length) return;
  const id = lib.nextLineRelease(releases);
  if (!id) return;
  // The release before it closes its flow first: what its retrospective decides reaches the next one.
  const status = wingfoil(line.checkout, ['workflow', 'status'], identityEnv(ctx.lineIdentity));
  if (!status.value) throw new Error(`workflow status: ${firstLine(status)}`);
  const owner = ownership(ctx, status.value);
  const owned = lib.frontier(status.value).steps.filter((s) => lib.ownsStep(s, { line, lifeCycle: ctx.config.life_cycle ?? 'sw-life-cycle', releaseLineOfRelease: owner.releaseLineOfRelease, startedHere: owner.startedHere(s.instance) }));
  const open = lib.releaseFlowSteps(owned, releases);
  if (open.length) { waitLine(ctx, `${id} waits for ${open.join(', ')}`); return; }
  log(ctx, `opening ${id}: no release of ${lib.releaseLineOf(line)} is in development`);
  if (DRY) return;
  const run = wingfoil(line.checkout, ['memory', 'submit', id], identityEnv(ctx.lineIdentity));
  if (run.status !== 0) throw new Error(`memory submit ${id} (the line's next release): ${firstLine(run)}`);
}

// ---- which steps are this line's --------------------------------------------------------------

/**
 * Where each open instance was started, and the release-line of each release. On the trunk an
 * instance is its own when its start commit is on main's first-parent history (a plan merged from
 * a line by a convergence is not); on a line, when its start commit is not in main's history (the
 * plans inherited from the trunk are).
 */
function ownership(ctx, status) {
  const { line } = ctx;
  const starts = new Map((status.open ?? []).map((o) => [o.instance.id, o.instance.startCommit]));
  const workflows = new Map((status.open ?? []).map((o) => [o.instance.id, o.instance.workflow]));
  let firstParent = null;
  const mainRef = ['refs/remotes/origin/main', 'refs/heads/main'].find((r) => sh('git', ['-C', line.checkout, 'rev-parse', '--verify', '--quiet', r]).status === 0);
  const startedHere = (id) => {
    const commit = starts.get(id);
    if (!commit) return false;
    if (line.name === 'trunk') {
      firstParent ??= new Set(git(line.checkout, ['rev-list', '--first-parent', 'HEAD']).split('\n'));
      return firstParent.has(commit);
    }
    if (!mainRef) return true;
    return sh('git', ['-C', line.checkout, 'merge-base', '--is-ancestor', commit, mainRef]).status !== 0;
  };
  const lines = new Map(releaseFiles(line.checkout).map((r) => [r.id, r.releaseLine]));
  return { startedHere, releaseLineOfRelease: (id) => lines.get(id) ?? null, workflowOf: (id) => workflows.get(id) };
}

// ---- workflows the runner starts -----------------------------------------------------------

function startDue(ctx, week) {
  const { line, config } = ctx;
  const env = identityEnv(ctx.lineIdentity);
  for (const main of lib.weeklyMains(config, line)) {
    const plan = lib.weeklyPlanId(main, line.name, week);
    if (existsSync(join(line.checkout, lib.memoryDir(PATHS.memoryYaml, 'plan'), `${plan}.md`))) continue;
    log(ctx, `starting ${main} for ${week}`);
    if (DRY) continue;
    const run = wingfoil(line.checkout, ['workflow', 'start', main, '--title', `${main} — ${line.name} ${week}`, '--set', `phase=${line.name}-${week.toLowerCase()}`], env);
    if (run.status !== 0) throw new Error(`workflow start ${main}: ${firstLine(run)}`);
  }
  // On a line: `adapt` once for every release sync merged into it (docs/pack-deviations.md D5).
  const adapt = config.adapt_workflow ?? 'adapt';
  if (line.name !== 'trunk' && adapt) {
    const trailers = git(line.checkout, ['log', '--format=%(trailers:key=DFD-Sync,valueonly)', line.branch]);
    for (const id of lib.syncedReleases(trailers)) {
      if (existsSync(join(line.checkout, lib.memoryDir(PATHS.memoryYaml, 'plan'), `${adapt}-${id}-plan.md`))) continue;
      log(ctx, `starting ${adapt} for ${id}`);
      if (DRY) continue;
      const run = wingfoil(line.checkout, ['workflow', 'start', adapt, '--element', `release:${id}`, '--title', `${adapt} — ${line.name} ${id}`], env);
      if (run.status !== 0) throw new Error(`workflow start ${adapt} ${id}: ${firstLine(run)}`);
    }
  }
  // The life cycle, once, on the trunk; the lines inherit it.
  const cycle = config.life_cycle ?? 'sw-life-cycle';
  if (line.name === 'trunk' && cycle && config.life_cycle_start === true) {
    const plansDir = join(line.checkout, lib.memoryDir(PATHS.memoryYaml, 'plan'));
    const plans = existsSync(plansDir) ? readdirSync(plansDir) : [];
    if (!plans.some((f) => f.startsWith(`${cycle}-`))) {
      log(ctx, `starting ${cycle}`);
      if (!DRY) {
        const run = wingfoil(line.checkout, ['workflow', 'start', cycle], env);
        if (run.status !== 0) throw new Error(`workflow start ${cycle}: ${firstLine(run)}`);
      }
    }
  }
}

// ---- merges keep each branch's notices ---------------------------------------------------------

/**
 * Every line's runner writes its own docs/notices.md, so a merge between branches (sync, a
 * convergence) would conflict on it every time. In every checkout (and its worktrees, which share
 * .git/info) the runner sets the merge rule `docs/notices.md merge=ours` and the driver `ours`: a
 * merge keeps the receiving branch's notices. Machine-local, so a repository file is not needed;
 * a merge made by hand elsewhere keeps git's default.
 */
function ensureMergeRules(ctx) {
  const info = join(ctx.line.checkout, '.git', 'info');
  const file = plainFile(join(info, 'attributes'), ctx.line.checkout);
  const rule = `${ctx.set.notices} merge=ours`;
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!text.split('\n').includes(rule) && !DRY) {
    mkdirSync(info, { recursive: true });
    writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${rule}\n`);
  }
  if (sh('git', ['-C', ctx.line.checkout, 'config', '--get', 'merge.ours.driver']).stdout.trim() !== 'true' && !DRY) {
    git(ctx.line.checkout, ['config', 'merge.ours.driver', 'true']);
  }
}

// ---- the trunk sees every line's ids -------------------------------------------------------

/**
 * The trunk writes scope, so its ids must not collide with the lines' (docs/bootstrap.md § 5).
 * WingFoil counts ids on every local and remote-tracking branch, and WIP limits on the same ones.
 * So for a step that needs them (config line_branches: one that allocates ids, or one of sync,
 * branch, converge, which work on the lines) each line's checkout on this machine is fetched
 * into the trunk's clone as a remote, and the lines' new ids are seen even while nothing is pushed;
 * for every other step those branches are removed, so a line's tasks in progress never block the
 * trunk's. The trunk's clone is single-branch on origin (main only), so the lines' branches pushed
 * to origin never reach it by a fetch of origin (directive agent-branches).
 */
function lineBranches(ctx, wanted) {
  for (const [name, entry] of Object.entries(ctx.config.lines)) {
    if (name === ctx.line.name) continue;
    const other = lib.lineConfig(ctx.config, name);
    const ref = `refs/remotes/${name}/${entry.branch}`;
    if (!wanted) {
      if (sh('git', ['-C', ctx.line.checkout, 'rev-parse', '--verify', '--quiet', ref]).status === 0) git(ctx.line.checkout, ['update-ref', '-d', ref]);
      continue;
    }
    if (!existsSync(join(other.checkout, '.git'))) continue;
    const url = sh('git', ['-C', ctx.line.checkout, 'remote', 'get-url', name]);
    if (url.status !== 0) git(ctx.line.checkout, ['remote', 'add', '-t', entry.branch, name, other.checkout]);
    else if (url.stdout.trim() !== other.checkout) git(ctx.line.checkout, ['remote', 'set-url', name, other.checkout]);
    git(ctx.line.checkout, ['fetch', '-q', name]);
  }
}

/** A number this step took that another branch gives to a different element becomes a notice. */
function noticeIdClashes(ctx, before) {
  const { line } = ctx;
  const memory = Object.keys(PATHS.memoryYaml?.types ?? {}).map((type) => lib.memoryDir(PATHS.memoryYaml, type));
  const added = sh('git', ['-C', line.checkout, 'diff', '--name-only', '--diff-filter=A', before, 'HEAD', '--', ...new Set(memory)]).stdout.split('\n').filter((f) => lib.numberedId(f));
  if (!added.length) return;
  lineBranches(ctx, true);
  const others = Object.entries(ctx.config.lines).filter(([name]) => name !== line.name).flatMap(([name, entry]) =>
    sh('git', ['-C', line.checkout, 'ls-tree', '-r', '--name-only', `refs/remotes/${name}/${entry.branch}`, '--', ...new Set(memory)]).stdout.split('\n').filter(Boolean));
  lineBranches(ctx, false);
  for (const file of lib.idClashes(added, others)) {
    const number = lib.numberedId(file);
    if ((ctx.config.known_duplicates ?? []).includes(number)) continue;
    const created = lib.creationStep(git(line.checkout, ['log', '--diff-filter=A', '-n', '1', '--format=%B', '--', file]));
    // A free-standing element (raised, or added by hand) is renumbered at once, still under the lock.
    if (!created && !DRY) {
      try { if (renumberElement(ctx, basename(file, '.md'), { auto: true })) continue; } catch (error) { log(ctx, `renumber ${basename(file, '.md')} failed: ${error.message}`); }
    }
    notice(ctx, { key: `id-clash-${line.name}-${number}`, element: 'runner', reason: `${basename(file, '.md')} takes a number another branch already gives to a different element`, command: created
      ? `add ${number} to known_duplicates in config/runner.yaml (governance-evolution): ${created.step} created it, and replacing it would reopen that step`
      : lib.safeId(basename(file, '.md')) ? `cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --renumber ${basename(file, '.md')}` : `rename ${lib.shellQuote(basename(file))} by hand: its name is not a plain id` });
  }
}

/**
 * One step at a time, across the lines, may take new ids: the number is read when the agent adds the
 * element, so two lines launched together would otherwise take the same one. The lock is in the
 * trunk's clone; a line that finds it held waits for its next run.
 */
function idLockFile(ctx) {
  const trunk = ctx.config.lines.trunk ? lib.lineConfig(ctx.config, 'trunk').checkout : ctx.line.checkout;
  return join(trunk, '.git', 'dfd-runner.ids.lock');
}
function takeIdLock(ctx) {
  const file = idLockFile(ctx);
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, line: ctx.line.name, started: now() }), { flag: 'wx' });
      ctx.idLock = file;
      return null;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let lock;
      try { lock = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
      if (!lib.lockIsStale(lock, { staleMinutes: ctx.config.limits.lock_stale_minutes, alive })) return lock.line;
      rmSync(file, { force: true });
    }
  }
  return 'another line';
}
function releaseIdLock(ctx) {
  if (ctx.idLock) rmSync(ctx.idLock, { force: true });
  ctx.idLock = null;
}

/**
 * An element whose number another branch took gets a free one. WingFoil has no verb for it, and an
 * id is never changed by hand: a new element takes the content through its draft and the CLI, and the
 * old one is deprecated. An approved element goes back to the approver. An element a workflow step
 * created is refused: deprecating it reopens that step for good (WingFoil 0.3.2), so its number is
 * declared in known_duplicates instead.
 */
function renumberElement(ctx, oldId, { auto = false } = {}) {
  const { line } = ctx;
  const memory = PATHS.memoryYaml;
  const type = Object.keys(memory.types ?? {}).find((t) => elementFile(line.checkout, t, oldId));
  if (!type) { console.error(`${oldId} is not an element of line ${line.name}`); process.exitCode = 3; return; }
  const created = lib.creationStep(git(line.checkout, ['log', '--diff-filter=A', '-n', '1', '--format=%B', '--', relative(line.checkout, elementFile(line.checkout, type, oldId))]));
  if (created) { console.error(`${oldId} was created by ${created.step}: replacing it would reopen that step. Add ${lib.numberedId(`${oldId}.md`)} to known_duplicates in config/runner.yaml instead.`); process.exitCode = 3; return; }
  const holder = Object.keys(ctx.config.lines).length > 1 && !ctx.idLock ? takeIdLock(ctx) : null;
  if (holder) { console.error(`line ${holder} is taking new ids: try again when its step ends`); process.exitCode = 10; return; }
  const env = identityEnv(ctx.lineIdentity);
  const oldFile = elementFile(line.checkout, type, oldId);
  const oldText = readFileSync(oldFile, 'utf8');
  const fields = elementFields(line.checkout, type, oldId);
  lineBranches(ctx, true);
  const added = wingfoil(line.checkout, ['memory', 'add', '--type', type, '--title', String(fields.title ?? oldId)], env);
  lineBranches(ctx, false);
  const newId = added.value?.id;
  if (added.status !== 0 || !newId) throw new Error(`memory add: ${firstLine(added)}`);
  const newFile = elementFile(line.checkout, type, newId);
  writeFileSync(newFile, lib.renumberedText(oldText, { oldId, newId, status: elementFields(line.checkout, type, newId).status }));
  commit(ctx, [relative(line.checkout, newFile)], `docs(${type}): ${newId} takes the content of ${oldId}`);
  const sequence = memory.types?.[type]?.states?.sequence ?? [];
  while (sequence.indexOf(elementFields(line.checkout, type, newId).status) < sequence.indexOf(fields.status)) {
    if (wingfoil(line.checkout, ['memory', 'submit', newId], env).status !== 0) break;
  }
  const because = `renumbered as ${newId}: another branch gives ${lib.numberedId(`${oldId}.md`)} to a different element`;
  const dropped = wingfoil(line.checkout, ['memory', 'deprecate', oldId, '--reason', because], env);
  if (dropped.status !== 0) throw new Error(`memory deprecate ${oldId}: ${firstLine(dropped)}`);
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `id-clash-${line.name}-${lib.numberedId(`${oldId}.md`)}`), `renumbered as ${newId}`);
  if (ctx.config.push) pushOrigin(ctx, ['--follow-tags'], [line.branch]);
  const status = elementFields(line.checkout, type, newId).status;
  log(ctx, `${oldId} is now ${newId} (${status}); the old element is deprecated`);
  const others = walkMd(join(line.checkout, lib.memoryDir(memory, type), '..')).filter((f) => f !== oldFile && readFileSync(f, 'utf8').includes(oldId)).map((f) => basename(f, '.md'));
  if (others.length) print(ctx, `  these still cite ${oldId}: ${others.join(', ')}`);
  const approve = `cd ${HOME_REPO} && node scripts/runner/gate.mjs --line ${line.name} --element ${newId} --expect ${lib.shellWord(status)} --reason ${lib.shellQuote(`Renumbered from ${oldId}, the content is unchanged`)}`;
  // The state name comes from the checkout's memory.yaml, which agents write (1.1.19, L-4).
  if (status !== fields.status && !lib.safeId(status)) print(ctx, `  ${newId} stays in a state whose name is not plain (${JSON.stringify(status)}): approve it by hand after checking memory.yaml`);
  else if (status !== fields.status && auto) notice(ctx, { key: `renumbered-${line.name}-${newId}`, element: `${type}:${newId}`, reason: `${oldId} was renumbered as ${newId} and stays ${status}, short of ${fields.status}`, command: approve });
  else if (status !== fields.status) print(ctx, `  → ${approve}`);
  return true;
}

/** Only the runner pushes: the agents' `git push origin` has nowhere to go. */
const PUSH_GUARD = 'the-runner-pushes-not-the-agent';
function ensurePushGuard(ctx) {
  if (!ctx.set.pushGuard || DRY) return;
  const current = sh('git', ['-C', ctx.line.checkout, 'config', '--get', 'remote.origin.pushurl']).stdout.trim();
  if (current !== PUSH_GUARD) git(ctx.line.checkout, ['config', 'remote.origin.pushurl', PUSH_GUARD]);
}
function pushOrigin(ctx, flags, refspecs) {
  const url = git(ctx.line.checkout, ['remote', 'get-url', 'origin']);
  git(ctx.line.checkout, ['push', '-q', ...flags, url, ...refspecs], identityEnv(ctx.lineIdentity));
}

/** Worktrees whose element is closed go, when nothing is left in them; the branch stays. */
function pruneWorktrees(ctx) {
  const { line, config } = ctx;
  if (DRY || !existsSync(line.worktrees)) return;
  sh('git', ['-C', line.checkout, 'worktree', 'prune']);
  for (const id of readdirSync(line.worktrees)) {
    const type = (config.worktree_types ?? ['task', 'bug']).find((t) => elementFile(line.checkout, t, id));
    if (!type || elementFields(line.checkout, type, id).status !== lib.finalState(PATHS.memoryYaml, type)) continue;
    sh('git', ['-C', line.checkout, 'worktree', 'remove', join(line.worktrees, id)]);
  }
}

/**
 * The closing step of a task, without an agent: the task's branch rebased onto the line's and merged
 * into it from the line's checkout (directive agent-branches). A conflict or a failing test leaves the
 * line as it was and answers blocked. Its answer has the form of an agent's.
 */
function integrateScripted(ctx, step, element, worktree) {
  const { line } = ctx;
  const co = line.checkout;
  const env = identityEnv(ctx.lineIdentity);
  const integration = `integration/${element.id}`;
  const answer = (text) => ({ status: 0, signal: null, stderr: '', stdout: JSON.stringify({ type: 'result', result: text, is_error: false }) });
  const undo = () => { sh('git', ['-C', co, 'rebase', '--abort']); sh('git', ['-C', co, 'merge', '--abort']); sh('git', ['-C', co, 'switch', '-q', line.branch]); sh('git', ['-C', co, 'branch', '-q', '-D', integration]); };
  const run = (args) => sh('git', ['-C', co, ...args], { env });
  const update = ctx.set.update === 'merge' ? ['merge', '-q', '--no-edit', line.branch] : ['rebase', '-q', line.branch];
  for (const args of [['switch', '-q', '--create', integration, worktree.branch], update]) {
    const done = run(args);
    if (done.status !== 0) { undo(); return answer(`RESULT: blocked git ${args[0]} of ${worktree.branch}: ${firstLine(done)}`); }
  }
  const [command, ...rest] = ctx.set.testCommand;
  const tests = sh(command, rest, { cwd: co, env: lib.safeGitEnv(lib.agentEnv(env)), timeout: ctx.config.limits.step_timeout_minutes * 60000 });
  guardPath(co); // the tests are the agent's code: judged again before the merge (C)
  if (tests.status !== 0) { undo(); return answer(`RESULT: blocked the tests fail after the rebase onto ${line.branch} (${ctx.set.testCommand.join(' ')}, exit ${tests.status})`); }
  const merge = ctx.set.merge === 'no-ff' ? ['merge', '-q', '--no-ff', '-m', `merge: ${element.id}`, integration] : ['merge', '-q', '--ff-only', integration];
  const moved = run(['switch', '-q', line.branch]);
  const merged = moved.status === 0 ? run(merge) : moved;
  if (merged.status !== 0) { undo(); return answer(`RESULT: blocked the merge into ${line.branch} failed: ${firstLine(merged)}`); }
  run(['branch', '-q', '-D', integration]);
  if ((step.actions ?? []).some((a) => a.token === 'memory.submit')) {
    const submitted = wingfoil(co, ['memory', 'submit', element.id], env);
    if (submitted.status !== 0) return answer(`RESULT: blocked memory submit ${element.id}: ${firstLine(submitted)}`);
  }
  return answer(`${worktree.branch} integrated into ${line.branch}\nRESULT: completed`);
}

// ---- one run -------------------------------------------------------------------------------

/**
 * The checkout is on another branch than lines.<line>.branch: after a change of that setting (a
 * stage switch), or left there by an interrupted step. When nothing would be lost (no uncommitted
 * file, no operation under way, every commit of the current branch already on origin) and origin
 * has the configured branch, the runner switches the single-branch clone itself (1.1.16): it adds
 * the branch to the fetched ones, fetches it and switches, all with the forced git settings, after
 * judging the config. Otherwise it returns false and a notice asks the approver.
 */
function switchLineBranch(ctx, current) {
  const { line } = ctx;
  guardCheckout(ctx);
  const co = line.checkout;
  const gitDir = git(co, ['rev-parse', '--absolute-git-dir']);
  if (['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD'].some((f) => existsSync(join(gitDir, f)))) return false;
  if (sh('git', ['-C', co, 'status', '--porcelain']).stdout.trim()) return false;
  const pushed = sh('git', ['-C', co, 'rev-list', '--count', `origin/${current}..${current}`]);
  if (pushed.status !== 0 || pushed.stdout.trim() !== '0') return false;
  if (!sh('git', ['-C', co, 'ls-remote', '--heads', 'origin', line.branch]).stdout.trim()) return false;
  git(co, ['remote', 'set-branches', '--add', 'origin', line.branch]);
  git(co, ['fetch', '-q', 'origin', line.branch]);
  const local = sh('git', ['-C', co, 'rev-parse', '--verify', '--quiet', `refs/heads/${line.branch}`]).status === 0;
  git(co, local ? ['switch', '-q', line.branch] : ['switch', '-q', '-c', line.branch, '--track', `origin/${line.branch}`]);
  if (local) sh('git', ['-C', co, 'merge', '-q', '--ff-only', `origin/${line.branch}`]);
  guardCheckout(ctx);
  log(ctx, `switched the checkout from '${current}' to '${line.branch}' (lines.${line.name}.branch); nothing was left unpushed`);
  return true;
}

function runOnce(ctx) {
  const { line, config } = ctx;
  const week = lib.isoWeek().label;
  const lineEnv = identityEnv(ctx.lineIdentity);

  ensureMergeRules(ctx);
  ensurePushGuard(ctx);
  pruneWorktrees(ctx);
  if (!DRY) {
    git(line.checkout, ['fetch', '-q', 'origin']);
    const branch = git(line.checkout, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== line.branch) {
      if (!switchLineBranch(ctx, branch)) {
        // The branch is the agent's to name: only a plain one reaches a command (1.1.19, H-1).
        if (!lib.safeRef(branch)) notice(ctx, { key: `branch-${line.name}`, element: 'runner', reason: `the checkout is on a branch whose name is not plain (${JSON.stringify(branch)}), not on '${line.branch}', and holds work origin does not have (or uncommitted files)`, command: `no command: an agent named this branch, and its name could run code in a shell. Inspect ${line.checkout} by hand without pasting the name, then put it back on ${line.branch}` });
        else notice(ctx, { key: `branch-${line.name}`, element: 'runner', reason: `the checkout is on '${branch}', not on '${line.branch}', and holds work origin does not have (or uncommitted files)`, command: `${lib.approverGit({ home: HOME_REPO, line: line.name, checkout: line.checkout, commands: [['status', '--short'], ['log', '--oneline', `origin/${branch}..${branch}`]] })}; review it, then push it from the runner home (git -C ${HOME_REPO} fetch ${line.checkout} ${lib.shellWord(branch)} && git -C ${HOME_REPO} push origin ${lib.shellWord(`FETCH_HEAD:refs/heads/${branch}`)}) or drop it, then run the line again` });
        return;
      }
    }
    if (sh('git', ['-C', line.checkout, 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${line.branch}`]).status === 0) {
      // Fast-forward when it can. With push off the checkout's own commits (records, notices,
      // Memory) and origin's (the approver's pushes) diverge: then a merge, never a rebase, since
      // run records and plans cite the commits by their ids. A conflict stops the line.
      const ff = sh('git', ['-C', line.checkout, 'merge', '-q', '--ff-only', `origin/${line.branch}`], { env: lineEnv });
      if (ff.status !== 0) {
        const merge = sh('git', ['-C', line.checkout, 'merge', '-q', '--no-edit', `origin/${line.branch}`], { env: lineEnv });
        if (merge.status !== 0) {
          sh('git', ['-C', line.checkout, 'merge', '--abort']);
          notice(ctx, { key: `diverged-${line.name}`, element: 'runner', reason: `origin/${line.branch} does not merge into the checkout: ${firstLine(merge)}`, command: `${lib.approverGit({ home: HOME_REPO, line: line.name, checkout: line.checkout, commands: [['merge', `origin/${line.branch}`]] })} (solve the conflict, commit; push from the runner home: git -C ${HOME_REPO} fetch ${line.checkout} ${lib.shellWord(line.branch)} && git -C ${HOME_REPO} push origin ${lib.shellWord(`FETCH_HEAD:refs/heads/${line.branch}`)})` });
          return;
        }
        log(ctx, `merged origin/${line.branch} into the checkout`);
      }
    }
    closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `diverged-${line.name}`), 'origin merges again');
  }
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `branch-${line.name}`), 'the checkout is back on its branch');
  closeNotices(ctx, (config.known_duplicates ?? []).flatMap((number) => lib.openNoticeKeys(noticesText(ctx), `id-clash-${line.name}-${number}`)), 'declared in known_duplicates');

  // Budget notices that no longer hold are closed (the budget set, a new week).
  const records = readRecords(line.checkout);
  const budget = CONTAINER ? null : lib.budgetStop({ line, records, week, weights: ctx.set.weights });
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `budget-${line.name}-`).filter((k) => k !== budget?.key), 'the budget allows the line again');

  startDue(ctx, week);
  if (line.name !== 'trunk') openNextLineRelease(ctx);
  if (line.name === 'trunk' && !DRY) { lineBranches(ctx, true); catchUpLineReleases(ctx); }
  else if (line.name === 'trunk') catchUpLineReleases(ctx);

  const status = wingfoil(line.checkout, ['workflow', 'status'], lineEnv);
  if (!status.value) throw new Error(`workflow status: ${firstLine(status)}`);
  const all = lib.frontier(status.value);
  // Only this line's steps and instances (lib.ownsStep): the gates of the others are not noticed
  // here, the trunk's runner notices its own.
  const owner = ownership(ctx, status.value);
  const owned = all.steps.filter((s) => lib.ownsStep(s, { line, lifeCycle: config.life_cycle ?? 'sw-life-cycle', releaseLineOfRelease: owner.releaseLineOfRelease, startedHere: owner.startedHere(s.instance) }));
  // Only what the project declares: anything else is neither launched nor proposed to the approver.
  const steps = owned.filter((s) => lib.stepMatches(ctx.set.allow, s));
  if (owned.length > steps.length) waitLine(ctx, `${owned.length - steps.length} step(s) outside launch.allow: ${owned.filter((s) => !steps.includes(s)).map((s) => s.key).slice(0, 3).join(', ')}`);
  const cycle = config.life_cycle ?? 'sw-life-cycle';
  const complete = all.complete.filter((id) => (owner.workflowOf(id) === cycle ? line.name === 'trunk' : owner.startedHere(id)));
  for (const id of complete) {
    log(ctx, `ending ${id}`);
    if (DRY) continue;
    const end = wingfoil(line.checkout, ['workflow', 'end', id], lineEnv);
    if (end.status !== 0) throw new Error(`workflow end ${id}: ${firstLine(end)}`);
  }

  // Gates: one notice per step waiting for the approver; the notices of gates ruled are closed.
  const gates = steps.filter(lib.waitsForApprover);
  const gateKey = (s) => lib.gateKey(line.name, s);
  for (const gate of gates) {
    const element = lib.stepElement(gate);
    const known = lib.openNoticeKeys(noticesText(ctx), gateKey(gate)).length > 0;
    const packet = known ? null : lib.gatePacket({
      step: gate, element, records, head: git(line.checkout, ['rev-parse', 'HEAD']),
      dirty: sh('git', ['-C', line.checkout, 'status', '--porcelain']).stdout.split('\n').filter(Boolean).map((l) => l.slice(3)),
      openNotices: lib.notices(noticesText(ctx)).filter((n) => n.open && !n.key.startsWith('gate-') && n.text.includes(lib.cite(line.name, element.id))).map((n) => n.id),
    });
    notice(ctx, { key: gateKey(gate), element: element.ref, reason: `${gate.key} waits for the approver`, packet, command: `cd ${HOME_REPO} && node scripts/runner/gate.mjs --line ${line.name} {id} --reason ${lib.shellQuote(packet?.reason ?? '')}` });
  }
  const waiting = new Set(gates.map(gateKey));
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `gate-${line.name}-`).filter((k) => !waiting.has(k)), 'the approver ruled the gate');

  // A halted line waits for the approver's --resume.
  const halts = lib.openNoticeKeys(noticesText(ctx), `halt-${line.name}-`);
  if (halts.length) {
    const all = lib.notices(noticesText(ctx));
    const why = halts.map((key) => { const n = all.find((e) => e.open && e.key === key); return `${n?.id ?? key} ${/\*\*Reason:\*\* (.*)/.exec(n?.text ?? '')?.[1] ?? ''}`.trim(); });
    waitLine(ctx, `halted by ${why.join('; ')}`);
    waitLine(ctx, `  → cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --resume`);
    ctx.halted = true;
    return;
  }

  // A step that waits on Memory (what a task needs, still open) is neither launched nor noticed;
  // nor is one whose move WingFoil refuses at a WIP limit (asked with memory submit --dry-run).
  const memoryYaml = yaml.load(readFileSync(join(line.checkout, '.wingfoil/memory.yaml'), 'utf8'));
  let step = null;
  let limited = 0;
  let blocked = 0;
  let manual = 0;
  let depending = 0;
  const openBlocked = [...lib.openNoticeKeys(noticesText(ctx), `blocked-${line.name}-`), ...lib.openNoticeKeys(noticesText(ctx), `decision-${line.name}-`)];
  if (AMEND_ORDER) {
    // The approver's order: the amendment runs on the task's own frontier step, whatever comes first.
    step = steps.find((s) => lib.stepElement(s).id === AMEND_TASK && s.role) ?? null;
    if (!step) { log(ctx, `--red-amend ${AMEND_TASK}: no open step of that task on the frontier`); return; }
  }
  for (const candidate of AMEND_ORDER ? [] : steps) {
    if (lib.waitsForApprover(candidate) || lib.waitsOnMemory(candidate)) continue;
    if (!lib.launchesOptional(candidate, ctx.set.optional)) { waitLine(ctx, `${candidate.key} is optional: passed over (launch.optional)`); continue; }
    if (lib.stepMatches(ctx.set.manual, candidate)) {
      manual += 1;
      notice(ctx, { key: `manual-${line.name}-${candidate.instance}-${candidate.key}`, element: lib.stepElement(candidate).ref, reason: `${candidate.key} is run by hand (launch.manual)`, command: `cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --read workflow next ${candidate.instance}` });
      continue;
    }
    const dependencies = lib.openDependencies(elementFields(line.checkout, lib.stepElement(candidate).type, lib.stepElement(candidate).id).depends_on, (id) => {
      const type = Object.keys(memoryYaml.types ?? {}).find((t) => elementFile(line.checkout, t, id));
      return { status: type ? elementFields(line.checkout, type, id).status : null, final: type ? lib.finalState(memoryYaml, type) : undefined };
    });
    if (dependencies.length) { depending += 1; waitLine(ctx, `${candidate.key} waits for ${dependencies.join(', ')}`); continue; }
    // A step that answered blocked waits for the approver to close its notice: it is not relaunched.
    const held = lib.blockedNotice(candidate, openBlocked, line.name);
    if (held) { blocked += 1; waitLine(ctx, `${candidate.key} blocked by ${lib.notices(noticesText(ctx)).find((n) => n.open && n.key === held)?.id ?? held}`); continue; }
    const target = lib.stepElement(candidate);
    if (lib.limitedMove(candidate, target, memoryYaml)) {
      const probe = wingfoil(line.checkout, ['memory', 'submit', target.id, '--dry-run'], lineEnv);
      if (probe.status !== 0 && lib.wipRefused(`${probe.stdout}\n${probe.stderr}`)) {
        limited += 1;
        waitLine(ctx, `${candidate.key} held by a WIP limit`);
        continue;
      }
    }
    step = candidate;
    break;
  }
  if (!step) {
    const waits = steps.filter(lib.waitsOnMemory).length;
    if (gates.length || waits || limited || blocked || manual || depending) {
      const line = lib.waitingLine({ gates: gates.length, waits, limited, blocked: blocked + manual + depending });
      if (line) waitLine(ctx, line);
    } else waitLine(ctx, 'no open step');
    return;
  }
  const element = lib.stepElement(step);
  if (budget) { notice(ctx, { key: budget.key, element: 'runner', reason: budget.reason, command: budget.command }); return; }
  // A dry run launches nothing: it says the machine is busy and still shows the step.
  if (lib.loadTooHigh(loadavg()[0], cpus().length, config.limits?.max_load)) {
    waitLine(ctx, DRY ? 'the machine is busy: a real run would wait for a lower load' : 'the machine is busy: the launch waits for a lower load');
    if (!DRY) return;
  }
  const resumedAt = lib.lastResume(noticesText(ctx), line.name);
  const halt = lib.haltReason({ line, records, limits: config.limits, element: element.ref, resumedAt, repo: HOME_REPO });
  if (halt) { notice(ctx, { key: halt.key, element: element.ref, reason: halt.reason, command: halt.command }); ctx.halted = true; return; }

  if (lib.needsPush(step, config.push_workflows) && !config.push) {
    notice(ctx, { key: `push-${line.name}-${step.instance}-${step.key}`, element: element.ref, reason: `${step.key} writes the lines' branches and needs push on`, command: 'set push: true in config/runner.yaml (docs/pack-deviations.md D5)' });
    return;
  }
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `push-${line.name}-`), 'push is on');
  if (!DRY && Object.keys(config.lines).length > 1) {
    // A step that may raise an adr, a decision-log or a bug takes ids too: it holds the lock, and a
    // number it takes that another line already gives is renumbered after it (noticeIdClashes).
    const allocates = lib.needsLineBranches(step, config.line_branches);
    const takes = lib.takesIds(step, { rule: config.line_branches, raises: lib.stepMatches(ctx.set.raising, step) });
    const holder = takes ? takeIdLock(ctx) : null;
    if (holder) { waitLine(ctx, `${step.key} waits: line ${holder} is taking new ids`); return; }
    lineBranches(ctx, allocates);
  }

  // A step resumed after a park or a reject is told why; every step is told how it completes.
  let returned = null;
  if (element.type !== 'plan') {
    const history = wf(line.checkout, ['memory', 'history', element.id]);
    try { returned = lib.lastReturn(JSON.parse(history.stdout.slice(history.stdout.indexOf('{'))).entries); } catch { returned = null; }
  }
  // A red amendment (asked by the return's reasons, or ordered by the approver) runs instead of the
  // frontier step, as red: the frontier step resumes on the next run.
  const due = AMEND_ORDER ?? lib.amendmentDue({ step, returned, records, elementRef: element.ref });
  const amend = due ? { by: 'the review', ...due } : null;
  if (amend) {
    if (!amend.decision || !amend.files.length) throw new Error('--red-amend needs --files <file>[,<file>…] and --because <decision id>');
    step = lib.amendmentStep(step, redChecks(line, step.workflow));
  }
  const asked = amend ? null : lib.askedAmendment(records, element.ref);
  const amendedAsk = asked ? lib.amendmentAfter(records, element.ref, { timestamp: asked.at }) : null;
  // The step is told of an amendment asked by its own request, by the return it resumes after, or
  // (any asker, the approver's order first) one later than the task's last green or refactor run.
  const sinceWork = amend || !['green', 'refactor'].includes(step.phase) ? null : lib.amendmentSinceWork(records, element.ref);
  const amended = amend ? null : (amendedAsk ? { ...amendedAsk, asked: `${asked.phase} (run ${asked.run})` }
    : lib.amendmentAfter(records, element.ref, returned) ?? (sinceWork ? { ...sinceWork, since: true } : null));
  const { agent, adapter } = lib.pickAdapter(config, line, step.role);
  const identity = { name: agent, email: ctx.agentEmail(agent) };
  // The adapter (command, arguments, sandbox) comes from the runner's home, never the checkout (H2).
  const manifestFile = ['custom', 'built-in'].map((kind) => join(HOME_REPO, '.wingfoil/agents', kind, `${adapter}.yaml`)).find(existsSync);
  if (!manifestFile) throw new Error(`adapter manifest '${adapter}' not found under ${HOME_REPO}/.wingfoil/agents/`);
  const manifest = yaml.load(readFileSync(manifestFile, 'utf8'));
  const held = existsSync(limitFile(ctx, manifest.command)) ? Number(readFileSync(limitFile(ctx, manifest.command), 'utf8')) : 0;
  if (held > Date.now()) { waitLine(ctx, `${manifest.command} is at its usage limit: launches wait until ${lib.logStamp(new Date(held)).slice(11, 16)}`); return; }
  const worktree = worktreeFor(ctx, element);
  const session = manifest.session?.id === 'assign' ? randomUUID() : null;
  const who = { agent, adapter, role: step.role, line };
  const newSession = manifest.session?.resume?.supported === false;
  const violation = lib.distinctViolation(records, element.ref, step.distinctFrom, { ...who, session, newSession });
  if (violation) {
    notice(ctx, { key: `distinct-${line.name}-${step.instance}-${step.key}`, element: element.ref, reason: `distinct_from: ${violation}`, command: `map role ${step.role} of line ${line.name} to another adapter in config/runner.yaml, or run ${step.key} by hand` });
    return;
  }

  const stateRef = git(line.checkout, ['rev-parse', 'HEAD']);
  const liveResults = DRY ? [] : runLiveChecks(ctx, step, worktree.path);
  if (liveResults.length) guardAfterAgentCode(ctx, worktree.path);
  const lastOther = records.filter((r) => r.element === element.ref && r.phase !== step.phase && r.result === 'completed').at(-1);
  // The approver's rulings come from the signed ledger gate.mjs and --close write in the state folder,
  // never from commit messages or notices an agent could write (M2).
  const ledger = readLedger();
  const rulings = lib.ledgerGateRulings(ledger, { line: line.name, instance: step.instance, element: element.ref, since: lib.parseNotes(lastOther?.notes).at ?? null });
  const decisions = lib.ledgerDecisions(ledger, { line: line.name, element: element.id, phase: step.phase, since: lib.parseNotes(lastOther?.notes).at ?? null });
  // What the approver decided since the step last stopped: after a return, or after its last run
  // ended blocked (what it raised was ruled meanwhile); and how they closed that run's notice.
  const lastOwn = records.filter((r) => r.element === element.ref && r.phase === step.phase).at(-1);
  const stoppedAt = returned?.timestamp ?? (lastOwn?.result === 'blocked' ? lib.parseNotes(lastOwn.notes).at ?? null : null);
  const decided = stoppedAt && element.type === 'task' ? lib.decidedSince(stoppedAt, settlingElements(line, memoryYaml, element)) : [];
  const closedBlock = lastOwn?.result === 'blocked' ? lib.ledgerClose(ledger, { line: line.name, key: `blocked-${line.name}-${lastOwn.id}` }) : null;
  const unblocked = closedBlock?.how ? { id: closedBlock.notice, how: closedBlock.how } : null;
  const exit = lib.exitLine(step, element, lib.nextState(memoryYaml, element.type, element.status));
  const prompt = lib.buildPrompt({ project: ctx.project, step, element, line, worktree: worktree.path, checkout: line.checkout, branch: worktree.branch, stateRef, returned, decided, exit, author: { email: identity.email, model: lib.adapterModel(manifest) }, amend, amended: amended ? { id: amended.id, head: lib.parseNotes(amended.notes).head, asked: amended.asked ?? null, since: amended.since ?? false } : null , push: Boolean(config.push), integrate: lib.stepMatches(ctx.set.integrate, step), raising: lib.stepMatches(ctx.set.raising, step), sessionContext: ctx.set.sessionContext, cli: CLI.join(' '), rulings, decisions, unblocked, merge: ctx.set.merge, elementPath: elementFile(line.checkout, element.type, element.id), liveResults, runsTests: ctx.set.testCommand.join(' '), versions: lib.versionCommands(CLI), lineBranchNames: Object.entries(config.lines).filter(([n]) => n !== 'trunk').map(([, e]) => e.branch) });
  const mcp = lib.mcpValues(CLI);
  const tmp = mkdtempSync(join(tmpdir(), 'dfd-runner-'));
  const mcpConfigText = lib.substitute([manifest.mcp?.template ?? ''], mcp)[0];
  const mcpFile = join(tmp, 'mcp.json');
  writeFileSync(mcpFile, mcpConfigText);
  const values = { bootstrap: prompt, mcp_config_file: mcpFile, mcp_config: mcpConfigText.trim(), session_id: session ?? '', worktree: worktree.path, checkout: line.checkout };
  const extra = structuredClone(config.adapter_extra_args?.[adapter] ?? { position: 'end', args: [] });
  const gitDir = existsSync(join(worktree.path, '.git')) ? git(worktree.path, ['rev-parse', '--absolute-git-dir']) : join(line.checkout, '.git', 'worktrees', basename(worktree.path));
  extra.args = [...lib.withoutToolLists(extra.args ?? []), ...lib.worktreeGitArgs({ command: manifest.command, worktree: worktree.path, checkout: line.checkout, gitDir }), ...lib.permissionArgs({ command: manifest.command, role: step.role, cli: CLI, sources: dna().paths?.sources ?? [], extra: ctx.set.extraTools })];
  if (session) extra.args = [...extra.args, ...(manifest.session.assign_args ?? [])];
  const argv = lib.launchArgs(manifest, extra, values);
  if (DRY) {
    showVersion();
    console.log(JSON.stringify({ line: line.name, step: step.key, amend, instance: step.instance, element: element.ref, agent, adapter, model: lib.adapterModel(manifest), worktree: worktree.path, command: manifest.command, argv: argv.map((a) => (a === prompt ? '<prompt>' : a)) }, null, 2));
    console.log(`--- prompt ---\n${prompt}`);
    rmSync(tmp, { recursive: true, force: true });
    return;
  }

  const scripted = ctx.set.scripted && lib.stepMatches(ctx.set.integrate, step) && worktree.path !== line.checkout;
  const pre = runChecks(ctx, step.checks?.pre ?? [], worktree.path, element);
  if (!DRY && (step.checks?.pre ?? []).length) guardAfterAgentCode(ctx, worktree.path);
  if (pre.some((c) => !c.ok)) {
    rmSync(tmp, { recursive: true, force: true });
    const failed = pre.filter((c) => !c.ok).map((c) => `${c.token}: ${c.why}`).join('; ');
    notice(ctx, { key: `pre-${line.name}-${step.instance}-${step.key}`, element: element.ref, reason: `pre checks of ${step.key} fail: ${failed}`, command: `fix the cause, then the next run launches ${step.key}` });
    return;
  }
  closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `pre-${line.name}-${step.instance}-${step.key}`), 'the pre checks pass');

  // An agent whose sandbox the machine cannot start is not launched (docs/setup.md): no attempt.
  const sandbox = lib.sandboxCheck(manifest.command, line, { setup: config.paths?.setup, home: HOME_REPO, exists: (f) => existsSync(f) });
  if (!scripted && sandbox && existsSync(sandbox.argv[1][0])) {
    const probe = sh(...sandbox.argv, { env: toolEnv() }); // the home's script, without credentials (N7)
    if (probe.status !== 0) {
      rmSync(tmp, { recursive: true, force: true });
      notice(ctx, { key: sandbox.key, element: element.ref, reason: sandbox.reason, command: sandbox.command });
      return;
    }
    closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), sandbox.key), "Codex's sandbox works");
  }

  const base = git(worktree.path, ['rev-parse', 'HEAD']);
  const statusBefore = elementStatus(line.checkout, element);
  const started = Date.now();
  log(ctx, lib.launchLine(step, element, scripted ? 'the runner' : adapter));
  // The agent commits as its own identity (directive git-conventions), whatever the checkout's
  // git configuration says.
  const minutes = config.limits.step_timeout_minutes;
  // `timeout` signals the whole process group: the tests a killed agent left running die with it.
  ctx.launched = true;
  const launch = scripted ? integrateScripted(ctx, step, element, worktree) : sh('timeout', ['-k', '30', `${minutes}m`, manifest.command, ...argv], { cwd: worktree.path, env: lib.agentEnv(identityEnv(identity, { DFD_LINE: line.name, WINGFOIL_AGENT: identity.name })), timeout: (minutes + 2) * 60000 });
  const duration = Date.now() - started;
  rmSync(tmp, { recursive: true, force: true });
  guardAfterAgentCode(ctx, worktree.path); // before any git after the agent: it can write the checkout's .git and the worktree's (N2, B)
  const out = lib.parseOutput(launch.stdout);
  let { result, reason } = launch.status === 0
    ? lib.parseResult(out.text)
    : { result: 'error', reason: lib.exitReason(launch, minutes, out.errorText) };
  if (result !== 'error' && out.isError) { result = 'error'; reason = out.errorText || 'the agent reported an error'; }
  const atLimit = result === 'error' && !scripted && lib.usageLimit(`${reason}\n${out.errorText}\n${launch.stderr}`);
  if (atLimit) writeFileSync(plainFile(limitFile(ctx, manifest.command), line.checkout), String(Date.now() + lib.limitHoldMs(`${reason}\n${launch.stderr}`, config.limits?.usage_limit_wait_minutes ?? 30, config.limits?.usage_limit_max_minutes ?? 720)));

  // A command no role may run stops the line, whatever the run answered.
  const forbidden = scripted ? [] : lib.forbiddenCommands(out.commands);
  if (forbidden.length) { result = 'error'; reason = `forbidden command: ${forbidden[0].slice(0, 160)}`; }
  const expected = lib.adapterModel(manifest);
  const wrongModel = !lib.modelMatches(out.model, expected);
  if (wrongModel) { result = 'error'; reason = `model ${out.model} reported, ${expected} expected by ${adapter}`; }
  const ranSession = out.session ?? session;
  const after = lib.distinctViolation(records, element.ref, step.distinctFrom, { ...who, session: ranSession });
  if (result === 'completed' && after) { result = 'error'; reason = `distinct_from: ${after}`; }

  const checksStarted = Date.now();
  const checks = result === 'completed' ? runChecks(ctx, step.checks?.post ?? [], worktree.path, element, { base, model: expected, role: step.role }) : [];
  if (checks.length) guardAfterAgentCode(ctx, worktree.path); // the checks ran the agent's code (C)
  const checksMs = Date.now() - checksStarted;
  // A red amendment changes only the files it names.
  if (amend && result === 'completed') {
    const outside = lib.amendmentScope(git(worktree.path, ['diff', '--name-only', base, 'HEAD']).split('\n'), amend.files);
    checks.push({ token: 'amendment-scope', ok: outside.length === 0, why: outside.length ? `changed outside the amendment: ${outside.join(', ')}` : '' });
  }
  // What a role may write (config role_scope): the step's commits and what it left uncommitted.
  const scope = worktree.path === line.checkout || scripted ? null : config.role_scope?.[step.role];
  let outside = [];
  if (scope && result === 'completed') {
    const committed = sh('git', ['-C', worktree.path, 'log', '--no-merges', '--format=', '--name-only', 'HEAD', '--not', base, line.branch, '--']).stdout.split('\n');
    const left = sh('git', ['-C', worktree.path, 'status', '--porcelain']).stdout.split('\n').map((l) => l.slice(3));
    outside = [...new Set(lib.roleScopeProblems([...committed, ...left], scope.allow))];
    if (outside.length && scope.mode !== 'report') checks.push({ token: 'role-scope', ok: false, why: `${step.role} changed ${outside.slice(0, 5).join(', ')}` });
  }
  // An integrating step that completed must leave the task's commits on the line's branch.
  if (result === 'completed' && lib.stepMatches(ctx.set.integrate, step) && worktree.path !== line.checkout && worktree.branch) {
    const cherry = sh('git', ['-C', line.checkout, 'cherry', line.branch, worktree.branch]).stdout;
    const missing = lib.integrationMissing({ cherry,
      merge: lib.notIntegrated(cherry).length ? sh('git', ['-C', line.checkout, 'merge-tree', '--write-tree', line.branch, worktree.branch]) : null,
      lineTree: git(line.checkout, ['rev-parse', `${line.branch}^{tree}`]) });
    checks.push({ token: 'integrated', ok: missing.length === 0, why: missing.length ? `${missing.length} commit(s) of ${worktree.branch} are not on ${line.branch} (${missing[0].slice(0, 8)})` : '' });
  }
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) { result = 'check-failed'; reason = failed.map((c) => `${c.token}: ${c.why}`).join('; '); }

  // A reviewer that parked the element rejected it, whatever its RESULT line says.
  const movedBack = lib.nextState(memoryYaml, element.type, elementStatus(line.checkout, element)) === statusBefore;
  if (lib.stepMatches(ctx.set.review, step) && result === 'completed' && movedBack) {
    result = 'rejected'; reason = reason || `returned to ${elementStatus(line.checkout, element)}`;
  }
  const head = git(worktree.path, ['rev-parse', 'HEAD']);

  // A step whose evidence is a state, a created element or a produced file closes by itself once
  // the agent's commits are in: finalize only a step still on the frontier.
  if (result === 'completed') {
    const next = wingfoil(line.checkout, ['workflow', 'next', step.instance], lineEnv).value;
    const open = [next?.next, ...(next?.more ?? [])].some((s) => s?.key === step.key);
    if (open) {
      const fin = wingfoil(line.checkout, ['workflow', 'finalize', step.instance, '--step', step.key], identityEnv(identity));
      if (fin.status !== 0) { result = 'error'; reason = `finalize: ${firstLine(fin)}`; }
    }
  }

  const logFile = plainFile(join(line.checkout, PATHS.runs, `${element.id}.jsonl`), line.checkout);
  mkdirSync(dirname(logFile), { recursive: true });
  const own = existsSync(logFile) ? lib.parseRunRecords(readFileSync(logFile, 'utf8'), logFile) : [];
  const version = sh(manifest.command, manifest.version_args ?? ['--version']).stdout.trim().split('\n')[0];
  // Green or refactor may ask for a red amendment in its blocked answer: read from the full reason.
  const ask = result === 'blocked' && !amend && ['green', 'refactor'].includes(step.phase) ? lib.parseAmendment(reason) : null;
  const record = {
    id: lib.nextRunId(own, element.id, step.phase), element: element.ref, workflow: step.workflow, phase: step.phase,
    role: step.role, mode: step.mode ?? 'fresh', agent: scripted ? 'runner' : agent, adapter: scripted ? 'script' : adapter, agent_version: scripted ? lib.NOT_REPORTED : version || lib.NOT_REPORTED,
    model: out.model, session: scripted ? lib.NOT_REPORTED : ranSession ?? lib.NOT_REPORTED, tokens: out.tokens,
    wingfoil: wf(line.checkout, ['--version']).stdout.trim() || lib.NOT_REPORTED,
    state_ref: base, duration_ms: duration, exit_status: launch.status ?? `signal:${launch.signal ?? 'SIGKILL'}`,
    result, notes: lib.formatNotes({ line: line.name, week, at: now(), started: new Date(started).toISOString(), check_ms: checksMs, changed: sh('git', ['-C', worktree.path, 'diff', '--shortstat', base, head]).stdout.trim().replace(/[^0-9,]+/g, '-'), step: step.key, instance: step.instance, head, amend: amend?.decision, limit: atLimit ? 1 : undefined, outside: outside.length || undefined, ask: lib.askNote(ask), checks: checks.map((c) => `${c.token}:${c.ok ? 'pass' : 'fail'}`).join(','), reason: ctx.set.noticePaths === 'relative' ? lib.publicText(reason, noticePlaces(ctx)) : reason }),
  };
  appendFileSync(logFile, lib.runRecordLine(record));
  if (RECORD_DIR) {
    // The caller's copy of the launch (R4): the record, the agent's whole stream, its exit.
    mkdirSync(RECORD_DIR, { recursive: true });
    writeFileSync(join(RECORD_DIR, `${record.id.replaceAll('/', '_')}.json`), `${JSON.stringify(lib.launchRecord({ record, line: line.name, step, adapter: record.adapter, model: out.model, stdout: launch.stdout, stderr: launch.stderr }), null, 2)}\n`);
  }
  commit(ctx, [join(PATHS.runs, `${element.id}.jsonl`)], lib.recordSubject(record), identity);
  if (line.name !== 'trunk' && Object.keys(config.lines).length > 1) { lineBranches(ctx, false); noticeIdClashes(ctx, stateRef); }
  log(ctx, lib.outcomeLine({ result, reason, durationMs: duration, tokens: out.tokens }));

  // A failed post check after the step moved its element returns it: the step comes back onto the
  // frontier and is told why (lib.lastReturn), instead of the next step going on past the check.
  const statusAfter = elementStatus(line.checkout, element);
  const back = lib.checkReturn({ failed, statusBefore, statusAfter, type: element.type, memoryYaml });
  if (back === 'park') {
    const parked = wingfoil(line.checkout, ['memory', 'park', element.id, '--reason', lib.checkReturnReason(step.key, record.id, failed)], lineEnv);
    if (parked.status === 0) log(ctx, `${element.ref} parked back from ${statusAfter}: a post check failed`);
    else notice(ctx, { key: `check-failed-${line.name}-${record.id}`, element: element.ref, reason: `${step.key} moved ${element.ref} to ${statusAfter}, then failed its post checks (${reason}); the park was refused: ${firstLine(parked)}`, command: `fix the step's commits, return ${element.ref} by hand (its history: cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --read memory history ${element.id}), then close this notice` });
  } else if (back === 'notice') {
    notice(ctx, { key: `check-failed-${line.name}-${record.id}`, element: element.ref, reason: `${step.key} moved ${element.ref} to ${statusAfter}, then failed its post checks: ${reason}`, command: `fix the step's commits, return ${element.ref} by hand (its history: cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --read memory history ${element.id}), then close this notice` });
  }

  // A step that raised elements or wrote needs is held by dev-loop's gates, not by a notice; approvals have theirs.
  // nor is one that asked for a red amendment: the runner launches it on the next run.
  const notPulled = result === 'blocked' && step.phase === 'start' && lib.raisedIds(reason) && statusBefore === statusAfter;
  // A step that asks for the approver's ruling waits on a decision notice, ruled with gate.mjs.
  const question = result === 'blocked' && !ask ? lib.decisionQuestion(reason) : null;
  if (question) notice(ctx, { key: `decision-${line.name}-${record.id}`, element: element.ref, reason: `decision (run ${record.id}): ${question}`, command: `cd ${HOME_REPO} && node scripts/runner/gate.mjs --line ${line.name} {id} --reason "<ruling>" [--reject]` });
  if (result === 'blocked' && !question && !(lib.stepMatches(ctx.set.raising, step) && lib.heldByGates({ phase: step.phase, reason, statusBefore, statusAfter })) && !ask) notice(ctx, { key: `blocked-${line.name}-${record.id}`, element: element.ref, reason: `blocked (run ${record.id}): ${reason}${notPulled ? `; start left the task ${statusAfter}, so the gates do not hold it` : ''}`, command: `cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --close {id} --how "<what solved it>"` });
  if (result === 'blocked' && element.type === 'task' && lib.raisedIds(reason)) {
    const own = needsTheTaskRaised(line.checkout, element);
    if (own.length) notice(ctx, { key: `needs-raised-${line.name}-${element.id}`, element: element.ref, reason: `the needs of ${element.ref} list what the task raised (${own.join(', ')}): the gate over needs waits for elements no step can write`, command: `remove those ids from the task's needs in ${relative(line.checkout, elementFile(line.checkout, element.type, element.id))}, then cd ${HOME_REPO} && node scripts/runner/gate.mjs --line ${line.name} --element ${element.id} --amend --reason "<why>"` });
  }
  if (forbidden.length) { ctx.halted = true; notice(ctx, { key: `halt-${line.name}-forbidden-${record.id.replaceAll('/', '-')}`, element: element.ref, reason: `${step.key} ran a command no role may run: ${forbidden[0].slice(0, 160)}`, command: `cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${line.name} --resume` }); }
  if (wrongModel) notice(ctx, { key: `halt-${line.name}-model-${adapter}`, element: element.ref, reason, command: `check adapter ${adapter} and the tier mapping of line ${line.name}, then node scripts/runner/run.mjs --line ${line.name} --resume` });
  const haltAfter = lib.haltReason({ line, records: [...records, record], limits: config.limits, element: element.ref, resumedAt, repo: HOME_REPO });
  if (haltAfter) ctx.halted = true;
  if (haltAfter) notice(ctx, { key: haltAfter.key, element: element.ref, reason: haltAfter.reason, command: haltAfter.command });
  if (config.push) {
    // The runner pushes, never the agent: the line's branch with its release tags, and after a
    // completed sync or branch step on the trunk the lines' branches it wrote.
    pushOrigin(ctx, ['--follow-tags'], [line.branch]);
    if (result === 'completed' && line.name === 'trunk' && lib.needsPush(step, config.push_workflows)) {
      const names = Object.entries(config.lines).filter(([n]) => n !== 'trunk').map(([, e]) => e.branch);
      const sha = (ref) => { const r = sh('git', ['-C', line.checkout, 'rev-parse', '--verify', '--quiet', ref]); return r.status === 0 ? r.stdout.trim() : null; };
      const local = Object.fromEntries(names.map((b) => [b, sha(`refs/heads/${b}`)]));
      const remote = Object.fromEntries(names.map((b) => [b, sh('git', ['-C', line.checkout, 'ls-remote', 'origin', `refs/heads/${b}`], { env: lineEnv }).stdout.split(/\s/)[0] || null]));
      for (const b of lib.lineBranchesToPush(config, local, remote)) {
        pushOrigin(ctx, [], [`refs/heads/${b}:refs/heads/${b}`]);
        log(ctx, `pushed ${b}`);
      }
    }
  }
}

/** One view of every line: what it waits on, its next step, its budget. */
function printStatus(config, project) {
  showVersion();
  const week = lib.isoWeek().label;
  console.log(`${project} · ${week}`);
  for (const name of Object.keys(config.lines)) {
    const line = lib.lineConfig(config, name);
    if (!existsSync(join(line.checkout, '.git'))) { console.log(`\n${name}: no checkout at ${line.checkout}`); continue; }
    const ctx = { config, line, project, set: lib.settings(config) };
    const text = noticesText(ctx);
    const open = lib.notices(text).filter((n) => n.open);
    const halted = open.some((n) => lib.noticeKind(n.key) === 'halt');
    const running = existsSync(join(line.checkout, '.git', 'dfd-runner.lock'));
    const spent = lib.weekTokens(readRecords(line.checkout), name, week, ctx.set.weights);
    const waits = lib.gateWaits(text).sort((a, b) => a - b);
    const status = wingfoil(line.checkout, ['workflow', 'status']);
    const owner = status.value ? ownership(ctx, status.value) : null;
    const steps = status.value ? lib.frontier(status.value).steps.filter((s) => lib.stepMatches(ctx.set.allow, s) && lib.ownsStep(s, { line, lifeCycle: config.life_cycle ?? 'sw-life-cycle', releaseLineOfRelease: owner.releaseLineOfRelease, startedHere: owner.startedHere(s.instance) })) : [];
    const next = steps.find((s) => !lib.waitsForApprover(s) && !lib.waitsOnMemory(s));
    console.log(`\n${name}: ${running ? 'running' : halted ? 'HALTED' : open.length ? 'waiting' : next ? 'ready' : 'idle'}`);
    console.log(`  next step: ${next?.key ?? 'none'}`);
    console.log(`  budget: ${spent} of ${line.weekly_token_budget ?? 'unset'} weighted tokens`);
    if (waits.length) console.log(`  gates closed: ${waits.length}, median wait ${waits[waits.length >> 1]} min`);
    for (const n of open) console.log(`  ${n.id} ${lib.noticeKind(n.key)}: ${/\*\*Reason:\*\* (.*)/.exec(n.text)?.[1] ?? n.key}`);
  }
}

/** What the project lacks to run under the runner, read from the project itself. */
/**
 * What makes the runner home untrustworthy (N3, N4): it is, or holds, a line's checkout or worktrees;
 * the folder the scripts run from is; its files that decide what runs (lib.HOME_PATHS) differ from
 * the trusted ref; or its own git config runs programs.
 */
function homeProblems(config) {
  return lib.homeTrustProblems({ config, home: HOME_REPO, repo: REPO, git: (args) => sh('git', ['-C', HOME_REPO, ...args]) });
}

function printDoctor(config, line) {
  showVersion();
  const co = line.checkout;
  const exists = existsSync(join(co, '.git'));
  const read = (path) => { try { return readFileSync(join(co, path), 'utf8'); } catch { return ''; } };
  PATHS.memoryYaml = yaml.load(read('.wingfoil/memory.yaml')) ?? {};
  const manifests = (dir) => (existsSync(join(co, dir)) ? walkYaml(join(co, dir)) : []).map((file) => { try { return yaml.load(readFileSync(file, 'utf8')); } catch { return null; } }).filter(Boolean);
  const adapters = Object.fromEntries((existsSync(join(HOME_REPO, '.wingfoil/agents')) ? walkYaml(join(HOME_REPO, '.wingfoil/agents')) : []).map((file) => { try { return yaml.load(readFileSync(file, 'utf8')); } catch { return null; } }).filter(Boolean).map((m) => [m.name, m]));
  const workflows = Object.fromEntries(manifests('.wingfoil/workflows').filter((m) => m.name && m.phases).map((m) => [m.name, m.phases.map((p) => p.name)]));
  const commands = new Set(Object.values(adapters).map((m) => m.command).filter(Boolean));
  const problems = lib.doctor({
    config, adapters, workflows, dna: yaml.load(read('.wingfoil/dna.yaml')) ?? {}, notices: read(lib.settings(config).notices),
    version: exists ? wf(co, ['--version']).stdout.trim() : '',
    listStatus: exists ? wf(co, ['workflow', 'list']).status : 1,
    releaseLines: walkMd(join(co, lib.memoryDir(PATHS.memoryYaml, 'release-line'))).map((file) => basename(file, '.md')).filter((id) => id.startsWith('rl-')),
    checkout: { path: co, exists, expected: line.branch, branch: exists ? git(co, ['rev-parse', '--abbrev-ref', 'HEAD']) : null, cli: existsSync(join(co, 'node_modules/.bin/wingfoil')) },
    cli: { missing: [...commands].filter((c) => sh(c, ['--version']).status !== 0) },
  });
  // What code outside the sandbox trusts (1.1.11): the home is not a line's checkout, and holds the
  // CLI, the adapters and a team with no agent sharing the approver's email.
  const inside = (path, dir) => path === dir || path.startsWith(`${dir}/`);
  for (const [name, entry] of Object.entries(config.lines ?? {})) {
    const other = { checkout: lib.expandHome(entry.checkout), worktrees: lib.expandHome(entry.worktrees) };
    if (other.checkout && inside(HOME_REPO, other.checkout)) problems.push(`the runner home ${HOME_REPO} is line ${name}'s checkout, which agents write: set paths.runner to the runner's own home, a clone no agent works in`);
    if (other.worktrees && inside(HOME_REPO, other.worktrees)) problems.push(`the runner home ${HOME_REPO} is inside line ${name}'s worktrees`);
  }
  const program = RUNNER_CLI[0] === 'node' ? RUNNER_CLI[1] : RUNNER_CLI[0];
  if (program.startsWith('/') && !existsSync(program)) problems.push(`the WingFoil CLI is not installed in the runner home: ${program}`);
  try { problems.push(...lib.identityProblems((yaml.load(readFileSync(join(HOME_REPO, '.wingfoil/dna.yaml'), 'utf8')) ?? {}).team)); } catch { problems.push(`${HOME_REPO}/.wingfoil/dna.yaml cannot be read`); }
  if (exists) problems.push(...lib.unsafeGitConfig(sh('git', ['-C', co, ...lib.GIT_CONFIG_LIST]).stdout).map((l) => `the checkout's git config runs a program: ${l}`));
  problems.push(...homeProblems(config));
  problems.forEach((p) => console.log(`FAIL  ${p}`));
  console.log(problems.length ? `${problems.length} problem(s) to solve before the runner can adopt this project` : 'ok: the project can run under the runner');
  process.exitCode = problems.length ? 1 : 0;
}

function walkYaml(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walkYaml(path) : name.endsWith('.yaml') ? [path] : [];
  });
}

function main() {
  const lineName = arg('--line') ?? (STATUS ? 'trunk' : null);
  if (!lineName) { console.error('usage: run.mjs --line <line> [--dry-run] [--config <file>] [--resume] [--red-amend <task id> --files <f>[,<f>…] --because <decision id> [--note "<text>"]]'); process.exit(3); }
  if (AMEND_ORDER && (!AMEND_ORDER.decision || !AMEND_ORDER.files.length)) { console.error('--red-amend needs --files <file>[,<file>…] and --because <decision id>'); process.exit(3); }
  const config = lib.readConfig(arg('--config', join(REPO, 'config/runner.yaml')));
  const project = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).name;
  HOME_REPO = lib.expandHome(config.paths?.runner) ?? REPO;
  CLI = lib.settings(config).cli;
  // Every git the runner runs, and every child's, goes without hooks or fsmonitor (H1); the CLI the
  // runner runs is the home's copy (H1, H2). The agents keep the project's own CLI.
  Object.assign(process.env, lib.safeGitEnv(process.env));
  RUNNER_CLI = lib.trustedCli(CLI, HOME_REPO);
  const program = RUNNER_CLI[0] === 'node' ? RUNNER_CLI[1] : RUNNER_CLI[0];
  if (program.startsWith('/') && !existsSync(program)) { console.error(`runner: the WingFoil CLI is not installed in the runner home: ${program} (npm ci in ${HOME_REPO})`); process.exit(2); }
  PROJECT = JSON.parse(readFileSync(join(HOME_REPO, 'package.json'), 'utf8')).name;
  // Container mode: the caller's, never a configuration's (lib.containerProblems).
  const container = lib.containerProblems({ flag: CONTAINER, env: process.env, config });
  if (container.length) { console.error(`runner: ${container.join('\nrunner: ')}`); process.exit(2); }
  if (CONTAINER) {
    if (!RECORD_DIR) { console.error('runner: --container needs --record-dir <dir>: the caller reads the launches and what waits there'); process.exit(2); }
    // No push, no notification, no budget, no trust checks of the home: the caller owns the run.
    Object.assign(config, { push: false, notify: null });
    for (const entry of Object.values(config.lines ?? {})) entry.weekly_token_budget = null;
  }
  if (!DOCTOR && !STATUS && !CONTAINER) {
    // The runner trusts its home: it refuses to start from a line's checkout, from a home whose files
    // differ from the trusted ref, or from one whose git config runs programs (N3, N4).
    const problems = homeProblems(config);
    if (problems.length) {
      console.error(`runner: ${problems.join('\nrunner: ')}`);
      if (config.notify && !DRY) sh(config.notify, [`${project} · ${lineName}: STOPPED`, problems.join('\n')]);
      process.exit(2);
    }
  }
  let line;
  try { line = lib.lineConfig(config, lineName); } catch (error) { console.error(`runner: ${error.message}`); process.exit(2); }
  const ctx = { config, line, project, set: lib.settings(config) };

  if (DOCTOR) { printDoctor(config, line); return; }
  if (CHECK_GIT) {
    // What a notice's hand command runs first (lib.approverGit): the checkout's and its worktrees'
    // git folders and config, judged without touching them; exit 11 when git there would run a program.
    try {
      guardPath(line.checkout);
      const wts = existsSync(line.worktrees) ? readdirSync(line.worktrees).map((n) => join(line.worktrees, n)).filter((p) => existsSync(join(p, '.git'))) : [];
      for (const wt of wts) guardWorktree({ line }, wt);
      console.log(`ok: line ${line.name}'s checkout and ${wts.length} worktree(s): their git config runs nothing`);
    } catch (error) { console.error(`runner: ${error.message}`); process.exitCode = 11; }
    return;
  }
  if (READ) {
    // A read-only verb for the approver, with the home's CLI in the line's checkout after its git config
    // is judged: never the checkout's own npx (1.2.0, L-5).
    if (!lib.readAllowed(READ)) { console.error(`runner: --read takes ${lib.APPROVER_READS.join(', ')}`); process.exitCode = 3; return; }
    try { guardPath(line.checkout); } catch (error) { console.error(`runner: ${error.message}`); process.exitCode = 11; return; }
    const run = sh(RUNNER_CLI[0], [...RUNNER_CLI.slice(1), ...READ], { cwd: line.checkout });
    process.stdout.write(run.stdout); process.stderr.write(run.stderr);
    process.exitCode = run.status ?? 1;
    return;
  }
  if (!existsSync(join(line.checkout, '.git'))) {
    // No notices file to write in: a missing checkout is told by the log and a notification only.
    const origin = sh('git', ['-C', REPO, 'remote', 'get-url', 'origin']).stdout.trim() || '<origin>';
    // Every checkout is single-branch: the trunk's holds main (the lines' branches come from their
    // checkouts, only for the steps that allocate ids: lineBranches); a line's, main and the line.
    const cmd = line.branch === 'main'
      ? `git clone --single-branch --branch main ${origin} ${line.checkout} && (cd ${line.checkout} && npm ci)`
      : `git clone --single-branch --branch ${line.branch} ${origin} ${line.checkout} && (cd ${line.checkout} && git remote set-branches --add origin main && git fetch -q origin && npm ci)`;
    log(ctx, `the line's checkout is missing: ${cmd}`);
    if (!DRY && config.notify) sh(config.notify, [`${project} · ${line.name}`, `the line's checkout is missing\n${cmd}`]);
    return;
  }
  const projectDna = yaml.load(readFileSync(join(line.checkout, '.wingfoil/dna.yaml'), 'utf8'));
  PATHS.dna = projectDna;
  PATHS.runs = lib.runsDir(projectDna);
  PATHS.memoryYaml = yaml.load(readFileSync(join(line.checkout, '.wingfoil/memory.yaml'), 'utf8'));
  // The team (who an agent is, which email it commits with) comes from the runner's home (H2).
  const homeDna = yaml.load(readFileSync(join(HOME_REPO, '.wingfoil/dna.yaml'), 'utf8')) ?? {};
  const team = lib.identityProblems(homeDna.team);
  if (team.length) { console.error(`runner: ${team.join('; ')} in ${HOME_REPO}/.wingfoil/dna.yaml`); process.exit(2); }
  ctx.agentEmail = (name) => {
    const email = homeDna.team?.agents?.find((a) => a.name === name)?.email;
    if (!email) throw new Error(`agent '${name}' has no email in ${HOME_REPO}/.wingfoil/dna.yaml team.agents`);
    return email;
  };
  ctx.lineIdentity = { name: line.agent, email: ctx.agentEmail(line.agent) };

  if (STATUS) { printStatus(config, project); return; }
  const lock = takeLock(ctx);
  if (!lock) { if (ctx.waiting?.length) finishOutput(ctx); return; }
  try {
    guardCheckout(ctx);
    if (RESUME) {
      closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `halt-${line.name}-`), 'resumed by the approver');
      if (config.push && !DRY) pushOrigin(ctx, ['--follow-tags'], [line.branch]);
      return;
    }
    if (RENUMBER) { try { renumberElement(ctx, RENUMBER); } finally { releaseIdLock(ctx); } return; }
    if (CLOSE) {
      const entry = lib.notices(noticesText(ctx)).find((n) => n.open && n.id === CLOSE);
      if (!entry) { console.error(`${CLOSE} is not an open notice of line ${lineName}`); process.exitCode = 3; return; }
      const how = arg('--how') ?? 'closed by the approver';
      if (lib.AGENT_MARKERS.some((name) => process.env[name])) { console.error('--close is the approver\'s: it is never run from an agent\'s shell'); process.exitCode = 3; return; }
      closeNotices(ctx, [entry.key], how);
      if (!DRY) appendLedger({ kind: 'close', line: line.name, notice: entry.id, key: entry.key, how });
      if (config.push && !DRY) pushOrigin(ctx, ['--follow-tags'], [line.branch]);
      return;
    }
    const most = Number(arg('--max-steps', 20));
    let runs = 0;
    do {
      let shown = [];
      try { shown = DRY ? [] : JSON.parse(readFileSync(join(line.checkout, '.git', 'dfd-runner.waiting'), 'utf8')).signature.split('\n'); } catch { /* nothing shown yet */ }
      refreshLock(lock);
      guardCheckout(ctx); // again before every step: the last one's agent may have changed it (N2)
      Object.assign(ctx, { acted: false, launched: false, halted: false, waiting: [], waits: [], shown: new Set(shown) });
      try { runOnce(ctx); } finally { releaseIdLock(ctx); }
      // A step that runs to its end clears the failures the line had before (1.1.19).
      closeNotices(ctx, lib.openNoticeKeys(noticesText(ctx), `failure-${line.name}-`), 'the line ran again without a failure');
      finishOutput(ctx);
      // What a run wrote without launching (a notice, a closed instance) reaches origin as well.
      if (config.push && !DRY && ctx.acted && !ctx.launched) pushOrigin(ctx, ['--follow-tags'], [line.branch]);
      runs += 1;
    } while (UNTIL_IDLE && !DRY && ctx.launched && !ctx.halted && runs < most && !existsSync(join(line.checkout, '.git', 'dfd-stop')));
    const waiting = CONTAINER ? lib.waitingItems(noticesText(ctx), line.name, { home: HOME_REPO }) : [];
    if (CONTAINER && !DRY) mkdirSync(RECORD_DIR, { recursive: true });
    if (CONTAINER && !DRY) writeFileSync(join(RECORD_DIR, 'waiting.json'), `${JSON.stringify({ line: line.name, at: now(), items: waiting }, null, 2)}\n`);
    // Container mode: 12 when the run stops on what its caller must rule (waiting.json).
    process.exitCode = DRY ? 0 : ctx.halted ? 11 : CONTAINER && waiting.length && !ctx.launched ? 12 : ctx.acted || runs > 1 ? 0 : 10;
  } catch (error) {
    if (error instanceof UnsafeCheckout) {
      // Nothing is written in that checkout, not even a notice: its git would run the program.
      console.error(`runner ${lineName}: ${error.message}`);
      if (config.notify && !DRY) sh(config.notify, [`${project} · ${lineName}: STOPPED`, error.message]);
      process.exitCode = 11;
      return;
    }
    for (const line of (ctx.waiting ?? []).splice(0)) print(ctx, line);
    console.error(`runner ${lineName}: ${error.message}`);
    process.exitCode = 1;
    try {
      const said = ctx.set.noticePaths === 'relative' ? lib.publicText(error.message, noticePlaces(ctx)) : error.message;
      notice(ctx, { key: `failure-${lineName}-${said.slice(0, 60).replace(/[^A-Za-z0-9.-]+/g, '_')}`, element: 'runner', reason: `runner failure: ${error.message.split('\n')[0]} (the notice closes by itself once the line runs again without a failure)`, command: `cd ${HOME_REPO} && node scripts/runner/run.mjs --line ${lineName} --dry-run` });
    } catch { /* the notice itself failed: the exit code reports it */ }
  } finally {
    if (!DRY) rmSync(lock, { force: true });
  }
}

main();
