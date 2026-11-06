/**
 * The index's read of one element file (spec-001 §4.2 bulk reader, task-055 D55-5, bug-032): at
 * the path `memory search` returned, confined to the project ({@link readConfined}); a frontmatter
 * above {@link MAX_INDEX_FRONTMATTER} bytes is a `shape` error, never parsed; the parse and the
 * `id`/`type`/`status` check of the element read; the values only (the body is dropped).
 */
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import { DirectReadError, nodeReadFs, readConfined, type ReadFs } from '../reads/confine.js';
import { checkMatch, parseElement } from '../reads/element.js';
import type { IndexRead } from './cache.js';
import { MAX_INDEX_FRONTMATTER } from './index.js';
import { extractValues } from './values.js';

/** The bytes between the two `---` lines of `text` (LF or CRLF), or `undefined` with none closed. */
function frontmatterBytes(text: string): number | undefined {
  const open = /^---\r?\n/.exec(text);
  if (!open) return undefined;
  const close = /^---[ \t]*\r?$/m.exec(text.slice(open[0].length));
  return close ? Buffer.byteLength(text.slice(open[0].length, open[0].length + close.index)) : undefined;
}

/** Read `match`'s file for the index: its text (for the blob check) and its values. */
export async function readIndexEntry(root: string, match: MemoryMatch, fs: ReadFs = nodeReadFs): Promise<IndexRead> {
  const text = await readConfined(root, root, match.path, fs);
  const bytes = frontmatterBytes(text);
  if (bytes !== undefined && bytes > MAX_INDEX_FRONTMATTER) {
    throw new DirectReadError(
      'shape',
      match.path,
      `${match.path}: frontmatter too large for the index (over ${MAX_INDEX_FRONTMATTER} bytes)`,
    );
  }
  const parsed = parseElement(text, match.path);
  checkMatch(parsed.frontmatter, match);
  return { text, values: extractValues(parsed.frontmatter as unknown as Record<string, unknown>) };
}
