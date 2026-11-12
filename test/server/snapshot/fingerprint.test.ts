// Review F1 — the content fingerprint of the status entries: changes with the content of a listed
// file, never follows a symbolic link, bounds the bytes read (size and time beyond the limits).
// task-026 (AC-2, bug-005): every comparison first asserts the state of the file system it relies
// on — the `lstat` changed, or stayed the same — so that no assertion passes on a cached mark.
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, truncate, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  combinedHash,
  contentFingerprint,
  Fingerprinter,
  MAX_FINGERPRINT_BYTES_PER_CHECK,
  MAX_FINGERPRINT_FILE_BYTES,
  RACY_WINDOW_MS,
} from '../../../server/src/snapshot/fingerprint.js';

let dir: string;
/** A clock well past the racy window of the files these tests just wrote. */
const LATER = { now: () => Date.now() + 60_000 };
const entry = (p: string) => ({ code: '??', path: p });

/** What the fingerprinter compares to decide whether to read a file again (links not followed). */
async function mark(file: string): Promise<string> {
  const s = await lstat(file, { bigint: true });
  return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
}

/** Assert that the `lstat` of `file` changed (or not) since `before` was taken. */
async function expectMark(file: string, before: string, change: 'changed' | 'same'): Promise<void> {
  if (change === 'changed') expect(await mark(file), `${file} lstat`).not.toBe(before);
  else expect(await mark(file), `${file} lstat`).toBe(before);
}

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
    const before = await mark(path.join(dir, 'a.md'));
    await writeFile(path.join(dir, 'a.md'), 'Second');
    await expectMark(path.join(dir, 'a.md'), before, 'changed');
    expect(await contentFingerprint(dir, [entry('a.md')])).not.toBe(one);
  });

  it('marks a missing file, and hashes a link by its target without following it', async () => {
    const missing = await contentFingerprint(dir, [entry('gone.md')]);
    expect(missing).toMatch(/^[0-9a-f]{64}$/);
    await writeFile(path.join(dir, 'target.md'), 'one');
    await symlink('target.md', path.join(dir, 'link.md'));
    const before = await contentFingerprint(dir, [entry('link.md')]);
    const linkMark = await mark(path.join(dir, 'link.md'));
    await writeFile(path.join(dir, 'target.md'), 'two');
    // The target changed, the link did not: an unchanged fingerprint means it was not followed.
    expect(await readFile(path.join(dir, 'link.md'), 'utf8')).toBe('two');
    await expectMark(path.join(dir, 'link.md'), linkMark, 'same');
    expect(await contentFingerprint(dir, [entry('link.md')])).toBe(before);
  });

  it('fingerprints a file over the size limit by size and time, unread', async () => {
    const big = path.join(dir, 'big.bin');
    await writeFile(big, '');
    await truncate(big, MAX_FINGERPRINT_FILE_BYTES + 1);
    await utimes(big, 1_000, 1_000);
    const one = await contentFingerprint(dir, [entry('big.bin')]);
    const before = await mark(big);
    await utimes(big, 2_000, 2_000);
    await expectMark(big, before, 'changed');
    expect(await contentFingerprint(dir, [entry('big.bin')])).not.toBe(one);
  });

  it('reads a file again only when its lstat changed (review R2)', async () => {
    const f = new Fingerprinter(dir, '', LATER);
    // bug-005: explicit mtimes, so the rewrite below is always visible to lstat (a same-size rewrite
    // inside one mtime tick is, correctly, not seen once the racy rule is disabled by the LATER clock).
    const t0 = 1_700_000_000; // seconds
    await writeFile(path.join(dir, 'c1.md'), 'one');
    await writeFile(path.join(dir, 'c2.md'), 'two');
    await utimes(path.join(dir, 'c1.md'), t0, t0);
    await utimes(path.join(dir, 'c2.md'), t0, t0);
    const entries = [entry('c1.md'), entry('c2.md')];
    const first = await f.fingerprint(entries);
    expect(f.lastReads).toBe(2);
    const c1 = await mark(path.join(dir, 'c1.md'));
    expect(await f.fingerprint(entries)).toBe(first);
    expect(f.lastReads).toBe(0);
    await expectMark(path.join(dir, 'c1.md'), c1, 'same');
    // Same size, later mtime: the change is seen through lstat alone.
    await writeFile(path.join(dir, 'c1.md'), 'ONE');
    await utimes(path.join(dir, 'c1.md'), t0 + 10, t0 + 10);
    await expectMark(path.join(dir, 'c1.md'), c1, 'changed');
    expect(await f.fingerprint(entries)).not.toBe(first);
    expect(f.lastReads).toBe(1);
  });

  it('reads at most the per-check byte budget of new content; the rest by size and time (review R2)', async () => {
    const f = new Fingerprinter(dir, '', LATER);
    const size = 512 * 1024;
    const count = Math.ceil(MAX_FINGERPRINT_BYTES_PER_CHECK / size) + 4;
    await mkdir(path.join(dir, 'budget'));
    const entries = [];
    for (let i = 0; i < count; i += 1) {
      await writeFile(path.join(dir, 'budget', `b${i}.bin`), Buffer.alloc(size, i));
      entries.push(entry(`budget/b${i}.bin`));
    }
    const first = await f.fingerprint(entries);
    expect(f.lastReads).toBe(MAX_FINGERPRINT_BYTES_PER_CHECK / size);
    // Nothing changed: the same fingerprint and nothing read (no entry moves from size+time to SHA).
    expect(await f.fingerprint(entries)).toBe(first);
    expect(f.lastReads).toBe(0);
  });

  it('counts only the entries under the project prefix (review R2)', async () => {
    await mkdir(path.join(dir, 'proj'), { recursive: true });
    await writeFile(path.join(dir, 'proj', 'in.md'), 'in');
    await writeFile(path.join(dir, 'out.md'), 'out');
    const f = new Fingerprinter(dir, 'proj/', LATER);
    const one = await f.fingerprint([entry('proj/in.md'), entry('out.md')]);
    // A change the lstat sees (another size and mtime): an unchanged fingerprint then comes from
    // the prefix, not from a rewrite inside one mtime tick (task-026).
    const out = await mark(path.join(dir, 'out.md'));
    await writeFile(path.join(dir, 'out.md'), 'OUT, changed');
    await utimes(path.join(dir, 'out.md'), 1_700_000_100, 1_700_000_100);
    await expectMark(path.join(dir, 'out.md'), out, 'changed');
    expect(await f.fingerprint([entry('proj/in.md'), entry('out.md')])).toBe(one);
    expect(f.lastReads).toBe(0);
  });

  it('N1 — does not trust a mark taken within the racy window of the file mtime', async () => {
    const file = path.join(dir, 'racy.md');
    await writeFile(file, 'same size A');
    const mtime = 1_700_000_000; // seconds
    await utimes(file, mtime, mtime);
    let now = mtime * 1000 + 1_000; // the mark is taken 1 s after the mtime: racy
    const f = new Fingerprinter(dir, '', { now: () => now });
    const first = await f.fingerprint([entry('racy.md')]);
    expect(f.lastReads).toBe(1);
    // Rewritten with the same size inside the same mtime tick (same size and mtime): must be seen.
    const racy = await lstat(file);
    await writeFile(file, 'same size B');
    await utimes(file, mtime, mtime);
    expect([(await lstat(file)).size, (await lstat(file)).mtimeMs]).toEqual([racy.size, racy.mtimeMs]);
    expect(await readFile(file, 'utf8')).toBe('same size B');
    now = mtime * 1000 + 1_500;
    const second = await f.fingerprint([entry('racy.md')]);
    expect(f.lastReads).toBe(1);
    expect(second).not.toBe(first);
    // Read again while racy; once a mark is taken past the window it is reused.
    now = mtime * 1000 + RACY_WINDOW_MS + 1_000;
    expect(await f.fingerprint([entry('racy.md')])).toBe(second);
    expect(f.lastReads).toBe(1);
    expect(await f.fingerprint([entry('racy.md')])).toBe(second);
    expect(f.lastReads).toBe(0);
    expect(RACY_WINDOW_MS).toBeGreaterThanOrEqual(2_000);
  });

  it('combines with the status hash into 16 hex digits', () => {
    expect(combinedHash('0123456789abcdef', 'f'.repeat(64))).toMatch(/^[0-9a-f]{16}$/);
    expect(combinedHash('0123456789abcdef', 'a')).not.toBe(combinedHash('0123456789abcdef', 'b'));
  });
});

// bug-033 (task-068 AC-5, the approver's Q3-a; spec-001 §4.4 "never followed"): a folder of the
// project replaced by a symbolic link — git then lists the tracked files under it as deleted — is
// never passed through: each such entry is marked by that ancestor, without any read behind it,
// and every ancestor is `lstat`ed at most once per check.
describe('bug-033 — no read through a linked folder of the project', () => {
  /** A repository folder whose `.wingfoil` is a link to a folder outside it, holding `memory.yaml`. */
  async function linkedWingfoil(name: string) {
    const top = path.join(dir, `${name}-top`);
    const out = path.join(dir, `${name}-outside`);
    await mkdir(top, { recursive: true });
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'memory.yaml'), 'version: 1\n');
    await writeFile(path.join(out, 'ui.yaml'), 'version: 1\n');
    await symlink(out, path.join(top, '.wingfoil'));
    const entries = [
      { code: '.D', path: '.wingfoil/memory.yaml' },
      { code: '.D', path: '.wingfoil/ui.yaml' },
      entry('.wingfoil'),
    ];
    return { top, out, entries };
  }

  it('an edit behind a linked .wingfoil does not move the fingerprint, and nothing behind it is read', async () => {
    const { top, out, entries } = await linkedWingfoil('b033-a');
    const f = new Fingerprinter(top, '', LATER);
    const before = await f.fingerprint(entries);
    expect(f.lastReads).toBe(0);
    const outsideMark = await mark(path.join(out, 'memory.yaml'));
    await writeFile(path.join(out, 'memory.yaml'), 'version: 1\n# edited outside the project\n');
    await expectMark(path.join(out, 'memory.yaml'), outsideMark, 'changed');
    // A fresh fingerprinter too: no cached mark hides a read.
    expect(await f.fingerprint(entries)).toBe(before);
    expect(f.lastReads).toBe(0);
    expect(await new Fingerprinter(top, '', LATER).fingerprint(entries)).toBe(before);
  });

  it('a nested folder replaced by a link marks the entries under it by that ancestor, each ancestor lstat-ed once', async () => {
    const top = path.join(dir, 'b033-b-top');
    const out = path.join(dir, 'b033-b-outside');
    await mkdir(path.join(top, 'docs'), { recursive: true });
    await mkdir(path.join(out, 'task'), { recursive: true });
    await writeFile(path.join(out, 'task', 'a.md'), 'A');
    await writeFile(path.join(out, 'task', 'b.md'), 'B');
    await symlink(out, path.join(top, 'docs', 'memory'));
    await writeFile(path.join(top, 'docs', 'real.md'), 'R');
    const entries = [
      { code: '.D', path: 'docs/memory/task/a.md' },
      { code: '.D', path: 'docs/memory/task/b.md' },
      entry('docs/real.md'),
    ];
    const f = new Fingerprinter(top, '', LATER);
    const before = await f.fingerprint(entries);
    // Only docs/real.md is read; the ancestors docs and docs/memory once each (docs/memory/task never).
    expect(f.lastReads).toBe(1);
    expect(f.lastAncestorChecks).toBe(2);
    await writeFile(path.join(out, 'task', 'a.md'), 'A edited');
    expect(await f.fingerprint(entries)).toBe(before);
    // The link itself replaced by a real folder: the entries are seen again (no stale ancestor mark).
    await rm(path.join(top, 'docs', 'memory'));
    await mkdir(path.join(top, 'docs', 'memory', 'task'), { recursive: true });
    await writeFile(path.join(top, 'docs', 'memory', 'task', 'a.md'), 'A');
    expect(await f.fingerprint(entries)).not.toBe(before);
  });
});

describe('Fingerprinter.lastMarks (bug-034, task-075 D75-1)', () => {
  it('one mark per listed entry, as hashed: sha:, missing, link:, stat: past the file limit', async () => {
    const sub = path.join(dir, 'marks');
    await mkdir(sub, { recursive: true });
    await writeFile(path.join(sub, 'a.md'), 'content A\n');
    await symlink('a.md', path.join(sub, 'l.md'));
    await writeFile(path.join(sub, 'big.md'), '');
    await truncate(path.join(sub, 'big.md'), MAX_FINGERPRINT_FILE_BYTES + 1);
    const fp = new Fingerprinter(dir, 'marks/', LATER);
    await fp.fingerprint([
      entry('marks/a.md'),
      entry('marks/gone.md'),
      entry('marks/l.md'),
      entry('marks/big.md'),
      entry('x.md'),
    ]);
    expect(Object.fromEntries(fp.lastMarks)).toEqual({
      'marks/a.md': `sha:${createHash('sha256').update('content A\n').digest('hex')}`,
      'marks/gone.md': 'missing',
      'marks/l.md': 'link:a.md',
      'marks/big.md': expect.stringMatching(/^stat:/),
    });
    await fp.fingerprint([entry('marks/a.md')]);
    expect([...fp.lastMarks.keys()]).toEqual(['marks/a.md']);
  });
});
