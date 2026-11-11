// task-060 D60-7, D60-4, D60-8 — the preset write's git steps (`server/src/git/index-write.ts`) and the
// `GitReads` methods they run through: the argument lists (WingFoil 0.3.1's own commit form), the
// guard that only `add` and `commit` run, the environment and settings every hook inherits (spec-001
// §1 plus D33-3's maintenance rule), and the entry reads of row 7′.
import { describe, expect, it } from 'vitest';
import { GitReads } from '../../../server/src/git/git.js';
import { INDEX_WRITE_GIT_CONFIG, presetAddArgs, presetCommitArgs } from '../../../server/src/git/index-write.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

const SHA = 'a'.repeat(40);
const reads = (runner: FakeProcessRunner) =>
  new GitReads({
    git: '/usr/bin/git',
    runner,
    cwd: '/p',
    env: { HOME: '/h', GIT_OPTIONAL_LOCKS: '1', git_allow_protocol: 'ext' },
  });

describe('the argument lists (D60-7)', () => {
  it('add and commit of one file, literal pathspecs, the file after --', () => {
    expect(presetAddArgs('.wingfoil/ui.yaml')).toEqual(['--literal-pathspecs', 'add', '--', '.wingfoil/ui.yaml']);
    expect(presetCommitArgs('.wingfoil/ui.yaml', 'chore(ui): apply the Kanban preset')).toEqual([
      '--literal-pathspecs',
      'commit',
      '--only',
      '--quiet',
      '--cleanup=whitespace',
      '-m',
      'chore(ui): apply the Kanban preset',
      '--',
      '.wingfoil/ui.yaml',
    ]);
  });

  it('the settings: the CLI’s three and no automatic maintenance', () => {
    expect(INDEX_WRITE_GIT_CONFIG).toEqual([
      ['core.fsmonitor', 'false'],
      ['protocol.allow', 'never'],
      ['log.showSignature', 'false'],
      ['maintenance.auto', 'false'],
      ['gc.auto', '0'],
    ]);
  });
});

describe('GitReads.indexWrite (D60-7)', () => {
  it('runs add and commit with the CLI’s variables (inherited spellings replaced) and the settings as gitConfig', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: '' }).answer({ stdout: '' });
    const r = reads(runner);
    await r.indexWrite(presetAddArgs('.wingfoil/ui.yaml'));
    await r.indexWrite(presetCommitArgs('.wingfoil/ui.yaml', 's'));
    for (const request of runner.requests) {
      expect(request).toMatchObject({ file: '/usr/bin/git', cwd: '/p', gitConfig: INDEX_WRITE_GIT_CONFIG });
      expect(request.env).toEqual({
        HOME: '/h',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_ALLOW_PROTOCOL: 'none',
        GIT_NO_LAZY_FETCH: '1',
      });
      expect(request.timeoutMs).toBeUndefined();
    }
  });

  it('refuses any other subcommand without a process', async () => {
    const runner = new FakeProcessRunner();
    const r = reads(runner);
    for (const args of [['push'], ['-c', 'x=y', 'reset', '--hard'], ['--literal-pathspecs', 'rm', 'x'], []]) {
      await expect(r.indexWrite(args)).rejects.toThrow(/not an index write/);
    }
    expect(runner.requests).toEqual([]);
  });
});

describe('the entry reads of row 7′ (D60-4)', () => {
  it('hasIndexEntry: any record of ls-files --stage; none → false', async () => {
    const runner = new FakeProcessRunner()
      .answer({ stdout: `100644 ${SHA} 1\t.wingfoil/ui.yaml\0` })
      .answer({ stdout: '' });
    const r = reads(runner);
    expect(await r.hasIndexEntry('.wingfoil/ui.yaml')).toBe(true);
    expect(await r.hasIndexEntry('.wingfoil/ui.yaml')).toBe(false);
    expect(runner.requests[0]!.args.slice(-6)).toEqual([
      '--literal-pathspecs',
      'ls-files',
      '--stage',
      '-z',
      '--',
      '.wingfoil/ui.yaml',
    ]);
  });

  it('hasHeadEntry: any record of ls-tree HEAD (a tree too); none → false', async () => {
    const runner = new FakeProcessRunner()
      .answer({ stdout: `040000 tree ${SHA}\t.wingfoil/ui.yaml\0` })
      .answer({ stdout: '' });
    const r = reads(runner);
    expect(await r.hasHeadEntry('.wingfoil/ui.yaml')).toBe(true);
    expect(await r.hasHeadEntry('.wingfoil/ui.yaml')).toBe(false);
    expect(runner.requests[0]!.args.slice(-6)).toEqual([
      '--literal-pathspecs',
      'ls-tree',
      '-z',
      'HEAD',
      '--',
      '.wingfoil/ui.yaml',
    ]);
  });

  it('commitsFromRoot: the first-parent history of HEAD, same format as commitsSince', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: `${SHA}\x1f1700000000\x1fchore(ui): x\x1e` });
    const r = reads(runner);
    expect(await r.commitsFromRoot()).toEqual([{ sha: SHA, at: new Date(1_700_000_000_000), subject: 'chore(ui): x' }]);
    expect(runner.requests[0]!.args.at(-1)).toBe('HEAD');
  });
});
