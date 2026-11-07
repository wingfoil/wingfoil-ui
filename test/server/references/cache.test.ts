// spec-012 §8 (reuse across states, a contract), task-055 AC-3, D55-6 — the values of an element
// file kept per (path, blob id): reused only when the file is not in the state's working-tree status
// and its blob at HEAD is the kept one; stored only when the file is clean and the bytes read hash to
// the blob at HEAD; entries of paths no longer listed dropped; no reuse and no store without the
// HEAD listing.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { gitBlobId, ReferenceValueCache, type IndexRead } from '../../../server/src/references/cache.js';

const m = (id: string, status = 'draft'): MemoryMatch => ({
  id,
  type: 'task',
  status,
  title: id,
  path: `m/${id}.md`,
  tags: [],
});

const text = (ref: string) => `---\nid: a\nref: ${ref}\n---\n`;

/** A reader of a working tree held in a map; counts reads. */
function tree(files: Record<string, string>) {
  const reads: string[] = [];
  return {
    files,
    reads,
    read(match: MemoryMatch): Promise<IndexRead> {
      reads.push(match.path);
      const t = files[match.path]!;
      return Promise.resolve({ text: t, values: { values: [/ref: (.*)/.exec(t)![1]!], capped: false } });
    },
  };
}

describe('gitBlobId', () => {
  it("is git's own blob id (SHA-1 and SHA-256 object formats)", () => {
    const t = text('US-1');
    const sha1 = execFileSync('git', ['hash-object', '--stdin'], { input: t }).toString().trim();
    expect(gitBlobId(t, 'sha1')).toBe(sha1);
    const bytes = Buffer.from(t);
    const sha256 = createHash('sha256')
      .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
      .digest('hex');
    expect(gitBlobId(t, 'sha256')).toBe(sha256);
    // Bytes, not UTF-16 units.
    expect(gitBlobId('é', 'sha1')).toBe(
      execFileSync('git', ['hash-object', '--stdin'], { input: 'é' }).toString().trim(),
    );
  });
});

describe('ReferenceValueCache (spec-012 §8)', () => {
  const committed = text('US-1');
  const blob = gitBlobId(committed, 'sha1');
  const a = m('a');

  it('AC-3 red first: edit, read, revert, read → the committed values, not the edited ones', async () => {
    const cache = new ReferenceValueCache();
    const wt = tree({ 'm/a.md': committed });
    const state = (changed: string[]) =>
      cache.source({
        blobs: new Map([['m/a.md', blob]]),
        changed: new Set(changed),
        format: 'sha1',
        read: (x) => wt.read(x),
      });
    // State 1, clean: read and stored.
    expect((await state([]).values(a)).values).toEqual(['US-1']);
    // State 2, edited (in the status): read, served, never stored.
    wt.files['m/a.md'] = text('US-2');
    expect((await state(['m/a.md']).values(a)).values).toEqual(['US-2']);
    // State 3, reverted (clean again, same blob): the committed values, from the cache.
    wt.files['m/a.md'] = committed;
    const before = wt.reads.length;
    expect((await state([]).values(a)).values).toEqual(['US-1']);
    expect(wt.reads.length).toBe(before);
  });

  it('a file the status does not list but whose bytes differ from HEAD (assume-unchanged, a filter) is never stored', async () => {
    const cache = new ReferenceValueCache();
    const wt = tree({ 'm/a.md': text('US-9') }); // hidden edit: not in the status
    const source = () =>
      cache.source({ blobs: new Map([['m/a.md', blob]]), changed: new Set(), format: 'sha1', read: (x) => wt.read(x) });
    expect((await source().values(a)).values).toEqual(['US-9']);
    wt.files['m/a.md'] = committed;
    // Not stored under the committed blob: read again, the committed values.
    expect((await source().values(a)).values).toEqual(['US-1']);
    expect(wt.reads).toHaveLength(2);
  });

  it('a commit touching one element re-reads that file only', async () => {
    const cache = new ReferenceValueCache();
    const files = { 'm/a.md': text('US-1'), 'm/b.md': text('US-2'), 'm/c.md': text('US-3') };
    const wt = tree({ ...files });
    const blobs = () => new Map(Object.entries(wt.files).map(([p, t]) => [p, gitBlobId(t, 'sha1')]));
    const all = [m('a'), m('b'), m('c')];
    const read = async () => {
      const source = cache.source({ blobs: blobs(), changed: new Set(), format: 'sha1', read: (x) => wt.read(x) });
      return Promise.all(all.map((x) => source.values(x)));
    };
    await read();
    expect(wt.reads).toHaveLength(3);
    wt.files['m/b.md'] = text('US-22'); // committed: a new blob at HEAD, clean
    expect((await read()).map((v) => v.values[0])).toEqual(['US-1', 'US-22', 'US-3']);
    expect(wt.reads).toEqual(['m/a.md', 'm/b.md', 'm/c.md', 'm/b.md']);
  });

  it('reads again when the listed match disagrees with the kept entry (id, type, status)', async () => {
    const cache = new ReferenceValueCache();
    const wt = tree({ 'm/a.md': committed });
    const source = () =>
      cache.source({ blobs: new Map([['m/a.md', blob]]), changed: new Set(), format: 'sha1', read: (x) => wt.read(x) });
    await source().values(a);
    await source().values(m('a', 'pending'));
    expect(wt.reads).toHaveLength(2);
  });

  it('drops the entries of paths no longer listed', async () => {
    const cache = new ReferenceValueCache();
    const wt = tree({ 'm/a.md': committed });
    const source = () =>
      cache.source({ blobs: new Map([['m/a.md', blob]]), changed: new Set(), format: 'sha1', read: (x) => wt.read(x) });
    await source().values(a);
    expect(cache.size).toBe(1);
    cache.prune(new Set(['m/other.md']));
    expect(cache.size).toBe(0);
    await source().values(a);
    expect(wt.reads).toHaveLength(2);
  });

  it('without the HEAD listing (unborn HEAD, a failed ls-tree): no reuse and no store', async () => {
    const cache = new ReferenceValueCache();
    const wt = tree({ 'm/a.md': committed });
    const source = () =>
      cache.source({ blobs: undefined, changed: new Set(), format: 'sha1', read: (x) => wt.read(x) });
    await source().values(a);
    await source().values(a);
    expect(wt.reads).toHaveLength(2);
    expect(cache.size).toBe(0);
  });

  it('a read error is not kept: the next state reads again', async () => {
    const cache = new ReferenceValueCache();
    let fail = true;
    const source = () =>
      cache.source({
        blobs: new Map([['m/a.md', blob]]),
        changed: new Set(),
        format: 'sha1',
        read: () =>
          fail
            ? Promise.reject(new Error('x'))
            : Promise.resolve({ text: committed, values: { values: ['US-1'], capped: false } }),
      });
    await expect(source().values(a)).rejects.toThrow('x');
    fail = false;
    expect((await source().values(a)).values).toEqual(['US-1']);
  });
});
