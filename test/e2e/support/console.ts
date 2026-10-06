/**
 * The console of an e2e test: the real `wingfoil-ui` bin on a free port, with an isolated home,
 * git configuration and state directory (`WINGFOIL_UI_STATE_DIR`), optionally seeded with fixture
 * projects, and the page opened with the token in the URL fragment (spec-004 §2).
 */
import type { Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProjectEntry, StateFile } from '../../../contracts/src/index.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { harnessEnv, type Fixture } from '../../harness/fixtures/index.js';
import { startLauncher, type Launcher } from '../../launcher/launcher.js';

/** How the bin may open a browser. */
export type Opener =
  /** `--no-open` (default): the test opens the page itself. */
  | 'flag'
  /** No opener on the `PATH` (S-01.3): the bin prints the URL to open. */
  | 'none'
  /** A fake `xdg-open`/`open` on the `PATH` recording the URL it was given (S-01.1). */
  | 'recording';

/** Options of {@link startConsole}. */
export interface ConsoleOptions {
  /** Projects seeded into `state.json`, in this order (each gets an opaque id). */
  projects?: Fixture[];
  /** Raw content of `state.json` instead of the seeded one (e.g. a corrupt file). */
  stateFile?: string;
  opener?: Opener;
  /** More command-line arguments. */
  args?: string[];
  /** More environment variables. */
  env?: NodeJS.ProcessEnv;
}

/** A running console. */
export interface RunningConsole {
  /** `http://127.0.0.1:<port>`. */
  origin: string;
  port: number;
  token: string;
  /** The URL the bin printed (`<origin>/#token=<token>`). */
  url: string;
  /** Opaque ids of the seeded projects, in the order given. */
  pids: string[];
  stateDir: string;
  /** Temporary root of this console (home, state, opener). */
  root: string;
  launcher: Launcher;
  /** The arguments the recording opener received, once it ran. */
  opened(): Promise<string[] | undefined>;
  /** Stop the bin and remove the root. */
  stop(): Promise<void>;
}

const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

function projectId(): string {
  return `p_${[...randomBytes(12)].map((b) => ID_ALPHABET[b % 32]).join('')}`;
}

/** First executable named `name` on `PATH`. */
async function which(name: string, envPath: string): Promise<string | undefined> {
  for (const dir of envPath.split(path.delimiter)) {
    if (!path.isAbsolute(dir)) continue;
    const file = path.join(dir, name);
    try {
      await access(file, constants.X_OK);
      if ((await stat(file)).isFile()) return file;
    } catch {
      // not here
    }
  }
  return undefined;
}

/** A `PATH` with only `node` and `git` (no browser opener), plus a recording opener when asked. */
async function isolatedPath(root: string, envPath: string, recordTo?: string): Promise<string> {
  const bin = path.join(root, 'bin');
  await mkdir(bin, { recursive: true });
  await symlink(process.execPath, path.join(bin, 'node'));
  const git = await which('git', envPath);
  if (git) await symlink(git, path.join(bin, 'git'));
  if (recordTo) {
    const script = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(recordTo)}, JSON.stringify(process.argv.slice(2)));\n`;
    for (const name of ['xdg-open', 'open']) {
      await writeFile(path.join(bin, name), script);
      await chmod(path.join(bin, name), 0o755);
    }
  }
  return bin;
}

/** Start the bin (see {@link ConsoleOptions}). */
export async function startConsole(options: ConsoleOptions = {}): Promise<RunningConsole> {
  const root = await mkdtemp(path.join(tmpdir(), 'wfui-e2e-'));
  const projects = options.projects ?? [];
  const base = projects[0]?.env ?? (await harnessEnv(root)).env;
  const stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const pids = projects.map(() => projectId());
  if (options.stateFile !== undefined) {
    await writeFile(path.join(stateDir, 'state.json'), options.stateFile, { mode: 0o600 });
  } else if (projects.length > 0) {
    const entries: ProjectEntry[] = projects.map((fx, i) => ({
      id: pids[i]!,
      path: fx.dir,
      name: fx.name,
      remote: '',
      addedAt: new Date(0).toISOString(),
      roleView: '',
    }));
    const state: StateFile = { version: 1, projects: entries, settings: {}, actionLog: [] };
    await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  const opener = options.opener ?? 'flag';
  const record = path.join(root, 'opened.json');
  const env: NodeJS.ProcessEnv = { ...base, WINGFOIL_UI_STATE_DIR: stateDir, ...options.env };
  if (opener !== 'flag') {
    env['PATH'] = await isolatedPath(root, base['PATH'] ?? '', opener === 'recording' ? record : undefined);
  }
  const args = [...(opener === 'flag' ? ['--no-open'] : []), ...(options.args ?? [])];
  const launcher = await startLauncher(args, env, 30_000);
  const origin = `http://127.0.0.1:${launcher.port}`;
  return {
    origin,
    port: launcher.port,
    token: launcher.token,
    url: `${origin}/#token=${launcher.token}`,
    pids,
    stateDir,
    root,
    launcher,
    opened: async () => {
      try {
        return JSON.parse(await readFile(record, 'utf8')) as string[];
      } catch {
        return undefined;
      }
    },
    stop: async () => {
      await launcher.kill();
      await rm(root, { recursive: true, force: true });
    },
  };
}

/** Options of {@link openConsole}. */
export interface OpenOptions {
  /** Client-side path to open (default `/`). */
  path?: string;
  /** `keys`: the key-rendering build `web/dist-keys` (spec-008 §6), served by route interception. */
  build?: 'normal' | 'keys';
}

const KEY_BUILD = path.join(REPO_ROOT, 'web', 'dist-keys');
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

/** Serve `web/dist-keys` to `page` for every non-API request to the console (decision W3-4). */
async function serveKeyBuild(page: Page, origin: string): Promise<void> {
  await page.route(
    (url) => url.origin === origin && !url.pathname.startsWith('/api/'),
    async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      let file = path.join(KEY_BUILD, path.normalize(pathname));
      if (!file.startsWith(KEY_BUILD) || pathname === '/' || !(await stat(file).catch(() => undefined))?.isFile()) {
        file = path.join(KEY_BUILD, 'index.html');
      }
      await route.fulfill({
        body: await readFile(file),
        contentType: TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
    },
  );
}

/** Open the console in `page` at `options.path` with the token in the fragment; waits for the shell. */
export async function openConsole(page: Page, console: RunningConsole, options: OpenOptions = {}): Promise<void> {
  if (options.build === 'keys') await serveKeyBuild(page, console.origin);
  await page.goto(`${console.origin}${options.path ?? '/'}#token=${console.token}`);
  await page.getByRole('banner').waitFor();
}
