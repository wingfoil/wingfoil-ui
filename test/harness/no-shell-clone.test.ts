// TT-SEC-05 (REQ-SEC-05) v0.1 scope, harness side (characterization): a clone whose URL and working
// directory contain a shell payload creates no `/tmp/pwned` and the paths stay literal. The server's
// clone (`POST /api/projects/clone`) must run the same probe in task-008; its screen closes in task-014 (S-04.3).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFixture, type Fixture } from './fixtures/index.js';
import { git } from './run.js';
import { PWNED_PATH, pwned, SHELL_PAYLOAD } from './security.js';

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
    expect(pwned(), `${PWNED_PATH} exists before the test: remove it and re-run`).toBe(false);
    const remote = path.join(root, `remote${SHELL_PAYLOAD}.git`);
    await git(root, ['clone', '-q', '--bare', fx.remoteDir, remote], fx.env);
    const workdir = path.join(root, `work${SHELL_PAYLOAD}dir`);
    await git(root, ['clone', '-q', `file://${remote}`, workdir], fx.env);
    expect((await git(workdir, ['rev-parse', 'HEAD'], fx.env)).stdout).toBe(
      (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout,
    );
    expect(pwned()).toBe(false);
  },
);
