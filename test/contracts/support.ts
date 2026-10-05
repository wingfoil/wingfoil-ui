/**
 * Support of the contract tests (spec-001 §7, adr-001 D4): the support matrix, the CLI build of
 * each matrix version, the raw CLI (as a terminal runs it — the samples are captured with it, not
 * with the adapter under test) and the fixture changes that make the archived searches non-empty.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { binScript, pinnedCli, pinnedVersion, REPO_ROOT, type CliBuild } from '../harness/cli.js';
import { cliPackageDir, memberByName, type Fixture, type MemberName } from '../harness/fixtures/index.js';
import { git, run, type RunResult } from '../harness/run.js';

/** Directory of the samples captured from `version`. */
export function samplesDir(version: string): string {
  return path.join(REPO_ROOT, 'test', 'contracts', 'samples', `wingfoil-${version}`);
}

/** The support matrix: `contracts/matrix.json`. */
export async function matrixVersions(): Promise<string[]> {
  const matrix = JSON.parse(await readFile(path.join(REPO_ROOT, 'contracts', 'matrix.json'), 'utf8')) as {
    versions: string[];
  };
  return matrix.versions;
}

/** Default folder of the matrix builds other than the pinned one (ignored by git with `node_modules`). */
export const MATRIX_CACHE = path.join(REPO_ROOT, 'node_modules', '.cache', 'wingfoil-ui-matrix');

/** Options of {@link cliBuildFor}. */
export interface CliBuildOptions {
  /** Folder holding one `<version>/` install prefix per version (default {@link MATRIX_CACHE}). */
  cacheRoot?: string;
  /** Installs `wingfoil@<version>` under `prefix` (default: `npm install --prefix`, needs the registry once). */
  install?: (prefix: string, version: string) => Promise<void>;
  /** Age after which a leftover staging or stale folder is removed (default {@link ORPHAN_AGE_MS}). */
  orphanAgeMs?: number;
}

/**
 * `npm install --prefix <prefix> --no-save wingfoil@<version>`, without scripts, audit or fund.
 * Under an npm script npm's own CLI (`npm_execpath`) runs with this Node.js, with no shell on any
 * platform; otherwise `npm` from the `PATH`, which `execFile` finds on Linux and macOS only (on
 * Windows run the tests through `npm run`).
 */
async function npmInstall(prefix: string, version: string): Promise<void> {
  await mkdir(prefix, { recursive: true });
  await writeFile(path.join(prefix, 'package.json'), '{"private": true}\n');
  const args = ['install', '--prefix', prefix, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund'];
  const npmCli = process.env.npm_execpath;
  const [file, prefixArgs] = npmCli ? [process.execPath, [npmCli]] : ['npm', []];
  await run(file, [...prefixArgs, ...args, `wingfoil@${version}`], { cwd: prefix, timeoutMs: 300_000 });
}

/**
 * The CLI build of a matrix version (adr-001 D4): the pinned version is the installed
 * devDependency; any other is installed once into `<cacheRoot>/<version>` and reused, and must
 * declare that exact version.
 */
export async function cliBuildFor(version: string, options: CliBuildOptions = {}): Promise<CliBuild> {
  if (version === pinnedVersion()) return pinnedCli();
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`contracts/matrix.json: ${version} is not an exact version`);
  }
  const prefix = path.join(options.cacheRoot ?? MATRIX_CACHE, version);
  const packageDir = path.join(prefix, 'node_modules', 'wingfoil');
  if ((await installedVersion(packageDir)) !== version) {
    // Install into a private folder, then rename it into place: parallel workers never share a
    // half-written prefix, and a concurrent winner's install is kept.
    await mkdir(path.dirname(prefix), { recursive: true });
    await removeOrphans(prefix, options.orphanAgeMs ?? ORPHAN_AGE_MS);
    const staging = await mkdtemp(`${prefix}.tmp-`);
    try {
      await (options.install ?? npmInstall)(staging, version);
      const installed = await installedVersion(path.join(staging, 'node_modules', 'wingfoil'));
      if (installed !== version) {
        throw new Error(`installing wingfoil ${version} for the contract tests gave ${String(installed)}`);
      }
      await moveIntoPlace(staging, prefix, version);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
  return { script: binScript(packageDir), packageDir };
}

/**
 * Rename `staging` to `prefix`. When `prefix` exists: kept if it holds `version` (a concurrent
 * winner); otherwise it is a broken install (interrupted, corrupted), moved aside to
 * `<prefix>.stale-<uuid>`, removed, and the rename is retried once.
 */
async function moveIntoPlace(staging: string, prefix: string, version: string): Promise<void> {
  const packageDir = path.join(prefix, 'node_modules', 'wingfoil');
  try {
    await rename(staging, prefix);
    return;
  } catch (error) {
    if ((await installedVersion(packageDir)) === version) return;
    const stale = `${prefix}.stale-${randomUUID()}`;
    try {
      await rename(prefix, stale);
    } catch {
      // Already moved aside by another worker, or gone: retry below.
    }
    await rm(stale, { recursive: true, force: true });
    try {
      await rename(staging, prefix);
    } catch {
      if ((await installedVersion(packageDir)) !== version) throw error;
    }
  }
}

/** Default age after which a `<version>.tmp-*` or `.stale-*` folder is an orphan of a killed worker. */
export const ORPHAN_AGE_MS = 6 * 60 * 60 * 1000;

/** Remove the staging and stale folders of `prefix` older than `ageMs` (left by a killed worker). */
async function removeOrphans(prefix: string, ageMs: number): Promise<void> {
  const dir = path.dirname(prefix);
  const base = path.basename(prefix);
  for (const name of await readdir(dir)) {
    if (!name.startsWith(`${base}.tmp-`) && !name.startsWith(`${base}.stale-`)) continue;
    const file = path.join(dir, name);
    try {
      if (Date.now() - (await stat(file)).mtimeMs >= ageMs) await rm(file, { recursive: true, force: true });
    } catch {
      // Removed meanwhile by another worker.
    }
  }
}

async function installedVersion(packageDir: string): Promise<string | undefined> {
  try {
    return (JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8')) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

/** Make `name` the git identity of `fx` (who the CLI acts as). */
export async function actAs(fx: Fixture, name: MemberName): Promise<void> {
  const member = memberByName(name);
  await git(fx.dir, ['config', 'user.name', member.name], fx.env);
  await git(fx.dir, ['config', 'user.email', member.email], fx.env);
}

/** Run the fixture's CLI as a terminal would: `node <bin script> --format json <args…>`, stdin closed. */
export function rawCli(fx: Fixture, args: readonly string[], json = true): Promise<RunResult> {
  const script = binScript(cliPackageDir(fx));
  return run(process.execPath, [script, ...(json ? ['--format', 'json'] : []), ...args], {
    cwd: fx.dir,
    env: fx.env,
    allowFailure: true,
  });
}

/**
 * Put one element of `fx` in an archived state (WingFoil's archived set: `deprecated`,
 * `superseded`), so that the `--status` searches answer a non-empty list: kanban — `memory
 * deprecate` of the bug by Morgan (a real `wf(…)` commit); custom — the draft ADR's working-tree
 * `status` set to `superseded` (a declared state of the custom `adr`; no verb reaches it in 0.2.2).
 * Returns the archived state, or `undefined` for a fixture left as it is.
 */
export async function archiveOne(fx: Fixture): Promise<'deprecated' | 'superseded' | undefined> {
  if (fx.kind === 'kanban') {
    await actAs(fx, 'Morgan');
    const result = await rawCli(fx, ['memory', 'deprecate', 'bug-001-crash-on-save', '--reason', 'Duplicate']);
    if (result.code !== 0) throw new Error(`deprecate failed: ${result.stderr}`);
    await actAs(fx, 'Alex');
    return 'deprecated';
  }
  if (fx.kind === 'custom') {
    const file = path.join(fx.dir, 'docs', '04_memory', 'design', 'adrs', 'adr-001-local-server.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace(/^status: draft$/m, 'status: superseded'));
    return 'superseded';
  }
  return undefined;
}
