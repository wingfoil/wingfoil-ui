/**
 * The working-tree files a project shows (REQ-SEC-06, REQ-ARC-04 "the working-tree files shown in
 * Files", spec-004 §3 `/docs`, `/files/tree`, `/files/content`): the documentation index, one
 * directory level of the tree, and the content of one documentation file — every path confined to
 * the repository lexically, then by `realpath`, before anything is read, so that neither `..`, an
 * absolute path nor a symlink leads out (refused as `outside`, with 0 bytes of the target read).
 *
 * v0.1 serves documents only (spec-004 §3 "v0.1 (docs)"): Markdown files (`.md`, `.markdown`)
 * under `paths.docs` that are not Memory files (spec-002 §3 Memory directories — Memory and plan
 * files are read only at the paths the CLI returns, REQ-ARC-04), nor under a governance folder
 * (`.wingfoil`, `paths.governance`), `.git` or `node_modules`, nor hard-linked; the tree lists the
 * documentation folders only. Folder names are compared in NFC. The index lists the working tree
 * as it is, git-ignored documents included (the project's documents on disk). Nothing here writes.
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
  /** The number of hard links of `file` (a document linked elsewhere is not served). */
  links(file: string): Promise<number>;
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
  links: async (file) => (await lstat(file)).nlink,
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
  /** `paths.docs`, normalised (POSIX, NFC, no trailing `/`, `.` for the root), inside the project. */
  roots: string[];
  /** The Memory directories (spec-002 §3), normalised. */
  memory: string[];
  /** The governance folders: `.wingfoil` and `paths.governance`, normalised. */
  governance: string[];
}

/** Largest number of entries the documentation index visits. */
export const MAX_DOC_ENTRIES = 20_000;

/** File names of documents: the only files served in v0.1. */
const DOCUMENT = /\.(md|markdown)$/i;

/** Folders never listed nor served, at any depth. */
const HIDDEN_DIRS = new Set(['.git', 'node_modules']);

/** The WingFoil folder: read only through the CLI and the allow-list (REQ-ARC-04). */
const GOVERNANCE_DIR = '.wingfoil';

/** `rel` normalised (POSIX, NFC, no trailing `/`), or `undefined` when it leaves the project. */
function normalise(rel: string): string | undefined {
  if (rel.includes('\0') || path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) return undefined;
  const clean = path.posix.normalize(rel.normalize('NFC').replace(/\/+$/, '') || '.');
  return clean === '..' || clean.startsWith('../') ? undefined : clean;
}

/**
 * The scope from `paths.docs`, the Memory directories and `paths.governance` (`.wingfoil` always);
 * folders leaving the project are dropped.
 */
export function documentationScope(input: {
  docs: readonly string[];
  memoryDirectories: readonly string[];
  governance?: readonly string[];
}): DocumentationScope {
  const keep = (list: readonly string[]) => list.map(normalise).filter((d): d is string => d !== undefined);
  return {
    roots: [...new Set(keep(input.docs))],
    memory: keep(input.memoryDirectories),
    governance: [...new Set([GOVERNANCE_DIR, ...keep(input.governance ?? [])])],
  };
}

const under = (rel: string, dir: string): boolean => dir === '.' || rel === dir || rel.startsWith(`${dir}/`);

/**
 * True when the folder `rel` (normalised, project-relative) is a documentation folder: under a root,
 * not a Memory or governance folder, not `.git` or `node_modules`.
 */
export function inDocumentationFolder(scope: DocumentationScope, rel: string): boolean {
  const clean = rel.normalize('NFC');
  if (clean.split('/').some((s) => HIDDEN_DIRS.has(s))) return false;
  if (scope.memory.some((dir) => under(clean, dir)) || scope.governance.some((dir) => under(clean, dir))) return false;
  return scope.roots.some((root) => under(clean, root));
}

/** True when the normalised project-relative `rel` is a document the scope serves (`.md`, `.markdown`). */
export function inDocumentationScope(scope: DocumentationScope, rel: string): boolean {
  return DOCUMENT.test(rel) && inDocumentationFolder(scope, rel);
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
        if (inDocumentationFolder(scope, rel)) await walk(rel, path.join(abs, entry.name));
      } else if (entry.kind === 'file' && inDocumentationScope(scope, rel)) {
        // A hard-linked file may be a file of anywhere else: not a document of the project.
        if ((await fs.links(path.join(abs, entry.name)).catch(() => 2)) === 1) found.add(rel);
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
 * The entries of the directory `rel` — in v0.1 a documentation folder (spec-004 §3 "v0.1 (docs)"),
 * else `not-allowed` — by name: its documentation folders and documents. Confined to the
 * repository (lexically, then by `realpath`) before the scope is judged.
 */
export async function listDirectory(
  root: string,
  rel: string,
  scope: DocumentationScope,
  fs: TreeFs = nodeTreeFs,
): Promise<TreeListing> {
  const lexical = rel === '' ? '.' : normalise(rel);
  if (lexical === undefined) throw new WorkingTreeError('outside', rel);
  const real = lexical === '.' ? await fs.realpath(root) : await confine(root, rel, fs);
  const resolved = relativeTo(await fs.realpath(root), real);
  if (!inDocumentationFolder(scope, lexical) || !inDocumentationFolder(scope, resolved)) {
    throw new WorkingTreeError('not-allowed', rel);
  }
  if ((await fs.kind(real).catch(() => 'missing')) !== 'directory') throw new WorkingTreeError('missing', rel);
  const base = lexical === '.' ? '' : lexical;
  const entries = (await fs.list(real))
    .map((e) => ({ name: e.name, path: base === '' ? e.name : `${base}/${e.name}`, kind: e.kind }))
    .filter((e) =>
      e.kind === 'directory' ? inDocumentationFolder(scope, e.path) : inDocumentationScope(scope, e.path),
    )
    .sort((a, b) => (a.name < b.name ? -1 : 1));
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
  // A trailing `/` names a folder: never a document.
  if (rel.endsWith('/') || !inDocumentationScope(scope, lexical) || !inDocumentationScope(scope, resolved)) {
    throw new WorkingTreeError('not-allowed', rel);
  }
  if ((await fs.kind(real).catch(() => 'missing')) !== 'file') throw new WorkingTreeError('missing', rel);
  // A hard link may be a file of anywhere else on the disk (REQ-SEC-06).
  if ((await fs.links(real).catch(() => 2)) !== 1) throw new WorkingTreeError('not-allowed', rel);
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
