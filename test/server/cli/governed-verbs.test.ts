// Characterisation (task-032 design): what the pinned `wingfoil@0.2.2` does on the governed verbs the
// server drives — facts the write routes rely on: one commit per verb, carrying only the element
// (`git commit --only`), with the W-15 subject; `submit` commits the element's pending edits (W-24);
// an edit hidden from `git status` by `assume-unchanged` is committed too — by `submit` silently, by
// `approve` before its own scope check refuses, leaving the commit (the reason for D32-1);
// a reason defect is a usage error, exit 2 (the reason for D32-5); positionals after `--` are literal
// (W-22).
import { realpath, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pinnedCli } from '../../harness/cli.js';
import { buildFixture, copyFixture, memberByName, type Fixture } from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

let ws: TempWorkspace;
let template: Fixture;
let n = 0;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-032-cli-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'kanban') });
}, 600_000);

afterAll(async () => {
  await ws.dispose();
});

async function copy(as: 'Morgan' | 'Jordan'): Promise<Fixture> {
  n += 1;
  const fx = await copyFixture(template, path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', memberByName(as).email], fx.env);
  return fx;
}

function wingfoil(fx: Fixture, args: readonly string[]) {
  return run(process.execPath, [pinnedCli().script, '--format', 'json', ...args], {
    cwd: fx.dir,
    env: fx.env,
    allowFailure: true,
  });
}

async function pathOf(fx: Fixture, id: string): Promise<string> {
  const out = await wingfoil(fx, ['memory', 'search']);
  const match = (JSON.parse(out.stdout) as { matches: { id: string; path: string }[] }).matches.find(
    (m) => m.id === id,
  );
  if (!match) throw new Error(`no ${id}`);
  return match.path;
}

async function head(fx: Fixture): Promise<string> {
  return (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
}

async function filesOf(fx: Fixture, sha: string): Promise<string[]> {
  const out = await git(fx.dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha], fx.env);
  return out.stdout.split('\n').filter(Boolean);
}

async function subject(fx: Fixture, sha: string): Promise<string> {
  return (await git(fx.dir, ['log', '-1', '--format=%s', sha], fx.env)).stdout.trim();
}

describe('wingfoil@0.2.2 governed verbs', () => {
  it('submit: one commit, only the element, subject `wf(<type>): submit <id>`, staged files left alone', async () => {
    const fx = await copy('Jordan');
    const before = await head(fx);
    await writeFile(path.join(fx.dir, 'other.txt'), 'staged elsewhere\n');
    await git(fx.dir, ['add', 'other.txt'], fx.env);
    const out = await wingfoil(fx, ['memory', 'submit', '--', 'task-004-session-timeout']);
    expect(out.code, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ id: 'task-004-session-timeout', from: 'draft', to: 'pending' });
    const after = await head(fx);
    expect((await git(fx.dir, ['rev-list', `${before}..${after}`], fx.env)).stdout.trim().split('\n')).toHaveLength(1);
    expect(await subject(fx, after)).toBe('wf(task): submit task-004-session-timeout');
    expect(await filesOf(fx, after)).toEqual([await pathOf(fx, 'task-004-session-timeout')]);
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toContain('A  other.txt');
  });

  it('approve and reject: subject `wf(<type>): <verb> <id> [<from> → <to>]`, the reason as one argument', async () => {
    for (const [verb, to] of [
      ['approve', 'approved'],
      ['reject', 'draft'],
    ] as const) {
      const fx = await copy('Morgan');
      const reason = `--looks "odd" $(touch x) \`y\`\nsecond line`;
      const out = await wingfoil(fx, ['memory', verb, `--reason=${reason}`, '--', 'task-001-login-form']);
      expect(out.code, out.stderr).toBe(0);
      const sha = await head(fx);
      expect(await subject(fx, sha)).toBe(`wf(task): ${verb} task-001-login-form [pending → ${to}]`);
      const body = (await git(fx.dir, ['log', '-1', '--format=%B', sha], fx.env)).stdout;
      expect(body).toContain('$(touch x)');
      expect(body).toContain('second line');
    }
  });

  it('W-24: submit commits the pending edits of the element', async () => {
    const fx = await copy('Jordan');
    const file = path.join(fx.dir, await pathOf(fx, 'task-004-session-timeout'));
    await writeFile(file, `${await readFile(file, 'utf8')}\nedited by hand\n`);
    expect((await wingfoil(fx, ['memory', 'submit', '--', 'task-004-session-timeout'])).code).toBe(0);
    expect((await git(fx.dir, ['show', 'HEAD'], fx.env)).stdout).toContain('+edited by hand');
  });

  it('an edit hidden by assume-unchanged: git status is empty, submit commits it (D32-1)', async () => {
    const fx = await copy('Jordan');
    const rel = await pathOf(fx, 'task-004-session-timeout');
    await git(fx.dir, ['update-index', '--assume-unchanged', '--', rel], fx.env);
    const file = path.join(fx.dir, rel);
    await writeFile(file, `${await readFile(file, 'utf8')}\nhidden edit\n`);
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toBe('');
    const out = await wingfoil(fx, ['memory', 'submit', '--', 'task-004-session-timeout']);
    expect(out.code, out.stderr).toBe(0);
    expect((await git(fx.dir, ['show', 'HEAD'], fx.env)).stdout).toContain('+hidden edit');
  });

  it('an edit hidden by assume-unchanged: approve commits it, then refuses (exit 1) and the commit stays (D32-1)', async () => {
    const fx = await copy('Morgan');
    const before = await head(fx);
    const rel = await pathOf(fx, 'task-001-login-form');
    await git(fx.dir, ['update-index', '--assume-unchanged', '--', rel], fx.env);
    const file = path.join(fx.dir, rel);
    await writeFile(file, `${await readFile(file, 'utf8')}\nhidden edit\n`);
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toBe('');
    const out = await wingfoil(fx, ['memory', 'approve', '--reason', 'ok', '--', 'task-001-login-form']);
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('carries more than the change it declares');
    expect(await head(fx)).not.toBe(before);
    expect((await git(fx.dir, ['show', 'HEAD'], fx.env)).stdout).toContain('+hidden edit');
  });

  it('a visible local change: approve refuses (exit 1) and commits nothing', async () => {
    const fx = await copy('Morgan');
    const before = await head(fx);
    const file = path.join(fx.dir, await pathOf(fx, 'task-001-login-form'));
    await writeFile(file, `${await readFile(file, 'utf8')}\nvisible edit\n`);
    const out = await wingfoil(fx, ['memory', 'approve', '--reason', 'ok', '--', 'task-001-login-form']);
    expect(out.code).toBe(1);
    expect(await head(fx)).toBe(before);
  });

  it.each([
    ['a line starting with Approver:', 'fine\nApprover: someone'],
    ['a line starting with Reason:', 'Reason: because'],
    ['a trailing Key: value paragraph', 'fine\n\nSigned-off-by: x'],
  ])('a reason with %s is a usage error: exit 2, a JSON message naming --reason (D32-5)', async (_l, reason) => {
    const fx = await copy('Morgan');
    const before = await head(fx);
    const out = await wingfoil(fx, ['memory', 'approve', '--reason', reason, '--', 'task-001-login-form']);
    expect(out.code).toBe(2);
    expect((JSON.parse(out.stderr.trim()) as { error: string }).error).toMatch(/^invalid flag value: --reason /);
    expect(await head(fx)).toBe(before);
  });

  it('W-22: an id after `--` is literal (`--version` is a document id)', async () => {
    const fx = await copy('Jordan');
    const out = await wingfoil(fx, ['memory', 'submit', '--', '--version']);
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('document not found: --version');
  });
});
