// bug-032, task-055 AC-10 (spec-001 §4.2, amended 2026-11-06, Q3-a) — the shared frontmatter parse
// is linear in its size: the YAML library's own duplicate-key check (`uniqueKeys`, quadratic: 1 MiB
// of keys took about 99 s, task-055 P4b) is off, and the reader's own check (one map of keys per
// mapping) still refuses a duplicate key with its line. Structural, not a wall-clock bound (bug-004).
import { describe, expect, it } from 'vitest';
import { FRONTMATTER_PARSE_OPTIONS, parseYaml } from '../../../server/src/reads/frontmatter.js';

describe('parseYaml (bug-032)', () => {
  it("the library's duplicate-key check is off; merge keys resolved as before", () => {
    expect(FRONTMATTER_PARSE_OPTIONS).toMatchObject({ schema: 'core', merge: true, uniqueKeys: false });
    expect(parseYaml('base: &b {x: 1}\nm:\n  <<: *b\n  y: 2\n', 'f.md')).toEqual({ base: { x: 1 }, m: { x: 1, y: 2 } });
  });

  it('still refuses a duplicate key (top level and nested), naming the key and its line', () => {
    expect(() => parseYaml('a: 1\nb: 2\na: 3\n', 'f.md')).toThrow(
      /f\.md: invalid YAML \(duplicate key a \(line 3, column 1\)\)/,
    );
    expect(() => parseYaml('m:\n  x: 1\n  x: 2\n', 'f.md')).toThrow(/duplicate key x \(line 3, column 3\)/);
    // Keys as the library compares them: the parsed scalar values.
    expect(() => parseYaml('1: a\n"1": b\n', 'f.md')).not.toThrow();
    expect(() => parseYaml('"a": 1\na: 2\n', 'f.md')).toThrow(/duplicate key a/);
  });

  it('a merge key and an explicit key of the same name are no duplicate (the explicit key wins)', () => {
    expect(parseYaml('b: &b {x: 1}\nm:\n  <<: *b\n  x: 2\n', 'f.md')).toEqual({ b: { x: 1 }, m: { x: 2 } });
  });

  it('other YAML errors keep their text; dates stay strings (core schema)', () => {
    expect(() => parseYaml('a: [1\n', 'f.md')).toThrow(/^f\.md: invalid YAML \(/);
    expect(parseYaml('d: 2026-11-05\n', 'f.md')).toEqual({ d: '2026-11-05' });
  });

  it('thousands of distinct keys parse (no quadratic check on the way)', () => {
    let text = '';
    for (let i = 0; i < 20_000; i += 1) text += `k${i}: v${i}\n`;
    expect(Object.keys(parseYaml(text, 'f.md') as object)).toHaveLength(20_000);
  });
});
