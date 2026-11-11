// spec-005 §5, spec-004 §3–§6, spec-001 §1, spec-006 §2, spec-010 §6 (task-060; US-C-02, US-C-03,
// REQ-ARC-03, REQ-INT-06, REQ-SEC-08, REQ-SEC-10) — `POST /api/p/:pid/ui-config/preset` on copies of
// the kanban and custom fixtures (pinned CLI, real git) over the audited runner of `git-console.ts`:
// the preconditions in their order with the processes each starts (D60-3, D60-4), the render and
// the checks before anything is written (D60-5, C-03.x), the one `chore(ui)` commit with only
// `.wingfoil/ui.yaml` (D60-7, D60-8, C-02.x), what follows it (D60-10) and the failures (D60-9).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import type { FastifyInstance } from 'fastify';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gitSubcommand } from '../../../server/src/git/git.js';
import type { ProcessRequest } from '../../../server/src/process/runner.js';
import {
  PRESET_COMMIT_SUBJECTS,
  presetCommitSubject,
  renderPreset,
  UI_PRESETS,
  type UiPreset,
  type UiPresetName,
} from '../../../server/src/presets/ui-config.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { DEFAULT_SETTINGS } from '../../../server/src/state/settings.js';
import {
  buildFixture,
  installCliStub,
  OUTSIDER,
  usePresetUiConfig,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { processKind } from '../snapshot/support.js';
import { startGitConsole, type GitConsole, type GitConsoleOptions } from './git-console.js';

const posix = process.platform !== 'win32' && process.getuid?.() !== 0;
const T = 120_000;
const UI = '.wingfoil/ui.yaml';
const KANBAN = presetCommitSubject('kanban');

let ws: TempWorkspace;
let kanban: Fixture;
let custom: Fixture;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-060-preset-');
  const root = await realpath(ws.dir);
  [kanban, custom] = await Promise.all([
    buildFixture('kanban', { root: path.join(root, 'kanban') }),
    buildFixture('custom', { root: path.join(root, 'custom') }),
  ]);
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

const start = (options: GitConsoleOptions = {}, template: Fixture = kanban): Promise<GitConsole> =>
  startGitConsole(template, ws.dir, apps, registries, options);

const uiFile = (c: GitConsole) => path.join(c.fx.dir, '.wingfoil', 'ui.yaml');
const exists = (file: string) =>
  lstat(file).then(
    () => true,
    () => false,
  );
const out = async (c: GitConsole, args: string[]) => (await git(c.fx.dir, args, c.fx.env)).stdout;
const subjects = async (c: GitConsole) => (await out(c, ['log', '--format=%s'])).split('\n').filter(Boolean);
const staged = async (c: GitConsole) => (await out(c, ['diff', '--cached', '--name-only'])).split('\n').filter(Boolean);
const changedBy = async (c: GitConsole, rev: string) =>
  (await out(c, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', rev])).split('\n').filter(Boolean);
const writeEvents = (c: GitConsole) => c.events.filter((e) => e.event === 'write');

/** A hook of the copy (`.git/hooks/<name>`). */
async function hook(fx: Fixture, name: string, script: string): Promise<void> {
  const file = path.join(fx.dir, '.git', 'hooks', name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `#!/bin/sh\n${script}\n`);
  await chmod(file, 0o755);
}

/** Processes `fn` starts, each with its git subcommand (`git add`) or the CLI's arguments. */
async function started(c: GitConsole, fn: () => Promise<unknown>) {
  const from = c.runner.spawned.length;
  await fn();
  const spawned = c.runner.spawned.slice(from);
  return {
    all: spawned,
    commands: spawned.map((r) => (processKind(r) === 'git' ? (gitSubcommand(r.args) ?? '') : 'wingfoil')),
  };
}

/**
 * No write process (`add`, `commit`) among `commands`. A state that moved since the page's read
 * runs rows 5–6 again (the reads a `GET` would, D60-3): those CLI reads may appear.
 */
const NO_WRITE = (commands: string[]) => expect(commands.filter((k) => ['add', 'commit'].includes(k))).toEqual([]);

describe('spec-004 §4 rows 1–6 (D60-3)', () => {
  it(
    'row 3: an unknown project → 404 before the body, 0 processes',
    async () => {
      const c = await start();
      const p = await started(c, async () => {
        expect((await c.preset({ preset: 'x' }, { pid: 'p_000000000000' })).status).toBe(404);
      });
      expect(p.all).toEqual([]);
    },
    T,
  );

  it(
    'row 4: an unknown preset, an extra key, no preset, a number, a list → 400 invalid-request, 0 processes',
    async () => {
      const c = await start();
      await c.warm();
      const p = await started(c, async () => {
        for (const body of [{ preset: 'Kanban' }, { preset: 'kanban', x: 1 }, {}, { preset: 1 }, '[]', '"kanban"']) {
          const res = await c.preset(body);
          expect(res.status, JSON.stringify(body)).toBe(400);
          expect(res.body.error.code).toBe('invalid-request');
        }
      });
      expect(p.all).toEqual([]);
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );

  it(
    'C-02.5 — Offer no preset to a user who is not in the team: 403 not-in-team as Riley, 0 processes warm',
    async () => {
      const c = await start({ as: OUTSIDER.email });
      await c.warm();
      const p = await started(c, async () => {
        const res = await c.preset({ preset: 'kanban' });
        expect(res).toMatchObject({ status: 403, body: { error: { code: 'not-in-team' } } });
      });
      expect(p.all).toEqual([]);
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );

  it(
    'row 5: no identity (no user.email) → 403 not-in-team',
    async () => {
      const c = await start({ as: null });
      await c.warm();
      expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('not-in-team');
    },
    T,
  );

  it(
    'row 6: a WingFoil version outside the range → 409 unsupported-version, 0 processes warm',
    async () => {
      const c = await start({ prepare: (fx) => installCliStub(fx, { version: '0.1.0' }).then(() => {}) });
      await c.warm();
      const p = await started(c, async () => {
        expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('unsupported-version');
      });
      expect(p.all).toEqual([]);
    },
    T,
  );
});

describe('row 7′ — ui.yaml exists nowhere, fresh under the lock (D60-4)', () => {
  it(
    'C-02.3 — Offer no preset when ui.yaml exists: 409 ui-config-exists on the custom fixture with the sw-life-cycle preset',
    async () => {
      const c = await start({ prepare: (fx) => usePresetUiConfig(fx, 'sw-life-cycle') }, custom);
      const before = await c.head();
      const text = await readFile(uiFile(c), 'utf8');
      const p = await started(c, async () => {
        expect((await c.preset({ preset: 'sw-life-cycle' })).body.error.code).toBe('ui-config-exists');
      });
      NO_WRITE(p.commands);
      expect(await c.head()).toBe(before);
      expect(await readFile(uiFile(c), 'utf8')).toBe(text);
    },
    T,
  );

  const KINDS: [string, (c: GitConsole) => Promise<void>][] = [
    ['an untracked file', (c) => writeFile(uiFile(c), 'mine\n')],
    ['a directory', (c) => mkdir(uiFile(c))],
    ['a dangling symbolic link', (c) => symlink(path.join(c.fx.dir, 'nowhere'), uiFile(c))],
    [
      'an intent-to-add entry whose file is gone',
      async (c) => {
        await writeFile(uiFile(c), 'mine\n');
        await git(c.fx.dir, ['add', '-N', '--', UI], c.fx.env);
        await rm(uiFile(c));
      },
    ],
    [
      'a file below a directory named ui.yaml, in the index only',
      async (c) => {
        await mkdir(uiFile(c));
        await writeFile(path.join(uiFile(c), 'x'), 'x\n');
        await git(c.fx.dir, ['add', '--', `${UI}/x`], c.fx.env);
        await rm(uiFile(c), { recursive: true });
      },
    ],
    [
      'a skip-worktree entry whose file is gone',
      async (c) => {
        await writeFile(uiFile(c), 'mine\n');
        await git(c.fx.dir, ['add', '--', UI], c.fx.env);
        await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
        await git(c.fx.dir, ['update-index', '--skip-worktree', '--', UI], c.fx.env);
        await rm(uiFile(c));
      },
    ],
    [
      'a staged deletion (at HEAD only)',
      async (c) => {
        await writeFile(uiFile(c), 'mine\n');
        await git(c.fx.dir, ['add', '--', UI], c.fx.env);
        await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
        await git(c.fx.dir, ['rm', '-q', '--', UI], c.fx.env);
      },
    ],
    [
      // Q1 (a): the reader reports such a ui.yaml as present and refused.
      '.wingfoil a symbolic link to a folder of the project',
      async (c) => {
        const wingfoil = path.join(c.fx.dir, '.wingfoil');
        await git(c.fx.dir, ['mv', '.wingfoil', 'wf'], c.fx.env);
        await git(c.fx.dir, ['commit', '-qm', 'move'], c.fx.env);
        await symlink('wf', wingfoil);
      },
    ],
  ];

  it.each(KINDS)(
    '%s → 409 ui-config-exists, no write process, nothing written',
    async (_l, plant) => {
      const c = await start();
      await plant(c);
      const before = await c.head();
      const index = await readFile(path.join(c.fx.dir, '.git', 'index'));
      const p = await started(c, async () => {
        expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('ui-config-exists');
      });
      NO_WRITE(p.commands);
      expect(await c.head()).toBe(before);
      expect(await readFile(path.join(c.fx.dir, '.git', 'index'))).toEqual(index);
    },
    T,
  );

  it(
    'fresh under the lock: a file created after the page’s read, with no check in between',
    async () => {
      const c = await start();
      await c.warm();
      await writeFile(uiFile(c), 'mine\n');
      expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('ui-config-exists');
      expect(await readFile(uiFile(c), 'utf8')).toBe('mine\n');
    },
    T,
  );
});

describe('row 8 — the copy, fresh under the lock', () => {
  it(
    'C-02.4 — Block the preset while the copy is behind: 409 stale-copy one commit behind the fetched remote',
    async () => {
      const c = await start();
      await c.remoteCommit('notes.md', 'x\n');
      await git(c.fx.dir, ['fetch', '-q'], c.fx.env);
      const p = await started(c, async () => {
        expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('stale-copy');
      });
      NO_WRITE(p.commands);
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );

  it(
    'diverged, and detached → 409 stale-copy; behind made after the page’s read is seen too',
    async () => {
      const c = await start();
      await c.warm();
      await c.remoteCommit('notes.md', 'x\n');
      await git(c.fx.dir, ['fetch', '-q'], c.fx.env);
      expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('stale-copy');
      await writeFile(path.join(c.fx.dir, 'mine.md'), 'm\n');
      await git(c.fx.dir, ['add', '--', 'mine.md'], c.fx.env);
      await git(c.fx.dir, ['commit', '-qm', 'mine'], c.fx.env);
      expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('stale-copy');
      await git(c.fx.dir, ['checkout', '-q', '--detach'], c.fx.env);
      expect((await c.preset({ preset: 'kanban' })).body.error.code).toBe('stale-copy');
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );
});

describe('render and checks before anything is written (D60-5)', () => {
  it(
    'C-03.1 — Refuse a preset that fails the schema: 422 ui-config-invalid, missing required key version, no file, HEAD unchanged',
    async () => {
      const { version: _v, ...rest } = UI_PRESETS.kanban.content as unknown as Record<string, unknown>;
      const presets: Record<UiPresetName, UiPreset> = {
        ...UI_PRESETS,
        kanban: { ...UI_PRESETS.kanban, content: rest as unknown as UiPreset['content'] },
      };
      const c = await start({ presets });
      const before = await c.head();
      const p = await started(c, async () => {
        const res = await c.preset({ preset: 'kanban' });
        expect(res).toEqual({
          status: 422,
          body: {
            error: {
              code: 'ui-config-invalid',
              message: 'ui.yaml not written: missing required key version',
              detail: { failure: 'missing required key version' },
            },
          },
        });
      });
      NO_WRITE(p.commands);
      expect(await exists(uiFile(c))).toBe(false);
      expect(await c.head()).toBe(before);
    },
    T,
  );

  it(
    'C-03.2 — Refuse a preset that maps a type the project does not declare: sw-life-cycle on kanban',
    async () => {
      const c = await start();
      const res = await c.preset({ preset: 'sw-life-cycle' });
      expect(res.status).toBe(422);
      expect(res.body.error.detail).toEqual({ failure: 'type service is not declared in memory.yaml' });
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );

  it.runIf(posix)(
    'memory.yaml unreadable (a link outside the project) → 502 read-error, no file',
    async () => {
      const c = await start();
      await c.warm();
      const outside = path.join(path.dirname(c.fx.dir), 'outside-memory.yaml');
      await writeFile(outside, await readFile(path.join(c.fx.dir, '.wingfoil', 'memory.yaml')));
      await rm(path.join(c.fx.dir, '.wingfoil', 'memory.yaml'));
      await symlink(outside, path.join(c.fx.dir, '.wingfoil', 'memory.yaml'));
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatchObject({
        code: 'read-error',
        detail: { file: '.wingfoil/memory.yaml', kind: 'outside' },
      });
      expect(await exists(uiFile(c))).toBe(false);
    },
    T,
  );
});

describe('the commit (D60-7, D60-8, D60-10)', () => {
  it(
    'C-02.1 — Apply the Kanban preset as one chore(ui) commit',
    async () => {
      const c = await start();
      await c.warm();
      const before = await c.head();
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(200);
      const head = await c.head();
      expect(res.body).toEqual({
        result: { file: UI, preset: 'kanban' },
        commits: [{ sha: head, subject: KANBAN }],
        push: { status: 'off' },
      });
      expect(await out(c, ['rev-parse', 'HEAD~1'])).toBe(`${before}\n`);
      expect((await subjects(c))[0]).toBe('chore(ui): apply the Kanban preset');
      expect(await changedBy(c, 'HEAD')).toEqual([UI]);
      expect(await out(c, ['show', `HEAD:${UI}`])).toBe(renderPreset('kanban'));
      expect(await out(c, ['status', '--porcelain'])).toBe('');
      const config = await c.get(`/api/p/${c.pid}/config`);
      expect(config.body.ui.status.source).toBe('file');
      // Configuration › Taxonomy: the categories, the patterns and the required references.
      const { taxonomy } = config.body.ui;
      const origins = [
        taxonomy.patterns.origin,
        taxonomy.requires.origin,
        ...taxonomy.categories.map((e: any) => e.origin),
      ];
      expect(new Set(origins)).toEqual(new Set(['declared']));
    },
    T,
  );

  it(
    'C-02.2 — Leave other staged changes out of the commit: README.md stays staged and uncommitted',
    async () => {
      const c = await start();
      await writeFile(path.join(c.fx.dir, 'README.md'), 'staged change\n');
      await git(c.fx.dir, ['add', '--', 'README.md'], c.fx.env);
      expect((await c.preset({ preset: 'kanban' })).status).toBe(200);
      expect(await changedBy(c, 'HEAD')).toEqual([UI]);
      expect(await staged(c)).toEqual(['README.md']);
      expect(await out(c, ['show', ':README.md'])).toBe('staged change\n');
    },
    T,
  );

  it(
    'the processes: one add and one commit with D60-7’s arguments, environment and settings; no CLI',
    async () => {
      const requests: ProcessRequest[] = [];
      const c = await start({
        intercept: async (request) => {
          if (['add', 'commit'].includes(gitSubcommand(request.args) ?? '')) requests.push(request);
          return undefined;
        },
      });
      await c.warm();
      const p = await started(c, async () => expect((await c.preset({ preset: 'kanban' })).status).toBe(200));
      expect(p.commands.filter((k) => k === 'wingfoil')).toEqual([]);
      expect(p.commands.filter((k) => k === 'add' || k === 'commit')).toEqual(['add', 'commit']);
      expect(requests.map((r) => r.args)).toEqual([
        ['--literal-pathspecs', 'add', '--', UI],
        ['--literal-pathspecs', 'commit', '--only', '--quiet', '--cleanup=whitespace', '-m', KANBAN, '--', UI],
      ]);
      for (const r of requests) {
        expect(r.cwd).toBe(c.fx.dir);
        expect(r.env).toMatchObject({ GIT_ALLOW_PROTOCOL: 'none', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' });
        expect(r.gitConfig).toEqual([
          ['core.fsmonitor', 'false'],
          ['protocol.allow', 'never'],
          ['log.showSignature', 'false'],
          ['maintenance.auto', 'false'],
          ['gc.auto', '0'],
        ]);
      }
    },
    T,
  );

  it.runIf(posix)(
    'the hooks run as for a CLI write; a hook’s git transport is refused (P10)',
    async () => {
      const c = await start();
      const marker = path.join(c.fx.dir, '.git', 'hook-ran');
      await hook(
        c.fx,
        'pre-commit',
        `echo ran > "${marker}"\ngit push -q origin HEAD:refs/heads/hooked 2>/dev/null; echo $? >> "${marker}"`,
      );
      const remoteRefs = await git(c.fx.remoteDir, ['for-each-ref'], c.fx.env);
      expect((await c.preset({ preset: 'kanban' })).status).toBe(200);
      const [ran, pushExit] = (await readFile(marker, 'utf8')).trim().split('\n');
      expect(ran).toBe('ran');
      expect(pushExit).not.toBe('0');
      expect(await git(c.fx.remoteDir, ['for-each-ref'], c.fx.env)).toEqual(remoteRefs);
    },
    T,
  );

  it(
    '.git before and after: only the index, the branch ref, its reflogs, COMMIT_EDITMSG and new objects change',
    async () => {
      const c = await start();
      await c.warm();
      const snap = async () => {
        const files = new Map<string, string>();
        const walk = async (dir: string) => {
          for (const e of await readdir(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) await walk(p);
            else files.set(path.relative(path.join(c.fx.dir, '.git'), p), (await readFile(p)).toString('base64'));
          }
        };
        await walk(path.join(c.fx.dir, '.git'));
        return files;
      };
      const before = await snap();
      expect((await c.preset({ preset: 'kanban' })).status).toBe(200);
      const after = await snap();
      const changed = [...after].filter(([f, v]) => before.get(f) !== v).map(([f]) => f);
      const removed = [...before.keys()].filter((f) => !after.has(f));
      expect(removed).toEqual([]);
      const other = changed.filter((f) => !f.startsWith(`objects${path.sep}`));
      expect(other.sort()).toEqual(
        [
          'COMMIT_EDITMSG',
          'index',
          path.join('logs', 'HEAD'),
          path.join('logs', 'refs', 'heads', 'main'),
          path.join('refs', 'heads', 'main'),
        ].sort(),
      );
      expect(changed.filter((f) => f.startsWith(`objects${path.sep}`)).length).toBeGreaterThan(0);
    },
    T,
  );

  it(
    'the action log, the repo state and the write event without eid (spec-004 §6, spec-006 §2)',
    async () => {
      const c = await start();
      await c.warm();
      expect((await c.preset({ preset: 'kanban' })).status).toBe(200);
      const head = await c.head();
      expect(c.store.snapshot().actionLog).toEqual([
        { sha: head, at: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/) },
      ]);
      expect(writeEvents(c).map((e) => e.data)).toEqual([{ pid: c.pid, commit: head }]);
      const res = await c.get(`/api/p/${c.pid}/config`);
      expect(String(res.headers['x-repo-state'])).toMatch(new RegExp(`^${head}\\.`));
    },
    T,
  );

  it(
    'auto-push on: pushed, the remote’s branch is the commit (spec-010 §6)',
    async () => {
      const c = await start({ autoPush: {} });
      await c.store.putSettings({ ...DEFAULT_SETTINGS, autoPush: true });
      const res = await c.preset({ preset: 'kanban' });
      expect(res.body.push).toEqual({ status: 'pushed' });
      expect((await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout.trim()).toBe(await c.head());
    },
    T,
  );

  it(
    'two requests at once: one 200, the other 409 ui-config-exists (D60-11)',
    async () => {
      const c = await start();
      const answers = await Promise.all([c.preset({ preset: 'kanban' }), c.preset({ preset: 'scrum' })]);
      expect(answers.map((a) => a.status)).toEqual([200, 409]);
      expect(answers[1]!.body.error.code).toBe('ui-config-exists');
      expect((await subjects(c)).filter((s) => PRESET_COMMIT_SUBJECTS.includes(s))).toEqual([KANBAN]);
    },
    T,
  );

  it(
    'a commit made by a hook with another subject: 200, only the preset’s commit listed and logged',
    async () => {
      const c = await start();
      await hook(
        c.fx,
        'post-commit',
        `[ -f .git/once ] && exit 0\ntouch .git/once\necho h > hooked.md\ngit add hooked.md\ngit commit -qm "hooked: another commit"`,
      );
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(200);
      const sha = (await out(c, ['rev-parse', 'HEAD~1'])).trim();
      expect(res.body.commits).toEqual([{ sha, subject: KANBAN }]);
      expect(c.store.snapshot().actionLog.map((e) => e.sha)).toEqual([sha]);
    },
    T,
  );
});

describe('failures (D60-9)', () => {
  /** The log sink holds no absolute folder and no git text. */
  const expectQuietLog = (log: string[], c: GitConsole) => {
    const text = log.join('');
    expect(text).not.toContain(c.fx.dir);
    expect(text).not.toContain(path.dirname(c.fx.dir));
    expect(text).not.toMatch(/hint:|fatal:|ignored by one of your/);
  };

  it(
    'ui.yaml ignored by git → 422 git-refused with git’s message, the created file removed',
    async () => {
      const log: string[] = [];
      const c = await start({ log });
      await writeFile(path.join(c.fx.dir, '.gitignore'), `${UI}\n`);
      await git(c.fx.dir, ['add', '--', '.gitignore'], c.fx.env);
      await git(c.fx.dir, ['commit', '-qm', 'ignore ui.yaml'], c.fx.env);
      await git(c.fx.dir, ['push', '-q', 'origin', 'HEAD:main'], c.fx.env);
      const before = await c.head();
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('git-refused');
      expect(res.body.error.message).toMatch(/ignored by one of your \.gitignore files/);
      expect(res.body.error.message).not.toContain(c.fx.dir);
      expect(await exists(uiFile(c))).toBe(false);
      expect(await c.head()).toBe(before);
      expect(c.store.snapshot().actionLog).toEqual([]);
      expect(writeEvents(c)).toEqual([]);
      expectQuietLog(log, c);
    },
    T,
  );

  it(
    '.git/index.lock held → 422 git-refused, the git folder redacted, the file removed',
    async () => {
      const log: string[] = [];
      const c = await start({ log });
      await c.warm();
      await writeFile(path.join(c.fx.dir, '.git', 'index.lock'), '');
      const res = await c.preset({ preset: 'kanban' });
      expect(res.body.error.code).toBe('git-refused');
      expect(res.body.error.message).toContain('index.lock');
      expect(res.body.error.message).not.toContain(c.fx.dir);
      expect(await exists(uiFile(c))).toBe(false);
      expectQuietLog(log, c);
    },
    T,
  );

  it.runIf(posix)(
    'a failing pre-commit hook → 500 write-incomplete, the file left staged, nothing logged, pushed or announced',
    async () => {
      const log: string[] = [];
      const c = await start({ log, autoPush: {} });
      await c.store.putSettings({ ...DEFAULT_SETTINGS, autoPush: true });
      await hook(c.fx, 'pre-commit', 'echo "refused by the hook" >&2\nexit 1');
      const before = await c.head();
      const remote = (await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout;
      const p = await started(c, async () => {
        const res = await c.preset({ preset: 'kanban' });
        expect(res).toEqual({
          status: 500,
          body: {
            error: {
              code: 'write-incomplete',
              message: 'The write did not finish: the preset commit was not made',
              detail: { file: UI },
            },
          },
        });
      });
      expect(p.commands).not.toContain('push');
      expect(await c.head()).toBe(before);
      expect(await staged(c)).toEqual([UI]);
      expect(await readFile(uiFile(c), 'utf8')).toBe(renderPreset('kanban'));
      expect(c.store.snapshot().actionLog).toEqual([]);
      expect(writeEvents(c)).toEqual([]);
      expect((await git(c.fx.remoteDir, ['rev-parse', 'main'], c.fx.env)).stdout).toBe(remote);
      expectQuietLog(log, c);
      expect(log.join('')).not.toContain('refused by the hook');
    },
    T,
  );

  it.runIf(posix)(
    'a pre-commit hook that stages another file (P2) → 500 write-incomplete naming the commit',
    async () => {
      const c = await start();
      await writeFile(path.join(c.fx.dir, 'other.md'), 'o\n');
      await hook(c.fx, 'pre-commit', 'git add other.md');
      const res = await c.preset({ preset: 'kanban' });
      const head = await c.head();
      expect(res.status).toBe(500);
      expect(res.body.error).toMatchObject({ code: 'write-incomplete', detail: { file: UI, commit: head } });
      expect(c.store.snapshot().actionLog).toEqual([]);
      expect(writeEvents(c)).toEqual([]);
    },
    T,
  );

  it.runIf(posix)(
    'a post-commit hook making a second commit with the same subject (P3) → 500, no commit named',
    async () => {
      const c = await start();
      await hook(
        c.fx,
        'post-commit',
        `[ -f .git/once ] && exit 0\ntouch .git/once\necho again >> ${UI}\ngit add ${UI}\ngit commit -qm "${KANBAN}"`,
      );
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.detail).toEqual({ file: UI });
      expect(c.store.snapshot().actionLog).toEqual([]);
    },
    T,
  );

  it.runIf(posix)(
    'a commit-msg hook that rewrites the subject (P4) → 500, no commit named',
    async () => {
      const c = await start();
      await hook(c.fx, 'commit-msg', 'echo "another subject" > "$1"');
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.detail).toEqual({ file: UI });
      expect((await subjects(c))[0]).toBe('another subject');
      expect(writeEvents(c)).toEqual([]);
    },
    T,
  );

  it.runIf(posix)(
    'a hook that rewrites ui.yaml in the commit → 500, the commit named',
    async () => {
      const c = await start();
      await hook(c.fx, 'pre-commit', `echo "version: 1" > ${UI}\ngit add ${UI}`);
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.detail).toEqual({ file: UI, commit: await c.head() });
    },
    T,
  );

  it.runIf(posix)(
    'commit.gpgSign with a signing program that fails (P5) → 500, the file staged',
    async () => {
      const c = await start();
      const program = path.join(path.dirname(c.fx.dir), 'failing-gpg');
      await writeFile(program, '#!/bin/sh\nexit 1\n');
      await chmod(program, 0o755);
      await git(c.fx.dir, ['config', 'commit.gpgSign', 'true'], c.fx.env);
      await git(c.fx.dir, ['config', 'gpg.program', program], c.fx.env);
      const res = await c.preset({ preset: 'kanban' });
      expect(res.status).toBe(500);
      expect(res.body.error.detail).toEqual({ file: UI });
      expect(await staged(c)).toEqual([UI]);
      expect((await stat(uiFile(c))).isFile()).toBe(true);
    },
    T,
  );
});
