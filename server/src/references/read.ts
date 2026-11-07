/**
 * The index's read of one element file (spec-001 §4.2 bulk reader, task-055 D55-5, bug-032): at
 * the path `memory search` returned, confined to the project ({@link readConfined}); a frontmatter
 * above {@link MAX_INDEX_FRONTMATTER} bytes — measured on the text the parse reads, with the
 * parse's own delimiters — is a `shape` error, never parsed; the parse and the
 * `id`/`type`/`status` check of the element read; the values only (the body is dropped).
 */
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import { nodeReadFs, readConfined, type ReadFs } from '../reads/confine.js';
import { checkMatch, parseElement } from '../reads/element.js';
import type { IndexRead } from './cache.js';
import { MAX_INDEX_FRONTMATTER } from './index.js';
import { extractValues } from './values.js';

/** Read `match`'s file for the index: its text (for the blob check) and its values. */
export async function readIndexEntry(root: string, match: MemoryMatch, fs: ReadFs = nodeReadFs): Promise<IndexRead> {
  const text = await readConfined(root, root, match.path, fs);
  // The bound on exactly the text the parse reads: one delimiter rule (review round 1 F1).
  const parsed = parseElement(text, match.path, { maxBytes: MAX_INDEX_FRONTMATTER });
  checkMatch(parsed.frontmatter, match);
  return { text, values: extractValues(parsed.frontmatter as unknown as Record<string, unknown>) };
}
