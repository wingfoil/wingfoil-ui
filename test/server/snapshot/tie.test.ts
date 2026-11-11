// bug-034, task-075 D75-4, D75-5 — the verdict of a per-state read against its state check, row by
// row: a status entry's `sha:` mark, its other marks (no comparable mark: kept, Q1 (a)), a clean
// file's HEAD blob, a file in neither, an unreadable HEAD tree, `ui.yaml`'s mark; and the suspects a
// later check confirms.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { gitBlobId } from '../../../server/src/references/cache.js';
import { mismatches, Suspects, type StateMarks } from '../../../server/src/snapshot/tie.js';

const sha = (text: string) => `sha:${createHash('sha256').update(text).digest('hex')}`;
const A = 'content A\n';
const B = 'content B\n';

function marks(files: Record<string, string>, ui = 'absent'): StateMarks {
  return { files: new Map(Object.entries(files)), ui, seq: 3, events: 0 };
}

const blobs = new Map([['docs/clean.md', gitBlobId(A, 'sha1')]]);

describe('mismatches (D75-4)', () => {
  const rows: [string, Record<string, string>, string, string | undefined, boolean][] = [
    ['a status entry hashing to its sha: mark', { 'docs/x.md': sha(A) }, 'docs/x.md', A, false],
    ['a status entry with other bytes', { 'docs/x.md': sha(A) }, 'docs/x.md', B, true],
    ['a status entry with a sha: mark, now absent', { 'docs/x.md': sha(A) }, 'docs/x.md', undefined, true],
    ['a deleted status entry, still absent', { 'docs/x.md': 'missing' }, 'docs/x.md', undefined, false],
    ['a deleted status entry, now present', { 'docs/x.md': 'missing' }, 'docs/x.md', A, true],
    ['a stat: mark (no comparable mark)', { 'docs/x.md': 'stat:1:2:3' }, 'docs/x.md', B, false],
    ['a link: mark', { 'docs/x.md': 'link:target' }, 'docs/x.md', B, false],
    ['an other: mark', { 'docs/x.md': 'other:1:2:3' }, 'docs/x.md', B, false],
    ['a via: mark', { 'docs/x.md': 'via:docs:1:2:3' }, 'docs/x.md', B, false],
    ['a clean file hashing to its HEAD blob', {}, 'docs/clean.md', A, false],
    ['a clean file with other bytes', {}, 'docs/clean.md', B, true],
    ['a clean file, now absent', {}, 'docs/clean.md', undefined, true],
    ['a file in neither (ignored, outside the listing)', {}, 'docs/ignored.md', B, false],
    ['a file in neither, absent', {}, 'docs/ignored.md', undefined, false],
  ];
  for (const [title, files, file, text, mismatch] of rows) {
    it(title, () => {
      const found = mismatches([{ path: file, text }], [], marks(files), blobs, 'sha1');
      expect(found.length > 0).toBe(mismatch);
      if (mismatch) expect(found[0]).toMatchObject({ path: file });
    });
  }

  it('an unreadable HEAD tree: a clean file has no comparable mark', () => {
    expect(mismatches([{ path: 'docs/clean.md', text: B }], [], marks({}), undefined, 'sha1')).toEqual([]);
  });

  it("`ui.yaml`'s mark against the check's", () => {
    expect(mismatches([], [sha(A)], marks({}, sha(A)), blobs, 'sha1')).toEqual([]);
    expect(mismatches([], ['absent'], marks({}, sha(A)), blobs, 'sha1')).toEqual([
      { path: '.wingfoil/ui.yaml', observed: 'absent', expected: sha(A) },
    ]);
  });

  it('a SHA-256 repository compares sha256 blob ids', () => {
    const wide = new Map([['docs/clean.md', gitBlobId(A, 'sha256')]]);
    expect(mismatches([{ path: 'docs/clean.md', text: A }], [], marks({}), wide, 'sha256')).toEqual([]);
  });
});

describe('Suspects (D75-5)', () => {
  const m = { path: 'docs/clean.md', observed: 'blob:b', expected: 'blob:a' };

  it('accepts a recorded mismatch only under a state whose check started after it', () => {
    const suspects = new Suspects();
    expect(suspects.accepts(m, 5)).toBe(false);
    suspects.record(m, 4);
    expect(suspects.accepts(m, 4)).toBe(false);
    expect(suspects.accepts(m, 5)).toBe(true);
    expect(suspects.accepts({ ...m, observed: 'blob:c' }, 5)).toBe(false);
    expect(suspects.accepts({ ...m, expected: 'blob:z' }, 5)).toBe(false);
  });

  it('keeps one suspect per path, at most 1 000', () => {
    const suspects = new Suspects();
    for (let i = 0; i < 1_001; i += 1) suspects.record({ ...m, path: `f${i}` }, 1);
    expect(suspects.size).toBe(1_000);
    expect(suspects.accepts({ ...m, path: 'f0' }, 2)).toBe(false);
    expect(suspects.accepts({ ...m, path: 'f1000' }, 2)).toBe(true);
  });
});
