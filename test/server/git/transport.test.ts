// spec-010 §4 (REQ-INT-06, REQ-SEC-05, RP-24; task-033 D33-2, D33-3, bug-013) — the argument arrays
// of the transport commands and their environment.
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PROTOCOLS,
  CLONE_SETTINGS,
  GIT_ALLOWED_SUBCOMMANDS,
  gitSubcommand,
} from '../../../server/src/git/git.js';
import {
  fetchArgs,
  pullArgs,
  pushArgs,
  sshInEnvironment,
  TRANSPORT_SETTINGS,
  transportEnv,
} from '../../../server/src/git/transport.js';

const SETTINGS = [
  '-c',
  'protocol.allow=never',
  '-c',
  'protocol.https.allow=always',
  '-c',
  'protocol.http.allow=always',
  '-c',
  'protocol.ssh.allow=always',
  '-c',
  'protocol.git.allow=always',
  '-c',
  'protocol.file.allow=always',
  '-c',
  'maintenance.auto=false',
  '-c',
  'gc.auto=0',
  '--no-optional-locks',
];

describe('transport arguments (spec-010 §4)', () => {
  it('prefixes every command with the protocol settings, no automatic maintenance and --no-optional-locks', () => {
    expect(TRANSPORT_SETTINGS).toEqual(SETTINGS);
    expect(TRANSPORT_SETTINGS.slice(0, CLONE_SETTINGS.length)).toEqual(CLONE_SETTINGS);
  });

  it('fetch: quiet, --prune, no submodules, the remote after --', () => {
    expect(fetchArgs('origin')).toEqual([
      ...SETTINGS,
      'fetch',
      '--quiet',
      '--prune',
      '--no-recurse-submodules',
      '--',
      'origin',
    ]);
  });

  it('update: pull --ff-only of the upstream, no rebase, no autostash, no submodules', () => {
    expect(pullArgs()).toEqual([
      ...SETTINGS,
      'pull',
      '--ff-only',
      '--no-rebase',
      '--no-autostash',
      '--no-recurse-submodules',
      '--quiet',
    ]);
  });

  it('push: an explicit refspec without + to the merge ref, no tags, no submodules', () => {
    expect(pushArgs('origin', 'refs/heads/main')).toEqual([
      ...SETTINGS,
      'push',
      '--quiet',
      '--no-follow-tags',
      '--recurse-submodules=no',
      '--',
      'origin',
      'HEAD:refs/heads/main',
    ]);
  });

  it('a remote that looks like an option stays after -- (never an option)', () => {
    const args = fetchArgs('--upload-pack=touch x');
    expect(args.indexOf('--')).toBe(args.length - 2);
    expect(pushArgs('-x', 'refs/heads/main').slice(-3)).toEqual(['--', '-x', 'HEAD:refs/heads/main']);
  });

  it('uses allowed subcommands only (REQ-INT-06)', () => {
    for (const args of [fetchArgs('origin'), pullArgs(), pushArgs('origin', 'refs/heads/main')]) {
      expect(GIT_ALLOWED_SUBCOMMANDS).toContain(gitSubcommand(args));
    }
    expect(['fetch', 'pull', 'push']).toEqual(
      [fetchArgs('o'), pullArgs(), pushArgs('o', 'refs/heads/m')].map(gitSubcommand),
    );
  });
});

describe('transport environment (spec-010 §4, RP-24, D33-2)', () => {
  it('never prompts and allows exactly the protocols of the settings (GIT_ALLOW_PROTOCOL overrides -c, bug-013)', () => {
    expect(transportEnv(true)).toEqual({ GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'https:http:ssh:git:file' });
    const fromSettings = CLONE_SETTINGS.filter((a) => /^protocol\.\w+\.allow=always$/.test(a)).map(
      (a) => a.split('.')[1],
    );
    expect(ALLOWED_PROTOCOLS.split(':')).toEqual(fromSettings);
  });

  it('adds ssh BatchMode only when no ssh command is configured', () => {
    expect(transportEnv(false)).toEqual({
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'https:http:ssh:git:file',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
    });
  });

  it.each<[NodeJS.ProcessEnv, boolean]>([
    [{}, false],
    [{ GIT_SSH_COMMAND: 'ssh -i k' }, true],
    [{ GIT_SSH: 'plink' }, true],
    [{ git_ssh_command: 'ssh' }, true],
    [{ GIT_SSH_COMMAND: '' }, false],
  ])('ssh command in the environment %j → %s', (env, expected) => {
    expect(sshInEnvironment(env)).toBe(expected);
  });
});
