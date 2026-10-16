/**
 * The git transport commands of spec-010 §4 (write class (c), REQ-ARC-03, REQ-INT-06; task-033):
 * argument arrays (no shell, REQ-SEC-05), each prefixed with {@link TRANSPORT_SETTINGS}, and their
 * environment ({@link transportEnv}).
 *
 * | Operation | Arguments (after the settings) |
 * |-----------|--------------------------------|
 * | fetch | `-c fetch.pruneTags=false --config-env=remote.<remote>.pruneTags=<empty> fetch --quiet --prune --no-recurse-submodules -- <remote>` — prunes tracking refs only (task-034 D34-5, bug-014) |
 * | update (manual) | `-c fetch.pruneTags=false --config-env=remote.<r>.pruneTags=<empty> --config-env=branch.<b>.mergeOptions=<empty> pull --no-prune --ff-only --no-squash --strategy=ort --no-rebase --no-autostash --no-recurse-submodules --quiet` |
 * | update (automatic) | `--config-env=branch.<b>.mergeOptions=<empty> merge --ff-only --no-squash --strategy=ort --no-edit --no-stat --no-autostash --quiet -- @{u}` (task-034, RP-41) |
 * | push | `push --quiet --no-follow-tags --recurse-submodules=no -- <remote> HEAD:<merge ref>` — never forced: no `+`, an explicit refspec |
 *
 * `<remote>` is always a name `git remote` lists and `<merge ref>` a checked branch ref (D33-8), both
 * after `--`. `--ff-only` alone does not prevent a merge commit (task-034 probe 3, bug-014):
 * `branch.<b>.mergeOptions = -s ours` or `pull.twohead = ours` make one, `--squash` stages the
 * incoming change without moving HEAD. `--strategy=ort` replaces `pull.twohead`, `--no-squash` a
 * configured squash, and the branch's `mergeOptions` is emptied with `--config-env` (which splits
 * at the last `=`; `-c` would split a branch name holding `=` at its first and be ignored).
 *
 * Unattended runs (the scheduler, task-034) add {@link noHooksArgs} (D34-1), {@link unattendedEnv}
 * (D34-3) and the {@link UNATTENDED_TIMEOUT_MS} limit of an automatic fetch and an auto-push (RP-20,
 * RP-33); the automatic merge has no limit (D34-7: a killed checkout leaves the tree half updated).
 */
import path from 'node:path';
import { ALLOWED_PROTOCOLS, CLONE_SETTINGS, NO_FSMONITOR } from './git.js';

/**
 * The settings of every transport command: the protocols of {@link CLONE_SETTINGS} (`ext::`, `fd::`
 * refused) and no automatic maintenance (D33-3): `fetch`, `pull` and its `merge` would otherwise
 * start `git maintenance run --auto` / `gc --auto`, which may detach and outlive a cancelled
 * process group or the server.
 */
export const TRANSPORT_SETTINGS: readonly string[] = [
  ...CLONE_SETTINGS,
  '-c',
  'maintenance.auto=false',
  '-c',
  'gc.auto=0',
  '--no-optional-locks',
];

/** The variable every transport command gets with an empty value ({@link transportEnv}): `--config-env` reads it. */
export const EMPTY_VARIABLE = 'WINGFOIL_UI_EMPTY';

/** Kill an automatic fetch and an auto-push after this much process time (RP-20, RP-33). */
export const UNATTENDED_TIMEOUT_MS = 60_000;

/** `key` set to the empty value for this command (a boolean reads `false`, a list nothing). */
function emptied(key: string): string {
  return `--config-env=${key}=${EMPTY_VARIABLE}`;
}

/**
 * `git fetch` of `remote` (spec-010 §4, RP-35: `--prune`), which prunes the tracking refs only: the
 * tag pruning of `fetch.pruneTags` / `remote.<r>.pruneTags` is turned off (bug-014). The refspecs
 * themselves are checked before ({@link trackingRefspecs}).
 */
export function fetchArgs(remote: string): string[] {
  return [
    ...TRANSPORT_SETTINGS,
    '-c',
    'fetch.pruneTags=false',
    emptied(`remote.${remote}.pruneTags`),
    'fetch',
    '--quiet',
    '--prune',
    '--no-recurse-submodules',
    '--',
    remote,
  ];
}

/**
 * The manual update: `git pull --ff-only` of the upstream of `branch` on `remote` (spec-010 §4,
 * RP-37: not cancellable), never a merge commit nor a squash (bug-014), and its own fetch prunes
 * nothing (`--no-prune`, tag pruning off: `fetch.prune` would otherwise apply, review R1).
 */
export function pullArgs(branch: string, remote: string): string[] {
  return [
    ...TRANSPORT_SETTINGS,
    // The pull's own fetch follows `fetch.prune` / `remote.<r>.prune*`: no pruning there (review R1).
    '-c',
    'fetch.pruneTags=false',
    emptied(`remote.${remote}.pruneTags`),
    emptied(`branch.${branch}.mergeOptions`),
    'pull',
    '--no-prune',
    '--ff-only',
    '--no-squash',
    '--strategy=ort',
    '--no-rebase',
    '--no-autostash',
    '--no-recurse-submodules',
    '--quiet',
  ];
}

/**
 * The automatic update of `branch` (spec-010 §4, §6, RP-41): a fast-forward to the tracking ref the
 * tick's fetch just updated — local, never a merge commit nor a squash (D34-2).
 */
export function mergeArgs(branch: string): string[] {
  return [
    ...TRANSPORT_SETTINGS,
    emptied(`branch.${branch}.mergeOptions`),
    'merge',
    '--ff-only',
    '--no-squash',
    '--strategy=ort',
    '--no-edit',
    '--no-stat',
    '--no-autostash',
    '--quiet',
    '--',
    '@{u}',
  ];
}

/**
 * The global options of an unattended command (D34-1): `core.hooksPath` = `hooksPath`, a regular
 * file (the clone's `NO_HOOKS_PATH`), so no hook runs — neither the repository's nor one the
 * incoming commits bring through a relative hooks path.
 */
export function noHooksArgs(hooksPath: string): string[] {
  // And no fsmonitor program (W4-5, security review S1).
  return ['-c', `core.hooksPath=${hooksPath}`, ...NO_FSMONITOR];
}

/**
 * Whether a remote's configured fetch refspecs (`remote.<r>.fetch`) write only under
 * `refs/remotes/` (D34-5, bug-014): `--prune` then deletes nothing but tracking refs. A negative
 * refspec (`^…`) and a refspec without destination write nothing; no refspec at all fails closed.
 */
export function trackingRefspecs(refspecs: readonly string[]): boolean {
  if (refspecs.length === 0) return false;
  return refspecs.every((raw) => {
    const spec = raw.trim().replace(/^\+/, '');
    if (spec.startsWith('^')) return true;
    const colon = spec.indexOf(':');
    if (colon < 0) return true;
    const destination = spec.slice(colon + 1);
    if (destination === '') return true;
    return /^refs\/remotes\/[^/]/.test(destination) && !destination.split('/').includes('..');
  });
}

/** `git push` of HEAD to the upstream's branch `mergeRef` on `remote` (spec-010 §4). */
export function pushArgs(remote: string, mergeRef: string): string[] {
  return [
    ...TRANSPORT_SETTINGS,
    'push',
    '--quiet',
    '--no-follow-tags',
    '--recurse-submodules=no',
    '--',
    remote,
    `HEAD:${mergeRef}`,
  ];
}

/**
 * Whether the user configured an ssh command in the server's environment (`GIT_SSH_COMMAND`,
 * `GIT_SSH`); names compared as the platform does (case-sensitive on POSIX, review round 1 S9).
 */
export function sshInEnvironment(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): boolean {
  const fold = (key: string) => (platform === 'win32' ? key.toUpperCase() : key);
  return Object.entries(env).some(
    ([key, value]) => ['GIT_SSH_COMMAND', 'GIT_SSH'].includes(fold(key)) && value !== undefined && value !== '',
  );
}

/**
 * `PATH` of `env` with its absolute entries only (review round 1 R3): a relative entry would be
 * resolved in the repository, where git and its helpers run (`ssh`, `git-remote-*`, a credential
 * helper), and run a program the repository ships. The rule of `resolveGit`.
 */
export function absolutePath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): {
  key: string;
  value: string | undefined;
} {
  const key =
    Object.keys(env).find((k) => (platform === 'win32' ? k.toUpperCase() === 'PATH' : k === 'PATH')) ?? 'PATH';
  const sep = platform === 'win32' ? ';' : ':';
  const isAbsolute = platform === 'win32' ? path.win32.isAbsolute : path.posix.isAbsolute;
  const value = env[key];
  return {
    key,
    value:
      value === undefined
        ? undefined
        : value
            .split(sep)
            .filter((e) => e !== '' && isAbsolute(e))
            .join(sep),
  };
}

/**
 * The variables a transport command adds to the git environment (spec-010 §4, RP-24, D33-2): git
 * never prompts (`GIT_TERMINAL_PROMPT=0`); `GIT_ALLOW_PROTOCOL` is the allowed list, whatever the
 * server's environment says (bug-013); `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when no ssh
 * command is configured (`sshConfigured`: the environment or `core.sshCommand`), so a passphrase or
 * host-key prompt fails at once. A configured ssh command is used as is. `PATH` (from `env`, the
 * server's environment) keeps its absolute entries only (R3).
 */
export function transportEnv(sshConfigured: boolean, env: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const { key, value } = absolutePath(env);
  return {
    ...(value !== undefined ? { [key]: value } : {}),
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: ALLOWED_PROTOCOLS,
    [EMPTY_VARIABLE]: '',
    ...(sshConfigured ? {} : { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }),
  };
}

/**
 * The environment of an unattended command (D34-3): {@link transportEnv}, and no askpass program —
 * an empty `GIT_ASKPASS` makes git skip `GIT_ASKPASS`, `core.askPass` and `SSH_ASKPASS` (probed),
 * `SSH_ASKPASS_REQUIRE=never` keeps a configured ssh command from asking. Credential helpers still
 * run: stored credentials keep working.
 */
export function unattendedEnv(sshConfigured: boolean, env: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...transportEnv(sshConfigured, env), GIT_ASKPASS: '', SSH_ASKPASS_REQUIRE: 'never' };
}
