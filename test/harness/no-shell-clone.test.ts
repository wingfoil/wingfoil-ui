// TT-SEC-05 (REQ-SEC-05) v0.1 scope, harness side: a clone whose URL and working directory contain
// a shell payload creates no `/tmp/pwned`. The server's clone is task-008, its screen task-014 (S-04.3).
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFixture, type Fixture } from './fixtures/index.js';
import { git } from './run.js';

const PAYLOAD = '"; touch /tmp/pwned; "';
const PWNED = '/tmp/pwned';
let root: string;
let fx: Fixture;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-sec-'));
  fx = await buildFixture('kanban', { root });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it.skipIf(process.platform === 'win32')(
  'clones a remote whose URL and working directory contain a shell payload, literally',
  async () => {
    expect(existsSync(PWNED), `${PWNED} exists before the test: remove it and re-run`).toBe(false);
    const remote = path.join(root, `remote${PAYLOAD}.git`);
    await git(root, ['clone', '-q', '--bare', fx.remoteDir, remote], fx.env);
    const workdir = path.join(root, `work${PAYLOAD}dir`);
    await git(root, ['clone', '-q', `file://${remote}`, workdir], fx.env);
    expect((await git(workdir, ['rev-parse', 'HEAD'], fx.env)).stdout).toBe(
      (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout,
    );
    expect(existsSync(PWNED)).toBe(false);
  },
);
