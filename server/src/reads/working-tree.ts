/**
 * The working-tree files a project shows (REQ-SEC-06, REQ-ARC-04 "the working-tree files shown in
 * Files", spec-004 §3 `/docs`, `/files/tree`, `/files/content`): the documentation index, one
 * directory level of the tree, and the content of one documentation file — every path confined to
 * the repository lexically, then by `realpath`, before anything is read, so that neither `..`, an
 * absolute path nor a symlink leads out (refused as `outside`, with 0 bytes of the target read).
 *
 * v0.1 serves documents only (spec-004 §3 "v0.1 (docs)"): the content of a file under `paths.docs`
 * that is not a Memory file (spec-002 §3 Memory directories — Memory and plan files are read only
 * at the paths the CLI returns, REQ-ARC-04), nor under `.wingfoil/`, `.git` or `node_modules`.
 * Nothing here writes.
 */
import type { Dirent } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { confinedPath, DirectReadError, nodeReadFs, readConfined, type ReadFs } from './confine.js';

/** What a working-tree entry is (symlinks are reported, never followed by a listing). */
export type EntryKind = 'file' | 'directory' | 'symlink' | 'other';

/** The read port of the working tree: {@link ReadFs} plus listing — reads only. */
export interface TreeFs extends ReadFs {
  /** The kind of `file` itself (`lstat`: a symlink is `symlink`). */
  kind(file: string): Promise<EntryKind>;
  /** The entries of the directory `dir`, by name and kind. */
  list(dir: string): Promise<{ name: string; kind: EntryKind }[]>;
}

function kindOf(entry: Pick<Dirent, 'isFile' | 'isDirectory' | 'isSymbolicLink'>): EntryKind {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isFile()) return 'file';
  if (entry.isDirectory()) return 'directory';
  return 'other';
}

/** {@link TreeFs} on the local file system. */
export const nodeTreeFs: TreeFs = {
  ...nodeReadFs,
  kind: async (file) => kindOf(await lstat(file)),
  list: async (dir) => (await readdir(dir, { withFileTypes: true })).map((d) => ({ name: d.name, kind: kindOf(d) })),
};

/** Why a working-tree path is refused. */
export type WorkingTreeErrorKind =
  /** The path leaves the repository (traversal, absolute path, NUL, escaping symlink). */
  | 'outside'
  /** Nothing readable of the right kind there. */
  | 'missing'
  /** Inside the repository but not served (in v0.1: not a documentation file). */
  | 'not-allowed'
  /** Larger than `MAX_DIRECT_READ_BYTES` (5 MiB). */
  | 'too-large';

/** A refused working-tree path (404 `not-found` with `detail { kind }`, spec-004 §5). */
export class WorkingTreeError extends Error {
  override name = 'WorkingTreeError';

  constructor(
    readonly kind: WorkingTreeErrorKind,
    /** The path as asked. */
    readonly file: string,
  ) {
    super(`${kind}: ${file}`);
  }
}

/** Where documents are looked for, and what is never served. */
export interface DocumentationScope {
  /** `paths.docs`, normalised (POSIX, no trailing `/`, `.` for the root), inside the project. */
  roots: string[];
  /** The Memory directories (spec-002 §3), normalised. */
  memory: string[];
}

/** Largest number of entries the documentation index visits. */
export const MAX_DOC_ENTRIES = 20_000;

/** File names of documents. */
const DOCUMENT = /\.(md|markdown)$/i;

/** Folders never listed nor served, at any depth (`.git` is never listed either). */
const HIDDEN_DIRS = new Set(['.git', 'node_modules']);

/** The WingFoil folder: read only through the CLI and the allow-list (REQ-ARC-04). */
const GOVERNANCE_DIR = '.wingfoil';

function normalise(rel: string): string | undefined {
  if (rel.includes('\0') || path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) return undefined;
  const clean = path.posix.normalize(rel.replace(/\/+$/, '') || '.');
  return clean === '..' || clean.startsWith('../') ? undefined : clean;
}

/** The scope from `paths.docs` and the Memory directories; folders leaving the project are dropped. */
export function documentationScope(input: {
  docs: readonly string[];
  memoryDirectories: readonly string[];
}): DocumentationScope {
  const keep = (list: readonly string[]) => list.map(normalise).filter((d): d is string => d !== undefined);
  return { roots: [...new Set(keep(input.docs))], memory: keep(input.memoryDirectories) };
}

const under = (rel: string, dir: string): boolean => dir === '.' || rel === dir || rel.startsWith(`${dir}/`);

/** True when the normalised project-relative `rel` is a file the documentation scope serves. */
export function inDocumentationScope(scope: DocumentationScope, rel: string): boolean {
  const segments = rel.split('/');
  if (segments.some((s) => HIDDEN_DIRS.has(s)) || segments[0] === GOVERNANCE_DIR) return false;
  if (scope.memory.some((dir) => under(rel, dir))) return false;
  return scope.roots.some((root) => under(rel, root));
}

/** `rel` of `real` against the real root, POSIX. */
function relativeTo(realRoot: string, real: string): string {
  return path.relative(realRoot, real).split(path.sep).join('/') || '.';
}

/** The confined real path of `rel`, or a {@link WorkingTreeError} (`outside` / `missing`). */
async function confine(root: string, rel: string, fs: ReadFs): Promise<string> {
  try {
    return await confinedPath(root, root, rel, fs);
  } catch (error) {
    if (error instanceof DirectReadError) {
      throw new WorkingTreeError(error.kind === 'outside' ? 'outside' : 'missing', rel);
    }
    throw error;
  }
}

/** A document of the index. */
export interface DocumentEntry {
  /** Path relative to the project root. */
  path: string;
}

/**
 * The documentation index (R-08.1): the Markdown files under the scope's roots, without the Memory
 * directories, `.wingfoil/`, `.git`, `node_modules`; symlinks are not followed; a root that does not
 * exist or leads out of the project is skipped. Sorted by path; nothing is read but directories.
 */
export async function documentationIndex(
  root: string,
  scope: DocumentationScope,
  fs: TreeFs = nodeTreeFs,
): Promise<DocumentEntry[]> {
  const found = new Set<string>();
  let visited = 0;
  const walk = async (dir: string, abs: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.list(abs);
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (++visited > MAX_DOC_ENTRIES) return;
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if (entry.kind === 'directory') {
        if (HIDDEN_DIRS.has(entry.name) || rel === GOVERNANCE_DIR || scope.memory.some((m) => under(rel, m))) continue;
        await walk(rel, path.join(abs, entry.name));
      } else if (entry.kind === 'file' && DOCUMENT.test(entry.name) && inDocumentationScope(scope, rel)) {
        found.add(rel);
      }
    }
  };
  for (const docRoot of scope.roots) {
    let real: string;
    try {
      real = docRoot === '.' ? await fs.realpath(root) : await confine(root, docRoot, fs);
      if ((await fs.kind(real)) !== 'directory') continue;
    } catch {
      continue;
    }
    await walk(docRoot, real);
  }
  return [...found].sort().map((p) => ({ path: p }));
}

/** One entry of a directory listing. */
export interface TreeEntry {
  name: string;
  /** Path relative to the project root. */
  path: string;
  kind: EntryKind;
}

/** One directory level of the working tree. */
export interface TreeListing {
  /** The directory, relative to the project root (`""` for the root). */
  path: string;
  entries: TreeEntry[];
}

/**
 * The entries of the directory `rel` (`""`: the root), by name, confined to the repository; `.git`
 * is neither listed nor listable (`not-allowed`).
 */
export async function listDirectory(root: string, rel: string, fs: TreeFs = nodeTreeFs): Promise<TreeListing> {
  const lexical = rel === '' ? '.' : normalise(rel);
  if (lexical === undefined) throw new WorkingTreeError('outside', rel);
  const real = lexical === '.' ? await fs.realpath(root) : await confine(root, rel, fs);
  const inRepo = relativeTo(await fs.realpath(root), real);
  if ([...lexical.split('/'), ...inRepo.split('/')].includes('.git')) throw new WorkingTreeError('not-allowed', rel);
  if ((await fs.kind(real).catch(() => 'missing')) !== 'directory') throw new WorkingTreeError('missing', rel);
  const base = lexical === '.' ? '' : lexical;
  const entries = (await fs.list(real))
    .filter((e) => e.name !== '.git')
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((e) => ({ name: e.name, path: base === '' ? e.name : `${base}/${e.name}`, kind: e.kind }));
  return { path: base, entries };
}

/** The content of a working-tree file. */
export interface FileContent {
  /** Path relative to the project root, as asked (normalised). */
  path: string;
  /** Size in bytes. */
  size: number;
  /** UTF-8 text. */
  content: string;
}

/**
 * The content of the file `rel`: confined (lexically, then by `realpath` — the target is never
 * opened when it lies outside), in `scope` both as written and as resolved, a regular file, at most
 * `MAX_DIRECT_READ_BYTES` (5 MiB).
 */
export async function readWorkingTreeFile(
  root: string,
  rel: string,
  scope: DocumentationScope,
  fs: TreeFs = nodeTreeFs,
): Promise<FileContent> {
  const lexical = normalise(rel);
  if (lexical === undefined || rel === '') throw new WorkingTreeError('outside', rel);
  const real = await confine(root, rel, fs);
  const resolved = relativeTo(await fs.realpath(root), real);
  if (!inDocumentationScope(scope, lexical) || !inDocumentationScope(scope, resolved)) {
    throw new WorkingTreeError('not-allowed', rel);
  }
  if ((await fs.kind(real).catch(() => 'missing')) !== 'file') throw new WorkingTreeError('missing', rel);
  let content: string;
  try {
    content = await readConfined(root, root, rel, fs);
  } catch (error) {
    if (!(error instanceof DirectReadError)) throw error;
    throw new WorkingTreeError(
      error.kind === 'shape' ? 'too-large' : error.kind === 'outside' ? 'outside' : 'missing',
      rel,
    );
  }
  return { path: lexical, size: Buffer.byteLength(content), content };
}
