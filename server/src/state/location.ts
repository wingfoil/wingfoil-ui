/**
 * Where the local state lives (spec-006 §1) and the check that it lies outside every listed
 * project (REQ-ARC-08; exit 4 at start, spec-007 §3.2; `state-dir-inside-project` at add).
 */
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectEntry } from '@wingfoil-ui/contracts';

/** Name of the folder under the platform configuration directory. */
export const STATE_DIR_NAME = 'wingfoil-ui';

/** The process facts the location depends on. */
export interface LocationContext {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  /** The user's home directory (`os.homedir()`). */
  homedir: string;
  /** Working directory a relative `WINGFOIL_UI_STATE_DIR` is resolved against (default: the process's). */
  cwd?: string;
}

/**
 * The state directory, in this order: `$WINGFOIL_UI_STATE_DIR`; Linux and other Unix
 * `$XDG_CONFIG_HOME/wingfoil-ui` (an absolute value only) else `~/.config/wingfoil-ui`; macOS
 * `~/Library/Application Support/wingfoil-ui`; Windows `%APPDATA%\wingfoil-ui`.
 */
export function resolveStateDir(context: LocationContext): string {
  const { env, platform, homedir } = context;
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const override = env.WINGFOIL_UI_STATE_DIR;
  if (override) return paths.resolve(context.cwd ?? process.cwd(), override);
  if (platform === 'win32') {
    return paths.join(env.APPDATA || paths.join(homedir, 'AppData', 'Roaming'), STATE_DIR_NAME);
  }
  if (platform === 'darwin') return paths.join(homedir, 'Library', 'Application Support', STATE_DIR_NAME);
  const xdg = env.XDG_CONFIG_HOME;
  return paths.join(xdg && paths.isAbsolute(xdg) ? xdg : paths.join(homedir, '.config'), STATE_DIR_NAME);
}

/** The realpath of `target`, resolving its nearest existing ancestor when it does not exist yet. */
export async function realpathLoose(target: string): Promise<string> {
  const absolute = path.resolve(target);
  try {
    return await realpath(absolute);
  } catch {
    const parent = path.dirname(absolute);
    if (parent === absolute) return absolute;
    return path.join(await realpathLoose(parent), path.basename(absolute));
  }
}

/** Whether `child` is `parent` or lies under it (both absolute). */
export function isWithin(child: string, parent: string, platform: NodeJS.Platform = process.platform): boolean {
  // Default file systems of Windows and macOS ignore letter case.
  const fold = platform === 'win32' || platform === 'darwin' ? (p: string) => p.toLowerCase() : (p: string) => p;
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const relative = paths.relative(fold(parent), fold(child));
  return (
    relative === '' || (relative !== '..' && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative))
  );
}

/** The first listed project whose working tree contains the state directory `stateDir`, if any. */
export async function findProjectContaining(
  stateDir: string,
  projects: readonly ProjectEntry[],
  platform: NodeJS.Platform = process.platform,
): Promise<ProjectEntry | undefined> {
  if (projects.length === 0) return undefined;
  const resolved = await realpathLoose(stateDir);
  return projects.find((p) => isWithin(resolved, p.path, platform));
}
