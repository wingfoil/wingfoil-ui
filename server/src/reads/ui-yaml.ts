/**
 * The direct read of `.wingfoil/ui.yaml`, the UI's own file (spec-001 §4.5, spec-005 §2 amended
 * 2026-11-05; task-054 D54-2): from the working tree, at a fixed path no input names, read-only,
 * with no symbolic link followed at any step. `O_NOFOLLOW` guards the last component only — through
 * a `.wingfoil` that is a link, the open reaches a file outside the project (design probe P1) — so:
 *
 * 1. `lstat(.wingfoil)`: missing → absent; anything but a directory (a link included) → refused;
 * 2. `lstat(.wingfoil/ui.yaml)`: missing → absent; not a regular file, or above 64 KiB → refused,
 *    never opened;
 * 3. `open(O_RDONLY | O_NOFOLLOW | O_NONBLOCK)`, then the descriptor's `fstat`: a regular file of at
 *    most 64 KiB whose (device, inode) are those of step 2, and `.wingfoil` still the directory of
 *    step 1 — so a swap between the checks and the open, also one put back after it (the ABA swap of
 *    probe P1), is refused;
 * 4. at most 64 KiB + 1 bytes read from the descriptor, decoded as strict UTF-8 (a BOM dropped).
 *
 * The state check's mark of the file ({@link uiYamlMark}, task-068) takes the same steps and hashes
 * the bytes instead of decoding them.
 *
 * Declared residual (spec-005 Process Note 2026-11-05): Node has no `openat`, so a local process
 * that swaps `.wingfoil` for a link after the first `lstat` of step 1 and puts it back before its
 * re-check in step 3 is not caught (the `lstat` of step 2 and the open both pass through the link;
 * review round 1 F4); it needs write access to the working tree. Nothing here writes.
 */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';

/** Path of the file, relative to the project root. */
export const UI_YAML = '.wingfoil/ui.yaml';

/** Largest file read (spec-005 §2). */
export const MAX_UI_YAML_BYTES = 64 * 1024;

/** What the read found at `.wingfoil/ui.yaml`. */
export type UiYamlEntry =
  /** No entry (nor a `.wingfoil` folder). */
  | { kind: 'absent' }
  /** An entry that is not read: the failure after "ui.yaml ignored: ". */
  | { kind: 'refused'; failure: string }
  /** The file's text and the SHA-256 (hex) of its bytes. */
  | { kind: 'text'; text: string; sha256: string };

/** The identity and kind of a file-system object (`lstat` / `fstat` with `bigint`). */
export interface UiYamlStats {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/** An open descriptor. */
export interface UiYamlHandle {
  stat(): Promise<UiYamlStats>;
  read(buffer: Buffer, offset: number, length: number, position: number | null): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

/** The file-system operations of the read — reads only (a port, for the swap tests). */
export interface UiYamlFs {
  lstat(file: string): Promise<UiYamlStats>;
  open(file: string, flags: number): Promise<UiYamlHandle>;
}

/** {@link UiYamlFs} on the local file system. */
export const nodeUiYamlFs: UiYamlFs = {
  lstat: (file) => lstat(file, { bigint: true }),
  async open(file, flags) {
    const handle = await open(file, flags);
    return {
      stat: () => handle.stat({ bigint: true }),
      read: (buffer, offset, length, position) => handle.read(buffer, offset, length, position),
      close: () => handle.close(),
    };
  },
};

// Not on every platform (Windows): 0 leaves them out.
const OPEN_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const LIMIT = BigInt(MAX_UI_YAML_BYTES);

const NOT_REGULAR = 'not a regular file';
const TOO_LARGE = 'larger than 64 KiB';
const UNREADABLE = 'cannot be read';

/**
 * What the guarded steps found: no entry, an entry that is not read (the failure, and the mark the
 * state key uses for it: its `lstat`, never a target), or the bytes of the regular file.
 */
type Inspected =
  { kind: 'absent' } | { kind: 'refused'; failure: string; mark: string } | { kind: 'bytes'; bytes: Buffer };

const same = (a: UiYamlStats, b: UiYamlStats): boolean => a.dev === b.dev && a.ino === b.ino;
const stamp = (s: UiYamlStats): string => `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}`;
const code = (error: unknown): string => (error as NodeJS.ErrnoException).code ?? 'unknown';
const missing = (error: unknown): boolean => code(error) === 'ENOENT' || code(error) === 'ENOTDIR';
const refuse = (failure: string, mark: string): Inspected => ({ kind: 'refused', failure, mark });

/** Steps 1–4 of the module comment, shared by the read and the mark (one code path, D68-5). */
async function inspect(root: string, fs: UiYamlFs): Promise<Inspected> {
  const folder = path.join(root, '.wingfoil');
  const file = path.join(root, UI_YAML);
  let dir: UiYamlStats;
  let entry: UiYamlStats;
  try {
    dir = await fs.lstat(folder);
  } catch (error) {
    return missing(error) ? { kind: 'absent' } : refuse(UNREADABLE, `error:${code(error)}`);
  }
  if (!dir.isDirectory()) return refuse(NOT_REGULAR, `wingfoil:${stamp(dir)}`);
  try {
    entry = await fs.lstat(file);
  } catch (error) {
    return missing(error) ? { kind: 'absent' } : refuse(UNREADABLE, `error:${code(error)}`);
  }
  if (entry.isSymbolicLink()) return refuse(NOT_REGULAR, `link:${stamp(entry)}`);
  if (!entry.isFile()) return refuse(NOT_REGULAR, `other:${stamp(entry)}`);
  if (entry.size > LIMIT) return refuse(TOO_LARGE, `large:${stamp(entry)}`);

  let handle: UiYamlHandle;
  try {
    handle = await fs.open(file, OPEN_FLAGS);
  } catch (error) {
    // ELOOP: the last component became a link (O_NOFOLLOW); ENOENT: it went away.
    return code(error) === 'ELOOP' || missing(error)
      ? refuse(NOT_REGULAR, `swapped:${stamp(entry)}`)
      : refuse(UNREADABLE, `error:${code(error)}`);
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !same(opened, entry)) return refuse(NOT_REGULAR, `swapped:${stamp(opened)}`);
    const dirAfter = await fs.lstat(folder).catch(() => undefined);
    if (!dirAfter?.isDirectory() || !same(dirAfter, dir)) return refuse(NOT_REGULAR, `swapped:${stamp(opened)}`);
    if (opened.size > LIMIT) return refuse(TOO_LARGE, `large:${stamp(opened)}`);
    const buffer = Buffer.alloc(MAX_UI_YAML_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_UI_YAML_BYTES) return refuse(TOO_LARGE, `large:${stamp(opened)}`);
    return { kind: 'bytes', bytes: buffer.subarray(0, total) };
  } catch (error) {
    return refuse(UNREADABLE, `error:${code(error)}`);
  } finally {
    await handle.close();
  }
}

/** Read the entry at `<root>/.wingfoil/ui.yaml` (`root`: the project's realpath). */
export async function readUiYaml(root: string, fs: UiYamlFs = nodeUiYamlFs): Promise<UiYamlEntry> {
  return (await readMarkedUiYaml(root, fs)).entry;
}

/**
 * {@link readUiYaml} with the {@link uiYamlMark} of what this read saw — the same steps, one pass —
 * to which a per-state read is tied (bug-034, task-075 D75-3).
 */
export async function readMarkedUiYaml(
  root: string,
  fs: UiYamlFs = nodeUiYamlFs,
): Promise<{ entry: UiYamlEntry; mark: string }> {
  const found = await inspect(root, fs);
  const mark = markOf(found);
  if (found.kind === 'absent') return { entry: found, mark };
  if (found.kind === 'refused') return { entry: { kind: 'refused', failure: found.failure }, mark };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(found.bytes);
  } catch {
    return { entry: { kind: 'refused', failure: 'not valid UTF-8' }, mark };
  }
  return { entry: { kind: 'text', text, sha256: mark.slice('sha:'.length) }, mark };
}

/** The mark of what {@link inspect} found (one rule for the read and the check). */
function markOf(found: Inspected): string {
  if (found.kind === 'absent') return 'absent';
  if (found.kind === 'refused') return found.mark;
  return `sha:${createHash('sha256').update(found.bytes).digest('hex')}`;
}

/**
 * The mark of `<root>/.wingfoil/ui.yaml` in the state key (spec-001 §4.4 amended 2026-11-06,
 * task-068 D68-5), taken on every check whatever git's status says of the file — so an edit of an
 * ignored `ui.yaml` moves the key too: `absent`; `sha:<SHA-256 of the bytes>` for a regular file
 * of at most 64 KiB (valid UTF-8 or not); otherwise the `lstat` of what is there, never opened and
 * never a target — `wingfoil:` (`.wingfoil` not a directory), `link:`, `other:` (a FIFO, a
 * directory, a device), `large:`, `swapped:` (replaced during the steps; the next check marks the
 * new content), or `error:<code>`. The bytes are hashed, neither kept nor exposed.
 */
export async function uiYamlMark(root: string, fs: UiYamlFs = nodeUiYamlFs): Promise<string> {
  return markOf(await inspect(root, fs));
}
