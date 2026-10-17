// task-029 (AC-2, D29-8) — `scripts/publish-guard.mjs`, the root `prepublishOnly`: once `private`
// is gone, an `npm publish` run from a checkout is refused before anything is packed or sent. The
// pipeline publishes the gate's tarball (`npm stage publish <tarball>`), which runs no lifecycle
// script, so the guard never stands in its way. Shown on a scratch package that carries the
// root's `prepublishOnly` and no `prepack` (the real root would rebuild `server/dist`).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { run } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { npmCli, readManifest } from '../package/allow-list.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'publish-guard.mjs');
let ws: TempWorkspace;
let env: NodeJS.ProcessEnv;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-029-guard-');
  const base = (await harnessEnv(path.join(ws.dir, 'user'))).env;
  env = Object.fromEntries(Object.entries(base).filter(([key]) => !/^npm_/i.test(key)));
  await writeFile(
    path.join(ws.dir, 'package.json'),
    JSON.stringify({
      name: 'wfui-guard-probe',
      version: '0.0.1',
      scripts: { prepublishOnly: readManifest().scripts?.prepublishOnly?.replace('scripts/', `${REPO_ROOT}/scripts/`) },
    }),
  );
}, 60_000);

afterAll(async () => {
  await ws?.dispose();
});

describe('publish guard (task-029, D29-8)', () => {
  it('is the root prepublishOnly', () => {
    expect(readManifest().scripts?.prepublishOnly).toBe('node scripts/publish-guard.mjs');
  });

  it('refuses when run, naming the pipeline and the publishing guide', async () => {
    const r = await run(process.execPath, [SCRIPT], { env, allowFailure: true });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('.github/workflows/publish.yml');
    expect(r.stderr).toContain('docs/publishing.md');
  });

  it('stops npm publish from a checkout (dry run, a registry nobody serves)', async () => {
    const r = await run(
      process.execPath,
      [npmCli(), 'publish', '--dry-run', '--registry', 'http://127.0.0.1:9/', '--fetch-retries', '0', '--no-update-notifier'],
      { cwd: ws.dir, env, allowFailure: true },
    );
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('.github/workflows/publish.yml');
  }, 60_000);
});
