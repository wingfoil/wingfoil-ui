/**
 * Opening the browser on the console URL (spec-007 §4): the platform opener, spawned with an
 * argument array and no shell (REQ-SEC-05). The URL, fragment included, is one argument.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';

/** The opener program and its arguments. */
export interface OpenerCommand {
  file: string;
  args: string[];
}

/** The opener of `platform` for `url`. */
export function openerCommand(platform: NodeJS.Platform, url: string): OpenerCommand {
  // The macOS program `open`, not a Memory state (REQ-ARC-05's one justified exception).
  // eslint-disable-next-line wfui/no-methodology-literal
  if (platform === 'darwin') return { file: 'open', args: [url] };
  if (platform === 'win32') return { file: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  return { file: 'xdg-open', args: [url] };
}

/** The subset of `child_process.spawn` the opener needs (injected by tests). */
export type Spawner = (
  file: string,
  args: readonly string[],
  options: { shell: false; stdio: 'ignore'; detached: boolean; windowsHide: boolean },
) => EventEmitter & { unref(): void };

/** Options of {@link openBrowser}. */
export interface OpenOptions {
  platform: NodeJS.Platform;
  spawn?: Spawner;
}

/**
 * Open `url` in the default browser. Resolves `true` when the opener exits 0, `false` when it is
 * missing, fails to spawn or exits non-zero — the caller then prints the URL to open (S-01.3).
 * The opener is detached and unref'd: the server never waits for the browser.
 */
export function openBrowser(url: string, options: OpenOptions): Promise<boolean> {
  const { file, args } = openerCommand(options.platform, url);
  const spawn: Spawner = options.spawn ?? ((f, a, o) => nodeSpawn(f, [...a], o));
  return new Promise((resolve) => {
    let child: ReturnType<Spawner>;
    try {
      child = spawn(file, args, { shell: false, stdio: 'ignore', detached: true, windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('exit', (code: number | null) => resolve(code === 0));
    child.unref();
  });
}
