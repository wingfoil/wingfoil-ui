/**
 * Read-only access to the files of the allow-list (adr-001 D1a, REQ-ARC-04): a read port with no
 * write method, the confinement of every path to a base folder of the project (lexically, then by
 * realpath, so neither `..` nor a symlink leads out), and the error of a failed direct read.
 */
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

/** The file-system operations a direct read needs — reads only. */
export interface ReadFs {
  /** The content of a file, as UTF-8. */
  readFile(file: string): Promise<string>;
  /** The canonical absolute path (symlinks resolved). */
  realpath(file: string): Promise<string>;
}

/** {@link ReadFs} on the local file system. */
export const nodeReadFs: ReadFs = {
  readFile: (file) => readFile(file, 'utf8'),
  realpath: (file) => realpath(file),
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
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * The real path of `rel` inside `base` (a folder of the project, e.g. the root or `.wingfoil/`), or
 * a {@link DirectReadError} `outside` when `rel` is empty, absolute, leaves `base` by `..`, or
 * resolves out of it through a symlink; `missing` when it does not exist. Only `base` and the
 * target are resolved: nothing outside `base` is ever read.
 */
export async function confinedPath(base: string, rel: string, fs: ReadFs = nodeReadFs): Promise<string> {
  const outside = () => new DirectReadError('outside', rel, `${rel || '(empty path)'}: outside the allowed folder`);
  if (rel === '' || rel.includes('\0') || path.isAbsolute(rel) || path.win32.isAbsolute(rel)) throw outside();
  const lexical = path.resolve(base, rel);
  if (!inside(path.resolve(base), lexical)) throw outside();
  const realBase = await fs.realpath(base).catch(() => {
    throw new DirectReadError('missing', rel, `${rel}: the folder does not exist`);
  });
  const real = await fs.realpath(lexical).catch(() => {
    throw new DirectReadError('missing', rel, `${rel}: no such file`);
  });
  if (!inside(realBase, real)) throw outside();
  return real;
}

/** The content of `rel` inside `base`, confined as {@link confinedPath} says. */
export async function readConfined(base: string, rel: string, fs: ReadFs = nodeReadFs): Promise<string> {
  const file = await confinedPath(base, rel, fs);
  return fs.readFile(file).catch(() => {
    throw new DirectReadError('missing', rel, `${rel}: cannot be read`);
  });
}
