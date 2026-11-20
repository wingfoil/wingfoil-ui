// The runner's pure parts (directive runner; docs/bootstrap.md § 7): configuration, adapter
// choice, launch arguments, run records, budget, stop conditions, notices. No process is spawned
// and no file is written here, so every rule is tested by scripts/runner/runner.test.mjs.
// The same file runs in every DFD project: nothing in it names a project.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
/** WingFoil's own run-log module, from the pinned package; a project may pin it under an alias. */
function loadRunLog() {
  for (const name of ['wingfoil', 'wingfoil-released']) {
    try { return require(`${name}/dist/agent/run-log.js`); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('WingFoil is not installed: neither wingfoil nor wingfoil-released is in node_modules');
}
const runLog = loadRunLog();

export const RUN_RECORD_KEYS = runLog.RUN_RECORD_KEYS;
export const NOT_REPORTED = runLog.NOT_REPORTED;
/** Results a run record can carry; errors are `error` and `check-failed`. */
export const RESULTS = ['completed', 'rejected', 'blocked', 'error', 'check-failed'];

// ---- configuration ------------------------------------------------------------------------------

/** `~/x` → `<home>/x`. */
export function expandHome(path) {
  return typeof path === 'string' && path.startsWith('~/') ? `${homedir()}/${path.slice(2)}` : path;
}

/** Plain objects merged key by key, `over` winning; arrays and other values are replaced. */
export function mergeConfig(base, over) {
  const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!plain(base) || !plain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) out[key] = key in base ? mergeConfig(base[key], value) : value;
  return out;
}

/**
 * The runner's configuration: the tracked file and, over it, `<name>.local.yaml` beside it when it
 * exists. The local file is never committed: it holds what belongs to one machine, such as the lines'
 * checkouts and worktrees, so that a public repository names no local path.
 */
export function readConfig(file, { read = (f) => require('node:fs').readFileSync(f, 'utf8'), exists = (f) => require('node:fs').existsSync(f) } = {}) {
  const yaml = require('js-yaml');
  const base = yaml.load(read(file)) ?? {};
  const local = localConfigFile(file);
  return exists(local) ? mergeConfig(base, yaml.load(read(local)) ?? {}) : base;
}

/** The machine's own file beside a configuration file: `runner.yaml` → `runner.local.yaml`. */
export function localConfigFile(file) {
  return String(file).replace(/(\.ya?ml)?$/, '.local.yaml');
}

/**
 * A notice's text with this machine's paths replaced by names (config `notices.paths: relative`),
 * longest path first: each line's checkout and worktrees, the runner's home, the temporary folder
 * and the home folder. The command printed in the terminal keeps the real paths.
 */
export function publicText(text, places) {
  const pairs = Object.entries(places ?? {}).filter(([path]) => path && path.length > 1).sort((a, b) => b[0].length - a[0].length);
  return pairs.reduce((out, [path, name]) => out.split(path).join(name), String(text ?? ''));
}

/** The line's configuration, with its paths expanded; throws on an unknown line. */
export function lineConfig(config, line) {
  const entry = config.lines?.[line];
  if (!entry) throw new Error(`unknown line '${line}': config/runner.yaml declares ${Object.keys(config.lines ?? {}).join(', ')}`);
  for (const key of ['branch', 'agent', 'tiers', 'checkout', 'worktrees']) {
    if (entry[key] === undefined) throw new Error(`line '${line}' has no '${key}' in config/runner.yaml or config/runner.local.yaml`);
  }
  return { name: line, ...entry, checkout: expandHome(entry.checkout), worktrees: expandHome(entry.worktrees) };
}

/**
 * The agent and adapter for a step's role on a line: the role's tier (config.roles, the same on
 * every line), then the line's adapter for that tier. On a line with a reviewer agent (the trunk:
 * written by claude, reviewed by codex) a reviewer step takes the reviewer agent's tiers.
 */
export function pickAdapter(config, line, role) {
  const tier = config.roles?.[role];
  if (!tier) throw new Error(`role '${role}' has no tier in config/runner.yaml roles`);
  const reviewing = role === 'reviewer' && Boolean(line.reviewer_agent);
  const tiers = reviewing ? line.reviewer_tiers : line.tiers;
  const adapter = tiers?.[tier];
  if (!adapter) throw new Error(`line '${line.name}' maps no ${reviewing ? 'reviewer ' : ''}adapter to tier '${tier}'`);
  return { agent: reviewing ? line.reviewer_agent : line.agent, adapter, tier };
}

/** The model an adapter launches, read from its headless arguments (--model / -m). */
export function adapterModel(manifest) {
  const args = manifest.launch?.headless?.args ?? manifest.launch?.interactive?.args ?? [];
  const at = args.findIndex((arg) => arg === '--model' || arg === '-m');
  return at === -1 ? null : args[at + 1] ?? null;
}

/** Whether a reported model is the one the adapter launches (`claude-opus-5-5[1m]` matches). */
export function modelMatches(reported, expected) {
  if (!expected || reported === NOT_REPORTED) return true;
  return String(reported).split(',').some((m) => m === expected || m.startsWith(`${expected}[`) || m.startsWith(`${expected}-`));
}

/** What a project declares about itself, with the defaults of a DFD project. */
export function settings(config = {}) {
  return {
    notices: config.paths?.notices ?? 'docs/notices.md',
    allow: config.launch?.allow ?? [],
    manual: config.launch?.manual ?? [],
    optional: config.launch?.optional ?? [],
    noticePaths: config.notices?.paths ?? 'absolute',
    integrate: config.phases?.integrate ?? ['dev-loop.done'],
    review: config.phases?.review ?? ['*.review'],
    raising: config.phases?.raising ?? ['dev-loop'],
    merge: config.integration?.merge ?? 'ff',
    update: config.integration?.update ?? 'rebase',
    scripted: (config.integration?.mode ?? 'script') === 'script',
    testCommand: config.integration?.test_command ?? ['npm', 'test'],
    taskBranch: config.integration?.task_branch ?? '{owner}/{id}',
    sessionContext: config.prompt?.session_context ?? true,
    weights: { ...TOKEN_WEIGHTS, ...(config.token_weights ?? {}) },
    pushGuard: config.push_guard ?? true,
    cli: config.cli ?? ['npx', '--no-install', 'wingfoil'],
    extraTools: config.permissions?.extra ?? [],
  };
}

/** Whether a version is at least `minimum` (`0.3.2`). */
export function versionAtLeast(version, minimum) {
  const parts = (v) => String(v).match(/\d+\.\d+\.\d+/)?.[0].split('.').map(Number) ?? [0, 0, 0];
  const [a, b] = [parts(version), parts(minimum)];
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** What a project still lacks to run under the runner: one line per problem, from the facts given. */
export function doctor({ version, listStatus, config, dna, adapters, workflows, checkout, notices: noticesText, cli, releaseLines = [] }) {
  const problems = [];
  const lines = Object.entries(config.lines ?? {});
  if (!versionAtLeast(version, '0.3.2')) problems.push(`WingFoil ${version || 'not installed'}: the runner needs 0.3.2 or later`);
  if (listStatus !== 0) problems.push('`npx wingfoil workflow list` fails: the configuration does not load on this WingFoil');
  const agents = new Map((dna?.team?.agents ?? []).map((a) => [a.name, a]));
  for (const name of new Set(lines.flatMap(([, l]) => [l.agent, l.reviewer_agent]).filter(Boolean))) {
    if (!agents.get(name)?.email) problems.push(`agent '${name}' needs an entry with an email in team.agents of dna.yaml`);
  }
  if (!dna?.paths?.runs?.length) problems.push('dna.yaml declares no paths.runs (the run log)');
  for (const [name, l] of lines) {
    if (!Number.isInteger(l.weekly_token_budget) || l.weekly_token_budget <= 0) problems.push(`line '${name}' has no weekly_token_budget: set it from a pilot task`);
    if (releaseLines?.length && !releaseLines.includes(releaseLineOf({ name, ...l }))) problems.push(`line '${name}' names release-line '${releaseLineOf({ name, ...l })}', which this project does not have (it has ${releaseLines.join(', ')})`);
  }
  if (!String(noticesText ?? '').includes(OPEN_MARK) || !String(noticesText).includes(CLOSED_MARK)) problems.push(`${settings(config).notices} is missing, or lacks its open and closed markers`);
  for (const adapter of new Set(lines.flatMap(([, l]) => [...Object.values(l.tiers ?? {}), ...Object.values(l.reviewer_tiers ?? {})]))) {
    if (!adapters[adapter]?.launch?.headless) problems.push(`adapter '${adapter}' is missing or has no launch.headless profile`);
  }
  for (const role of dna?.team?.roles ?? []) {
    if (role.name !== 'approver' && !role.human_only && !config.roles?.[role.name]) problems.push(`role '${role.name}' has no tier in roles`);
  }
  const set = settings(config);
  if (!set.allow.length) problems.push('launch.allow is empty: the runner would launch nothing');
  const known = (pattern) => { const [w, phase] = String(pattern).split('.'); return w.includes('*') || (workflows[w] && (!phase || phase.includes('*') || workflows[w].includes(phase))); };
  for (const pattern of [...set.allow, ...set.manual, ...set.integrate]) if (!known(pattern)) problems.push(`'${pattern}' names no workflow or phase of this project`);
  if (!checkout.exists) problems.push(`the line's checkout ${checkout.path} is missing`);
  else {
    if (checkout.branch !== checkout.expected) problems.push(`the line's checkout is on ${checkout.branch}, not on ${checkout.expected}`);
    if (!checkout.cli) problems.push('the checkout has no node_modules/.bin/wingfoil: run npm ci there');
  }
  for (const name of cli.missing) problems.push(`the CLI '${name}' is not on the PATH`);
  return problems;
}

/** Whether a step matches one of the patterns: `workflow`, `workflow.phase`, with `*` as a wildcard. */
export function stepMatches(patterns, step) {
  const names = [step.workflow, `${step.workflow}.${step.phase}`];
  return (patterns ?? []).some((pattern) => {
    const regex = new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return names.some((name) => regex.test(name));
  });
}

/** The fixed folder of a Memory type: its `path` template up to the first placeholder. */
export function memoryDir(memoryYaml, type) {
  const pattern = memoryYaml?.types?.[type]?.path;
  if (!pattern) return `docs/memory/${type}`;
  const fixed = pattern.slice(0, pattern.includes('{') ? pattern.indexOf('{') : pattern.length);
  return fixed.replace(/\/[^/]*$/, '') || '.';
}

/** The run log's folder (`paths.runs` of dna.yaml). */
export function runsDir(dna) {
  return String(dna?.paths?.runs?.[0] ?? 'docs/runs').replace(/\/+$/, '');
}

/** The final state of a Memory type. */
export function finalState(memoryYaml, type) {
  const sequence = memoryYaml?.types?.[type]?.states?.sequence ?? memoryYaml?.defaults?.states?.sequence ?? [];
  return sequence.at(-1) ?? null;
}

/** The ids an element depends on that are not in their final state yet. */
export function openDependencies(dependsOn, stateOf) {
  return (Array.isArray(dependsOn) ? dependsOn : []).filter((id) => { const s = stateOf(id); return s.status !== s.final; });
}

/** The task branch of an element. */
export function taskBranch(pattern, { owner, id }) {
  return pattern.replace('{owner}', owner).replace('{id}', id);
}

/** Why a launch ended badly, in the agent's own words when it gave any; a timeout is told apart. */
export function exitReason({ status, signal, error, stderr = '' }, minutes, agentError = '') {
  if (status === 124 || status === 137 || error?.code === 'ETIMEDOUT') return `timed out after ${minutes} minutes`;
  const said = [agentError, ...String(stderr).split('\n').reverse()].map((l) => String(l).trim()).find(Boolean);
  const code = error?.message ?? `exit ${status ?? signal}`;
  return said ? `${code}: ${said.slice(0, 300)}` : code;
}

/** Whether an agent's failure is its provider's usage limit, not a fault of the step. */
export function usageLimit(text) {
  return /usage limit|rate.?limit|quota|too many requests|\b429\b|limit (?:reached|exceeded)|hit your .*limit/i.test(String(text ?? ''));
}

/** How long to hold an agent after its usage limit: what its message says, else the default. */
export function limitHoldMs(text, defaultMinutes = 30, maxMinutes = 720) {
  const match = /(?:in|after)\s+(\d+)\s*(s|sec|second|m|min|minute|h|hour)s?\b/i.exec(String(text ?? ''));
  if (!match) return Math.min(defaultMinutes, maxMinutes) * 60000;
  const unit = match[2][0].toLowerCase();
  // The text is the agent's: a hold it names is capped (limits.usage_limit_max_minutes).
  return Math.min(Number(match[1]) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000), maxMinutes * 60000);
}

/** The files a role changed outside the folders it may write. */
export function roleScopeProblems(files, allow) {
  return (files ?? []).filter((file) => file && !(allow ?? []).some((prefix) => file === prefix || file.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)));
}

/** Whether the machine is too busy for a launch: the load per CPU over `max` (no `max`, never). */
export function loadTooHigh(load, cpus, max) {
  return Number.isFinite(max) && max > 0 && cpus > 0 && load / cpus > max;
}

// ---- what code outside the sandbox may trust (1.1.11) -------------------------------------------
//
// Agents can write the line's checkout and its .git. The runner and gate.mjs run outside the
// sandbox, so they never run code or read executable settings from there: git runs without hooks or
// fsmonitor, the WingFoil CLI comes from the runner's home, adapters, check bindings and the team
// from the home's .wingfoil/, and the approver's rulings from a ledger in the home's .git.

/**
 * git settings forced on every git the runner or gate.mjs runs, children included: no hooks, no
 * fsmonitor, and never the transports that run a command (ext::, fd::). Command-line settings win
 * over the repository's own config.
 */
export const SAFE_GIT_CONFIG = [['core.hooksPath', '/dev/null'], ['core.fsmonitor', 'false'], ['protocol.ext.allow', 'never'], ['protocol.fd.allow', 'never']];

/** An environment whose git (and the git of every child) runs with SAFE_GIT_CONFIG. */
export function safeGitEnv(env = {}) {
  const count = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10) || 0;
  const out = { ...env, GIT_CONFIG_COUNT: String(count + SAFE_GIT_CONFIG.length) };
  SAFE_GIT_CONFIG.forEach(([key, value], i) => { out[`GIT_CONFIG_KEY_${count + i}`] = key; out[`GIT_CONFIG_VALUE_${count + i}`] = value; });
  return out;
}

/**
 * The repository settings (`git config --list --show-scope -z`, scopes local and worktree) outside
 * an allowlist of exact keys that run nothing (1.1.13: no whole sections; a section such as gc.*
 * holds gc.recentObjectsHook, which runs a command, and user.* sets who gate.mjs commits as).
 * Values that name a repository are judged too: no transport helper (`::`). Global and system
 * settings are the user's own and are not judged.
 */
export function unsafeGitConfig(list) {
  const exact = new Set(['core.repositoryformatversion', 'core.filemode', 'core.bare', 'core.logallrefupdates', 'core.ignorecase', 'core.precomposeunicode', 'core.symlinks', 'extensions.objectformat']);
  const perRemote = /^remote\.[^.]+(?:\.[^.]+)*\.(fetch|push|tagopt|prune|url|pushurl)$/;
  const perBranch = /^branch\.[^.]+(?:\.[^.]+)*\.(remote|merge|rebase)$/;
  const safeUrl = (value) => !value.includes('::') && ![...value].some((c) => c.charCodeAt(0) < 32) && /^(?:https?:\/\/|ssh:\/\/|git:\/\/|file:\/\/|[\w.-]+@[\w.-]+:|\/|~\/|\.{1,2}\/)/.test(value);
  const verdict = (scope, key, value, entry) => {
    if (!['local', 'worktree'].includes(scope)) return [];
    if (key === 'merge.ours.driver' && value === 'true') return []; // the runner's own (ensureMergeRules)
    if (exact.has(key)) return [];
    const remote = perRemote.exec(key);
    if (remote) {
      if (remote[1] === 'url') return safeUrl(value) ? [] : [entry];
      if (remote[1] === 'pushurl') return safeUrl(value) || value === 'the-runner-pushes-not-the-agent' ? [] : [entry];
      return [];
    }
    const branch = perBranch.exec(key);
    if (branch) return branch[1] !== 'remote' || /^[\w.-]+$/.test(value) || safeUrl(value) ? [] : [entry];
    return [entry];
  };
  const text = String(list ?? '');
  if (text.includes('\0')) {
    // -z: scope NUL key LF value NUL …
    const parts = text.split('\0');
    const out = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const [scope, pair] = [parts[i], parts[i + 1]];
      const at = pair.indexOf('\n');
      const key = (at === -1 ? pair : pair.slice(0, at)).toLowerCase();
      const value = at === -1 ? '' : pair.slice(at + 1);
      out.push(...verdict(scope, key, value, `${key}=${value}`));
    }
    return out;
  }
  return text.split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const [scope, ...rest] = line.includes('\t') ? line.split('\t') : ['local', line];
    const entry = rest.join('\t');
    const at = entry.indexOf('=');
    return verdict(scope, (at === -1 ? entry : entry.slice(0, at)).toLowerCase(), at === -1 ? '' : entry.slice(at + 1), entry);
  });
}

/** Whether a WingFoil CLI call writes (and so commits): every verb but the reading ones. */
export function writesWithCli(args) {
  const [group, verb] = args ?? [];
  if (group === 'memory') return !['search', 'history', 'show', 'list', 'lint'].includes(verb);
  if (group === 'workflow') return ['start', 'finalize', 'end', 'abort', 'cancel'].includes(verb);
  return false;
}

/** The command that lists what unsafeGitConfig judges. */
export const GIT_CONFIG_LIST = ['config', '--list', '--show-scope', '-z'];

/**
 * Whether a task worktree is what the runner made (1.1.13): its `.git` is a plain file naming a git
 * folder under `<checkout>/.git/worktrees/`, itself a plain folder whose `commondir` leads back to
 * `<checkout>/.git`. An agent can rewrite that file to point at a git folder of its own, whose config
 * then runs programs on the runner's next git there. Returns the problems found (none: trusted).
 */
export function worktreeProblems(path, checkout) {
  const fs = require('node:fs');
  const nodePath = require('node:path');
  if (resolveReal(path) === resolveReal(checkout)) return [];
  const dotGit = nodePath.join(path, '.git');
  try {
    if (!fs.lstatSync(dotGit).isFile()) return [`${dotGit} is not a plain file`];
    const named = /^gitdir: (.+?)\s*$/.exec(fs.readFileSync(dotGit, 'utf8'))?.[1];
    if (!named) return [`${dotGit} names no git folder`];
    const gitDir = nodePath.resolve(path, named);
    const worktrees = nodePath.join(resolveReal(nodePath.join(checkout, '.git')), 'worktrees');
    if (fs.lstatSync(gitDir).isSymbolicLink()) return [`${gitDir} is a symbolic link`];
    const real = resolveReal(gitDir);
    if (nodePath.dirname(real) !== worktrees) return [`${dotGit} points at ${real}, outside ${worktrees}`];
    const common = nodePath.resolve(real, fs.readFileSync(nodePath.join(real, 'commondir'), 'utf8').trim());
    if (resolveReal(common) !== resolveReal(nodePath.join(checkout, '.git'))) return [`${real}/commondir leads to ${common}, not ${checkout}/.git`];
    return [];
  } catch (error) { return [`${path}: ${error.message}`]; }
}

/** A path with its links resolved, or the path itself when it does not exist. */
export function resolveReal(path) {
  try { return require('node:fs').realpathSync(path); } catch { return path; }
}

/**
 * The files of the runner's home that decide what runs outside the sandbox. A run is refused while
 * any of them differs from the trusted ref (config paths.trusted_ref, default origin/main): edited,
 * staged, untracked, or committed but not yet on that ref.
 */
export const HOME_PATHS = ['scripts/runner', 'scripts/checks', 'scripts/lib', 'scripts/setup', '.wingfoil', 'config/runner.yaml', 'package.json', 'package-lock.json'];

/** The home's drifted files, from `git status --porcelain --untracked-files=all` and `git diff --name-only <ref> HEAD`. */
export function homeDrift(status, diff) {
  const files = [
    ...String(status ?? '').split('\n').filter(Boolean).map((l) => l.slice(3).trim()),
    ...String(diff ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
  ];
  return [...new Set(files)];
}

/** Whether `path` is `dir` or inside it. */
export function inside(path, dir) {
  return Boolean(path && dir) && (path === dir || String(path).startsWith(`${dir}/`));
}

/** The lines whose checkout or worktrees hold `path` (the runner home, or the folder the scripts run from). */
export function homeInLines(path, config) {
  const real = resolveReal(path);
  return Object.entries(config?.lines ?? {}).filter(([, e]) => [expandHome(e.checkout), expandHome(e.worktrees)].some((dir) => dir && (inside(path, dir) || inside(real, resolveReal(dir))))).map(([name]) => name);
}

/**
 * Why the runner home cannot be trusted (N3, N4, E): the scripts do not run from it; it or the
 * scripts' folder is in a line's checkout or worktrees; its own git config runs programs; or its
 * files that decide what runs (HOME_PATHS) differ from the trusted ref. `git(args)` runs git in the
 * home: { status, stdout }.
 */
export function homeTrustProblems({ config, home: runnerHome, repo, git }) {
  const problems = [];
  if (resolveReal(runnerHome) !== resolveReal(repo)) problems.push(`the scripts run from ${repo}, not from the runner home ${runnerHome}: run them from the home (paths.runner)`);
  for (const [label, path] of [['the runner home', runnerHome], ['the folder the runner runs from', repo]]) {
    const lines = homeInLines(path, config);
    if (lines.length) problems.push(`${label} ${path} is in line ${lines.join(', ')}'s checkout or worktrees, which agents write: run the runner from the approver's own checkout (paths.runner)`);
  }
  const unsafe = unsafeGitConfig(git(GIT_CONFIG_LIST).stdout);
  if (unsafe.length) return [...problems, ...unsafe.map((l) => `the runner home's git config runs a program: ${l}`)];
  const ref = config.paths?.trusted_ref ?? 'origin/main';
  if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status !== 0) return [...problems, `the trusted ref ${ref} does not exist in the runner home ${runnerHome} (paths.trusted_ref)`];
  const drift = homeDrift(git(['status', '--porcelain', '--untracked-files=all', '--', ...HOME_PATHS]).stdout, git(['diff', '--name-only', ref, 'HEAD', '--', ...HOME_PATHS]).stdout);
  if (drift.length) problems.push(`the runner home ${runnerHome} differs from ${ref} in what decides what runs: ${drift.slice(0, 5).join(', ')}${drift.length > 5 ? ', …' : ''}`);
  return problems;
}

/**
 * The WingFoil CLI run from the runner's home instead of the checkout (whose node_modules an agent
 * can change): `npx --no-install <pkg>` → `<home>/node_modules/.bin/<pkg>`; `node <path>` → the
 * home's copy of that path. Anything else is returned as it is.
 */
export function trustedCli(cli, runnerHome) {
  const [first, ...rest] = cli ?? [];
  if (first === 'npx') { const pkg = rest.filter((a) => !a.startsWith('-'))[0]; return pkg ? [`${runnerHome}/node_modules/.bin/${pkg}`, ...rest.slice(rest.indexOf(pkg) + 1)] : cli; }
  if (first === 'node' && rest[0] && !rest[0].startsWith('/')) return ['node', `${runnerHome}/${rest[0]}`, ...rest.slice(1)];
  return cli;
}

/** A value quoted for a POSIX shell: a notice command the approver copies runs nothing it carries. */
export function shellQuote(value) {
  return `'${String(value ?? '').replaceAll("'", "'\\''")}'`;
}

/** Whether an id can be put in a command as it is (letters, digits, dots, dashes). */
export function safeId(id) {
  return /^[a-z0-9][a-z0-9.-]*$/i.test(String(id ?? ''));
}

/** The agents of a team that share an approver's email, or that have none: their launches are refused. */
export function identityProblems(team) {
  const approvers = new Set((team?.members ?? []).filter((m) => (m.roles ?? []).includes('approver')).map((m) => String(m.email ?? '').toLowerCase()).filter(Boolean));
  return (team?.agents ?? []).flatMap((a) => {
    const email = String(a.email ?? '').toLowerCase();
    if (!email) return [`agent ${a.name} has no email`];
    return approvers.has(email) ? [`agent ${a.name} has the approver's email`] : [];
  });
}

/** The hosts of package-lock.json's `resolved` URLs outside the allowed registries. */
export function foreignResolved(lockText, hosts = ['registry.npmjs.org']) {
  const found = new Set();
  for (const match of String(lockText ?? '').matchAll(/"resolved":\s*"([^"]+)"/g)) {
    let host;
    try { host = new URL(match[1]).host; } catch { host = match[1]; }
    if (!hosts.includes(host)) found.add(host);
  }
  return [...found];
}

/**
 * Where the approver's rulings are kept: outside any repository, in the user's state folder
 * (DFD_RUNNER_STATE overrides it for tests), one ledger per project, and the key that signs it.
 */
export function stateDir(env = process.env) {
  return env.DFD_RUNNER_STATE || `${homedir()}/.local/state/dfd-runner`;
}
export function ledgerFile(project, env = process.env) {
  return `${stateDir(env)}/${String(project).replace(/[^\w.@-]+/g, '_')}/rulings.jsonl`;
}
export function ledgerKeyFile(env = process.env) {
  return `${stateDir(env)}/ledger.key`;
}

/** An entry's signature: HMAC-SHA256 of its JSON without the signature, with the ledger's key. */
export function ledgerMac(key, entry) {
  const { mac: _mac, ...rest } = entry;
  return createHmac('sha256', key).update(JSON.stringify(rest)).digest('hex');
}

/** The ledger's entries ({ at, kind: gate | decision | close, line, … }) whose signature is right, oldest first. */
export function parseLedger(text, key = null, project = null) {
  if (!key) return [];
  const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return String(text ?? '').split('\n').filter(Boolean).flatMap((l) => {
    let entry;
    try { entry = JSON.parse(l); } catch { return []; }
    if (typeof entry?.mac !== 'string' || !same(entry.mac, ledgerMac(key, entry))) return [];
    return project === null || entry.project === project ? [entry] : []; // signed with its project: no replay across projects
  });
}

/** One signed line of the ledger. */
export function ledgerLine(key, entry) {
  return `${JSON.stringify({ ...entry, mac: ledgerMac(key, entry) })}\n`;
}

/**
 * The ledger of a project, read: its signed entries, or none when the key is missing or the ledger
 * or its key can be written by anyone but the user.
 */
export function readLedger(project, env = process.env) {
  const fs = require('node:fs');
  const own = (file, mask) => { const st = fs.lstatSync(file); return st.isFile() && st.uid === process.getuid?.() && (st.mode & mask) === 0; };
  try {
    const keyFile = ledgerKeyFile(env);
    const file = ledgerFile(project, env);
    if (!own(keyFile, 0o077) || !own(file, 0o022)) return []; // the key private, the ledger writable by the user only
    return parseLedger(fs.readFileSync(file, 'utf8'), fs.readFileSync(keyFile, 'utf8').trim(), project);
  } catch { return []; }
}

/** One ruling added to a project's ledger, signed; the folder (0700), the key and the ledger (0600) are made when missing. */
export function appendLedger(project, entry, env = process.env) {
  const fs = require('node:fs');
  const dir = ledgerFile(project, env).replace(/\/[^/]+$/, '');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keyFile = ledgerKeyFile(env);
  try { fs.writeFileSync(keyFile, require('node:crypto').randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  fs.appendFileSync(ledgerFile(project, env), ledgerLine(fs.readFileSync(keyFile, 'utf8').trim(), { at: new Date().toISOString(), project, ...entry }), { mode: 0o600 });
}

/** The gate rulings for a step's instance and element since a moment, from the ledger: [{ step, reason, at }]. */
export function ledgerGateRulings(entries, { line, instance, element, since = null }) {
  const from = Date.parse(since ?? '');
  return (entries ?? []).filter((e) => e.kind === 'gate' && e.line === line && e.instance === instance && e.element === element && (Number.isNaN(from) || Date.parse(e.at) > from))
    .map((e) => ({ step: e.step, reason: `${e.ruling === 'reject' ? 'REJECTED: ' : ''}${e.reason}`, at: e.at }));
}

/** The decisions ruled for runs of an element's phase since a moment, from the ledger (decisionRulings' shape). */
export function ledgerDecisions(entries, { line, element, phase, since = null }) {
  const from = Date.parse(since ?? '');
  const prefix = `${element}/${phase}/`;
  return (entries ?? []).filter((e) => e.kind === 'decision' && e.line === line && String(e.run ?? '').startsWith(prefix) && (Number.isNaN(from) || Date.parse(e.at) > from))
    .map((e) => ({ id: e.notice, question: e.question, ruling: e.ruling === 'reject' ? 'reject' : 'approve', reason: e.reason, at: e.at }));
}

/** How the approver closed a notice, from the ledger (`--close --how`), or null. */
export function ledgerClose(entries, { line, key }) {
  return (entries ?? []).filter((e) => e.kind === 'close' && e.line === line && e.key === key).at(-1) ?? null;
}

/** The numbered id of a Memory file (`dl-027` of `…/dl-027-a-title.md`), or null. */
export function numberedId(file) {
  const match = /(?:^|\/)([a-z]+)-0*(\d+)-[^/]*\.md$/.exec(String(file));
  return match ? `${match[1]}-${match[2]}` : null;
}

/** The workflow step that created an element, from the body of its `memory add` commit, or null. */
export function creationStep(body) {
  const instance = /^WingFoil-Instance: (\S+)/m.exec(String(body))?.[1];
  const step = /^WingFoil-Step: (\S+)/m.exec(String(body))?.[1];
  return instance && step ? { instance, step } : null;
}

/** A Memory file's text under a new id: its own id everywhere, and the status of the new draft. */
export function renumberedText(text, { oldId, newId, status }) {
  return String(text).replaceAll(oldId, newId).replace(/^status:.*$/m, `status: ${status}`);
}

/** The files added here whose number another branch gives to a different element. */
export function idClashes(added, others) {
  const name = (file) => String(file).split('/').at(-1);
  const taken = new Map();
  for (const file of others) { const id = numberedId(file); if (id) taken.set(id, [...(taken.get(id) ?? []), name(file)]); }
  return added.filter((file) => { const id = numberedId(file); return id && (taken.get(id) ?? []).some((other) => other !== name(file)); });
}

// ---- launch -------------------------------------------------------------------------------------

/** Replace placeholders `{name}` with values; unknown placeholders are kept. */
export function substitute(args, values) {
  return args.map((arg) => arg.replace(/\{([a-z_]+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole)));
}

/**
 * The headless argv of a launch: the adapter's `launch.headless.args`, the runner's extra
 * arguments for that adapter at their position (`end`, or `before-prompt` for a CLI that reads
 * nothing after its prompt), every placeholder filled.
 */
export function launchArgs(manifest, extra, values) {
  const headless = manifest.launch?.headless;
  if (!headless) throw new Error(`adapter '${manifest.name}' declares no launch.headless profile`);
  const args = [...headless.args];
  const more = extra?.args ?? [];
  if (extra?.position === 'before-prompt') {
    const at = args.indexOf('{bootstrap}');
    if (at === -1) throw new Error(`adapter '${manifest.name}' has no {bootstrap} argument to insert before`);
    args.splice(at, 0, ...more);
  } else {
    args.push(...more);
  }
  return substitute(args, values);
}

/**
 * The MCP values an adapter's template needs (the pinned WingFoil MCP server): the args as JSON
 * for a config file (Claude Code), as a TOML array for a `-c key=value` (Codex). Both spellings
 * are the same text for an array of plain strings.
 */
export function mcpValues(cli = ['npx', '--no-install', 'wingfoil']) {
  return { mcp_command: cli[0], mcp_args: JSON.stringify([...cli.slice(1), 'mcp']) };
}

// ---- what an agent may do ------------------------------------------------------------------------

const GIT_READ = ['status', 'diff', 'log', 'show', 'ls-files', 'ls-tree', 'rev-parse', 'rev-list', 'merge-base', 'grep', 'cat-file', 'check-ignore', 'var', 'for-each-ref', 'blame'];
const GIT_RECORD = ['add', 'commit'];
const GIT_WRITE = ['switch', 'checkout', 'restore', 'rm', 'mv', 'branch', 'merge', 'rebase', 'tag', 'stash', 'revert', 'cherry-pick'];
const WF_READ = ['workflow next', 'workflow status', 'workflow show', 'workflow list', 'memory search', 'memory history', 'directives list', 'agent list', 'agent show'];
const WF_REVIEW = ['memory add', 'memory park', 'memory amend'];
const WF_WRITE = ['memory add', 'memory submit', 'memory park', 'memory amend'];
/** What no role ever runs: publishing, and the approver's verbs. */
export const FORBIDDEN_WF = Object.freeze(['memory approve', 'memory reject', 'workflow finalize', 'workflow start', 'workflow end']);

/**
 * The tools of a Claude Code launch for a role, listed one by one: no generic git, node or WingFoil.
 * A reviewer and a qa cannot edit the project's sources (`paths.sources` of dna.yaml). Other CLIs
 * have no per-command allowlist: their commands are audited after the run (forbiddenCommands).
 */
export function permissionArgs({ command, role, cli, sources = [], extra = [] }) {
  if (command !== 'claude') return [];
  const forms = [...new Set([cli.join(' '), 'npx wingfoil', 'npx --no-install wingfoil'])];
  const wf = (verbs) => forms.flatMap((form) => verbs.map((verb) => `Bash(${form} ${verb}:*)`));
  const git = (verbs) => verbs.map((verb) => `Bash(git ${verb}:*)`);
  const reviewing = role === 'reviewer';
  const allow = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash(npm test:*)', 'Bash(npm run:*)', ...git(GIT_READ), ...git(GIT_RECORD), ...wf(WF_READ),
    ...wf(reviewing ? WF_REVIEW : WF_WRITE), ...(reviewing ? [] : git(GIT_WRITE)), ...extra];
  const deny = ['Bash(git push:*)', 'Bash(git -C:*)', 'Bash(git remote:*)', 'Bash(git config:*)', 'Bash(npm publish:*)', ...wf(FORBIDDEN_WF),
    ...(['reviewer', 'qa'].includes(role) ? sources.flatMap((path) => { const glob = `${String(path).replace(/\/+$/, '')}/**`; return [`Edit(${glob})`, `Write(${glob})`]; }) : [])];
  return ['--allowedTools', ...allow, '--disallowedTools', ...deny];
}

/**
 * Codex keeps read-only the git folder of the worktree it runs in, even under a writable `.git`:
 * naming that folder as a writable root is what lets a step commit on its task branch.
 */
export function worktreeGitArgs({ command, worktree, checkout, gitDir }) {
  return command === 'codex' && worktree !== checkout ? ['--add-dir', gitDir] : [];
}

/** The runner's own arguments without an older generic allowlist from the configuration. */
export function withoutToolLists(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--allowedTools' || args[i] === '--disallowedTools') { while (i + 1 < args.length && !String(args[i + 1]).startsWith('--')) i += 1; continue; }
    out.push(args[i]);
  }
  return out;
}

/** An agent's environment: no credential to publish with, and git limited to local repositories. */
export function agentEnv(env, extra = {}) {
  const clean = { ...env };
  for (const name of ['SSH_AUTH_SOCK', 'GH_TOKEN', 'GITHUB_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN']) delete clean[name];
  return { ...clean, GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'false', SSH_ASKPASS: 'false', GIT_SSH_COMMAND: 'false',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '', ...extra };
}

/** The commands of a run that no role may run. */
export function forbiddenCommands(commands) {
  const rule = new RegExp(`\\bgit(?:\\s+-[cC]\\s+\\S+|\\s+--?[a-z][\\w-]*(?:=\\S+)?)*\\s+push\\b|\\bnpm\\s+publish\\b|wingfoil(?:\\S*)\\s+(?:${FORBIDDEN_WF.join('|')})\\b|cli\\.js\\s+(?:${FORBIDDEN_WF.join('|')})\\b`);
  return (commands ?? []).filter((command) => rule.test(String(command)));
}

// ---- steps --------------------------------------------------------------------------------------

/**
 * The frontier of every open workflow, from `workflow status --format json`: each step with its
 * instance; the instances that are complete, to end.
 */
export function frontier(status) {
  const steps = [];
  const complete = [];
  for (const open of status?.open ?? []) {
    if (open.complete) { complete.push(open.instance.id); continue; }
    for (const step of open.frontier ?? []) steps.push({ ...step, instance: step.instance ?? open.instance.id, instanceInfo: open.instance });
  }
  return { steps, complete };
}

/** The element a step runs on, as `type:id`, or the plan's for a step without one. */
export function stepElement(step, instance = step.instanceInfo) {
  const element = step.scope?.element ?? instance?.element ?? instance?.context ?? null;
  if (element?.type && element?.id) return { type: element.type, id: element.id, status: element.status ?? null, ref: `${element.type}:${element.id}` };
  const id = instance?.id ?? step.instance;
  return { type: 'plan', id, status: null, ref: `plan:${id}` };
}

/**
 * Whether a step waits on Memory: no role, no action, only `selection` evidence (dev-loop's
 * `need-closed.wait`, open while an element a task needs is open). No agent is launched for it and
 * no notice is opened: it closes by itself once the element is closed.
 */
export function waitsOnMemory(step) {
  const kinds = step.evidence?.kinds ?? [];
  return !step.role && !(step.actions ?? []).length && kinds.length > 0 && kinds.every((kind) => kind === 'selection');
}

/** Whether a step waits for the approver (an approval, a role the agents do not hold, a party). */
export function waitsForApprover(step) {
  if (waitsOnMemory(step)) return false;
  if (step.awaiting !== null && step.awaiting !== undefined) return true;
  return step.role === 'approver' || step.agentRole === false;
}

/**
 * The exact command that unblocks a step waiting for the approver, run in the line's checkout
 * (the approver approves in one worktree per line: directive agent-branches), so that the ruling
 * reaches the runner without a push.
 */
export function unblockCommand(step, checkout = null) {
  const cd = checkout ? `cd ${checkout} && ` : '';
  if (step.awaiting?.kind === 'approval' && step.awaiting.recordNeeded === false && step.awaiting.elements?.length) {
    return cd + step.awaiting.elements.map((e) => `npx wingfoil memory approve ${e.id} --reason "<your ruling>"`).join(' && ');
  }
  return `${cd}npx wingfoil workflow finalize ${step.instance} --step ${step.key} --reason "<your ruling>"`;
}

/** The notice key of a step waiting for the approver. */
export function gateKey(lineName, step) {
  return `gate-${lineName}-${step.instance}-${step.key}`;
}

/** The commands that rule a gate, each as an argv after `npx --no-install wingfoil`. */
export function gateArgv(step, reason, { reject = false } = {}) {
  if (step.awaiting?.kind === 'approval' && step.awaiting.recordNeeded === false && step.awaiting.elements?.length) {
    return step.awaiting.elements.map((e) => ['memory', reject ? 'reject' : 'approve', e.id, '--reason', reason]);
  }
  if (reject) throw new Error(`${step.key} is ruled with workflow finalize: it has no reject`);
  return [['workflow', 'finalize', step.instance, '--step', step.key, '--reason', reason]];
}

/** The environment variables that say a shell belongs to an agent: approvals refuse them. */
export const AGENT_MARKERS = Object.freeze(['WINGFOIL_AGENT', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDECODE', 'CODEX_SANDBOX']);

/** What a gate's packet says: whether it is ready, the evidence, and a reason ready to use. */
export function gatePacket({ step, element, head, dirty = [], records = [], openNotices = [] }) {
  const last = records.filter((r) => r.element === element.ref).at(-1) ?? null;
  const notes = last ? parseNotes(last.notes) : {};
  const problems = [];
  if (dirty.length) problems.push(`uncommitted files: ${dirty.slice(0, 3).join(', ')}`);
  if (last && last.result !== 'completed') problems.push(`the last run ${last.id} ended ${last.result}`);
  if (String(notes.checks ?? '').includes(':fail')) problems.push(`failed checks in ${last.id}`);
  if (openNotices.length) problems.push(`open notices: ${openNotices.join(', ')}`);
  const evidence = last ? `run ${last.id} ${last.result}${notes.checks ? `, checks ${notes.checks}` : ''}` : 'no run recorded on this element';
  const short = String(head ?? '').slice(0, 8);
  return { ready: problems.length === 0, problems, head: short, evidence, reason: `Approved ${step.key} at ${short}: ${evidence}`.replace(/"/g, "'") };
}

/** The minutes each closed gate waited, from docs/notices.md. */
export function gateWaits(text) {
  return notices(text).filter((n) => !n.open && n.key.startsWith('gate-') && /T/.test(n.closedAt ?? '')).map((n) => {
    const opened = /\*\*Opened:\*\* (\S+)/.exec(n.text)?.[1];
    return Math.round((Date.parse(n.closedAt) - Date.parse(opened)) / 60000);
  }).filter((m) => Number.isFinite(m) && m >= 0);
}

/**
 * What the approver ruled at the gates before a step, from `git log --format=%cI%x00%B%x1e`: the
 * commits with an `Approver:` and a `Reason:` on the step's instance and element, later than `since`
 * (the last completed run of another phase of that element), oldest first.
 */
export function gateRulings(log, { instance, element, since = null }) {
  const from = Date.parse(since ?? '');
  return String(log ?? '').split('\x1e').map((entry) => entry.trim()).filter(Boolean).flatMap((entry) => {
    const [at, body = ''] = entry.split('\x00');
    const subject = /^workflow: finalize (\S+) (\S+)/.exec(body);
    const reason = /^Reason: ([\s\S]*?)(?:\n\s*\n|$(?![\s\S]))/m.exec(body)?.[1]?.trim();
    const scope = /^WingFoil-Element: (\S+)/m.exec(body)?.[1] ?? null;
    if (!subject || !reason || !/^Approver: /m.test(body) || subject[1] !== instance) return [];
    if ((scope ?? '') !== (String(element).startsWith('plan:') ? '' : element)) return [];
    if (!Number.isNaN(from) && Date.parse(at) <= from) return [];
    return [{ step: subject[2], reason, at }];
  }).reverse();
}

/** The weekly mains of a line: its own list, else the project's. */
export function weeklyMains(config, line) {
  return line.weekly_mains ?? config.weekly_mains ?? [];
}

/**
 * Whether a trunk step needs the lines' branches (config `line_branches`): one that allocates ids
 * (an action such as `memory.add`), so that its ids do not collide with theirs, or one of a
 * workflow that works on the lines (`sync`, `branch`, `converge`). Every other step runs without
 * them, since WingFoil counts WIP limits on the same branches and a line's work would block the
 * trunk's.
 */
export const DEFAULT_LINE_BRANCHES = { actions: ['memory.add'], workflows: ['sync', 'branch', 'converge'] };

export function needsLineBranches(step, rule = DEFAULT_LINE_BRANCHES) {
  const actions = rule.actions ?? [];
  const workflows = rule.workflows ?? [];
  if (workflows.includes(step.workflow) || (step.trail ?? []).some((t) => workflows.includes(t.workflow))) return true;
  return (step.actions ?? []).some((a) => actions.some((prefix) => String(a.token ?? '').startsWith(prefix)));
}

/**
 * Whether a step may take new ids, so that it holds the id lock while it runs: one that needs the
 * lines' branches, or one that may raise an adr, a decision-log or a bug (config phases.raising).
 */
export function takesIds(step, { rule = DEFAULT_LINE_BRANCHES, raises = false } = {}) {
  return raises || needsLineBranches(step, rule);
}

/**
 * The commits of a task branch that did not reach the line, from `git cherry <line> <branch>`: the
 * lines marked `+` (no commit with the same patch on the line). Empty when the work is integrated.
 */
export function notIntegrated(cherry) {
  return String(cherry ?? '').split('\n').filter((l) => l.startsWith('+ ')).map((l) => l.slice(2).trim());
}

/**
 * Whether a task branch's work is on the line. `git cherry` compares patches, context lines included,
 * so a commit rebased onto a line that moved shows as missing though its change is there. Such
 * commits are then judged by content: `git merge-tree --write-tree <line> <branch>` merging cleanly
 * into the line's own tree means the branch adds nothing the line lacks. Returns the commits still
 * missing (empty when integrated).
 */
export function integrationMissing({ cherry, merge = null, lineTree = null }) {
  const missing = notIntegrated(cherry);
  if (!missing.length || !merge) return missing;
  const tree = String(merge.stdout ?? '').trim().split('\n')[0];
  return merge.status === 0 && tree && tree === String(lineTree ?? '').trim() ? [] : missing;
}

/**
 * Whether the runner launches an optional step (`optional: true` on the frontier): only one that
 * config `launch.optional` names. Any other optional step is passed over, as nothing asks for it.
 */
export function launchesOptional(step, patterns = []) {
  return !step.optional || stepMatches(patterns, step);
}

/** How the approver closed a notice: the text after the dash of its closed status, or null. */
export function closedHow(entry) {
  return /\*\*Status:\*\* closed \S+ — (.*)/.exec(entry?.text ?? '')?.[1]?.trim() ?? null;
}

/** The release-line a line owns (config `lines.<line>.release_line`, default `rl-<line>`). */
export function releaseLineOf(line) {
  return line.release_line ?? `rl-${line.name}`;
}

/**
 * Whether a step belongs to this line (docs/pack-deviations.md D12; WingFoil 0.3.2 cannot filter
 * by line). One life cycle, started on the trunk and inherited by the lines through sync:
 * - in the life cycle, a step under a `release-flow` belongs to the line whose release-line holds
 *   that release (the trunk: rl-trunk; a line: rl-<line>); every other life-cycle step (inception,
 *   specification, plan-release, end of life) is the trunk's;
 * - any other workflow belongs to the branch it was started on (`startedHere`), so a line never
 *   runs a plan it inherited from the trunk, nor the trunk one merged from a line.
 * `releaseLineOfRelease(id)` names the release-line of a release element.
 */
export function ownsStep(step, { line, lifeCycle = 'sw-life-cycle', releaseLineOfRelease, startedHere }) {
  const trail = step.trail ?? [];
  const root = trail[0]?.workflow ?? step.instanceInfo?.workflow ?? step.workflow;
  if (root === lifeCycle) {
    const flow = trail.find((t) => t.workflow === 'release-flow' && t.scope?.element?.type === 'release');
    if (flow) return releaseLineOfRelease(flow.scope.element.id) === releaseLineOf(line);
    return line.name === 'trunk';
  }
  return Boolean(startedHere);
}

/**
 * How many `memory submit` bring a release on the trunk to the state its own line reached: the
 * difference of their places in the release's state sequence (0 when the trunk is level or ahead,
 * or a state is not in the sequence). A line's release lives on the trunk as scope but advances on
 * the line only; without this the trunk's delivery would never complete (docs/pack-deviations.md D12).
 */
export function catchUpSteps(sequence, trunkStatus, lineStatus) {
  const from = sequence.indexOf(trunkStatus);
  const to = sequence.indexOf(lineStatus);
  return from === -1 || to === -1 || to <= from ? 0 : to - from;
}

/** Whether the trunk's copy is ahead of its line (a reject sent the line's release back). */
export function isBehind(sequence, trunkStatus, lineStatus) {
  const from = sequence.indexOf(trunkStatus);
  const to = sequence.indexOf(lineStatus);
  return from !== -1 && to !== -1 && to < from;
}

/**
 * The line release to open next, or null: when no release of the line's release-line is
 * in-development or releasing, the planned one (status `planning`) with the lowest scope. The line
 * keeps one release in development (methodology/kanban), and the trunk writes the line releases in
 * planning (workflow scope); plan-release runs on the trunk only.
 */
export function nextLineRelease(releases) {
  if (releases.some((r) => r.status === 'in-development' || r.status === 'releasing')) return null;
  const planned = releases.filter((r) => r.status === 'planning');
  const key = (s) => String(s ?? '').split('.').map((n) => String(Number(n) || 0).padStart(6, '0')).join('.');
  planned.sort((a, b) => key(a.scope).localeCompare(key(b.scope)));
  return planned[0]?.id ?? null;
}

/**
 * The steps that keep a released line release's flow open: a step of this line still on the frontier
 * whose element is one of the line's releases already released (its retrospective, or whatever else
 * release-flow runs after the release). The next release opens only when there is none.
 */
export function releaseFlowSteps(steps, releases) {
  const released = new Set(releases.filter((r) => r.status === 'released').map((r) => r.id));
  return steps.filter((step) => {
    const element = stepElement(step);
    return element.type === 'release' && released.has(element.id);
  }).map((step) => step.key);
}

/** The `scope:` of a Memory file's text (its frontmatter), or null. */
export function scopeOf(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ''));
  const m = fm && /^scope:\s*"?([^"\n]+?)"?\s*$/m.exec(fm[1]);
  return m ? m[1] : null;
}

/** The `status:` of a Memory file's text (its frontmatter), or null. */
export function statusOf(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ''));
  const m = fm && /^status:\s*"?([A-Za-z0-9_-]+)"?\s*$/m.exec(fm[1]);
  return m ? m[1] : null;
}

/** Whether a step needs push on (config `push_workflows`: sync and branch write the lines). */
export function needsPush(step, workflows = ['sync', 'branch']) {
  return workflows.includes(step.workflow) || (step.trail ?? []).some((t) => workflows.includes(t.workflow));
}

/**
 * The lines' branches a sync or branch step leaves to push: each line but the trunk whose local
 * branch exists (`local[branch]`, a sha) and differs from origin's (`remote[branch]`, a sha or
 * absent). The runner pushes them; the agent never does.
 */
export function lineBranchesToPush(config, local, remote) {
  return Object.entries(config?.lines ?? {}).filter(([name]) => name !== 'trunk')
    .map(([, entry]) => entry.branch).filter((b) => b && local?.[b] && local[b] !== remote?.[b]);
}

/** What the agent of a step the runner pushes for is told: it writes, the runner pushes. */
export function pushText(step, { push, checkout, lines = [] }) {
  if (['sync', 'branch'].includes(step.workflow)) {
    return `Work on the local branches ${lines.join(', ') || 'main-<line>'} of ${checkout}: create a missing one from main (git branch <name> main), or merge main into it (its merge commit ending with the trailer DFD-Sync: <this release's id>); end on main. Push nothing: the runner pushes those branches after this step.`;
  }
  if (step.workflow === 'release-publishing' && step.phase === 'publish') {
    return push
      ? `The runner pushes the release commit and its annotated tag after this step (git push --follow-tags): push nothing yourself, and answer completed naming the commit and the tag.`
      : `This line does not push (push: false in config/runner.yaml): leave the release commit and its tag in ${checkout}, push nothing, and answer completed naming the commit and the tag; the approver pushes them when they choose.`;
  }
  return '';
}

/**
 * The releases `sync` merged into a line, from the trailers `DFD-Sync: <release id>` of the
 * line's merge commits (`git log --format=%(trailers:key=DFD-Sync,valueonly)`), in order, once each.
 */
export function syncedReleases(trailersLog) {
  const ids = String(trailersLog ?? '').split('\n').map((l) => l.trim()).filter((l) => /^rel-[A-Za-z0-9._-]+$/.test(l));
  return [...new Set(ids.reverse())];
}

/**
 * A bound check's argv with its project scripts taken from the line's checkout: every argument
 * that is a relative path under scripts/ and exists in the checkout becomes that absolute path,
 * so a task branch's own copy of a check is never run. The command itself (argv[0]) is not
 * rewritten: a binding such as `run: [scripts/check.sh]` would run the worktree's copy; bind
 * `[node, scripts/…]` or `[sh, scripts/…]` instead (no binding runs a script as argv[0] today).
 */
export function checkArgv(argv, checkout, exists) {
  return argv.map((a, i) => (i > 0 && /^scripts\//.test(a) && exists(`${checkout}/${a}`) ? `${checkout}/${a}` : a));
}

/**
 * The check run before launching an agent whose sandbox needs the machine prepared (docs/setup.md):
 * for Codex, codex-apparmor.sh --check, from config `paths.setup` (a folder, set in
 * config/runner.local.yaml) or else the runner home's scripts/setup/; never the line's checkout, where
 * an agent could commit a script of its own (1.1.14, N7). Null for any other agent. When it fails the
 * run stops before the agent, records no attempt, and opens the notice. With no script found the
 * check is not run.
 */
export function sandboxCheck(command, line, { setup = null, home: runnerHome = null, exists = () => true } = {}) {
  if (command !== 'codex') return null;
  const candidates = [setup ? `${expandHome(setup)}/codex-apparmor.sh` : null, runnerHome ? `${runnerHome}/scripts/setup/codex-apparmor.sh` : null].filter(Boolean);
  const script = candidates.find((f) => exists(f)) ?? candidates[0] ?? `${runnerHome ?? '.'}/scripts/setup/codex-apparmor.sh`;
  const run = `bash ${script}`;
  return {
    argv: ['bash', [script, '--check']],
    key: `codex-sandbox-${line.name}`,
    reason: "Codex's sandbox does not work on this machine: it needs the AppArmor profile (docs/setup.md)",
    command: `${run}, then run the two sudo commands it prints`,
  };
}

/**
 * The environment of a bound check: the step's element (WINGFOIL_ELEMENT, DFD_ELEMENT), its line
 * (DFD_LINE) and the line's checkout (DFD_CHECKOUT), where Memory and the run records are; the
 * check itself runs in the task's worktree, where the code is; the line's branch
 * (DFD_LINE_BRANCH). With the step's launch known: the worktree's HEAD before it (DFD_BASE: the
 * commits the step added are those reachable from HEAD and from neither DFD_BASE nor the line's
 * branch) and the adapter's model (DFD_MODEL).
 */
export function checkEnv({ line, element, base = null, model = null }) {
  return {
    WINGFOIL_ELEMENT: element.id, DFD_ELEMENT: element.ref, DFD_LINE: line.name, DFD_CHECKOUT: line.checkout,
    ...(line.branch ? { DFD_LINE_BRANCH: line.branch } : {}),
    ...(base ? { DFD_BASE: base } : {}), ...(model ? { DFD_MODEL: model } : {}),
  };
}

/** Cite an element as `<line>:<id>` (directive agent-branches). */
export function cite(line, element) {
  return `${line}:${String(element).replace(/^[a-z-]+:/, '')}`;
}

/** The prompt the agent is launched with: the one step, where to work, what to report. */
/**
 * The return a resumed step must answer: when the element's last state change is a `park` or a
 * `reject` (`memory history` entries, oldest first), that entry ({ operation, author, timestamp,
 * reason }); otherwise null. Read from the last transition, not from the step's last run record: a
 * failed run after the return must not hide its reasons.
 */
export function lastReturn(entries) {
  const moves = (entries ?? []).filter((e) => e.to && e.to !== e.from);
  const last = moves.at(-1);
  if (!last || !['park', 'reject'].includes(last.operation)) return null;
  return { operation: last.operation, author: last.author ?? 'unknown', timestamp: last.timestamp ?? '', reason: last.reason ?? '(no reason given)' };
}

// ---- red amendment ------------------------------------------------------------------------------

/**
 * The red amendment a return's reasons ask for: the line
 * `Red amendment (<line>:<decision id>): <file>[, <file>…]` → { decision, files }; null without it.
 */
export function parseAmendment(reason) {
  const match = /Red amendment \(([^():\s]+):([^()\s]+)\):[ \t]*([^\n]+)/.exec(String(reason ?? ''));
  if (!match) return null;
  const files = match[3].split(/[\s,]+/).map((f) => f.replace(/[.;]+$/, '')).filter(Boolean);
  return files.length ? { decision: match[2], files } : null;
}

/** The task's last completed red run later than the return, or null. */
export function amendmentAfter(records, elementRef, returned) {
  const since = Date.parse(returned?.timestamp ?? '');
  if (Number.isNaN(since)) return null;
  return (records ?? []).filter((r) => r.element === elementRef && r.phase === 'red' && r.result === 'completed'
    && Date.parse(parseNotes(r.notes).at ?? '') > since).at(-1) ?? null;
}

/**
 * The red amendment the task's last green or refactor run asked for: a `blocked` run whose record
 * carries `ask=<decision id>:<file>[,<file>…]` (the runner reads the amendment line from the full
 * answer, before the notes flatten it) → { decision, files, run, at, phase }; null otherwise.
 */
export function askedAmendment(records, elementRef) {
  const last = (records ?? []).filter((r) => r.element === elementRef && ['green', 'refactor'].includes(r.phase)).at(-1);
  if (!last || last.result !== 'blocked') return null;
  const notes = parseNotes(last.notes);
  const at = String(notes.ask ?? '').indexOf(':');
  if (at <= 0) return null;
  const files = notes.ask.slice(at + 1).split(',').filter(Boolean);
  return files.length ? { decision: notes.ask.slice(0, at), files, run: last.id, at: notes.at ?? '', phase: last.phase } : null;
}

/** The `ask=` value of a red amendment that a green or refactor answer asks for. */
export function askNote(amend) {
  return amend ? `${amend.decision}:${amend.files.join(',')}` : undefined;
}

/**
 * The amendment due before a frontier step, its green or refactor: asked by the task's last green
 * or refactor run (askedAmendment), or by the reasons of the return it resumes after; in both cases
 * only while no completed red run of the task came after the request. { by, decision, files }.
 */
export function amendmentDue({ step, returned, records, elementRef }) {
  if (!['green', 'refactor'].includes(step?.phase)) return null;
  const asked = askedAmendment(records, elementRef);
  if (asked && !amendmentAfter(records, elementRef, { timestamp: asked.at })) {
    return { by: `${asked.phase} (run ${asked.run})`, decision: asked.decision, files: asked.files };
  }
  const amend = parseAmendment(returned?.reason);
  if (!amend || amendmentAfter(records, elementRef, returned)) return null;
  return { by: 'the review', ...amend };
}

/**
 * The task's last completed red amendment (a red run whose notes carry `amend=`, whoever asked)
 * later than its last green or refactor run, whatever that run's result: red's tests changed since
 * that step last ran, and the step that resumes must be told. Null otherwise.
 */
export function amendmentSinceWork(records, elementRef) {
  const own = (records ?? []).filter((r) => r.element === elementRef);
  const work = own.filter((r) => ['green', 'refactor'].includes(r.phase)).at(-1);
  const since = Date.parse(parseNotes(work?.notes).at ?? '');
  return own.filter((r) => r.phase === 'red' && r.result === 'completed' && parseNotes(r.notes).amend
    && (Number.isNaN(since) || Date.parse(parseNotes(r.notes).at ?? '') > since)).at(-1) ?? null;
}

/**
 * The open notice that holds a frontier step: a blocked one (`blocked-<line>-<element id>/<phase>/…`)
 * or a decision waiting for the approver's ruling (`decision-<line>-…`), or null.
 */
export function blockedNotice(step, openKeys, lineName) {
  const tail = `${lineName}-${stepElement(step).id}/${step.phase}/`;
  return (openKeys ?? []).find((key) => key.startsWith(`blocked-${tail}`) || key.startsWith(`decision-${tail}`)) ?? null;
}

/**
 * The step a red amendment runs as, made from the frontier step of its task: phase red, role qa, a
 * fresh session distinct from green and refactor, red's bound checks but tests-red (a right amendment
 * fails or passes, depending on how far the code already follows the decision). Not on
 * WingFoil's frontier, so the runner never finalizes it.
 */
export function amendmentStep(step, { checks = [], bindings = {} } = {}) {
  return {
    ...step,
    key: step.key.replace(/^([^.]+)\.[^@]+/, '$1.red'),
    phase: 'red', role: 'qa', mode: 'fresh', distinctFrom: ['green', 'refactor'], actions: [], produces: [],
    checks: { pre: [], post: checks.filter((token) => token !== 'tests-red').map((token) => ({ token, binding: bindings[token] ? { argv: bindings[token].run, severity: bindings[token].severity } : undefined })) },
  };
}

/** The files a run changed outside the amendment's list (the runner's scope check). */
export function amendmentScope(changed, files) {
  const allowed = new Set(files);
  return (changed ?? []).filter((f) => f && !allowed.has(f));
}

/**
 * What a failed post check does to the element: when the step moved it (its status after differs
 * from before), 'park' if the type returns from the status it reached (`memory.yaml` `returns`),
 * else 'notice'; null when no check failed or the element did not move.
 */
export function checkReturn({ failed, statusBefore, statusAfter, type, memoryYaml }) {
  if (!failed?.length || !statusAfter || statusAfter === statusBefore) return null;
  return memoryYaml?.types?.[type]?.states?.returns?.[statusAfter] ? 'park' : 'notice';
}

/** The park reason of a failed post check after a move. */
export function checkReturnReason(stepKey, recordId, failed) {
  return `Bound check failed after ${stepKey} (run ${recordId}): ${failed.map((c) => `${c.token}: ${c.why}`).join('; ')}. Fix it in the step's own commits (amend or a new commit) and move the element again.`;
}

/** The states in which an element that settles a task is decided (a withdrawn one is not). */
export const DECIDED_STATES = Object.freeze({ task: ['done'], adr: ['accepted'], 'decision-log': ['ready'], bug: ['resolved', 'closed'] });

/** When an element reached `status`: the timestamp of its last move into it (`memory history` entries), or null. */
export function reachedAt(entries, status) {
  return reachedBy(entries, status)?.timestamp ?? null;
}

/** The move that last brought an element into `status`: { timestamp, reason, approver }, or null. */
export function reachedBy(entries, status) {
  const move = (entries ?? []).filter((e) => e.to === status && e.from !== status).at(-1);
  return move ? { timestamp: move.timestamp ?? null, reason: move.reason ?? null, approver: move.approver ?? null } : null;
}

/**
 * The elements that settle a task and were decided after a moment: each candidate ({ type, id,
 * title, status, decidedAt, reason }, from its `needs` and the elements whose `origin` is the task)
 * in a decided state reached later than `since` (an ISO time, or a return whose timestamp is used).
 * Oldest first; none without a moment.
 */
export function decidedSince(since, candidates) {
  since = Date.parse((typeof since === 'string' ? since : since?.timestamp) ?? '');
  if (Number.isNaN(since)) return [];
  return (candidates ?? [])
    .filter((c) => (DECIDED_STATES[c.type] ?? []).includes(c.status) && Date.parse(c.decidedAt ?? '') > since)
    .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
}

/** The state after `status` in the type's sequence (`memory.yaml`), or null. */
export function nextState(memoryYaml, type, status) {
  const sequence = memoryYaml?.types?.[type]?.states?.sequence ?? memoryYaml?.defaults?.states?.sequence ?? [];
  const at = sequence.indexOf(status);
  return at >= 0 && at + 1 < sequence.length ? sequence[at + 1] : null;
}

/**
 * Whether a step moves its element into a state with a WIP limit (`memory.yaml` `limits`): its
 * actions hold `memory.submit` and the element's next state is limited. The runner asks WingFoil
 * (`memory submit --dry-run`) before launching such a step.
 */
export function limitedMove(step, element, memoryYaml) {
  if (!(step.actions ?? []).some((a) => a.token === 'memory.submit')) return false;
  const next = nextState(memoryYaml, element.type, element.status);
  const limits = memoryYaml?.types?.[element.type]?.states?.limits ?? {};
  return next !== null && Number.isInteger(limits[next]);
}

/** Whether WingFoil refused a move for a WIP limit (the output of `memory submit`). */
export function wipRefused(output) {
  return /WIP limit reached/i.test(String(output ?? ''));
}

/** How the step completes, from the evidence it still misses (`workflow status`). */
export function exitLine(step, element, next) {
  const missing = step.evidence?.missing ?? [];
  if (!missing.length) return '';
  const parts = missing.map((kind) => {
    if (kind === 'state') {
      const verb = (step.actions ?? []).map((a) => a.token).find((t) => /^memory\.(submit|approve|park)$/.test(t)) ?? 'memory.submit';
      return `${element.ref} must reach ${next ?? 'its next state'}: run npx wingfoil ${verb.replace('.', ' ')} ${element.id} once the work is done`;
    }
    if (kind === 'created') return 'each element type its actions add must be created with --workflow and --step';
    if (kind === 'record') return 'the runner records it after your answer';
    return `${kind} evidence`;
  });
  return `This step completes from its evidence (${missing.join(', ')}): ${parts.join('; ')}. An answer "completed" without it fails.`;
}

/**
 * How the step that closes a task merges it (directive agent-branches): from the line's checkout,
 * through an integration branch rebased onto the line's branch and fast-forwarded into it, never
 * inside the task's worktree (Codex's sandbox mounts a worktree's git directory read-only).
 */
/**
 * The command forms a headless session may run: no one can approve a refusal, and
 * Claude Code refuses a cd joined to git or npm and npm --prefix, while it runs the same work as a
 * cd of its own followed by the command, or git -C.
 */
export const COMMAND_FORMS = 'Run each command as its own call, in a form a headless run may run (no one can approve a refusal): a cd alone, then the command; never cd … && git … or cd … && npm … in one command, never npm --prefix; git on another folder: a cd of its own first, never git -C.';

export function integrationText({ checkout, worktree, lineBranch, branch, id, test = 'npm test', merge = 'ff' }) {
  const integration = `integration/${id}`;
  return [
    `Integrate from ${checkout}, the line's checkout, NEVER inside ${worktree}: the task's worktree git directory is read-only in your sandbox, and the merge belongs to the line (directive agent-branches). In ${checkout}, in this order:`,
    `git switch --create ${integration} ${branch}`,
    `git rebase ${lineBranch}`,
    test,
    `git switch ${lineBranch}`,
    merge === 'no-ff' ? `git merge --no-ff -m "merge: ${id}" ${integration}` : `git merge --ff-only ${integration}`,
    `git branch -D ${integration}`,
    `Leave ${branch} and its worktree as they are. On a conflict or a failing test: git rebase --abort (if a rebase is under way), git switch ${lineBranch}, git branch -D ${integration}, and answer RESULT: blocked <reason>. In every case end with ${checkout} on ${lineBranch}.`,
    `Memory and workflow commands: ONLY in ${checkout} (branch ${lineBranch}).`,
    COMMAND_FORMS,
  ].join('\n');
}

export function buildPrompt({ project, step, element, line, worktree, checkout, branch, stateRef, returned = null, decided = [], exit = '', author = null, amend = null, amended = null, push = false, lineBranchNames = [], integrate = false, raising = true, sessionContext = true, runsTests = 'npm test', elementPath = null, liveResults = [], cli = 'npx wingfoil', rulings = [], decisions = [], unblocked = null, merge = 'ff' }) {
  if (amend) { exit = ''; }
  const amendText = amend
    ? [
      `This is a red amendment (directive runner), asked by ${amend.by ?? 'the review'}: a test that red wrote contradicts ${cite(line.name, amend.decision)}.`,
      `Amend ONLY these files, so that they test what ${cite(line.name, amend.decision)} decides: ${amend.files.join(', ')}. Read the decision first.`,
      amend.note ? `The approver's note, follow it: ${amend.note}` : '',
      returned ? `The reasons of the last ${returned.operation} (${returned.author}, ${returned.timestamp}), for context; implement nothing else they ask:\n${returned.reason}` : '',
      'Touch no other file (no source, no other test): the runner refuses a run that changed any file outside the list. Commit on the task branch. Do not run memory submit or any workflow command: the task stays where it is.',
    ].filter(Boolean).join('\n')
    : '';
  const checks = [...(step.checks?.pre ?? []), ...(step.checks?.post ?? [])].map((c) => c.token);
  const lines = [
    `You are launched headless by the ${project} runner (directive runner) on line '${line.name}'.`,
    'Do exactly one workflow step, then stop.',
    '',
    `Step: ${step.key} (workflow ${step.workflow}, phase ${step.phase}, instance ${step.instance}).`,
    `Role: ${step.role}. Element: ${element.ref}${element.status ? ` (status ${element.status})` : ''}. Cite it as ${cite(line.name, element.id)}.`,
    `Directives of your role, read them first: ${(step.directives ?? []).map((d) => d.id).join(', ') || 'none'}.`,
    amend ? 'Actions: amend the named test files (a red amendment: not a step of the workflow\'s frontier).' : `Actions: ${(step.actions ?? []).map((a) => a.text ?? a.token).join('; ') || 'none (a checkpoint)'}.`,
    step.produces?.length ? `Produces: ${step.produces.map((p) => p.pattern ?? p.path ?? JSON.stringify(p)).join(', ')}.` : '',
    amend ? '' : `Read the step with: npx wingfoil workflow next ${step.instance}`,
    stateRef && sessionContext ? `Your context: the MCP resource wingfoil://session/${step.role}/${element.ref}/${stateRef}` : '',
    elementPath && worktree !== checkout ? `The element's current text is ${elementPath}: read that file. The copy in your worktree may be older.` : '',
    liveResults.length ? `The runner ran these live checks outside your sandbox. Use these results and do not run them yourself: inside a sandbox they fail for reasons that are not the code's.\n${liveResults.map((r) => `- ${r.name}: ${r.ok ? 'passed' : `FAILED (exit ${r.status})\n${r.tail}`}`).join('\n')}` : '',
    rulings.length ? `The approver ruled at the gates before this step. These rulings are part of your task: address every point.\n${rulings.map((r) => `- ${r.step}: ${r.reason}`).join('\n')}` : '',
    unblocked ? `The approver closed the block of this step's last run (${unblocked.id}) with: ${unblocked.how}. Follow it.` : '',
    decisions.length ? `The approver ruled on the decisions this step asked for. Follow each ruling; a rejected one names what to change before you ask again.\n${decisions.map((d) => `- ${d.question}: ${d.ruling === 'reject' ? 'REJECTED' : 'approved'} (${d.id}). ${d.reason}`).join('\n')}` : '',
    amendText,
    returned && !amend ? `This step resumes after a ${returned.operation} by ${returned.author} (${returned.timestamp}). Its reasons, address every point before you answer:\n${returned.reason}\nWhere the reasons name a class or a structural solution, implement the solution for the whole class; a change that only handles the reproduced cases does not address the point (directive code-review).` : '',
    !amend && amended
      ? returned && !amended.asked && !amended.since
        ? `Red's tests were amended after that return, at ${amended.head} (run ${amended.id}): those are red's tests now; make them pass and do not touch them. The Red amendment line of the reasons is settled.`
        : `Red's tests were amended at ${amended.head} (run ${amended.id})${amended.asked ? `, as ${amended.asked} asked` : ''}: those are red's tests now; make them pass and do not touch them.`
      : '',
    ['green', 'refactor'].includes(step.phase) && !amend
      ? `If a test red wrote contradicts an accepted decision (an adr, a decision-log, the specification), do not change it: end your RESULT line with the red amendment it needs, RESULT: blocked <why>. Red amendment (${line.name}:<decision id>): <file>[, <file>…], naming those test files last on the line; the runner then has red amend them, and this step resumes after.`
      : '',
    !amend && decided.length
      ? `${returned ? 'Decided since that return, and prevailing over the reasons where they differ' : 'Decided since this step last stopped'}: ${decided.map((d) => `${cite(line.name, d.id)} (${d.title})${d.reason ? `, ${d.status} with the approver's reason: ${d.reason}` : ''}`).join('; ')}. Read each before you start; implement what it decides and every point of the approver's reason${returned ? ', and say in your commit which reason it replaces' : ''}.`
      : '',
    exit,
    '',
    worktree === checkout
      ? `Work in ${checkout} (branch ${line.branch}): the line's checkout, where Memory commands run.`
      : integrate
        ? integrationText({ checkout, worktree, lineBranch: line.branch, branch, id: element.id, test: runsTests, merge })
        : `Code and tests: in ${worktree} (branch ${branch}), committed on that branch.\nMemory and workflow commands: ONLY in ${checkout} (branch ${line.branch}): cd there with a cd of its own, and back to ${worktree} the same way before code, tests and git.\n${COMMAND_FORMS}`,
    `Memory changes only through the pinned CLI (directive cli-only-writes). An element this step creates takes --workflow ${step.instance} --step ${step.key}; custom fields (release, kind, scope, tags, …) are written in the draft right after memory add.`,
    /^task:/.test(element.ref) && raising
      ? `If the step needs an element it cannot settle itself (another task, an adr: the task or the specification calls a choice architectural, or the work adds a dependency or changes a public contract; a decision-log; a bug: a defect outside this task), look for it first in ${checkout}: npx wingfoil memory search <keyword>. One that exists and is still open (a task not done, an adr not accepted, a decision-log not ready, a bug not resolved): add its id to the task's needs: list in its frontmatter, commit, and answer RESULT: blocked needs <id>[, <id>…]. One that is missing: raise it, npx wingfoil memory add --type <adr|decision-log|bug> --title "<the decision or the defect, nothing else>" WITHOUT --workflow and --step, write origin: ${element.id} and its Context in the draft, commit, and answer RESULT: blocked raised <id>[, <id>…]. Never a duplicate of an open element. In both cases do not move the task (no memory submit) unless this is start, which pulls it first: dev-loop holds it until each is closed. What you raise never goes in the task's needs: its own gate holds the task, and listing it there stalls the task.`
      : '',
    'Your git identity is already set: commit in small commits (directive git-conventions).',
    author
      ? `Each commit's body cites ${cite(line.name, element.id)}, and the message ends with these two trailers, the first with your own name:\nCo-Authored-By: <your name and model> <${author.email}>\nAI-Model: ${author.model}`
      : '',
    'Do not run workflow finalize, memory approve or memory reject, and do not push: the runner finalizes after its bound checks, and the approver approves.',
    pushText(step, { push, checkout, lines: lineBranchNames }),
    step.phase === 'review'
      ? `Review: to accept, leave the element as it is and answer completed. To reject, in ${checkout} run npx wingfoil memory park ${element.id} --reason "<the reasons>" and answer rejected with the reasons. Name each finding's class and, when one exists, the structural solution that removes the class; look for the other cases of each class first (directive code-review). If the reject needs an adr, a decision-log or a bug, raise it first (as below), cite its id in the reasons, then park and answer rejected: dev-loop holds the task until it is closed. If a finding's cause is a test red wrote that contradicts an accepted decision (an adr, a decision-log, the specification), the solution is a red amendment: add to the reasons the line Red amendment (${line.name}:<decision id>): <file>[, <file>…] naming those test files, and never ask green or refactor to change red's files.`
      : '',
    checks.length ? `After you, the runner runs the bound checks: ${checks.join(', ')}.` : '',
    '',
    'End your answer with exactly one line:',
    'RESULT: completed | rejected <reasons> | blocked <reason> | blocked decision <question>',
    '(rejected: a review that does not accept the work; blocked: you cannot do the step; blocked decision: a directive or the element asks for the approver\'s ruling before you go on, so commit what you prepared and ask one question the approver can approve or reject, naming what they rule on). Before it, state the evidence of what you did (directive claim-evidence).',
  ];
  return lines.filter((text, i, all) => text !== '' || (i > 0 && all[i - 1] !== '')).join('\n').trim().replaceAll('npx wingfoil', cli);
}

/** The RESULT line of an agent's answer: { result, reason }. */
export function parseResult(text) {
  const matches = [...String(text ?? '').matchAll(/^RESULT:\s*(completed|rejected|blocked)\b[ \t]*(.*)$/gim)];
  const match = matches.at(-1);
  if (!match) return { result: 'error', reason: 'no RESULT line in the agent output' };
  return { result: match[1].toLowerCase(), reason: match[2].trim() };
}

/**
 * The elements a step raised or found it needs (`RESULT: blocked raised <id>[, <id>…]`: an adr, a
 * decision-log or a bug whose `origin` is the step's element; `RESULT: blocked needs <id>[, <id>…]`:
 * ids added to the task's `needs`). dev-loop's gates hold the element until each is closed, so such
 * a result opens no blocked notice. `null` for any other reason.
 */
export function raisedIds(reason) {
  const match = /^(?:raised|needs)\s+(.+)$/i.exec(String(reason ?? '').trim());
  if (!match) return null;
  const ids = match[1].split(/[\s,]+/).filter((id) => /^[a-z][a-z-]*-\d+(-[a-z0-9.-]*[a-z0-9])?$/.test(id));
  return ids.length ? ids : null;
}

/**
 * The question of a step that waits for the approver's ruling (`RESULT: blocked decision
 * <question>`): a checkpoint a directive or the element asks for, not a fault. Null otherwise.
 */
export function decisionQuestion(reason) {
  const match = /^decision\s*:?\s+([\s\S]+)$/i.exec(String(reason ?? '').trim());
  return match ? match[1].trim() : null;
}

/** The commit message `gate.mjs` writes for a ruled decision notice; `decisionRulings` reads it. */
export function decisionMessage({ id, run, question, ruling, reason, approver }) {
  return [`runner: decision ${id} ${ruling === 'reject' ? 'rejected' : 'approved'}`, '', `Question: ${question}`, `Run: ${run}`, `Ruling: ${ruling}`, `Approver: ${approver}`, `Reason: ${reason}`].join('\n');
}

/**
 * The approver's rulings on the decisions a step asked for, from `git log --format=%cI%x00%B%x1e`:
 * the commits `decisionMessage` writes for runs of the same element and phase, later than `since`,
 * oldest first.
 */
export function decisionRulings(log, { element, phase, since = null }) {
  const from = Date.parse(since ?? '');
  const prefix = `${element}/${phase}/`;
  return String(log ?? '').split('\x1e').map((entry) => entry.trim()).filter(Boolean).flatMap((entry) => {
    const [at, body = ''] = entry.split('\x00');
    const head = /^runner: decision (N-\d+) /.exec(body);
    const field = (name) => new RegExp(`^${name}: (.*)$`, 'm').exec(body)?.[1]?.trim() ?? null;
    if (!head || !String(field('Run') ?? '').startsWith(prefix)) return [];
    if (!Number.isNaN(from) && Date.parse(at) <= from) return [];
    const reason = /^Reason: ([\s\S]*)$/m.exec(body)?.[1]?.trim() ?? '';
    return [{ id: head[1], question: field('Question'), ruling: field('Ruling') === 'reject' ? 'reject' : 'approve', reason, at }];
  }).reverse();
}

/**
 * Whether dev-loop's gates hold a step that answered blocked raised or blocked needs. A start that
 * left its task where it was is not held by them: the gates come after start.
 */
export function heldByGates({ phase, reason, statusBefore, statusAfter }) {
  if (!raisedIds(reason)) return false;
  return !(phase === 'start' && statusBefore === statusAfter);
}

/**
 * The ids in a task's needs that the task itself raised (origin): the gate over needs comes before
 * the gates over what the task raised, so such a task waits for an element no step can write.
 */
export function needsItRaised(needs, taskId, originOf) {
  return (Array.isArray(needs) ? needs : []).filter((id) => originOf(id) === taskId);
}

/**
 * Tokens, model, session, final text and error flag from a headless output: Claude Code's
 * `--output-format json` (one object) or Codex's `exec --json` (JSON lines).
 */
export function parseOutput(stdout) {
  const tokens = { input: NOT_REPORTED, output: NOT_REPORTED, cache_read: NOT_REPORTED, cache_write: NOT_REPORTED };
  let model = NOT_REPORTED;
  let text = '';
  let session = null;
  let isError = false;
  let errorText = '';
  const commands = [];
  const objects = [];
  try {
    objects.push(JSON.parse(stdout));
  } catch {
    for (const line of String(stdout).split('\n')) {
      if (!line.trim().startsWith('{')) continue;
      try { objects.push(JSON.parse(line)); } catch { /* not JSON */ }
    }
  }
  const add = (key, value) => {
    if (Number.isSafeInteger(value) && value >= 0) tokens[key] = (tokens[key] === NOT_REPORTED ? 0 : tokens[key]) + value;
  };
  for (const o of objects) {
    if (o === null || typeof o !== 'object') continue;
    if (o.type === 'result' || 'result' in o) {
      text = typeof o.result === 'string' ? o.result : text;
      session = o.session_id ?? session;
      if (o.is_error === true) { isError = true; errorText = typeof o.result === 'string' ? o.result : errorText; }
      const u = o.usage ?? {};
      add('input', u.input_tokens);
      add('output', u.output_tokens);
      add('cache_read', u.cache_read_input_tokens);
      add('cache_write', u.cache_creation_input_tokens);
      const models = Object.keys(o.modelUsage ?? {});
      if (models.length) model = models.join(',');
    }
    if (o.type === 'thread.started') session = o.thread_id ?? session;
    if (o.type === 'turn.completed' && o.usage) {
      // Codex counts the cached input inside input_tokens; Claude does not. Without the cache, the
      // two agents' input means the same (each project's decision-log dl-001).
      add('input', Math.max(0, (o.usage.input_tokens ?? 0) - (o.usage.cached_input_tokens ?? 0)));
      add('output', o.usage.output_tokens);
      add('cache_read', o.usage.cached_input_tokens);
    }
    if (o.type === 'turn.failed' || o.type === 'error') { isError = true; errorText = o.error?.message ?? o.message ?? errorText; }
    if (o.type === 'item.completed' && o.item?.type === 'agent_message') text = o.item.text ?? text;
    if (o.type === 'item.completed' && o.item?.type === 'command_execution') commands.push(o.item.command ?? '');
    if (typeof o.model === 'string') model = o.model;
  }
  return { tokens, model, text, session, isError, errorText, commands, parsed: objects.length > 0 };
}

// ---- run records --------------------------------------------------------------------------------

/** A run record in WingFoil's run-log format, as its log line (validated by WingFoil's writer). */
export function runRecordLine(fields) {
  return runLog.serializeRunRecord(Object.fromEntries(RUN_RECORD_KEYS.map((key) => [key, fields[key] ?? NOT_REPORTED])));
}

/** The run records of a run-log file's text (WingFoil's reader; throws on a bad log). */
export function parseRunRecords(text, path) {
  const parsed = runLog.parseRunLog(text, path);
  if (!parsed.ok) throw new Error(parsed.error?.message ?? `run log ${path} is not valid`);
  return parsed.value;
}

/** The next run id of an element's phase: `<element id>/<phase>/<n>`. */
export function nextRunId(records, elementId, phase) {
  const n = records.filter((r) => r.id.startsWith(`${elementId}/${phase}/`)).length + 1;
  return runLog.formatRunId(elementId, phase, n);
}

/** The commit subject of a run record: WingFoil's own (`agent: record <run-id>`). */
export function recordSubject(record) {
  return runLog.recordSubject(record.id);
}

/** Runner facts kept in a record's `notes`: `line=… week=… at=… step=… head=… checks=… reason=…`. */
export function formatNotes(facts) {
  return Object.entries(facts).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, '_')}`).join(' ');
}

export function parseNotes(notes) {
  return Object.fromEntries(String(notes ?? '').split(' ').filter(Boolean).map((pair) => {
    const at = pair.indexOf('=');
    return at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
  }));
}

/** The ISO week of a date: { year, week, label: 'yyyy-Www' }. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week, label: `${year}-W${String(week).padStart(2, '0')}` };
}

/** The plan id `workflow start <main> --set phase=<line>-<week>` gives (one per line and week). */
export function weeklyPlanId(main, line, week) {
  return `${main}-${line}-${week.toLowerCase()}-plan`;
}

/**
 * The weight of each token field in the budget: the cache at its price relative to input (a cache
 * write 1.25×, a cache read 0.1×), input and output at 1×. The result is one token count, in
 * input-token equivalents; the run records keep the raw fields.
 */
export const TOKEN_WEIGHTS = Object.freeze({ input: 1, output: 1, cache_write: 1.25, cache_read: 0.1 });

/** The weighted tokens of one run record; a field not reported counts as 0. */
export function weightedTokens(tokens, weights = TOKEN_WEIGHTS) {
  return Object.entries(weights)
    .reduce((sum, [key, weight]) => sum + (Number.isInteger(tokens?.[key]) ? tokens[key] * weight : 0), 0);
}

/** Weighted tokens a line spent in a week (rounded up), from run records whose notes carry week=. */
export function weekTokens(records, line, week, weights = TOKEN_WEIGHTS) {
  const spent = records.filter((r) => { const n = parseNotes(r.notes); return n.line === line && n.week === week; })
    .reduce((sum, r) => sum + weightedTokens(r.tokens, weights), 0);
  // Rounded to a millionth first, so a float residue (30 × 0.1 = 3.0000000000000004) is not a token.
  return Math.ceil(Math.round(spent * 1e6) / 1e6);
}

/** The budget of a line: null when it lets the runner launch, else the notice that stops it. */
export function budgetStop({ line, records, week, weights = TOKEN_WEIGHTS }) {
  if (!Number.isInteger(line.weekly_token_budget) || line.weekly_token_budget <= 0) {
    return { key: `budget-${line.name}-unset`, reason: 'the weekly token budget of the line is not set', command: `set lines.${line.name}.weekly_token_budget in config/runner.yaml (governance-evolution, on the trunk)` };
  }
  const spent = weekTokens(records, line.name, week, weights);
  if (spent >= line.weekly_token_budget) {
    return { key: `budget-${line.name}-${week}`, reason: `the weekly token budget is spent (${spent} of ${line.weekly_token_budget} weighted tokens, ${week})`, command: `wait for the next week, or raise lines.${line.name}.weekly_token_budget in config/runner.yaml (governance-evolution, on the trunk)` };
  }
  return null;
}

/**
 * A halt of the line (a notice only the approver closes, with `run.mjs --line <line> --resume`):
 * an element rejected `review_rejections` times in review, or `errors_in_a_row` errors in a row.
 * Only the records after the line's last resume count.
 */
export function haltReason({ line, records, limits, element, resumedAt = null, repo = '.' }) {
  const resume = `cd ${repo} && node scripts/runner/run.mjs --line ${line.name} --resume`;
  const after = (r) => !resumedAt || String(parseNotes(r.notes).at) > resumedAt;
  // A provider's usage limit says nothing about the step: it holds the agent, it never halts the line.
  const ofLine = records.filter((r) => parseNotes(r.notes).line === line.name && after(r) && !parseNotes(r.notes).limit)
    .sort((a, b) => String(parseNotes(a.notes).at).localeCompare(String(parseNotes(b.notes).at)));
  if (element) {
    const rejected = ofLine.filter((r) => r.element === element && r.phase === 'review' && r.result === 'rejected').length;
    if (rejected >= limits.review_rejections) {
      return { key: `halt-${line.name}-rejected-${element.replace(/^[a-z-]+:/, '')}`, reason: `${cite(line.name, element)} rejected ${rejected} times in review: rule it first (npx wingfoil memory history ${element.replace(/^[a-z-]+:/, '')})`, command: resume };
    }
  }
  const tail = ofLine.slice(-limits.errors_in_a_row);
  if (tail.length === limits.errors_in_a_row && tail.every((r) => r.result === 'error' || r.result === 'check-failed')) {
    const last = parseNotes(tail.at(-1).notes).reason ?? '';
    return { key: `halt-${line.name}-errors`, reason: `${limits.errors_in_a_row} errors in a row, the last: ${last.replace(/_/g, ' ')}; fix the cause first (npx wingfoil agent list)`, command: resume };
  }
  return null;
}

/**
 * distinct_from (WingFoil 0.3.2 validates it, enforces nothing): a step is refused when its
 * session ran one of the phases it names on the same element; when the CLI names no session, when
 * the same agent and adapter did, since a different session cannot be proved, unless newSession
 * says the launch about to happen cannot resume one (the run's reported session is checked after
 * it, without newSession); and, on a line with a reviewer agent, when a reviewer step would be run
 * by the agent that did the work.
 */
export function distinctViolation(records, element, distinctFrom, { session, agent, adapter, role, line, newSession = false }) {
  if (!distinctFrom?.length) return null;
  const earlier = records.filter((r) => r.element === element && distinctFrom.includes(r.phase) && r.result === 'completed');
  for (const r of earlier) {
    if (session && r.session === session) return `session ${session} already ran ${r.phase} of ${element}`;
  }
  if (role === 'reviewer' && line?.reviewer_agent) {
    const own = earlier.find((r) => r.agent === agent);
    if (own) return `agent ${agent} already ran ${own.phase} of ${element}, and line ${line.name} is reviewed by ${line.reviewer_agent}`;
  }
  return earlier.length && !session && !newSession && earlier.some((r) => r.agent === agent && r.adapter === adapter)
    ? `cannot prove a different session from ${earlier.map((r) => r.phase).join(', ')} of ${element}`
    : null;
}

// ---- notices ------------------------------------------------------------------------------------

const OPEN_MARK = '<!-- runner:open -->';
const CLOSED_MARK = '<!-- runner:closed -->';

/** The entries of docs/notices.md: { key, id, open, start, end, text, closedAt }. */
export function notices(text) {
  const lines = String(text).split('\n');
  const closedAt = lines.findIndex((l) => l.includes(CLOSED_MARK));
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^<!-- key:([^ ]+) -->$/.exec(lines[i].trim());
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && !/^<!-- key:/.test(lines[end].trim()) && !lines[end].startsWith('## ') && !lines[end].includes(CLOSED_MARK)) end += 1;
    const block = lines.slice(i, end).join('\n');
    const closed = /\*\*Status:\*\* closed (\S+)/.exec(block);
    out.push({ key: m[1], id: /### (N-\d+)/.exec(block)?.[1] ?? null, open: closedAt === -1 || i < closedAt, start: i, end, text: block, closedAt: closed?.[1] ?? null });
  }
  return out;
}

/** The keys of the open notices, optionally only those starting with a prefix. */
export function openNoticeKeys(text, prefix = '') {
  return notices(text).filter((n) => n.open && n.key.startsWith(prefix)).map((n) => n.key);
}

// ---- what a run prints ------------------------------------------------------------------------

/** A log line's time: local, to the second, as the terminal around the runner shows it. */
export function logStamp(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

/** A step's launch: the element is named only when the step's key does not already end with it. */
export function launchLine(step, element, adapter) {
  const on = step.key.endsWith(`@${element.ref}`) ? '' : ` on ${element.ref}`;
  return `${step.key}${on} as ${step.role} with ${adapter}`;
}

/** A step's outcome: how long it took, what it cost, and its reason cut to one readable line. */
export function outcomeLine({ result, reason = '', durationMs, tokens }) {
  const seconds = Math.round(durationMs / 1000);
  const time = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
  const weighted = weightedTokens(tokens ?? {});
  const cost = weighted > 0 ? `, ${(weighted / 1e6).toFixed(2)} M tokens` : '';
  const why = String(reason).replace(/\s+/g, ' ').trim();
  return `→ ${result} in ${time}${cost}${why ? `: ${why.length > 220 ? `${why.slice(0, 219)}…` : why}` : ''}`;
}

/** Why every open step waits, without the causes at zero; null when each one already has its own line. */
export function waitingLine({ gates = 0, waits = 0, limited = 0, blocked = 0 }) {
  if (waits === 0 && gates + limited + blocked < 2) return null;
  const parts = [[gates, 'for the approver'], [waits, 'for what a task needs'], [limited, 'for a WIP limit'], [blocked, 'blocked']];
  return `waiting: ${parts.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}`).join(', ')}`;
}

/**
 * What a run that only waits prints: its lines the first time, nothing while they stay the same, and
 * once every `everyMs` a reminder saying how long they have held. `previous` is the state the last
 * run left; `state` is what this run leaves.
 */
export function repeatedWait(previous, lines, nowMs, everyMs) {
  const signature = lines.join('\n');
  if (previous?.signature !== signature) return { print: lines, state: { signature, since: nowMs, printed: nowMs, runs: 1 } };
  const runs = previous.runs + 1;
  if (nowMs - previous.printed < everyMs) return { print: [], state: { ...previous, runs } };
  const minutes = Math.round((nowMs - previous.since) / 60000);
  const held = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
  return { print: [`unchanged for ${held} (${runs} runs):`, ...lines.map((l) => `  ${l}`)], state: { ...previous, runs, printed: nowMs } };
}

/** The next notice id (N-001, N-002, …). */
export function nextNoticeId(text) {
  const ids = [...String(text).matchAll(/### N-(\d+)/g)].map((m) => Number(m[1]));
  return `N-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0')}`;
}

/** One notice entry of docs/notices.md. */
export function noticeKind(key) {
  return String(key).split('-')[0];
}

export function noticeEntry({ key, id, at, line, element, reason, command, packet = null }) {
  return [
    `<!-- key:${key} -->`,
    `### ${id} · ${at.slice(0, 10)} · ${cite(line, element)}`,
    '',
    '- **Status:** open',
    `- **Kind:** ${noticeKind(key)}`,
    `- **Opened:** ${at.slice(0, 19)}Z`,
    `- **Line:** ${line}`,
    `- **Element:** ${cite(line, element)}`,
    `- **Reason:** ${reason}`,
    ...(packet ? [`- **Ready:** ${packet.ready ? 'yes' : `no: ${packet.problems.join('; ')}`}`, `- **Head:** ${packet.head}`, `- **Evidence:** ${packet.evidence}`] : []),
    `- **Unblock:** \`${command}\``,
    '',
  ].join('\n');
}

/** docs/notices.md with an entry added under Open, unless an open entry has the same key. */
export function addNotice(text, { key, at, line, element, reason, command, packet = null }) {
  if (openNoticeKeys(text).includes(key)) return { text, added: false };
  if (!text.includes(OPEN_MARK)) throw new Error(`docs/notices.md has no ${OPEN_MARK} marker`);
  const id = nextNoticeId(text);
  const entry = noticeEntry({ key, id, at, line, element, reason, command: String(command).replaceAll('{id}', id), packet });
  return { text: text.replace(OPEN_MARK, `${OPEN_MARK}\n\n${entry.trimEnd()}`), added: true };
}

/** docs/notices.md with the open entry of this key moved under Closed, with the date and how. */
export function closeNotice(text, key, { at, how }) {
  const entry = notices(text).find((n) => n.open && n.key === key);
  if (!entry) return { text, closed: false };
  const lines = text.split('\n');
  const block = lines.splice(entry.start, entry.end - entry.start).join('\n').trimEnd()
    .replace('- **Status:** open', `- **Status:** closed ${at.slice(0, 19)}Z — ${how}`);
  const marker = lines.findIndex((l) => l.includes(CLOSED_MARK));
  if (marker === -1) throw new Error(`docs/notices.md has no ${CLOSED_MARK} marker`);
  lines.splice(marker + 1, 0, '', ...block.split('\n'));
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n'), closed: true };
}

/** When the approver last resumed a line: the latest close of one of its halt notices, or null. */
export function lastResume(text, line) {
  return notices(text).filter((n) => !n.open && n.key.startsWith(`halt-${line}-`) && n.closedAt)
    .map((n) => n.closedAt).sort().at(-1) ?? null;
}

// ---- lock ---------------------------------------------------------------------------------------

/** Whether a lock is stale: its process is gone, or it is older than the limit. */
export function lockIsStale(lock, { now = Date.now(), staleMinutes, alive }) {
  if (!alive(lock.pid)) return true;
  return now - Date.parse(lock.started) > staleMinutes * 60000;
}
