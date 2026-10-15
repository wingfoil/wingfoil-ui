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
  EMPTY_VARIABLE,
  fetchArgs,
  mergeArgs,
  noHooksArgs,
  pullArgs,
  pushArgs,
  sshInEnvironment,
  trackingRefspecs,
  TRANSPORT_SETTINGS,
  transportEnv,
  UNATTENDED_TIMEOUT_MS,
  unattendedEnv,
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

  it('fetch: quiet, --prune (tracking refs only: no tag pruning, D34-5 / bug-014), no submodules, the remote after --', () => {
    expect(fetchArgs('origin')).toEqual([
      ...SETTINGS,
      '-c',
      'fetch.pruneTags=false',
      '--config-env=remote.origin.pruneTags=WINGFOIL_UI_EMPTY',
      'fetch',
      '--quiet',
      '--prune',
      '--no-recurse-submodules',
      '--',
      'origin',
    ]);
  });

  it('update: pull --ff-only of the upstream, never a merge commit nor a squash (D34-2 / bug-014), no rebase, no autostash, no submodules', () => {
    expect(pullArgs('main')).toEqual([
      ...SETTINGS,
      '--config-env=branch.main.mergeOptions=WINGFOIL_UI_EMPTY',
      'pull',
      '--ff-only',
      '--no-squash',
      '--strategy=ort',
      '--no-rebase',
      '--no-autostash',
      '--no-recurse-submodules',
      '--quiet',
    ]);
  });

  it('automatic update (task-034, RP-41, D34-2): merge --ff-only of @{u}, never a merge commit nor a squash', () => {
    expect(mergeArgs('main')).toEqual([
      ...SETTINGS,
      '--config-env=branch.main.mergeOptions=WINGFOIL_UI_EMPTY',
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
    ]);
    expect(mergeArgs('a=b')).toContain('--config-env=branch.a=b.mergeOptions=WINGFOIL_UI_EMPTY');
    expect(mergeArgs('main').some((a) => a.includes('+'))).toBe(false);
  });

  it('unattended runs (D34-1): no hook — core.hooksPath is the given regular file', () => {
    expect(noHooksArgs('/x/clone.js')).toEqual(['-c', 'core.hooksPath=/x/clone.js']);
    expect(UNATTENDED_TIMEOUT_MS).toBe(60_000);
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
    for (const args of [
      fetchArgs('origin'),
      pullArgs('main'),
      mergeArgs('main'),
      pushArgs('origin', 'refs/heads/main'),
    ]) {
      expect(GIT_ALLOWED_SUBCOMMANDS).toContain(gitSubcommand(args));
    }
    expect(['fetch', 'pull', 'merge', 'push']).toEqual(
      [fetchArgs('o'), pullArgs('m'), mergeArgs('m'), pushArgs('o', 'refs/heads/m')].map(gitSubcommand),
    );
    expect(gitSubcommand([...noHooksArgs('/x'), ...mergeArgs('m')])).toBe('merge');
  });
});

describe('transport environment (spec-010 §4, RP-24, D33-2)', () => {
  it('never prompts and allows exactly the protocols of the settings (GIT_ALLOW_PROTOCOL overrides -c, bug-013)', () => {
    expect(transportEnv(true)).toEqual({
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'https:http:ssh:git:file',
      [EMPTY_VARIABLE]: '',
    });
    const fromSettings = CLONE_SETTINGS.filter((a) => /^protocol\.\w+\.allow=always$/.test(a)).map(
      (a) => a.split('.')[1],
    );
    expect(ALLOWED_PROTOCOLS.split(':')).toEqual(fromSettings);
  });

  it('R3: keeps only the absolute entries of PATH (a relative entry would resolve in the repository)', () => {
    const sep = process.platform === 'win32' ? ';' : ':';
    const env = transportEnv(true, { PATH: ['.', '/a/bin', 'rel/bin', '', '/b'].join(sep) });
    expect(env.PATH).toBe(['/a/bin', '/b'].join(sep));
  });

  it('adds ssh BatchMode only when no ssh command is configured', () => {
    expect(transportEnv(false)).toEqual({
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'https:http:ssh:git:file',
      [EMPTY_VARIABLE]: '',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
    });
  });

  it('unattended (D34-3): no askpass program (an empty GIT_ASKPASS disables GIT_ASKPASS, core.askPass, SSH_ASKPASS) and ssh never asks', () => {
    expect(unattendedEnv(false, { PATH: '/bin' })).toEqual({
      ...transportEnv(false, { PATH: '/bin' }),
      GIT_ASKPASS: '',
      SSH_ASKPASS_REQUIRE: 'never',
    });
    expect(unattendedEnv(true).GIT_SSH_COMMAND).toBeUndefined();
  });

  it.each<[NodeJS.ProcessEnv, boolean]>([
    [{}, false],
    [{ GIT_SSH_COMMAND: 'ssh -i k' }, true],
    [{ GIT_SSH: 'plink' }, true],
    // POSIX names are case-sensitive (review round 1 S9): a lower-case name is another variable.
    [{ git_ssh_command: 'ssh' }, process.platform === 'win32'],
    [{ GIT_SSH_COMMAND: '' }, false],
  ])('ssh command in the environment %j → %s', (env, expected) => {
    expect(sshInEnvironment(env)).toBe(expected);
  });
});

describe('fetch refspecs (D34-5, D34-8 / bug-014): every destination under refs/remotes/', () => {
  it.each<[string[], boolean]>([
    [['+refs/heads/*:refs/remotes/origin/*'], true],
    [['refs/heads/main:refs/remotes/origin/main', '^refs/heads/tmp/*'], true],
    [['+refs/heads/main'], true],
    [['refs/heads/main:'], true],
    [[], false],
    [['+refs/heads/*:refs/heads/*'], false],
    [['+refs/*:refs/*'], false],
    [['+refs/heads/*:refs/remotes/origin/*', 'refs/tags/*:refs/tags/*'], false],
    [['+refs/heads/*:refs/remotes'], false],
    [['+refs/heads/*:refs/remotes/../heads/*'], false],
    [['+refs/heads/*:refs/remotesx/*'], false],
  ])('%j → %s', (refspecs, expected) => {
    expect(trackingRefspecs(refspecs)).toBe(expected);
  });
});
