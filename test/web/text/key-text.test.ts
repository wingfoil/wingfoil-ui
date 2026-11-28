// task-085 AC-1 (D85-2) — `keyText`: the one escape of a repository key where the page renders it,
// the rule of the server's `neutralise` (bug-041), so the two cannot drift.
import { expect, it } from 'vitest';
import { neutralise } from '../../../server/src/git/redact.js';
import { keyText } from '../../../web/src/text/key-text.js';

const CORPUS = [
  'task-001-plain',
  'in-progress',
  'a\x1bb',
  'a\u202eb',
  'a\u200bb',
  'a\ufeffb',
  'a\u0000b',
  'a\u007fb',
  'a\u2028b\u2029c',
  'lone\ud800surrogate',
  'astral\u{e0001}tag',
  'back\\slash',
  'cr\r\nlf',
  'tab\tand\nnewline',
  '',
];

it('leaves plain keys unchanged (AC-2)', () => {
  for (const k of ['task-085-x', 'sprint-002', 'in-progress', 'docs/04_memory/v0.3.1/task-085.md', 'v0.3.1', 'a b']) {
    expect(keyText(k)).toBe(k);
  }
});

it('writes control, bidi and format characters as visible escapes', () => {
  expect(keyText('a\u202eb')).toBe('a\\u202eb');
  expect(keyText('a\x1bb')).toBe('a\\x1bb');
  expect(keyText('a\u200bb')).toBe('a\\u200bb');
  expect(keyText('x\u{e0001}')).toBe('x\\u{e0001}');
  expect(keyText('a\\b')).toBe('a\\\\b');
});

it('agrees with the server rule on the corpus (parity)', () => {
  for (const k of CORPUS) expect(keyText(k), JSON.stringify(k)).toBe(neutralise(k));
});

it('grows linearly with the number of unsafe characters', () => {
  const one = keyText('\u202e'.repeat(1000));
  const two = keyText('\u202e'.repeat(2000));
  expect(two.length).toBe(one.length * 2);
});
