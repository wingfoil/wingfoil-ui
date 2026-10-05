/**
 * Support of the contract tests (spec-001 §7, adr-001 D4): the support matrix, the CLI build of
 * each matrix version, the raw CLI (as a terminal runs it — the samples are captured with it, not
 * with the adapter under test) and the fixture changes that make the archived searches non-empty.
 */
import { readFile, writeFile } from 'node:fs/promises';
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

/**
 * The CLI build of a matrix version. v0.1's matrix holds the pinned version only; a matrix advance
 * (`release-planning`) that adds another version installs it here (adr-001 D4).
 */
export function cliBuildFor(version: string): CliBuild {
  if (version === pinnedVersion()) return pinnedCli();
  throw new Error(`wingfoil ${version} is in contracts/matrix.json but no build of it is installed for the contract tests`);
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
