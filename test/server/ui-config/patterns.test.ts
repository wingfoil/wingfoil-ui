// spec-005 §1 (amended 2026-11-05, task-054 Q1 (a)), AC-2 — the safe subset of
// `taxonomy.patterns[].match`: one case per reason, in the spec's order, the admitted shapes at
// their bounds, and the cost bound (10 ms on a 256-character value built to backtrack).
import { describe, expect, it } from 'vitest';
import { MAX_ALTERNATIVES, MAX_PATTERN_VALUE, patternProblem } from '../../../server/src/ui-config/patterns.js';

describe('patternProblem — accepted', () => {
  it.each([
    ['^(REQ|US)-'],
    ['^(P\\d|Journey)'],
    ['^(minor|patch)-v|^rl-'],
    ['^a*b+'],
    ['^.{0,100}x'],
    ['^a{3}'],
    ['^a{2,}'],
    ['^a*?b'],
    ['^\\p{L}*\\p{N}'],
    ['^\\u{1F600}{2}'],
    ['^[|(){}*+?]x'],
    ['^[\\]a-z]*'],
    ['^(?<name>ab)c'],
    ['^(?:a|b|c|d)(?:e|f|g|h)'],
    ['^x|^y|^z'],
    ['^\\(a\\)\\*'],
    ['^\\d\\.\\d'],
    ['^\\0'],
  ])('%s', (src) => {
    expect(patternProblem(src)).toBeUndefined();
  });
});

describe('patternProblem — one case per reason', () => {
  it.each([
    ['^(', 'does not compile: '],
    ['^a{2,1}', 'does not compile: '],
    ['^(?<n>a)\\k<m>', 'does not compile: '],
    ['REQ-', 'must start with ^'],
    ['^REQ-|US-', 'must start with ^'],
    ['^a|', 'must start with ^'],
    ['(^a)', 'must start with ^'],
    ['^(a)\\1', 'backreferences are not allowed'],
    ['^(?<n>a)\\k<n>', 'backreferences are not allowed'],
    ['^a(?=b)', 'lookaround is not allowed'],
    ['^a(?!b)', 'lookaround is not allowed'],
    ['^(?<=a)b', 'lookaround is not allowed'],
    ['^(?<!a)b', 'lookaround is not allowed'],
    ['^a*b*c*', 'at most 2 quantifiers'],
    ['^a?b+c{2}', 'at most 2 quantifiers'],
    ['^(ab)*', 'a quantifier on a group is not allowed'],
    ['^(?:a|b)+', 'a quantifier on a group is not allowed'],
    ['^(?<g>a){2}', 'a quantifier on a group is not allowed'],
    ['^a{0,101}', '{n,m} above 100'],
    ['^(?:a|b|c|d|e)(?:f|g|h|i)', 'at most 16 alternatives combined'],
    ['^' + '(?:a|a)'.repeat(5), 'at most 16 alternatives combined'],
    ['^(?:a|(?:b|c|d|e|f))(?:g|h|i)', 'at most 16 alternatives combined'],
  ])('%s → %s', (src, reason) => {
    const problem = patternProblem(src);
    expect(problem).toBeDefined();
    if (reason.endsWith(': ')) expect(problem!.startsWith(reason)).toBe(true);
    else expect(problem).toBe(reason);
  });

  it('checks in the spec order: compile, ^, backreference, lookaround, count, group, bound, alternatives', () => {
    // Several problems at once: the first in the order is reported.
    expect(patternProblem('a(b)\\1(?=c)')).toBe('must start with ^');
    expect(patternProblem('^(b)\\1(?=c)')).toBe('backreferences are not allowed');
    expect(patternProblem('^b(?=c)a*b*c*')).toBe('lookaround is not allowed');
    expect(patternProblem('^(a)*b*c*')).toBe('at most 2 quantifiers');
    expect(patternProblem('^(a)*b{0,200}')).toBe('a quantifier on a group is not allowed');
    expect(patternProblem('^a{0,200}' + '(?:a|a)'.repeat(5))).toBe('{n,m} above 100');
  });

  it('exports the bounds', () => {
    expect(MAX_PATTERN_VALUE).toBe(256);
    expect(MAX_ALTERNATIVES).toBe(16);
  });
});

describe('the cost bound (spec-005 §6)', () => {
  // The slowest admitted shapes of the task-054 design probes P3 and P3c.
  it.each([
    ['^.*.*X'],
    ['^[a-z]*[a-z]*!'],
    ['^.{0,100}.{0,100}X'],
    ['^(?:a|a|a|a|a|a|a|a|a|a|a|a|a|a|a|a).*.*X'],
    ['^(?:a|a|a|a)(?:a|a|a|a).*.*X'],
    ['^(?:|a|aa|aaa)(?:|a|aa|aaa)a*a*X'],
  ])('%s answers within 10 ms on 256 characters', (src) => {
    expect(patternProblem(src)).toBeUndefined();
    const re = new RegExp(src, 'u');
    const value = 'a'.repeat(MAX_PATTERN_VALUE);
    re.test(value); // warm-up (compilation)
    const runs = 20;
    const start = performance.now();
    for (let i = 0; i < runs; i++) expect(re.test(value)).toBe(false);
    expect((performance.now() - start) / runs).toBeLessThan(10);
  });
});
