/**
 * Shared support of the smoke suites: the launch smoke (`launch.smoke.test.ts`, task-025 AC-3,
 * `npm run test:smoke`) and the staging publish smoke (`staging.publish.test.ts`, task-029 AC-3,
 * `npm run test:publish-smoke`). Moved here unchanged from the launch smoke by task-029 (D29-3):
 * one way to run `npx wingfoil-ui` from an installed package, find its processes and stop it.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { expect } from 'vitest';
import { run } from '../harness/run.js';
import { npmCli } from '../package/allow-list.js';

/** The launcher's first line (spec-007 §4). */
export const RUNNING = /^WingFoil UI is running at (http:\/\/127\.0\.0\.1:(\d+)\/)#token=([A-Za-z0-9_-]+)$/;
const START_MS = 30_000;

/** `env` without the variables `npm run` adds (`npm_config_*`, `npm_package_*`, `npm_lifecycle_*`). */
export function withoutNpmVars(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Vitest's `NODE_ENV=test` goes too: `prepack`'s Vite build would make React's development
  // bundle (review round 1).
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^npm_/i.test(key) && key !== 'NODE_ENV'));
}

/** Run `work`, record its duration in `timings[name]` and print it. */
export async function timed<T>(
  timings: Record<string, number>,
  label: string,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const t0 = performance.now();
  try {
    return await work();
  } finally {
    timings[name] = Math.round(performance.now() - t0);
    console.log(`${label}: ${name} ${timings[name]} ms`);
  }
}

/** `npx` of this npm, run with this Node.js (no shell). */
export const NPX = path.join(path.dirname(npmCli()), 'npx-cli.js');

/** `npx --no -- wingfoil-ui …` in the install folder: never a registry fallback. */
export function npxArgs(args: readonly string[]): string[] {
  return [NPX, '--no', '--', 'wingfoil-ui', ...args];
}

/** A process of `ps`. */
export interface Proc {
  pid: number;
  ppid: number;
  pgid: number;
  args: string;
}

/** Every process of the machine (`ps -e`). */
export async function processes(): Promise<Proc[]> {
  const { stdout } = await run('ps', ['-e', '-o', 'pid=,ppid=,pgid=,args=']);
  return stdout
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), pgid: Number(m[3]), args: m[4]! }));
}

/** Processes still alive in the group led by `pgid`. */
export async function group(pgid: number): Promise<Proc[]> {
  return (await processes()).filter((p) => p.pgid === pgid);
}

/** The bin's own process: the leaf of the `npx` group (npm → `sh -c` → node). */
export async function serverProcess(pgid: number): Promise<Proc> {
  const members = await group(pgid);
  const leaves = members.filter((p) => !members.some((q) => q.ppid === p.pid));
  expect(leaves, JSON.stringify(members)).toHaveLength(1);
  return leaves[0]!;
}

/** Wait until the group led by `pgid` has no process left. */
export async function expectGroupGone(pgid: number): Promise<void> {
  await expect.poll(async () => (await group(pgid)).map((p) => p.args), { timeout: 10_000 }).toEqual([]);
}

/** A console started by {@link start}. */
export interface Started {
  pgid: number;
  origin: string;
  token: string;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

/**
 * Start `npx wingfoil-ui --no-open` in `cwd` in its own process group (added to `groups`, for the
 * caller's `afterAll`) and wait for the running line.
 */
export function start(cwd: string, env: NodeJS.ProcessEnv, groups: Set<number>): Promise<Started> {
  const child = spawn(process.execPath, npxArgs(['--no-open']), {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pgid = child.pid!;
  groups.add(pgid);
  let out = '';
  let err = '';
  child.stderr.on('data', (d: Buffer) => (err += String(d)));
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no running line after ${START_MS} ms: ${out} ${err}`)), START_MS);
    void exited.then(({ code, signal }) => {
      clearTimeout(timer);
      reject(new Error(`npx ended (${String(code ?? signal)}) before the running line: ${out} ${err}`));
    });
    child.stdout.on('data', (d: Buffer) => {
      out += String(d);
      const first = out.split('\n')[0]!;
      const m = out.includes('\n') ? RUNNING.exec(first) : null;
      if (!m) return;
      clearTimeout(timer);
      resolve({ pgid, origin: m[1]!.replace(/\/$/, ''), token: m[3]!, stdout: () => out, stderr: () => err, exited });
    });
  });
}

/** SIGKILL every process group in `groups` (an `afterAll` that runs whatever happened). */
export function killGroups(groups: Set<number>): void {
  for (const pgid of groups) {
    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}
