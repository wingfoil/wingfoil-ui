// Review F1 — the content fingerprint of the status entries: changes with the content of a listed
// file, never follows a symbolic link, bounds the bytes read (size and time beyond the limits).
import { mkdtemp, rm, symlink, truncate, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  combinedHash,
  contentFingerprint,
  MAX_FINGERPRINT_FILE_BYTES,
} from '../../../server/src/snapshot/fingerprint.js';

let dir: string;
const entry = (p: string) => ({ code: '??', path: p });

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'wfui-fp-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('contentFingerprint', () => {
  it('changes with the content of a listed file, not without', async () => {
    await writeFile(path.join(dir, 'a.md'), 'First');
    const one = await contentFingerprint(dir, [entry('a.md')]);
    expect(await contentFingerprint(dir, [entry('a.md')])).toBe(one);
    await writeFile(path.join(dir, 'a.md'), 'Second');
    expect(await contentFingerprint(dir, [entry('a.md')])).not.toBe(one);
  });

  it('marks a missing file, and hashes a link by its target without following it', async () => {
    const missing = await contentFingerprint(dir, [entry('gone.md')]);
    expect(missing).toMatch(/^[0-9a-f]{64}$/);
    await writeFile(path.join(dir, 'target.md'), 'one');
    await symlink('target.md', path.join(dir, 'link.md'));
    const before = await contentFingerprint(dir, [entry('link.md')]);
    await writeFile(path.join(dir, 'target.md'), 'two');
    expect(await contentFingerprint(dir, [entry('link.md')])).toBe(before);
  });

  it('fingerprints a file over the size limit by size and time, unread', async () => {
    const big = path.join(dir, 'big.bin');
    await writeFile(big, '');
    await truncate(big, MAX_FINGERPRINT_FILE_BYTES + 1);
    await utimes(big, 1_000, 1_000);
    const one = await contentFingerprint(dir, [entry('big.bin')]);
    await utimes(big, 2_000, 2_000);
    expect(await contentFingerprint(dir, [entry('big.bin')])).not.toBe(one);
  });

  it('combines with the status hash into 16 hex digits', () => {
    expect(combinedHash('0123456789abcdef', 'f'.repeat(64))).toMatch(/^[0-9a-f]{16}$/);
    expect(combinedHash('0123456789abcdef', 'a')).not.toBe(combinedHash('0123456789abcdef', 'b'));
  });
});
