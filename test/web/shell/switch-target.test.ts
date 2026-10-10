// Where a switch of project lands (decision W4-5): the same view of the sidebar in the other
// project; anything below a view (an element panel, a document, a directive) and the search
// parameters are dropped (S-16.2); a path that is not a view lands on the project root.
import { expect, it } from 'vitest';
import { switchTarget } from '../../../web/src/shell/switch-target.js';

const VIEWS = ['/p/$pid/memory', '/p/$pid/dna', '/p/$pid/directives', '/p/$pid/team', '/p/$pid/docs'] as const;

it.each([
  ['/p/p_a/memory', '/p/p_b/memory'],
  ['/p/p_a/dna', '/p/p_b/dna'],
  ['/p/p_a/directives/accessibility', '/p/p_b/directives'],
  ['/p/p_a/docs/docs/guide.md', '/p/p_b/docs'],
  ['/p/p_a/e/task-001-login-form', '/p/p_b'],
  ['/p/p_a', '/p/p_b'],
  ['/p/p_a/', '/p/p_b'],
  ['/p/p_a/unknown', '/p/p_b'],
  ['/', '/p/p_b'],
])('%s → %s', (from, to) => {
  expect(switchTarget('p_b', from, VIEWS)).toBe(to);
});

it('encodes the id and never builds a path from anything but the id and a view', () => {
  expect(switchTarget('p b/..', '/p/p_a/memory', VIEWS)).toBe('/p/p%20b%2F../memory');
});
