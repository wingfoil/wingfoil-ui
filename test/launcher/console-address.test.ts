// The console address file end to end (task-058 AC-1, AC-4, AC-6; launch.feature S-01.4 … S-01.6;
// adr-003 D1–D5): the package `bin` run with node, as `npx wingfoil-ui` runs it. The scenarios'
// port 4870 is replaced by a free port (design D58-12).
import { lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { hostname } from 'node:os';
import path from 'node:path';
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { binTestMs, BIN_TEST_MS } from '../harness/load.js';
import { scanForSecrets } from '../harness/secret-scan.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { startLauncher, type Launcher } from './launcher.js';

const POSIX = process.platform !== 'win32';
/** A pid no process holds (above Linux's `pid_max` limit). */
const DEAD_PID = 4_194_304;
const validate = new Ajv({ allErrors: true }).compile(
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/state/console-address.schema.json'), 'utf8')) as object,
);

let ws: TempWorkspace;
let env: NodeJS.ProcessEnv;
let n = 0;
const started: Launcher[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-console-address-bin-');
  env = (await harnessEnv(path.join(ws.dir, 'user'))).env;
}, 180_000);

afterAll(async () => {
  await Promise.all(started.map((l) => l.kill()));
  await ws.dispose();
});

/** A free loopback port (never the scenarios' 4870, D58-12). */
async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((r) => probe.listen({ host: '127.0.0.1', port: 0 }, r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise((r) => probe.close(r));
  return port;
}

function newStateDir(): string {
  return path.join(ws.dir, `state-${n++}`);
}

async function launch(stateDir: string, args: string[]): Promise<Launcher> {
  const l = await startLauncher(args, { ...env, WINGFOIL_UI_STATE_DIR: stateDir });
  started.push(l);
  return l;
}

const consoles = (stateDir: string): string => path.join(stateDir, 'consoles');
const addressOf = (stateDir: string, port: number): string => path.join(consoles(stateDir), `${port}.json`);

async function exists(file: string): Promise<boolean> {
  return lstat(file).then(
    () => true,
    () => false,
  );
}

describe('US-S-01 @v0.3 — the console address file', () => {
  it(
    "S-01.4 — Write the console's address file for agents",
    async () => {
      const stateDir = newStateDir();
      const port = await freePort();
      expect(await exists(consoles(stateDir))).toBe(false);
      const l = await launch(stateDir, ['--no-open', '--port', String(port)]);
      // Checked as soon as the URL line is seen (the console wrote it before the line).
      const file = addressOf(stateDir, port);
      const text = await readFile(file, 'utf8');
      if (POSIX) {
        expect((await stat(file)).mode & 0o777).toBe(0o600);
        expect((await stat(consoles(stateDir))).mode & 0o777).toBe(0o700);
      }
      const entry = JSON.parse(text) as Record<string, unknown>;
      expect(validate(entry), JSON.stringify(validate.errors)).toBe(true);
      expect(entry).toMatchObject({
        url: `http://127.0.0.1:${port}/`,
        port,
        portFixed: true,
        pid: l.pid,
        host: hostname(),
      });
      // No part of the session token printed in the URL line (adr-003 D5).
      expect(text).not.toContain(l.token);
      for (let i = 0; i + 8 <= l.token.length; i++) expect(text).not.toContain(l.token.slice(i, i + 8));
      // Nor the session id of an exchanged token (the cookie's value), anywhere in the state directory.
      const session = await fetch(`http://127.0.0.1:${port}/api/session`, {
        method: 'POST',
        headers: { authorization: `Bearer ${l.token}` },
      });
      expect(session.status).toBe(204);
      const sessionId = /=([^;]+)/.exec(session.headers.get('set-cookie') ?? '')?.[1];
      expect(sessionId).toBeDefined();
      expect(await scanForSecrets([stateDir], [l.token, sessionId!])).toEqual([]);
      expect(await l.stop()).toBe(0);
    },
    BIN_TEST_MS,
  );

  it(
    'S-01.4 — without --port the file names the port of the URL line, portFixed false',
    async () => {
      const stateDir = newStateDir();
      const l = await launch(stateDir, ['--no-open']);
      expect(JSON.parse(await readFile(addressOf(stateDir, l.port), 'utf8'))).toMatchObject({
        url: `http://127.0.0.1:${l.port}/`,
        port: l.port,
        portFixed: false,
      });
      expect(await l.stop()).toBe(0);
    },
    BIN_TEST_MS,
  );

  it.each(POSIX ? (['SIGINT', 'SIGTERM', 'SIGHUP'] as const) : (['SIGINT'] as const))(
    'S-01.5 — Remove the address file on stop (%s)',
    async (signal) => {
      const stateDir = newStateDir();
      const l = await launch(stateDir, ['--no-open', '--port', String(await freePort())]);
      expect(await exists(addressOf(stateDir, l.port))).toBe(true);
      expect(await l.stop(signal)).toBe(0);
      expect(l.stdoutLines().at(-1)).toBe('WingFoil UI stopped');
      expect(await exists(addressOf(stateDir, l.port))).toBe(false);
    },
    BIN_TEST_MS,
  );

  it(
    'S-01.6 — Remove a stale address file at start',
    async () => {
      const stateDir = newStateDir();
      const port = await freePort();
      const stale = addressOf(stateDir, port + 1);
      await mkdir(consoles(stateDir), { recursive: true, mode: 0o700 });
      await writeFile(
        stale,
        JSON.stringify({
          format: 1,
          url: `http://127.0.0.1:${port + 1}/`,
          port: port + 1,
          portFixed: true,
          pid: DEAD_PID,
          host: hostname(),
          started: '2026-11-05T09:00:00.000Z',
          version: '0.3.0',
        }),
      );
      const l = await launch(stateDir, ['--no-open', '--port', String(port)]);
      expect(await exists(stale)).toBe(false);
      expect(await exists(addressOf(stateDir, port))).toBe(true);
      expect(await l.stop()).toBe(0);
    },
    BIN_TEST_MS,
  );

  it(
    'two consoles on one state directory write two files (AC-4)',
    async () => {
      // one-console-per-test: kept — two consoles on one state directory, AC-4
      const stateDir = newStateDir();
      const a = await launch(stateDir, ['--no-open', '--port', String(await freePort())]);
      const b = await launch(stateDir, ['--no-open']);
      expect(await exists(addressOf(stateDir, a.port))).toBe(true);
      expect(await exists(addressOf(stateDir, b.port))).toBe(true);
      expect(await a.stop()).toBe(0);
      expect(await exists(addressOf(stateDir, a.port))).toBe(false);
      expect(await exists(addressOf(stateDir, b.port))).toBe(true);
      expect(await b.stop()).toBe(0);
    },
    binTestMs(2),
  );

  it(
    "a SIGKILLed console's file is left, then removed by the next start (AC-4, AC-5)",
    async () => {
      // one-console-per-test: kept — a forced kill followed by a new start, AC-4
      const stateDir = newStateDir();
      const a = await launch(stateDir, ['--no-open']);
      // The second console's port is drawn while the first one holds its own, so the two differ
      // (review round 1 F7: an OS-chosen port could be the dead console's again).
      const second = await freePort();
      await a.kill();
      expect(await exists(addressOf(stateDir, a.port))).toBe(true);
      const b = await launch(stateDir, ['--no-open', '--port', String(second)]);
      expect(await exists(addressOf(stateDir, a.port))).toBe(false);
      expect(await exists(addressOf(stateDir, b.port))).toBe(true);
      expect(await b.stop()).toBe(0);
    },
    binTestMs(2),
  );
});
