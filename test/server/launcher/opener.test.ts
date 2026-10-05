// spec-007 §4 — opening the browser without a shell (REQ-SEC-05).
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { openBrowser, openerCommand, type Spawner } from '../../../server/src/launcher/opener.js';

const URL_WITH_TOKEN = 'http://127.0.0.1:4321/#token=abc_-DEF';

describe('openerCommand', () => {
  it.each([
    ['darwin', 'open', [URL_WITH_TOKEN]],
    ['linux', 'xdg-open', [URL_WITH_TOKEN]],
    ['freebsd', 'xdg-open', [URL_WITH_TOKEN]],
    ['win32', 'rundll32', ['url.dll,FileProtocolHandler', URL_WITH_TOKEN]],
  ] as const)('%s → %s', (platform, file, args) => {
    expect(openerCommand(platform, URL_WITH_TOKEN)).toEqual({ file, args });
  });
});

interface Call {
  file: string;
  args: readonly string[];
  options: Record<string, unknown>;
}

function fakeSpawner(outcome: { exit?: number; error?: Error; throws?: Error }): { spawn: Spawner; calls: Call[] } {
  const calls: Call[] = [];
  const spawn: Spawner = (file, args, options) => {
    calls.push({ file, args, options: options as Record<string, unknown> });
    if (outcome.throws) throw outcome.throws;
    const child = Object.assign(new EventEmitter(), { unref: () => undefined });
    setImmediate(() => {
      if (outcome.error) child.emit('error', outcome.error);
      else child.emit('exit', outcome.exit ?? 0, null);
    });
    return child;
  };
  return { spawn, calls };
}

describe('openBrowser', () => {
  it('passes the URL as one argument, with shell false and no stdio', async () => {
    const { spawn, calls } = fakeSpawner({ exit: 0 });
    expect(await openBrowser(URL_WITH_TOKEN, { platform: 'linux', spawn })).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.file).toBe('xdg-open');
    expect(calls[0]!.args).toEqual([URL_WITH_TOKEN]);
    expect(calls[0]!.options).toMatchObject({ shell: false, stdio: 'ignore' });
  });

  it.each([
    ['a missing opener', { error: Object.assign(new Error('spawn xdg-open ENOENT'), { code: 'ENOENT' }) }],
    ['a non-zero exit', { exit: 3 }],
    ['a spawn that throws', { throws: new Error('EACCES') }],
  ])('reports failure on %s', async (_name, outcome) => {
    const { spawn } = fakeSpawner(outcome);
    expect(await openBrowser(URL_WITH_TOKEN, { platform: 'linux', spawn })).toBe(false);
  });
});
