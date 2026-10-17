/**
 * Review R5 of task-029: the local registry runs detached (its own process group), so a smoke run
 * interrupted by Ctrl-C, SIGTERM or a closed terminal would leave it running. `killGroupOnExit`
 * (`test/smoke/registry-cleanup.ts`, used by `startRegistry`) kills the registry's group on SIGINT,
 * SIGTERM, SIGHUP and `exit`, and its returned `remove()` takes the handlers off on a normal stop.
 * Shown in a child Node.js process (the module has no import, so Node's type stripping runs it)
 * that starts a detached stand-in for the registry and is then signalled. Part of
 * `npm run test:publish-smoke`; it starts no registry.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { expectGroupGone, group, killGroups } from './support.js';

const MODULE = pathToFileURL(path.join(REPO_ROOT, 'test', 'smoke', 'registry-cleanup.ts')).href;
let ws: TempWorkspace;
let script: string;
const groups = new Set<number>();

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-029-cleanup-');
  script = path.join(ws.dir, 'child.mjs');
  // argv: <module URL> <mode>; mode `wait` (stay until signalled), `exit` (process.exit at once),
  // `remove` (remove the handlers, then exit).
  await writeFile(
    script,
    [
      "import { spawn } from 'node:child_process';",
      'const { killGroupOnExit } = await import(process.argv[2]);',
      "const standIn = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });",
      'const remove = killGroupOnExit(standIn.pid);',
      'process.stdout.write(`${standIn.pid}\\n`);',
      "if (process.argv[3] === 'exit') process.exit(0);",
      "if (process.argv[3] === 'remove') { remove(); process.exit(0); }",
      'setInterval(() => {}, 1000);',
      '',
    ].join('\n'),
  );
}, 60_000);

afterAll(async () => {
  killGroups(groups);
  await ws?.dispose();
});

/** Run the child in `mode`; resolve with the stand-in's pid once printed, and the child. */
function child(mode: 'wait' | 'exit' | 'remove') {
  const proc = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', script, MODULE, mode], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  proc.stderr.on('data', (d: Buffer) => (err += String(d)));
  const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  const standIn = new Promise<number>((resolve, reject) => {
    let out = '';
    proc.stdout.on('data', (d: Buffer) => {
      out += String(d);
      const m = /^(\d+)\n/.exec(out);
      if (m) {
        groups.add(Number(m[1]));
        resolve(Number(m[1]));
      }
    });
    void exited.then(() => setTimeout(() => reject(new Error(`child ended without a pid: ${err}`)), 100));
  });
  return { proc, standIn, exited };
}

describe('the registry process group is killed when the smoke is interrupted (review R5)', () => {
  it('startRegistry installs the handlers for its group and removes them on stop', async () => {
    const source = await readFile(path.join(REPO_ROOT, 'test', 'smoke', 'registry.ts'), 'utf8');
    expect(source).toMatch(/const removeCleanup = killGroupOnExit\(pgid\);/);
    expect(source).toMatch(/removeCleanup\(\);/);
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    '%s to the smoke process kills the registry group',
    async (signal) => {
      const c = child('wait');
      const pgid = await c.standIn;
      expect((await group(pgid)).length).toBeGreaterThan(0);
      c.proc.kill(signal);
      await c.exited;
      await expectGroupGone(pgid);
    },
  );

  it('an exit of the smoke process kills the registry group', async () => {
    const c = child('exit');
    const pgid = await c.standIn;
    await c.exited;
    await expectGroupGone(pgid);
  });

  it('remove() (a normal stop) takes the handlers off: the exit leaves the group alone', async () => {
    const c = child('remove');
    const pgid = await c.standIn;
    await c.exited;
    expect((await group(pgid)).length).toBeGreaterThan(0);
    process.kill(-pgid, 'SIGKILL');
    await expectGroupGone(pgid);
  });
});
