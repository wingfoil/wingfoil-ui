/**
 * The package contract of `wingfoil-ui` (task-025, bug-007, decisions ES-8…ES-11): which paths the
 * tarball may hold, which it must hold, and how the server's run-time imports are resolved.
 * Shared by the packaging guard (`pack.test.ts`) and the launch smoke (`test/smoke/`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { REPO_ROOT } from '../harness/cli.js';
import { run, type RunResult } from '../harness/run.js';

/** A file of `npm pack --json`. */
export interface PackedFile {
  path: string;
  size: number;
  mode: number;
}

/** The report of `npm pack --json` for one package. */
export interface PackReport {
  name: string;
  version: string;
  filename: string;
  size: number;
  unpackedSize: number;
  entryCount: number;
  files: PackedFile[];
}

/**
 * Every path the tarball may hold (ES-10): the bin, the built server (JavaScript only), the
 * server catalogue the bin and the server read at its source path, the built web application, the
 * JSON contracts the server reads, and the files npm adds or the allow-list names.
 */
export const ALLOWED: readonly RegExp[] = [
  /^package\.json$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^CHANGELOG\.md$/,
  /^bin\/wingfoil-ui\.cjs$/,
  /^server\/dist\/(?:[\w.-]+\/)*[\w.-]+(?<!\.d)\.js$/,
  /^server\/src\/i18n\/en\.json$/,
  /^web\/dist\/(?:[\w.-]+\/)*[\w.-]+$/,
  /^contracts\/(?:api|cli|files|state)\/[\w.-]+\.schema\.json$/,
  /^contracts\/(?:capabilities|capabilities\.schema|matrix)\.json$/,
];

/** Paths that must never be packed, with the reason shown when one is (security-secrets, bug-007). */
export const FORBIDDEN: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /^export\d*\//, reason: "the user's private material (export*/)" },
  { pattern: /^\.idea\//, reason: 'IDE settings' },
  { pattern: /^\.mcp\.json$/, reason: 'local MCP configuration' },
  { pattern: /^test\//, reason: 'tests' },
  { pattern: /^docs\//, reason: 'project documentation and governance' },
  { pattern: /(^|\/)node_modules\//, reason: 'installed dependencies' },
  { pattern: /\.map$/, reason: 'source maps' },
  { pattern: /\.d\.ts$/, reason: 'type declarations' },
  { pattern: /\.tsx?$/, reason: 'TypeScript sources' },
  { pattern: /\.tsbuildinfo$/, reason: 'TypeScript build state' },
];

/** Whether `file` is on the allow-list. */
export function isAllowed(file: string): boolean {
  return ALLOWED.some((pattern) => pattern.test(file));
}

/** The reason `file` must never be packed, if any. */
export function forbiddenReason(file: string): string | undefined {
  return FORBIDDEN.find(({ pattern }) => pattern.test(file))?.reason;
}

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** Files of `dir` (relative to the repository, `/`-separated) on disk. */
export function filesUnder(dir: string, root = REPO_ROOT): string[] {
  const rel = path.relative(root, dir).split(path.sep).join('/');
  return walk(dir).map((file) => `${rel}/${file}`);
}

/**
 * Every file the installed package needs at run time (ES-10, ES-11), from the checkout at `root`:
 * the fixed files, one `server/dist` module per server source, every built web file, every JSON
 * contract tracked under `contracts/` (but the workspace's own `package.json` / `tsconfig.json`).
 */
export function requiredFiles(trackedContracts: readonly string[], root = REPO_ROOT): string[] {
  const server = serverModules(root);
  const contracts = trackedContracts.filter(
    (file) => file.endsWith('.json') && !/^contracts\/(package|tsconfig)\.json$/.test(file),
  );
  return [
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'bin/wingfoil-ui.cjs',
    'server/src/i18n/en.json',
    ...server,
    ...filesUnder(path.join(root, 'web', 'dist'), root),
    ...contracts,
  ];
}

/** The `server/dist` modules of the server sources: exactly what the tarball holds under `server/dist`. */
export function serverModules(root = REPO_ROOT): string[] {
  return filesUnder(path.join(root, 'server', 'src'), root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .map((file) => file.replace(/^server\/src\//, 'server/dist/').replace(/\.ts$/, '.js'));
}

/** JavaScript files under `dir` that hold React's development build (`jsxDEV`). */
export function developmentBuildFiles(dir: string): string[] {
  return walk(dir).filter(
    (file) => file.endsWith('.js') && readFileSync(path.join(dir, file), 'utf8').includes('jsxDEV'),
  );
}

/** The npm CLI script, run with this Node.js (no shell, REQ-SEC-05). */
export function npmCli(): string {
  const exec = process.env.npm_execpath;
  if (exec && /npm-cli\.js$/.test(exec)) return exec;
  if (exec && /npx-cli\.js$/.test(exec)) return exec.replace(/npx-cli\.js$/, 'npm-cli.js');
  return path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
}

/** Run `npm` with `args`. */
export function npm(
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<RunResult> {
  return run(process.execPath, [npmCli(), ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...(options.env ?? process.env), npm_config_update_notifier: 'false', npm_config_fund: 'false' },
    timeoutMs: options.timeoutMs ?? 120_000,
  });
}

/** The single package report of `npm pack … --json` output. */
export function parsePackReport(stdout: string): PackReport {
  // Lifecycle scripts may print before the JSON array.
  const start = stdout.indexOf('[\n');
  const reports = JSON.parse(start >= 0 ? stdout.slice(start) : stdout) as PackReport[];
  if (reports.length !== 1) throw new Error(`expected one package in npm pack output, got ${reports.length}`);
  return reports[0]!;
}

/** The file list of the tarball, without building (`--ignore-scripts`). */
export async function dryRunPack(): Promise<PackReport> {
  return parsePackReport((await npm(['pack', '--dry-run', '--json', '--ignore-scripts'])).stdout);
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

/** Bare module specifiers (not relative, not `node:`) imported by the JavaScript files under `dir`. */
export function bareImports(dir: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(dir).filter((f) => f.endsWith('.js'))) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const spec = match[2]!;
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
      if (builtinModules.includes(spec.split('/')[0]!)) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]!;
      found.set(name, [...(found.get(name) ?? []), file]);
    }
  }
  return found;
}

/** `package.json` of `dir`. */
export function readManifest(dir = REPO_ROOT): {
  version: string;
  private?: boolean;
  files?: string[];
  workspaces?: string[];
  repository?: { type: string; url: string };
  homepage?: string;
  bugs?: { url: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as ReturnType<typeof readManifest>;
}
