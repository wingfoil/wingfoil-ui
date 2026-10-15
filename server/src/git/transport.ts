/**
 * The git transport commands of spec-010 §4 (write class (c), REQ-ARC-03, REQ-INT-06; task-033):
 * argument arrays (no shell, REQ-SEC-05), each prefixed with {@link TRANSPORT_SETTINGS}, and their
 * environment ({@link transportEnv}).
 *
 * | Operation | Arguments (after the settings) |
 * |-----------|--------------------------------|
 * | fetch | `--no-optional-locks fetch --quiet --prune --no-recurse-submodules -- <remote>` |
 * | update (manual) | `--no-optional-locks pull --ff-only --no-rebase --no-autostash --no-recurse-submodules --quiet` |
 * | push | `--no-optional-locks push --quiet --no-follow-tags --recurse-submodules=no -- <remote> HEAD:<merge ref>` — never forced: no `+`, an explicit refspec |
 *
 * `<remote>` is always a name `git remote` lists and `<merge ref>` a checked branch ref (D33-8), both
 * after `--`.
 */
import { ALLOWED_PROTOCOLS, CLONE_SETTINGS } from './git.js';

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

/** `git fetch` of `remote` (spec-010 §4, RP-35: `--prune`). */
export function fetchArgs(remote: string): string[] {
  return [...TRANSPORT_SETTINGS, 'fetch', '--quiet', '--prune', '--no-recurse-submodules', '--', remote];
}

/** The manual update: `git pull --ff-only` of the upstream (spec-010 §4, RP-37: not cancellable). */
export function pullArgs(): string[] {
  return [
    ...TRANSPORT_SETTINGS,
    'pull',
    '--ff-only',
    '--no-rebase',
    '--no-autostash',
    '--no-recurse-submodules',
    '--quiet',
  ];
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

/** Whether the user configured an ssh command in the server's environment (`GIT_SSH_COMMAND`, `GIT_SSH`). */
export function sshInEnvironment(env: NodeJS.ProcessEnv): boolean {
  return Object.entries(env).some(
    ([key, value]) => ['GIT_SSH_COMMAND', 'GIT_SSH'].includes(key.toUpperCase()) && value !== undefined && value !== '',
  );
}

/**
 * The variables a transport command adds to the git environment (spec-010 §4, RP-24, D33-2): git
 * never prompts (`GIT_TERMINAL_PROMPT=0`); `GIT_ALLOW_PROTOCOL` is the allowed list, whatever the
 * server's environment says (bug-013); `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when no ssh
 * command is configured (`sshConfigured`: the environment or `core.sshCommand`), so a passphrase or
 * host-key prompt fails at once. A configured ssh command is used as is.
 */
export function transportEnv(sshConfigured: boolean): NodeJS.ProcessEnv {
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: ALLOWED_PROTOCOLS,
    ...(sshConfigured ? {} : { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }),
  };
}
