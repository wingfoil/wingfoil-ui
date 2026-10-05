// adr-001 D5, adr-002 (process runner port) — the local adapter: argument array, no shell, timeout,
// cancellation, termination at stop (spec-007 §6).
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEOUT_MS,
  LocalProcessRunner,
  ProcessStartError,
  type SpawnRecord,
} from '../../../server/src/process/runner.js';
import { pwned, SHELL_PAYLOAD } from '../../harness/security.js';

let dir: string;
const runners: LocalProcessRunner[] = [];

function runner(options: ConstructorParameters<typeof LocalProcessRunner>[0] = {}): LocalProcessRunner {
  const r = new LocalProcessRunner(options);
  runners.push(r);
  return r;
}

/** `node -e <code> <args…>` */
function node(code: string, args: readonly string[] = []) {
  return { file: process.execPath, args: ['-e', code, ...args], cwd: dir };
}

const SLEEP = 'setTimeout(() => {}, 60_000)';

beforeAll(async () => {
  dir = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-runner-')));
});

afterEach(async () => {
  for (const r of runners.splice(0)) await r.terminateAll();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('LocalProcessRunner', () => {
  it('times out after 30 s by default', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
  });

  it('passes every argument verbatim, with no shell, in the given working directory', async () => {
    expect(pwned()).toBe(false);
    const args = [SHELL_PAYLOAD, '$HOME', '`id`', 'a b', '*', ''];
    const result = await runner().run(
      node('process.stdout.write(JSON.stringify([process.cwd(), ...process.argv.slice(1)]))', args),
    );
    expect(result.ended).toBe('exit');
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([dir, ...args]);
    expect(pwned()).toBe(false);
  });

  it('collects stdout, stderr and the exit status', async () => {
    const result = await runner().run(
      node('process.stdout.write("out"); process.stderr.write("err"); process.exit(3)'),
    );
    expect(result).toMatchObject({ exitCode: 3, signal: null, stdout: 'out', stderr: 'err', ended: 'exit' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('closes the standard input of the child', async () => {
    const result = await runner().run(
      node(
        'let n = 0; process.stdin.on("data", (d) => (n += d.length)); process.stdin.on("end", () => process.stdout.write(String(n)))',
      ),
    );
    expect(result.stdout).toBe('0');
  });

  it('passes the given environment', async () => {
    const result = await runner().run({
      ...node('process.stdout.write(process.env.WFUI_PROBE ?? "unset")'),
      env: { ...process.env, WFUI_PROBE: 'set' },
    });
    expect(result.stdout).toBe('set');
  });

  it('kills a process that outlives its timeout', async () => {
    const started = Date.now();
    const result = await runner().run({ ...node(SLEEP), timeoutMs: 300 });
    expect(result.ended).toBe('timeout');
    expect(result.exitCode).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('runs without a timeout when timeoutMs is null, and is cancelled by its signal', async () => {
    const controller = new AbortController();
    const pending = runner().run({ ...node(SLEEP), timeoutMs: null, signal: controller.signal });
    setTimeout(() => controller.abort(), 300);
    const result = await pending;
    expect(result.ended).toBe('cancelled');
  });

  it('does not start a process whose signal is already aborted', async () => {
    const records: SpawnRecord[] = [];
    const controller = new AbortController();
    controller.abort();
    const result = await runner({ onSpawn: (r) => records.push(r) }).run({ ...node(SLEEP), signal: controller.signal });
    expect(result.ended).toBe('cancelled');
    expect(records).toEqual([]);
  });

  it('escalates to SIGKILL when the process ignores SIGTERM', async () => {
    const r = runner({ killGraceMs: 200 });
    const result = await r.run({
      ...node('process.on("SIGTERM", () => {}); process.stdout.write("ready"); setInterval(() => {}, 1000)'),
      timeoutMs: 500,
    });
    expect(result.ended).toBe('timeout');
    expect(result.signal).toBe('SIGKILL');
  });

  it('kills a process whose output exceeds the limit', async () => {
    const result = await runner({ maxOutputBytes: 1024 }).run(
      node('const b = "x".repeat(4096); setInterval(() => process.stdout.write(b), 5)'),
    );
    expect(result.ended).toBe('overflow');
  });

  it('reports every process it starts to the observer (process audit)', async () => {
    const records: SpawnRecord[] = [];
    await runner({ onSpawn: (r) => records.push(r) }).run(node('0', ['x']));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ file: process.execPath, args: ['-e', '0', 'x'], cwd: dir });
    expect(records[0]?.pid).toBeTypeOf('number');
  });

  it('rejects with ProcessStartError when the program cannot be started', async () => {
    await expect(runner().run({ file: path.join(dir, 'missing'), args: [], cwd: dir })).rejects.toBeInstanceOf(
      ProcessStartError,
    );
  });

  it('terminates every running child and refuses new ones (stop sequence)', async () => {
    const r = runner();
    const a = r.run({ ...node(SLEEP), timeoutMs: null });
    const b = r.run({ ...node(SLEEP), timeoutMs: null });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(r.running).toBe(2);
    await r.terminateAll();
    expect(r.running).toBe(0);
    expect((await a).ended).toBe('terminated');
    expect((await b).ended).toBe('terminated');
    await expect(r.run(node('0'))).rejects.toBeInstanceOf(ProcessStartError);
  });
});
