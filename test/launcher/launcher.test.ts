// The wingfoil-ui command end to end (spec-007; S-01.1…S-01.3, X-03.1, X-03.2, REQ-PERF-06):
// the package `bin` run with node, as `npx wingfoil-ui` runs it.
import { chmod, mkdir, mkdtemp, readFile, readlink, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { run } from '../harness/run.js';
import { BIN, startLauncher, type Launcher } from './launcher.js';

const RUNNING = /^WingFoil UI is running at (http:\/\/127\.0\.0\.1:(\d+)\/#token=([A-Za-z0-9_-]{43}))$/;
let root: string;
let env: NodeJS.ProcessEnv;
const started: Launcher[] = [];

/** A PATH holding `node` (and `git`) but no browser opener. */
async function pathWithoutOpener(): Promise<string> {
  const bin = path.join(root, 'bin-no-opener');
  await mkdir(bin, { recursive: true });
  await symlink(process.execPath, path.join(bin, 'node')).catch(() => undefined);
  return bin;
}

/** A PATH whose `xdg-open`/`open` records its arguments in `file`. */
async function pathWithRecordingOpener(file: string): Promise<string> {
  const bin = path.join(root, 'bin-recording');
  await mkdir(bin, { recursive: true });
  const script = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(file)}, JSON.stringify(process.argv.slice(2)));\n`;
  for (const name of ['xdg-open', 'open']) {
    await writeFile(path.join(bin, name), script);
    await chmod(path.join(bin, name), 0o755);
  }
  return bin;
}

async function launch(args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<Launcher> {
  const l = await startLauncher(args, { ...env, ...extraEnv });
  started.push(l);
  return l;
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-launch-'));
  env = { ...(await harnessEnv(root)).env, WINGFOIL_UI_STATE_DIR: path.join(root, 'state') };
}, 180_000);

afterAll(async () => {
  await Promise.all(started.map((l) => l.kill()));
  await rm(root, { recursive: true, force: true });
});

describe('S-01.1 — start the console', () => {
  it('prints the URL with the token, serves it on 127.0.0.1, and opens the browser on it', async () => {
    const record = path.join(root, 'opened.json');
    const bin = await pathWithRecordingOpener(record);
    const l = await launch([], { PATH: `${bin}${path.delimiter}${env.PATH ?? ''}` });
    const [, url, port] = RUNNING.exec(l.runningLine)!;
    expect(url).toBeDefined();
    const api = await fetch(`http://127.0.0.1:${port}/api/nothing`, {
      headers: { authorization: `Bearer ${l.token}` },
    });
    expect(api.status).toBe(404);
    await expect
      .poll(async () => readFile(record, 'utf8').catch(() => ''), { timeout: 5_000 })
      .toBe(JSON.stringify([url]));
  });

  it('never prints the token on stderr', async () => {
    const l = await launch(['--no-open']);
    const token = RUNNING.exec(l.runningLine)![3]!;
    await fetch(`http://127.0.0.1:${l.port}/api/nothing`, { headers: { authorization: `Bearer ${token}` } });
    await l.stop();
    expect(l.stderr()).toContain('"port"');
    expect(l.stderr()).not.toContain(token);
  });
});

describe('S-01.2 — refuse an unsupported Node.js version', () => {
  it('prints the catalogue message, exits 1 and opens no port', async () => {
    const fake = path.join(root, 'node20.cjs');
    await writeFile(fake, "Object.defineProperty(process.versions, 'node', { value: '20.11.1' });\n");
    const result = await run(process.execPath, ['--require', fake, BIN, '--no-open'], { env, allowFailure: true });
    expect(result.code).toBe(1);
    expect(result.stderr.trim()).toBe('WingFoil UI needs Node.js 22.12 or later (found 20.11)');
    expect(result.stdout).toBe('');
  });

  it('keeps the bin stub parseable by old Node.js (ES2020 script)', async () => {
    const { parse } = await import('espree');
    const source = await readFile(BIN, 'utf8');
    expect(() => parse(source.replace(/^#!.*\n/, ''), { ecmaVersion: 2020, sourceType: 'script' })).not.toThrow();
  });
});

describe('S-01.3 — no browser available', () => {
  it('prints the URL to open and keeps running', async () => {
    const l = await launch([], { PATH: await pathWithoutOpener() });
    const url = RUNNING.exec(l.runningLine)![1]!;
    await expect.poll(() => l.stdoutLines(), { timeout: 5_000 }).toContain(`Open this URL in your browser: ${url}`);
    const api = await fetch(`http://127.0.0.1:${l.port}/api/nothing`, {
      headers: { authorization: `Bearer ${l.token}` },
    });
    expect(api.status).toBe(404);
  });
});

describe('spec-007 command line', () => {
  it('--version prints the package version and exits 0', async () => {
    const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
    const result = await run(process.execPath, [BIN, '--version'], { env });
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('--help prints the synopsis and exits 0', async () => {
    const result = await run(process.execPath, [BIN, '--help'], { env });
    expect(result.stdout).toContain('wingfoil-ui [--port <n>] [--no-open] [--version] [--help]');
  });

  it('exits 2 with the usage on stderr for an unknown option', async () => {
    const result = await run(process.execPath, [BIN, '--verbose'], { env, allowFailure: true });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('wingfoil-ui [--port <n>]');
    expect(result.stdout).toBe('');
  });

  it('exits 3 when the given port is in use', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen({ host: '127.0.0.1', port: 0 }, r));
    const port = (blocker.address() as net.AddressInfo).port;
    const result = await run(process.execPath, [BIN, '--no-open', '--port', String(port)], { env, allowFailure: true });
    blocker.close();
    expect(result.code).toBe(3);
    expect(result.stderr).toContain(`Port ${port} is already in use`);
  });

  it('stops on SIGINT with the stop line and exit 0', async () => {
    const l = await launch(['--no-open']);
    const code = await l.stop('SIGINT');
    expect(code).toBe(0);
    expect(l.stdoutLines().at(-1)).toBe('WingFoil UI stopped');
  });

  it('exits 130 on a second signal while stopping', async () => {
    const l = await launch(['--no-open']);
    // An unfinished request keeps the graceful stop waiting.
    const socket = net.connect({ host: '127.0.0.1', port: l.port });
    await new Promise<void>((r) => socket.once('connect', () => r()));
    socket.write('GET /api/nothing HTTP/1.1\r\nHost: 127.0.0.1\r\n');
    l.signal('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
    const code = await l.stop('SIGINT');
    socket.destroy();
    expect(code).toBe(130);
  });
});

describe('REQ-PERF-06 — server start', () => {
  it('prints the URL within 3.0 s in 10 out of 10 runs', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const l = await launch(['--no-open']);
      times.push(l.startMs);
      await l.stop();
    }
    console.info(`REQ-PERF-06 spawn → URL (ms): ${times.map((t) => Math.round(t)).join(', ')}`);
    expect(Math.max(...times)).toBeLessThanOrEqual(3_000);
  }, 60_000);
});

describe('REQ-SEC-01 — loopback only', () => {
  it.skipIf(process.platform !== 'linux')('X-03.1 — every listening socket is 127.0.0.1 or ::1', async () => {
    const l = await launch(['--no-open']);
    const inodes = new Set<string>();
    for (const fd of await readdir(`/proc/${l.pid}/fd`)) {
      const target = await readlink(`/proc/${l.pid}/fd/${fd}`).catch(() => '');
      const m = /^socket:\[(\d+)\]$/.exec(target);
      if (m) inodes.add(m[1]!);
    }
    const listening: string[] = [];
    for (const table of ['tcp', 'tcp6']) {
      const rows = (await readFile(`/proc/net/${table}`, 'utf8')).trim().split('\n').slice(1);
      for (const row of rows) {
        const cols = row.trim().split(/\s+/);
        if (cols[3] === '0A' && inodes.has(cols[9]!)) listening.push(cols[1]!);
      }
    }
    const hexPort = l.port.toString(16).toUpperCase().padStart(4, '0');
    expect(listening.sort()).toEqual([`00000000000000000000000001000000:${hexPort}`, `0100007F:${hexPort}`]);
  });

  it('X-03.2 — refuses a connection on the machine network address', async (ctx) => {
    const address = Object.values(networkInterfaces())
      .flat()
      .find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
    if (!address) ctx.skip(); // no network address on this machine: nothing to refuse
    const l = await launch(['--no-open']);
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      const socket = net.connect({ host: address, port: l.port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(null);
      });
      socket.once('error', resolve);
    });
    expect(error?.code).toBe('ECONNREFUSED');
  });
});
