// bug-032, task-055 AC-10 (spec-001 §4.2, amended 2026-11-06, Q3-a) — the shared frontmatter parse
// is linear in its size: the YAML library's own duplicate-key check (`uniqueKeys`, quadratic: 1 MiB
// of keys took about 99 s, task-055 P4b) is off, and the reader's own check (one map of keys per
// mapping) still refuses a duplicate key with its line. Structural, not a wall-clock bound (bug-004).
// bug-037, task-075 AC-2 (D75-9): keys are compared as the pinned CLI's js-yaml 4.3.2 stores them —
// `String()` of their default-schema value — so the files the CLI leaves out as a "duplicated mapping
// key" are refused here, and a pair it accepts is read; the differential table is `yaml-keys.test.ts`.
import { Alias, parseDocument, type YAMLMap } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { FRONTMATTER_PARSE_OPTIONS, parseYaml } from '../../../server/src/reads/frontmatter.js';
import { jsYamlKey, keyContext } from '../../../server/src/reads/yaml-keys.js';

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
    // Keys as WingFoil's js-yaml stores them (bug-037): a quoted and a plain key of one text.
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

describe('parseYaml keys as js-yaml stores them (bug-037, task-075 AC-2)', () => {
  const refused: [string, string, number, number?][] = [
    ['1: a\n"1": b\n', '"1"', 2],
    ['true: a\n"true": b\n', '"true"', 2],
    ['~: a\n"null": b\n', '"null"', 2],
    ['.inf: a\n"Infinity": b\n', '"Infinity"', 2],
    ['2026-01-01: a\n2026-01-01T00:00:00Z: b\n', '2026-01-01T00:00:00Z', 2],
    ['x0: &k x1\nx1: a\n*k : b\n', '*k', 3],
    ['? [a, b]\n: a\n? [a, b]\n: b\n', '[a, b]', 3, 3],
    ['"<<": a\n"<<": b\n', '"<<"', 2],
  ];
  for (const [text, key, line, column = 1] of refused) {
    it(`AC-2 refused as a duplicate with its line: ${JSON.stringify(text)}`, () => {
      const escaped = key.replace(/[[\]*.]/g, (c) => `\\${c}`);
      expect(() => parseYaml(text, 'f.md')).toThrow(
        new RegExp(`^f\\.md: invalid YAML \\(duplicate key ${escaped} \\(line ${line}, column ${column}\\)\\)$`),
      );
    });
  }

  it('AC-2 `2026-01-01:` with `"2026-01-01":` is read (js-yaml makes the first a date)', () => {
    expect(parseYaml('2026-01-01: a\n"2026-01-01": b\n', 'f.md')).toEqual({ '2026-01-01': 'b' });
  });

  it('a merge key is no key of its own; the explicit keys after it are compared', () => {
    expect(() => parseYaml('b: &b {x: 1}\nm:\n  <<: *b\n  <<: *b\n', 'f.md')).not.toThrow();
    expect(() => parseYaml('b: &b {x: 1}\nm:\n  <<: *b\n  x: 2\n  x: 3\n', 'f.md')).toThrow(/duplicate key x \(line 5/);
  });

  it('a nested sequence key and a key with a tag js-yaml does not resolve are refused', () => {
    expect(() => parseYaml('? [[a]]\n: x\n', 'f.md')).toThrow(
      /^f\.md: invalid YAML \(unsupported key \[\[a\]\] \(line 1, column 3\)\)$/,
    );
    expect(() => parseYaml('!!binary aGk=: x\n', 'f.md')).toThrow(/unsupported key aGk= \(line 1, column 10\)/);
  });

  it('thousands of distinct number and date keys parse in one pass', () => {
    let text = '';
    const two = (n: number) => String(n).padStart(2, '0');
    // 1 000 integer keys and 1 000 distinct date-time keys (one per minute from 2026-01-01T00:00Z).
    for (let i = 0; i < 1_000; i += 1) text += `${i}: v\n2026-01-01T${two(Math.floor(i / 60))}:${two(i % 60)}:00Z: v\n`;
    expect(Object.keys(parseYaml(text, 'f.md') as object)).toHaveLength(2_000);
  });
});

describe('jsYamlKey (bug-037 with bug-032)', () => {
  it("an aliased sequence's form is computed once per parse, however many aliases name it", () => {
    const items = Array.from({ length: 2_000 }, (_, i) => `i${i}`).join(', ');
    const text = `a: &s [${items}]\n${Array.from({ length: 500 }, (_, i) => `m${i}:\n  ? *s\n  : x\n`).join('')}`;
    const doc = parseDocument(text, FRONTMATTER_PARSE_OPTIONS);
    const context = keyContext(doc);
    const seq = (doc.contents as YAMLMap).items[0]!.value;
    const join = vi.spyOn(Array.prototype, 'join');
    try {
      for (const pair of (doc.contents as YAMLMap).items.slice(1)) {
        const inner = (pair.value as YAMLMap).items[0]!.key;
        expect(jsYamlKey(inner, context)).toHaveLength(items.replace(/ /g, '').length);
      }
      expect(join.mock.calls.filter((c) => c[0] === ',')).toHaveLength(1);
    } finally {
      join.mockRestore();
    }
    expect([...context.forms.keys()]).toEqual([seq]);
  });
});

describe('alias keys resolved in one pass (task-075 review round 1 F-1)', () => {
  /** A frontmatter with one anchor and a sequence key of `n` aliases of it. */
  const aliases = (n: number) => `z: &a v\n? [${Array.from({ length: n }, () => '*a').join(', ')}]\n: 1\n`;
  /** `n` anchors and `n` distinct alias keys. */
  const distinct = (n: number) =>
    Array.from({ length: n }, (_, i) => `a${i}: &a${i} v${i}\n`).join('') +
    Array.from({ length: n }, (_, i) => `*a${i} : ${i}\n`).join('');

  it('the key check resolves no alias by walking the document, for N and 2N aliases', () => {
    // `Alias.resolve(doc)` without the library's context walks the whole document (the check's
    // former call); the library's own `toJS` passes its context, which caches that walk.
    const resolve = Alias.prototype.resolve;
    let walks = 0;
    Alias.prototype.resolve = function (this: Alias, ...args: Parameters<Alias['resolve']>) {
      if (args[1] === undefined) walks += 1;
      return resolve.apply(this, args);
    };
    try {
      for (const n of [500, 1_000]) {
        // The library's own alias limit refuses it after the key check, as before this task.
        expect(() => parseYaml(aliases(n), 'f.md')).toThrow(/Excessive alias count/);
        expect(() => parseYaml(distinct(n), 'f.md')).not.toThrow();
      }
    } finally {
      Alias.prototype.resolve = resolve;
    }
    expect(walks).toBe(0);
  });

  it('the key forms of 4N alias keys cost about four times those of N (review round 2 F-9)', () => {
    // The check's own work only: the documents are parsed outside the clock (the library's own
    // `toJS` is not measured here). Median of five; a quadratic cost would give about 16×.
    const time = (n: number): number => {
      const doc = parseDocument(distinct(n), FRONTMATTER_PARSE_OPTIONS);
      const runs: number[] = [];
      for (let r = 0; r < 5; r += 1) {
        const started = performance.now();
        const context = keyContext(doc);
        for (const pair of (doc.contents as YAMLMap).items) jsYamlKey(pair.key, context);
        runs.push(performance.now() - started);
      }
      return runs.sort((x, y) => x - y)[2]!;
    };
    time(2_000); // warm-up
    const ratio = time(16_000) / time(4_000);
    expect(ratio).toBeLessThan(8);
  });

  it('a 64 KiB frontmatter of 16 000 aliases is answered within 5 s (53 s before the fix)', () => {
    const text = aliases(16_000);
    expect(text.length).toBeLessThanOrEqual(64 * 1024);
    const started = performance.now();
    expect(() => parseYaml(text, 'f.md')).toThrow(/Excessive alias count/);
    expect(performance.now() - started).toBeLessThan(5_000);
  }, 120_000);
});

describe('parseYaml an empty key (bug-040, task-075 AC-4)', () => {
  it('AC-4 an implicit empty key of a block mapping is refused with its line, as js-yaml refuses it', () => {
    expect(() => parseYaml(': a\nb: c\n', 'f.md')).toThrow(/^f\.md: invalid YAML \(empty key \(line 1, column 1\)\)$/);
    expect(() => parseYaml('x:\n  : a\n', 'f.md')).toThrow(/empty key \(line 2, column 3\)/);
    expect(() => parseYaml('- : a\n', 'f.md')).toThrow(/empty key/);
  });

  it('AC-4 an explicit, tagged, anchored or flow empty key is read, as js-yaml reads it', () => {
    for (const text of ['? \n: a\n', '!!null : a\n', '&x : a\n', 'x: {: a}\n', 'x: [: a]\n']) {
      expect(() => parseYaml(text, 'f.md'), text).not.toThrow();
    }
  });
});
