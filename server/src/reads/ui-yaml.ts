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
  isFile(): boolean;
  isDirectory(): boolean;
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

const refused = (failure: string): UiYamlEntry => ({ kind: 'refused', failure });
const same = (a: UiYamlStats, b: UiYamlStats): boolean => a.dev === b.dev && a.ino === b.ino;
const missing = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

/** Read the entry at `<root>/.wingfoil/ui.yaml` (`root`: the project's realpath). */
export async function readUiYaml(root: string, fs: UiYamlFs = nodeUiYamlFs): Promise<UiYamlEntry> {
  const folder = path.join(root, '.wingfoil');
  const file = path.join(root, UI_YAML);
  let dir: UiYamlStats;
  let entry: UiYamlStats;
  try {
    dir = await fs.lstat(folder);
  } catch (error) {
    return missing(error) ? { kind: 'absent' } : refused(UNREADABLE);
  }
  if (!dir.isDirectory()) return refused(NOT_REGULAR);
  try {
    entry = await fs.lstat(file);
  } catch (error) {
    return missing(error) ? { kind: 'absent' } : refused(UNREADABLE);
  }
  if (!entry.isFile()) return refused(NOT_REGULAR);
  if (entry.size > LIMIT) return refused(TOO_LARGE);

  let handle: UiYamlHandle;
  try {
    handle = await fs.open(file, OPEN_FLAGS);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // ELOOP: the last component became a link (O_NOFOLLOW); ENOENT: it went away.
    return code === 'ELOOP' || missing(error) ? refused(NOT_REGULAR) : refused(UNREADABLE);
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !same(opened, entry)) return refused(NOT_REGULAR);
    const dirAfter = await fs.lstat(folder).catch(() => undefined);
    if (!dirAfter?.isDirectory() || !same(dirAfter, dir)) return refused(NOT_REGULAR);
    if (opened.size > LIMIT) return refused(TOO_LARGE);
    const buffer = Buffer.alloc(MAX_UI_YAML_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_UI_YAML_BYTES) return refused(TOO_LARGE);
    const bytes = buffer.subarray(0, total);
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
      return refused('not valid UTF-8');
    }
    return { kind: 'text', text, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch {
    return refused(UNREADABLE);
  } finally {
    await handle.close();
  }
}
