// spec-007 §3, §6 — start and stop sequences, in process (the bin is covered by test/launcher).
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { drawToken, EXIT, onStop, runLauncher, type LauncherIo } from '../../../server/src/launcher/start.js';
import type { Spawner } from '../../../server/src/launcher/opener.js';

let staticDir: string;
const stops: (() => void)[] = [];

beforeAll(async () => {
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-start-'));
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>WingFoil UI</title>');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  for (const stop of stops.splice(0)) stop();
  await new Promise((r) => setTimeout(r, 50));
});

afterAll(async () => {
  vi.restoreAllMocks();
  await rm(staticDir, { recursive: true, force: true });
});

interface TestIo extends LauncherIo {
  out: string[];
  err: string[];
  exits: number[];
  signal(): void;
}

function testIo(spawn?: Spawner): TestIo {
  let handler: (() => void) | undefined;
  const io: TestIo = {
    out: [],
    err: [],
    exits: [],
    stdout: (line) => io.out.push(line),
    stderr: (line) => io.err.push(line),
    version: '9.9.9',
    staticDir,
    platform: 'linux',
    onSignal: (h) => {
      handler = h;
    },
    exit: (code) => io.exits.push(code),
    signal: () => handler?.(),
  };
  if (spawn) io.spawn = spawn;
  stops.push(() => {
    if (io.exits.length === 0) handler?.();
  });
  return io;
}

function spawner(exitCode: number): Spawner {
  return () => {
    const child = Object.assign(new EventEmitter(), { unref: () => undefined });
    setImmediate(() => child.emit('exit', exitCode, null));
    return child;
  };
}

const RUNNING = /^WingFoil UI is running at http:\/\/127\.0\.0\.1:(\d+)\/#token=[A-Za-z0-9_-]{43}$/;

describe('runLauncher', () => {
  it('answers --version and --help at once', async () => {
    const io = testIo();
    expect(await runLauncher(['--version'], io)).toBe(EXIT.ok);
    expect(await runLauncher(['--help'], io)).toBe(EXIT.ok);
    expect(io.out[0]).toBe('9.9.9');
    expect(io.out[1]).toMatch(/^Usage: wingfoil-ui \[--port <n>\]/);
  });

  it('refuses a malformed command line with the reason and the usage', async () => {
    const io = testIo();
    expect(await runLauncher(['--port', '80'], io)).toBe(EXIT.usage);
    expect(io.err[0]).toBe(
      'Invalid port: 80 (expected an integer from 1024 to 65535)\nUsage: wingfoil-ui [--port <n>] [--no-open] [--version] [--help]',
    );
  });

  it('prints the running line, serves, and stops with the stop line and exit 0', async () => {
    const io = testIo();
    const hook = vi.fn(async () => undefined);
    onStop(hook);
    expect(await runLauncher(['--no-open'], io)).toBeUndefined();
    const port = Number(RUNNING.exec(io.out[0]!)![1]);
    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200);
    io.signal();
    await vi.waitFor(() => expect(io.exits).toEqual([EXIT.ok]));
    expect(io.out.at(-1)).toBe('WingFoil UI stopped');
    expect(hook).toHaveBeenCalledOnce();
  });

  it('exits 130 on a second signal', async () => {
    const io = testIo();
    await runLauncher(['--no-open'], io);
    io.signal();
    io.signal();
    expect(io.exits[0]).toBe(EXIT.forced);
  });

  it('prints the URL to open when the opener fails, nothing when it succeeds', async () => {
    const failing = testIo(spawner(1));
    await runLauncher([], failing);
    const url = failing.out[0]!.replace('WingFoil UI is running at ', '');
    await vi.waitFor(() => expect(failing.out).toContain(`Open this URL in your browser: ${url}`));
    const opening = testIo(spawner(0));
    await runLauncher([], opening);
    await new Promise((r) => setTimeout(r, 50));
    expect(opening.out).toHaveLength(1);
  });

  it('exits 3 when the given port is in use', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen({ host: '127.0.0.1', port: 0 }, r));
    const port = (blocker.address() as net.AddressInfo).port;
    const io = testIo();
    expect(await runLauncher(['--no-open', '--port', String(port)], io)).toBe(EXIT.port);
    expect(io.err).toEqual([`Port ${port} is already in use`]);
    blocker.close();
  });
});

describe('drawToken', () => {
  it('draws 32 random bytes as base64url, different at every call', () => {
    const a = drawToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(drawToken()).not.toBe(a);
  });
});
