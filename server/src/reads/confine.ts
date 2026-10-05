/**
 * Read-only access to the files of the allow-list (adr-001 D1a, REQ-ARC-04): a read port with no
 * write method, the confinement of every path to a base folder of the project (lexically, then by
 * realpath, so neither `..` nor a symlink leads out), and the error of a failed direct read.
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

/** The file-system operations a direct read needs — reads only. */
export interface ReadFs {
  /** The content of a file, as UTF-8. */
  readFile(file: string): Promise<string>;
  /** The canonical absolute path (symlinks resolved). */
  realpath(file: string): Promise<string>;
  /** The size of a file in bytes. */
  size(file: string): Promise<number>;
}

/** Largest file a direct read accepts (5 MiB): a bigger one is a `shape` error, never read. */
export const MAX_DIRECT_READ_BYTES = 5 * 1024 * 1024;

/** {@link ReadFs} on the local file system. */
export const nodeReadFs: ReadFs = {
  readFile: (file) => readFile(file, 'utf8'),
  realpath: (file) => realpath(file),
  size: async (file) => (await stat(file)).size,
};

/** Why a direct read failed. */
export type DirectReadErrorKind =
  /** The path leaves its base folder (traversal, absolute path, escaping symlink). */
  | 'outside'
  /** The file does not exist or cannot be read. */
  | 'missing'
  /** The file does not have the shape of its schema (`contracts/files/`). */
  | 'shape'
  /** The file disagrees with what the CLI returned (e.g. an element's `status`). */
  | 'mismatch';

/** A failed direct read: a read error of that one file, never guessed at (spec-001 §4). */
export class DirectReadError extends Error {
  override name = 'DirectReadError';

  constructor(
    readonly kind: DirectReadErrorKind,
    /** The path as the CLI gave it (relative to the project or to `.wingfoil/`), or the file read. */
    readonly file: string,
    message: string,
  ) {
    super(message);
  }
}

function inside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  // `..notes` is a name inside `base`; only `..` itself or `../…` leaves it.
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * The real path of `rel` inside `base` — the project `root` or a folder of it, e.g. `.wingfoil/` —
 * or a {@link DirectReadError}: `outside` when `rel` is empty, absolute, leaves `base` by `..`, or
 * resolves out of it through a symlink, or when `base` itself resolves out of `root`; `missing` when
 * something does not exist. Only `root`, `base` and the target are resolved: nothing outside is
 * ever read.
 */
export async function confinedPath(root: string, base: string, rel: string, fs: ReadFs = nodeReadFs): Promise<string> {
  const outside = () => new DirectReadError('outside', rel, `${rel || '(empty path)'}: outside the allowed folder`);
  if (rel === '' || rel.includes('\0') || path.isAbsolute(rel) || path.win32.isAbsolute(rel)) throw outside();
  const lexical = path.resolve(base, rel);
  if (!inside(path.resolve(base), lexical)) throw outside();
  const resolve = (p: string, what: string) =>
    fs.realpath(p).catch(() => {
      throw new DirectReadError('missing', rel, `${rel}: ${what} does not exist`);
    });
  const realRoot = await resolve(root, 'the project folder');
  const realBase = await resolve(base, 'the folder');
  if (realBase !== realRoot && !inside(realRoot, realBase)) throw outside();
  const real = await resolve(lexical, 'the file');
  if (!inside(realBase, real)) throw outside();
  return real;
}

/**
 * The content of `rel` inside `base`, confined as {@link confinedPath} says, at most
 * {@link MAX_DIRECT_READ_BYTES}; the path is resolved again after the read, so a file swapped for a
 * link out of the folder meanwhile is refused.
 */
export async function readConfined(root: string, base: string, rel: string, fs: ReadFs = nodeReadFs): Promise<string> {
  const file = await confinedPath(root, base, rel, fs);
  const tooLarge = () => new DirectReadError('shape', rel, `${rel}: too large (over ${MAX_DIRECT_READ_BYTES} bytes)`);
  const unreadable = () => new DirectReadError('missing', rel, `${rel}: cannot be read`);
  if ((await fs.size(file).catch(() => Promise.reject(unreadable()))) > MAX_DIRECT_READ_BYTES) throw tooLarge();
  const text = await fs.readFile(file).catch(() => Promise.reject(unreadable()));
  if ((await confinedPath(root, base, rel, fs)) !== file) {
    throw new DirectReadError('outside', rel, `${rel}: outside the allowed folder`);
  }
  if (Buffer.byteLength(text) > MAX_DIRECT_READ_BYTES) throw tooLarge();
  return text;
}
