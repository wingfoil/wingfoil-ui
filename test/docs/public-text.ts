/**
 * The public-text scanner (task-028, dl-006 action 4, dl-005): finds absolute filesystem paths
 * outside the repository in the tracked text files. Three rules: a POSIX path under a standard
 * top-level directory of Linux or macOS ({@link CHECKED_ROOTS}), a Windows drive path, and a
 * `~/` path. Any other leading-slash string (an API route, a repository-relative path) is not a
 * path outside the repository and is not checked.
 */
import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import { run } from '../harness/run.js';
import { ALLOWED, type AllowEntry } from './public-text.allow-list.js';

/** The top-level directories of Linux (FHS) and macOS whose paths are checked. */
export const CHECKED_ROOTS = [
  'home',
  'Users',
  'root',
  'tmp',
  'var',
  'etc',
  'opt',
  'usr',
  'mnt',
  'media',
  'srv',
  'private',
  'Volumes',
  'run',
  'proc',
  'dev',
  'snap',
  'bin',
  'sbin',
  'lib',
  'lib64',
  'boot',
  'sys',
  'nix',
  'Applications',
  'Library',
  'System',
] as const;

/** The rule that found a path. */
export type PathRule = 'posix' | 'windows' | 'home';

/** A path found on a line (1-based). */
export interface PathMatch {
  line: number;
  path: string;
  rule: PathRule;
}

/** A path not on the allow-list, in a tracked file (repository-relative, `/` separators). */
export interface Finding extends PathMatch {
  file: string;
}

/** The outcome of {@link scanRepository}. */
export interface Scan {
  /** Number of tracked text files read. */
  files: number;
  findings: Finding[];
  /** The allow-list entries that allowed at least one path. */
  used: Set<AllowEntry>;
}

// A path does not continue a word, a relative path, a URL, a placeholder (`<prefix>/bin`,
// `${dir}/tmp`) or an escaped regex (`\/home\/`); a `file://` URL is still checked.
const NOT_CONTINUING = String.raw`(?<![\w.~/\\>})\]$*@-])`;
// A path ends at whitespace, a quote, a bracket or a list separator.
const PATH_CHAR = String.raw`[^\s'"\x60()[\]{}<>,;|*]`;
// Each rule with a substring every match holds: a line without it is skipped (speed).
const RULES: readonly (readonly [PathRule, string, RegExp])[] = [
  ['posix', '/', new RegExp(String.raw`(?:${NOT_CONTINUING}|(?<=file://))/(?:${CHECKED_ROOTS.join('|')})(?![\w.-])${PATH_CHAR}*`, 'g')],
  // `\\` is a backslash escaped in source; `a:\n` (a YAML escape after a one-letter key) is not a drive.
  ['windows', ':', new RegExp(String.raw`${NOT_CONTINUING}[A-Za-z]:(?:\\\\|\\(?![nrt0](?![A-Za-z0-9]))|/)${PATH_CHAR}+`, 'g')],
  ['home', '~/', new RegExp(String.raw`${NOT_CONTINUING}~/${PATH_CHAR}+`, 'g')],
];

/**
 * Drop what a sentence or an escape leaves at the end of a path (`.`, `:`, an escape such as
 * `\"` or `\n`) and read a backslash escaped in source (`C:\\work`) as one.
 */
function clean(found: string, rule: PathRule): string {
  // A POSIX or home path holds no backslash: one starts an escape (`/bin/sh\necho`).
  const cut = rule === 'windows' ? found : found.split('\\')[0]!;
  return cut.replace(/(?:\\+|[.:])+$/, '').replace(/\\+/g, '\\');
}

/** Every path of {@link RULES} in `text`, line by line, allowed or not. */
export function findPaths(text: string): PathMatch[] {
  const matches: PathMatch[] = [];
  text.split('\n').forEach((content, index) => {
    for (const [rule, needle, pattern] of RULES) {
      if (!content.includes(needle)) continue;
      for (const match of content.matchAll(pattern)) {
        const found = clean(match[0], rule);
        // A bare `~/` (the notation itself, or one before an escape as in a regex) names nothing.
        if (found !== '~/') matches.push({ line: index + 1, path: found, rule });
      }
    }
  });
  return matches.sort((a, b) => a.line - b.line);
}

/** The allow-list entry that allows `found`, if any. */
export function allowedBy(found: string, entries: readonly AllowEntry[] = ALLOWED): AllowEntry | undefined {
  return entries.find((entry) => entry.pattern.test(found));
}

/** One `file:line: path` line per finding. */
export function formatFindings(findings: readonly Finding[]): string {
  return findings.map((f) => `${f.file}:${String(f.line)}: ${f.path}`).join('\n');
}

/** Git's own heuristic: a NUL byte in the first 8 000 bytes makes a file binary. */
function isBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0);
}

/**
 * The text git tracks for `file`: a regular file's content, a symbolic link's target (git stores
 * the target, not what it points to); `undefined` for a binary file, a submodule or a file
 * deleted from the working tree.
 */
async function trackedText(file: string): Promise<string | undefined> {
  const stats = await lstat(file).catch(() => undefined);
  if (stats?.isSymbolicLink()) return readlink(file);
  if (!stats?.isFile()) return undefined;
  const content = await readFile(file);
  return isBinary(content) ? undefined : content.toString('utf8');
}

/** Without inherited `GIT_*` variables, which could point git at another repository (bug-002). */
function cleanGitEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
}

/**
 * Scan the text files tracked in `root` (`git ls-files`: untracked and ignored files are never
 * read; binary files are skipped) and return the paths the allow-list does not allow.
 */
export async function scanRepository(root: string, env: NodeJS.ProcessEnv = cleanGitEnv()): Promise<Scan> {
  const listed = await run('git', ['ls-files', '-z'], { cwd: root, env });
  const files = listed.stdout.split('\0').filter((file) => file !== '');
  const scan: Scan = { files: 0, findings: [], used: new Set() };
  for (const file of files) {
    const text = await trackedText(path.join(root, file));
    if (text === undefined) continue;
    scan.files += 1;
    for (const match of findPaths(text)) {
      const entry = allowedBy(match.path);
      if (entry) scan.used.add(entry);
      else scan.findings.push({ file, ...match });
    }
  }
  return scan;
}
