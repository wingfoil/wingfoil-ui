// spec-007 §3, §6 (amended by task-058), adr-003 D2 — the console address file in the start and
// stop sequences, in process: written before the URL line, removed right after the console stops
// accepting connections and before the stop steps, and by the exit handler (task-058 AC-5).
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXIT, onStop, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';

let root: string;
let n = 0;
const stops: (() => void)[] = [];
const unsubscribe: (() => void)[] = [];
const stderr: string[] = [];

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-start-address-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>WingFoil UI</title>');
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
});

afterEach(async () => {
  for (const off of unsubscribe.splice(0)) off();
  for (const stop of stops.splice(0)) stop();
  await new Promise((r) => setTimeout(r, 50));
});

afterAll(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

interface TestIo extends LauncherIo {
  out: string[];
  exits: number[];
  exitHandlers: (() => void)[];
  /** Whether the address file existed when each stdout line was written. */
  fileAtLine: boolean[];
  signal(): void;
}

function testIo(stateDir: string, file: () => string | undefined): TestIo {
  let handler: (() => void) | undefined;
  const io: TestIo = {
    out: [],
    exits: [],
    exitHandlers: [],
    fileAtLine: [],
    stdout: (line) => {
      const f = file();
      io.fileAtLine.push(f !== undefined && existsSync(f));
      io.out.push(line);
    },
    stderr: () => undefined,
    version: '9.9.9',
    staticDir: root,
    stateDir,
    platform: process.platform,
    onSignal: (h) => {
      handler = h;
    },
    onExit: (h) => io.exitHandlers.push(h),
    exit: (code) => io.exits.push(code),
    signal: () => handler?.(),
  };
  stops.push(() => {
    if (io.exits.length === 0) handler?.();
  });
  return io;
}

/** Start on a free port; resolves with the io and the address file's path. */
async function start(processes?: LocalProcessRunner): Promise<{ io: TestIo; file: string; port: number }> {
  const stateDir = path.join(root, `state-${n++}`);
  const probe = net.createServer();
  await new Promise<void>((r) => probe.listen({ host: '127.0.0.1', port: 0 }, r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise((r) => probe.close(r));
  const file = path.join(stateDir, 'consoles', `${port}.json`);
  const io = testIo(stateDir, () => file);
  if (processes) io.processes = processes;
  expect(await runLauncher(['--no-open', '--port', String(port)], io)).toBeUndefined();
  return { io, file, port };
}

describe('the address file in the start and stop sequences', () => {
  it('exists when the URL line is printed, with portFixed true and this process id', async () => {
    const { io, file, port } = await start();
    expect(io.out[0]).toMatch(/^WingFoil UI is running at /);
    expect(io.fileAtLine[0]).toBe(true);
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      url: `http://127.0.0.1:${port}/`,
      port,
      portFixed: true,
      pid: process.pid,
      version: '9.9.9',
    });
  });

  it('is gone when the first stop step runs, after the console stops accepting connections', async () => {
    const { io, file, port } = await start();
    const seen: { file: boolean; accepting: boolean }[] = [];
    unsubscribe.push(
      onStop(async () => {
        const accepting = await new Promise<boolean>((resolve) => {
          const socket = net.connect({ host: '127.0.0.1', port });
          socket.once('connect', () => {
            socket.destroy();
            resolve(true);
          });
          socket.once('error', () => resolve(false));
        });
        seen.push({ file: existsSync(file), accepting });
      }),
    );
    io.signal();
    await vi.waitFor(() => expect(io.exits).toEqual([EXIT.ok]));
    expect(seen).toEqual([{ file: false, accepting: false }]);
    expect(io.out.at(-1)).toBe('WingFoil UI stopped');
    expect(existsSync(file)).toBe(false);
  });

  it('is removed on an exit 70 (a failed stop step)', async () => {
    const { io, file } = await start();
    unsubscribe.push(
      onStop(() => {
        throw new Error('a stop step failed');
      }),
    );
    io.signal();
    await vi.waitFor(() => expect(io.exits).toEqual([EXIT.unexpected]));
    expect(existsSync(file)).toBe(false);
  });

  it('is removed by the exit handler (a forced stop, any process exit)', async () => {
    const { io, file } = await start();
    expect(existsSync(file)).toBe(true);
    for (const h of io.exitHandlers) h();
    expect(existsSync(file)).toBe(false);
  });

  // Review round 1 F4: the removal runs first and on its own, so a failing kill cannot skip it.
  it('is removed by the exit handler even when killing the children throws', async () => {
    const processes = new LocalProcessRunner();
    const kill = vi.spyOn(processes, 'killAllNow').mockImplementation(() => {
      throw new Error('kill failed');
    });
    const { io, file } = await start(processes);
    expect(existsSync(file)).toBe(true);
    expect(() => {
      for (const h of io.exitHandlers) h();
    }).not.toThrow();
    expect(existsSync(file)).toBe(false);
    expect(kill).toHaveBeenCalledTimes(1);
    kill.mockRestore();
  });

  it('is left when another console holds it, and the stop still exits 0', async () => {
    const { io, file } = await start();
    const theirs = `${JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), pid: 1 })}\n`;
    await writeFile(file, theirs);
    io.signal();
    await vi.waitFor(() => expect(io.exits).toEqual([EXIT.ok]));
    expect(await readFile(file, 'utf8')).toBe(theirs);
  });

  it.skipIf(process.platform === 'win32')(
    'an unusable consoles/ is a warning in the log: the start goes on and the URL is printed',
    async () => {
      const stateDir = path.join(root, `state-${n++}`);
      await mkdir(stateDir, { recursive: true, mode: 0o700 });
      await writeFile(path.join(stateDir, 'consoles'), 'not a folder');
      stderr.length = 0;
      const io = testIo(stateDir, () => undefined);
      expect(await runLauncher(['--no-open'], io)).toBeUndefined();
      expect(io.out[0]).toMatch(/^WingFoil UI is running at /);
      const line = stderr.find((l) => l.includes('console address file'));
      expect(line).toBeDefined();
      expect(JSON.parse(line!)).toMatchObject({ level: 40, reason: 'consoles-not-directory' });
      expect(line).not.toContain(stateDir);
    },
  );
});
