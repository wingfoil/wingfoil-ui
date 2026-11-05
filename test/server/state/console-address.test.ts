// adr-003 D1–D5, spec-006 §1, §4, §6 — the console address file `consoles/<port>.json`
// (task-058 AC-2 … AC-6; design D58-1 … D58-9): write, modes and checks, heartbeat, start
// housekeeping, stale rule, removal.
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, symlink, utimes, writeFile, chmod, lstat } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ADDRESS_HEARTBEAT_MS,
  ADDRESS_STALE_MS,
  CONSOLES_DIR,
  consolesVerdict,
  isStaleAddress,
  publishConsoleAddress,
  removableAtStart,
  stateDirProblem,
  type AddressLogger,
  type ConsoleAddress,
  type ConsoleAddressOptions,
} from '../../../server/src/state/console-address.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

const POSIX = process.platform !== 'win32';
const HOST = hostname();
/** A pid no process holds (above Linux's `pid_max` limit). */
const DEAD_PID = 4_194_304;
const STARTED = new Date('2026-11-05T10:00:00.000Z');

let ws: TempWorkspace;
let n = 0;
const open: ConsoleAddress[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-console-address-');
});

afterEach(async () => {
  vi.useRealTimers();
  for (const a of open.splice(0)) await a.stop();
});

afterAll(async () => {
  await ws.dispose();
});

interface Logged {
  level: 'info' | 'warn';
  fields: Record<string, unknown>;
  msg: string;
}

function recorder(): AddressLogger & { lines: Logged[]; warnings(): unknown[] } {
  const lines: Logged[] = [];
  return {
    lines,
    info: (fields, msg) => lines.push({ level: 'info', fields: fields as Record<string, unknown>, msg }),
    warn: (fields, msg) => lines.push({ level: 'warn', fields: fields as Record<string, unknown>, msg }),
    warnings: () => lines.filter((l) => l.level === 'warn').map((l) => l.fields['reason']),
  };
}

/** A fresh state directory path (not created). */
function stateDir(): string {
  return path.join(ws.dir, `state-${n++}`);
}

function publish(
  dir: string,
  extra: Partial<ConsoleAddressOptions> = {},
): ConsoleAddress & { log: ReturnType<typeof recorder> } {
  const log = recorder();
  const a = publishConsoleAddress({
    stateDir: dir,
    port: 4931,
    portFixed: true,
    version: '9.9.9',
    started: STARTED,
    logger: log,
    ...extra,
  });
  open.push(a);
  return Object.assign(a, { log });
}

function addressFile(dir: string, port = 4931): string {
  return path.join(dir, CONSOLES_DIR, `${port}.json`);
}

async function mode(file: string): Promise<number> {
  return (await stat(file)).mode & 0o777;
}

async function entry(dir: string, fields: Record<string, unknown>, port: number, ageMs = 0): Promise<string> {
  await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
  const file = addressFile(dir, port);
  await writeFile(
    file,
    `${JSON.stringify({ format: 1, url: `http://127.0.0.1:${port}/`, port, portFixed: true, started: STARTED.toISOString(), version: '0.3.0', ...fields })}\n`,
  );
  if (ageMs > 0) {
    const t = new Date(Date.now() - ageMs);
    await utimes(file, t, t);
  }
  return file;
}

async function exists(file: string): Promise<boolean> {
  return lstat(file).then(
    () => true,
    () => false,
  );
}

describe('write (AC-2, adr-003 D1, D2)', () => {
  it('creates the state directory and consoles/ with 0700 and the file with 0600, holding the eight fields', async () => {
    const dir = stateDir();
    const a = publish(dir);
    expect(await a.written).toBe(true);
    const parsed = JSON.parse(await readFile(addressFile(dir), 'utf8')) as Record<string, unknown>;
    expect(parsed).toEqual({
      format: 1,
      url: 'http://127.0.0.1:4931/',
      port: 4931,
      portFixed: true,
      pid: process.pid,
      host: HOST,
      started: STARTED.toISOString(),
      version: '9.9.9',
    });
    expect(Object.keys(parsed)).toEqual(['format', 'url', 'port', 'portFixed', 'pid', 'host', 'started', 'version']);
    if (POSIX) {
      expect(await mode(dir)).toBe(0o700);
      expect(await mode(path.join(dir, CONSOLES_DIR))).toBe(0o700);
      expect(await mode(addressFile(dir))).toBe(0o600);
    }
    // No temporary file is left.
    expect(await readdir(path.join(dir, CONSOLES_DIR))).toEqual(['4931.json']);
    // The info line names the port only (D58-9).
    expect(a.log.lines).toEqual([{ level: 'info', fields: { port: 4931 }, msg: 'console address file written' }]);
  });

  it('writes portFixed false for a console started without --port', async () => {
    const dir = stateDir();
    const a = publish(dir, { port: 41993, portFixed: false });
    expect(await a.written).toBe(true);
    const parsed = JSON.parse(await readFile(addressFile(dir, 41993), 'utf8')) as Record<string, unknown>;
    expect(parsed['portFixed']).toBe(false);
    expect(parsed['url']).toBe('http://127.0.0.1:41993/');
  });

  it.skipIf(!POSIX)('keeps 0700 and 0600 under umask 000 (a child process)', async () => {
    const dir = stateDir();
    // The built module (the global setup builds `server/dist`), in a child whose umask is 000.
    const module = pathToFileURL(path.join(REPO_ROOT, 'server/dist/state/console-address.js')).href;
    const script = [
      'process.umask(0);',
      `const { publishConsoleAddress } = await import(${JSON.stringify(module)});`,
      'const logger = { info() {}, warn(f) { console.error(JSON.stringify(f)); } };',
      `const a = publishConsoleAddress({ stateDir: ${JSON.stringify(path.join(dir, 'a', 'b'))}, port: 4931, portFixed: true, version: '1', started: new Date(), logger });`,
      'process.exit((await a.written) ? 0 : 1);',
    ].join('\n');
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' });
    for (const d of [dir, path.join(dir, 'a'), path.join(dir, 'a', 'b'), path.join(dir, 'a', 'b', CONSOLES_DIR)])
      expect(await mode(d), d).toBe(0o700);
    expect(await mode(path.join(dir, 'a', 'b', CONSOLES_DIR, '4931.json'))).toBe(0o600);
  });

  it.skipIf(!POSIX)('sets an existing consoles/ of the user with group or other bits back to 0700', async () => {
    const dir = stateDir();
    await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
    await chmod(path.join(dir, CONSOLES_DIR), 0o777);
    const a = publish(dir);
    expect(await a.written).toBe(true);
    expect(await mode(path.join(dir, CONSOLES_DIR))).toBe(0o700);
  });

  it.skipIf(!POSIX)('writes nothing through consoles/ when it is a symbolic link (probe F1)', async () => {
    const dir = stateDir();
    const elsewhere = path.join(ws.dir, `elsewhere-${n++}`);
    await mkdir(elsewhere, { recursive: true });
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await symlink(elsewhere, path.join(dir, CONSOLES_DIR));
    const a = publish(dir);
    expect(await a.written).toBe(false);
    expect(await readdir(elsewhere)).toEqual([]);
    expect(a.log.warnings()).toEqual(['consoles-link']);
    expect(a.log.lines[0]?.fields).toEqual({ reason: 'consoles-link' });
    // The stop changes nothing either.
    await a.stop();
    expect(await readdir(elsewhere)).toEqual([]);
  });

  it('writes nothing when consoles/ is a regular file', async () => {
    const dir = stateDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(dir, CONSOLES_DIR), 'x');
    const a = publish(dir);
    expect(await a.written).toBe(false);
    expect(await readFile(path.join(dir, CONSOLES_DIR), 'utf8')).toBe('x');
    expect(a.log.warnings()).toEqual(['consoles-not-directory']);
  });

  it.skipIf(!POSIX)(
    'replaces a consoles/<port>.json pre-created as a link, its target untouched (probe F2)',
    async () => {
      const dir = stateDir();
      const victim = path.join(ws.dir, `victim-${n++}.txt`);
      await writeFile(victim, 'victim\n');
      const before = (await stat(victim)).mtimeMs;
      await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
      await symlink(victim, addressFile(dir));
      const a = publish(dir);
      expect(await a.written).toBe(true);
      expect((await lstat(addressFile(dir))).isFile()).toBe(true);
      expect(await readFile(victim, 'utf8')).toBe('victim\n');
      expect((await stat(victim)).mtimeMs).toBe(before);
    },
  );

  it.skipIf(!POSIX)('never creates a file through a dangling link at its temporary name', async () => {
    const dir = stateDir();
    const target = path.join(ws.dir, `dangling-${n++}`);
    await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
    await symlink(target, path.join(dir, CONSOLES_DIR, `4931.json.tmp-${process.pid}-0`));
    await symlink(target, path.join(dir, CONSOLES_DIR, `4931.json.tmp-${process.pid}-1`));
    const a = publish(dir);
    await a.written;
    expect(await exists(target)).toBe(false);
  });

  it.skipIf(!POSIX)(
    'does not hang on a FIFO named like an address file (probe F3)',
    async () => {
      const dir = stateDir();
      await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
      execFileSync('mkfifo', [path.join(dir, CONSOLES_DIR, '4999.json')]);
      const a = publish(dir);
      expect(await a.written).toBe(true);
      // Not a regular file: never read, never removed.
      expect((await lstat(path.join(dir, CONSOLES_DIR, '4999.json'))).isFIFO()).toBe(true);
    },
    10_000,
  );

  it.skipIf(!POSIX || process.getuid?.() === 0)(
    'a failed write is a warning with a code and no path; written resolves false',
    async () => {
      const dir = stateDir();
      await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
      await chmod(path.join(dir, CONSOLES_DIR), 0o500);
      try {
        const a = publish(dir);
        expect(await a.written).toBe(false);
        expect(a.log.lines).toEqual([
          { level: 'warn', fields: { reason: 'write-failed', code: 'EACCES' }, msg: 'console address file' },
        ]);
        expect(JSON.stringify(a.log.lines)).not.toContain(ws.dir);
      } finally {
        await chmod(path.join(dir, CONSOLES_DIR), 0o700);
      }
    },
  );

  it.skipIf(!POSIX)(
    'writes nothing in an unsafe state directory (group-writable), its mode untouched (Q1 b)',
    async () => {
      const dir = stateDir();
      await mkdir(dir, { recursive: true });
      await chmod(dir, 0o770);
      const a = publish(dir);
      expect(await a.written).toBe(false);
      expect(await exists(path.join(dir, CONSOLES_DIR))).toBe(false);
      expect(await mode(dir)).toBe(0o770);
      expect(a.log.warnings()).toEqual(['state-dir-unsafe']);
    },
  );

  it('writes no mode and checks no owner on Windows (A6)', () => {
    expect(stateDirProblem({ uid: 0, mode: 0o40777 }, 1000, 'win32')).toBeUndefined();
    expect(consolesVerdict({ directory: true, uid: 0, mode: 0o40777 }, 1000, 'win32')).toBe('ok');
    expect(consolesVerdict({ directory: false, uid: 0, mode: 0o100666 }, 1000, 'win32')).toBe('consoles-not-directory');
  });

  it.each([
    ['owned by the user, 0700', { uid: 1000, mode: 0o40700 }, undefined],
    ['owned by the user, 0755', { uid: 1000, mode: 0o40755 }, undefined],
    ['owned by another user', { uid: 1001, mode: 0o40700 }, 'state-dir-unsafe'],
    ['group-writable', { uid: 1000, mode: 0o40770 }, 'state-dir-unsafe'],
    ['other-writable', { uid: 1000, mode: 0o40707 }, 'state-dir-unsafe'],
  ])('the state directory %s → %s', (_label, stats, expected) => {
    expect(stateDirProblem(stats, 1000, 'linux')).toBe(expected);
  });

  it.each([
    ['owned by the user, 0700', { directory: true, uid: 1000, mode: 0o40700 }, 'ok'],
    ['owned by the user, 0755', { directory: true, uid: 1000, mode: 0o40755 }, 'chmod'],
    ['owned by another user', { directory: true, uid: 1001, mode: 0o40700 }, 'consoles-not-owned'],
    ['not a directory', { directory: false, uid: 1000, mode: 0o100600 }, 'consoles-not-directory'],
  ])('consoles/ %s → %s', (_label, stats, expected) => {
    expect(consolesVerdict(stats, 1000, 'linux')).toBe(expected);
  });
});

describe('heartbeat (AC-3, adr-003 D2, C2)', () => {
  async function started(): Promise<{ dir: string; a: ReturnType<typeof publish>; file: string; bytes: string }> {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const dir = stateDir();
    const a = publish(dir);
    expect(await a.written).toBe(true);
    const file = addressFile(dir);
    return { dir, a, file, bytes: await readFile(file, 'utf8') };
  }

  async function tick(a: ConsoleAddress): Promise<void> {
    vi.advanceTimersByTime(ADDRESS_HEARTBEAT_MS);
    await a.settled();
  }

  it('refreshes the modification time every 10 s', async () => {
    const { a, file } = await started();
    const old = new Date(Date.now() - 20_000);
    await utimes(file, old, old);
    await tick(a);
    expect(Date.now() - (await stat(file)).mtimeMs).toBeLessThan(5_000);
  });

  it('rewrites a removed file in full', async () => {
    const { a, file, bytes } = await started();
    await rm(file);
    await tick(a);
    expect(await readFile(file, 'utf8')).toBe(bytes);
    if (POSIX) expect(await mode(file)).toBe(0o600);
  });

  it.each([
    ['another pid', { pid: 1 }],
    ['another started', { started: '2026-11-05T11:00:00.000Z' }],
  ])('rewrites a file holding %s', async (_label, patch) => {
    const { a, file, bytes } = await started();
    await writeFile(file, JSON.stringify({ ...JSON.parse(bytes), ...patch }));
    await tick(a);
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it('rewrites a truncated file', async () => {
    const { a, file, bytes } = await started();
    await writeFile(file, '{"format"');
    await tick(a);
    expect(await readFile(file, 'utf8')).toBe(bytes);
  });

  it.skipIf(!POSIX)("replaces a link put in the file's place, the link's target untouched (probe F2)", async () => {
    const { a, file, bytes } = await started();
    // The target holds the console's own bytes: a heartbeat that followed the link would only
    // refresh the target's time and leave the link in place.
    const victim = path.join(ws.dir, `victim-${n++}.txt`);
    await writeFile(victim, bytes);
    const old = new Date(Date.now() - 3_600_000);
    await utimes(victim, old, old);
    await rm(file);
    await symlink(victim, file);
    await tick(a);
    expect((await lstat(file)).isFile()).toBe(true);
    expect(await readFile(file, 'utf8')).toBe(bytes);
    expect(Math.abs((await stat(victim)).mtimeMs - old.getTime())).toBeLessThan(1);
  });

  it('stops beating once stopped', async () => {
    const { a, file } = await started();
    await a.stop();
    await tick(a);
    expect(await exists(file)).toBe(false);
  });
});

describe('stale rule and start housekeeping (AC-4, adr-003 D3)', () => {
  it.each([
    ['this host, a dead pid', { host: HOST, pid: DEAD_PID }, 0, true],
    ['this host, a running pid, fresh', { host: HOST, pid: process.pid }, 0, false],
    ['this host, a running pid, 31 s old', { host: HOST, pid: process.pid }, 31_000, true],
    ['another host, 5 s old', { host: 'elsewhere', pid: DEAD_PID }, 5_000, false],
    ['another host, 31 s old', { host: 'elsewhere', pid: process.pid }, 31_000, true],
    ['unreadable', undefined, 0, true],
  ])('readers judge %s → stale %s', (_label, info, age, expected) => {
    expect(isStaleAddress(info, age, HOST)).toBe(expected);
  });

  it.each([
    ['this host, a dead pid', { host: HOST, pid: DEAD_PID }, 0, true],
    ['this host, a running pid (a reused pid), an hour old', { host: HOST, pid: process.pid }, 3_600_000, false],
    ['this host, pid 1 (EPERM: running)', { host: HOST, pid: 1 }, 3_600_000, false],
    ['another host, 31 s old', { host: 'elsewhere', pid: process.pid }, ADDRESS_STALE_MS + 1_000, true],
    ['another host, 5 s old', { host: 'elsewhere', pid: DEAD_PID }, 5_000, false],
    ['unreadable, 31 s old', undefined, 31_000, true],
    ['unreadable, 5 s old', undefined, 5_000, false],
  ])('the start removes %s → %s', (_label, info, age, expected) => {
    expect(removableAtStart(info, age, HOST)).toBe(expected);
  });

  it('removes and keeps the files of consoles/ by the rule, before writing its own', async () => {
    const dir = stateDir();
    const dead = await entry(dir, { host: HOST, pid: DEAD_PID }, 4801);
    const reused = await entry(dir, { host: HOST, pid: process.pid }, 4802, 3_600_000);
    const eperm = await entry(dir, { host: HOST, pid: 1 }, 4803, 3_600_000);
    const otherOld = await entry(dir, { host: 'elsewhere', pid: process.pid }, 4804, 31_000);
    const otherFresh = await entry(dir, { host: 'elsewhere', pid: DEAD_PID }, 4805, 5_000);
    const newer = await entry(dir, { format: 2, host: HOST, pid: process.pid, extra: true }, 4806);
    const garbledOld = path.join(dir, CONSOLES_DIR, '4807.json');
    await writeFile(garbledOld, 'not json');
    const t = new Date(Date.now() - 31_000);
    await utimes(garbledOld, t, t);
    const garbledFresh = path.join(dir, CONSOLES_DIR, '4808.json');
    await writeFile(garbledFresh, '{');
    const own = await entry(dir, { host: HOST, pid: process.pid }, 4931);
    const deadTmp = path.join(dir, CONSOLES_DIR, `4809.json.tmp-${DEAD_PID}-0`);
    const liveTmp = path.join(dir, CONSOLES_DIR, `4810.json.tmp-${process.pid}-99`);
    await writeFile(deadTmp, '{}');
    await writeFile(liveTmp, '{}');
    const aDirectory = path.join(dir, CONSOLES_DIR, '4811.json');
    await mkdir(aDirectory);
    const other = path.join(dir, CONSOLES_DIR, 'notes.txt');
    await writeFile(other, 'x');

    const a = publish(dir, { started: new Date('2026-11-05T12:00:00.000Z') });
    expect(await a.written).toBe(true);
    for (const gone of [dead, otherOld, garbledOld, deadTmp]) expect(await exists(gone), gone).toBe(false);
    for (const kept of [reused, eperm, otherFresh, newer, garbledFresh, liveTmp, aDirectory, other])
      expect(await exists(kept), kept).toBe(true);
    // Its own port's file is replaced, whatever it held.
    expect(JSON.parse(await readFile(own, 'utf8'))).toMatchObject({ started: '2026-11-05T12:00:00.000Z' });
  });

  it.skipIf(!POSIX)('leaves a link named like an address file and its target alone', async () => {
    const dir = stateDir();
    const victim = path.join(ws.dir, `victim-${n++}.json`);
    await writeFile(victim, JSON.stringify({ host: HOST, pid: DEAD_PID }));
    await mkdir(path.join(dir, CONSOLES_DIR), { recursive: true, mode: 0o700 });
    await symlink(victim, path.join(dir, CONSOLES_DIR, '4812.json'));
    const a = publish(dir);
    expect(await a.written).toBe(true);
    expect((await lstat(path.join(dir, CONSOLES_DIR, '4812.json'))).isSymbolicLink()).toBe(true);
    expect(await exists(victim)).toBe(true);
  });

  it('two consoles on one state directory write two files', async () => {
    const dir = stateDir();
    const a = publish(dir, { port: 4931 });
    const b = publish(dir, { port: 4932, portFixed: false });
    expect(await a.written).toBe(true);
    expect(await b.written).toBe(true);
    expect((await readdir(path.join(dir, CONSOLES_DIR))).sort()).toEqual(['4931.json', '4932.json']);
    await a.stop();
    expect(await readdir(path.join(dir, CONSOLES_DIR))).toEqual(['4932.json']);
  });
});

describe('removal (AC-5, adr-003 D2)', () => {
  it('stop() removes its own file', async () => {
    const dir = stateDir();
    const a = publish(dir);
    await a.written;
    await a.stop();
    expect(await exists(addressFile(dir))).toBe(false);
  });

  it('stop() waits for a write still in progress, then removes the file', async () => {
    const dir = stateDir();
    const a = publish(dir);
    await a.stop();
    expect(await exists(addressFile(dir))).toBe(false);
  });

  it('removeSync() removes its own file (the exit handler)', async () => {
    const dir = stateDir();
    const a = publish(dir);
    await a.written;
    a.removeSync();
    expect(await exists(addressFile(dir))).toBe(false);
  });

  it.each(['stop', 'removeSync'] as const)(
    '%s() leaves a file holding another console (another pid or started)',
    async (how) => {
      const dir = stateDir();
      const a = publish(dir);
      await a.written;
      const theirs = `${JSON.stringify({ ...JSON.parse(await readFile(addressFile(dir), 'utf8')), pid: 1 })}\n`;
      await writeFile(addressFile(dir), theirs);
      if (how === 'stop') await a.stop();
      else a.removeSync();
      expect(await readFile(addressFile(dir), 'utf8')).toBe(theirs);
    },
  );

  it.skipIf(!POSIX)('a link in its place is removed as a link only, never followed', async () => {
    const dir = stateDir();
    const a = publish(dir);
    await a.written;
    const victim = path.join(ws.dir, `victim-${n++}.json`);
    await writeFile(victim, await readFile(addressFile(dir), 'utf8'));
    await rm(addressFile(dir));
    await symlink(victim, addressFile(dir));
    await a.stop();
    expect(await exists(victim)).toBe(true);
  });

  it.skipIf(!POSIX || process.getuid?.() === 0)('a failed removal is a warning, stop() still resolves', async () => {
    const dir = stateDir();
    const a = publish(dir);
    await a.written;
    await chmod(path.join(dir, CONSOLES_DIR), 0o500);
    try {
      await a.stop();
      expect(a.log.lines.at(-1)).toEqual({
        level: 'warn',
        fields: { reason: 'remove-failed', code: 'EACCES' },
        msg: 'console address file',
      });
    } finally {
      await chmod(path.join(dir, CONSOLES_DIR), 0o700);
    }
  });
});

describe('what the file never holds (AC-6, adr-003 D5)', () => {
  it('holds no other field than the eight of the schema, whatever the options carry', async () => {
    const dir = stateDir();
    const options = { token: 'TOKEN-MARKER', sessionId: 'SESSION-MARKER', projects: ['p_7kq2m9x4r1tz'] };
    const a = publish(dir, options as unknown as Partial<ConsoleAddressOptions>);
    await a.written;
    const text = await readFile(addressFile(dir), 'utf8');
    for (const marker of ['TOKEN-MARKER', 'SESSION-MARKER', 'p_7kq2m9x4r1tz', ws.dir])
      expect(text).not.toContain(marker);
  });
});
