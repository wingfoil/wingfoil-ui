// task-078 security review round 2, R2-1: the comment rules of an element's document take time
// linear in the body, like markdown-it itself — a committed body (up to 5 MiB) must not freeze the
// tab. Each input renders with the comment rules within 5 × plain markdown-it on the same input plus
// a constant; the inputs are bounded (100 KB, one of 1 MB).
import { describe, expect, it } from 'vitest';
import { commentFreeMarkdown, plainMarkdown } from '../../../web/src/docs/render.js';

/** The shortest of `runs` timings of `render(source)`, in ms. */
function best(render: (s: string) => string, source: string, runs: number): number {
  let shortest = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    render(source);
    shortest = Math.min(shortest, performance.now() - start);
  }
  return shortest;
}

/** Whether the comment rules render `source` within the budget (one retry against CI noise). */
function withinBudget(source: string): { comments: number; plain: number } {
  const plain = best((s) => plainMarkdown.render(s), source, 3);
  const budget = 5 * plain + 250;
  let comments = best((s) => commentFreeMarkdown.render(s), source, 1);
  if (comments > budget) comments = best((s) => commentFreeMarkdown.render(s), source, 1);
  return { comments: comments <= budget ? 0 : comments, plain };
}

describe('the comment rules are linear (review round 2, R2-1)', () => {
  it.each([
    ['unclosed openers on lines, closed at the end with text', 'x\n' + '<!--\n'.repeat(20000) + '--> tail\n'],
    ['unclosed openers inside a link label', '[' + '<!-- '.repeat(20000) + ']'],
    ['unclosed inline openers', 'x ' + '<!--'.repeat(20000)],
    ['many closed inline comments', 'x ' + '<!---->'.repeat(20000)],
    // Review round 3, R3-1: an unclosed comment in each list item ends with its item. (A quote whose
    // comment is followed by a lazy line costs what markdown-it 15.0.2 costs for any non-paragraph
    // block there — `> # h\nlazy` repeated is quadratic in plain markdown-it too: not this rule's.)
    ['unclosed openers in list items', '- <!--\n'.repeat(20000)],
  ])('%s (100 KB)', (_name, source) => {
    expect(withinBudget(source).comments).toBe(0);
  }, 60_000);

  it('a 1 MB body of single-line comments with text and unclosed openers', () => {
    const source = ('Line <!-- a --> text <!-- open\n<!-- b --> tail\n').repeat(22000);
    expect(source.length).toBeGreaterThan(1_000_000);
    expect(withinBudget(source).comments).toBe(0);
  }, 60_000);
});
