// adr-003 D2 — the address file's heartbeat with `node:fs/promises` `open` observed (task-058
// review round 1, F1 and F2): the handle it refreshes the time through is writable on Windows
// (libuv opens a read-only handle without FILE_WRITE_ATTRIBUTES), a tick never overlaps the
// previous one, and a failing heartbeat is logged once.
import { constants } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TempWorkspace } from '../../harness/temp-workspace.js';

/** Every `open` of the module under test, and an optional hook that replaces one call. */
const fsSpy = vi.hoisted(() => ({
  calls: [] as { file: string; flags: unknown }[],
  hook: undefined as ((file: string, flags: unknown) => Promise<unknown> | undefined) | undefined,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    open: (file: string, flags?: unknown, mode?: unknown) => {
      fsSpy.calls.push({ file: String(file), flags });
      const replaced = fsSpy.hook?.(String(file), flags);
      if (replaced) return replaced;
      return (original.open as (...args: unknown[]) => Promise<unknown>)(file, flags, mode);
    },
  };
});

const { ADDRESS_HEARTBEAT_MS, CONSOLES_DIR, publishConsoleAddress } =
  await import('../../../server/src/state/console-address.js');
type ConsoleAddress = ReturnType<typeof publishConsoleAddress>;

/** The access-mode bits of the open flags (POSIX `O_ACCMODE`; `fs.constants` does not export it). */
const ACCMODE = 3;

let ws: TempWorkspace;
let n = 0;
const open: ConsoleAddress[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-console-address-hb-');
});

afterEach(async () => {
  fsSpy.hook = undefined;
  vi.useRealTimers();
  for (const a of open.splice(0)) await a.stop();
});

afterAll(async () => {
  await ws.dispose();
});

function recorder() {
  const warnings: unknown[] = [];
  return {
    warnings,
    info: () => undefined,
    warn: (fields: object) => warnings.push(fields),
  };
}

async function started(platform: NodeJS.Platform) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const log = recorder();
  const stateDir = path.join(ws.dir, `state-${n++}`);
  const a = publishConsoleAddress({
    stateDir,
    port: 4931,
    portFixed: true,
    version: '9.9.9',
    started: new Date('2026-11-05T10:00:00.000Z'),
    logger: log,
    platform,
  });
  open.push(a);
  expect(await a.written).toBe(true);
  const file = path.join(stateDir, CONSOLES_DIR, '4931.json');
  fsSpy.calls.length = 0;
  return { a, file, log };
}

/** The `open` calls of the heartbeat on the address file itself (not its temporary files). */
function beats(file: string): unknown[] {
  return fsSpy.calls.filter((c) => c.file === file).map((c) => c.flags);
}

describe('heartbeat handle (F1)', () => {
  it('opens the file read-write on Windows, so the time can be set through the handle', async () => {
    const { a, file } = await started('win32');
    vi.advanceTimersByTime(ADDRESS_HEARTBEAT_MS);
    await a.settled();
    const flags = beats(file);
    expect(flags).toHaveLength(1);
    expect(Number(flags[0]) & ACCMODE).toBe(constants.O_RDWR);
  });

  it.skipIf(process.platform === 'win32')('keeps a read-only, no-follow, non-blocking handle on POSIX', async () => {
    const { a, file } = await started('linux');
    vi.advanceTimersByTime(ADDRESS_HEARTBEAT_MS);
    await a.settled();
    const flags = Number(beats(file)[0]);
    expect(flags & ACCMODE).toBe(constants.O_RDONLY);
    expect(flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
    expect(flags & constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);
  });
});

describe('heartbeat ticks (F2)', () => {
  it('skips a tick while the previous one still runs: no pile-up behind a hung beat', async () => {
    const { a, file } = await started('linux');
    let release: () => void = () => undefined;
    const hung = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    fsSpy.hook = (target) => {
      if (target !== file || !first) return undefined;
      first = false;
      return hung.then(() => {
        throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      });
    };
    for (let i = 0; i < 4; i++) vi.advanceTimersByTime(ADDRESS_HEARTBEAT_MS);
    await new Promise((r) => setTimeout(r, 20));
    expect(beats(file)).toHaveLength(1);
    release();
    await a.settled();
    await new Promise((r) => setTimeout(r, 20));
    await a.settled();
    // The three ticks that came while it hung were skipped, not queued.
    expect(beats(file)).toHaveLength(1);
  });

  it('logs a failing heartbeat once, whatever the number of ticks', async () => {
    const { a, file, log } = await started('linux');
    fsSpy.hook = (target) =>
      target === file ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : undefined;
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(ADDRESS_HEARTBEAT_MS);
      await a.settled();
    }
    expect(beats(file)).toHaveLength(3);
    expect(log.warnings).toEqual([{ reason: 'heartbeat-failed', code: 'EACCES' }]);
  });
});
