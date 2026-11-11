// bug-037, task-075 AC-2 (D75-9, D75-10) — the differential table: every row is a mapping of two (or
// three) keys run through the server's parse (`parseYaml`) and through `js-yaml` 4.3.2's `load` with
// its default schema, the loader of the pinned `wingfoil@0.3.1` (`dist/validation/yaml.js`). A row
// passes when both refuse it for its keys (js-yaml: "duplicated mapping key", "nested arrays are not
// supported inside keys", a tag it does not accept on a key, an implicit empty key; the server: a
// `duplicate key`, `unsupported key` or `empty key`) or both read it.
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseYaml } from '../../../server/src/reads/frontmatter.js';

/** Two-key rows `[first, second]`: each a key spelling, the value added here. */
const PAIRS: readonly [string, string][] = [
  // AC-2 and task-059's probe P6.
  ['1', '"1"'],
  ['true', '"true"'],
  ['~', '"null"'],
  ['.inf', '"Infinity"'],
  ['2026-01-01', '2026-01-01T00:00:00Z'],
  ['2026-01-01', '"2026-01-01"'],
  ['? [a, b]\n', '? [a, b]\n'],
  ['? [a, b]\n', '"a,b"'],
  ['? {a: 1}\n', '"[object Object]"'],
  ['? {a: 1}\n', '? {b: 2}\n'],
  // The design's probe P3.
  ['1.0', '1'],
  ['0x1', '1'],
  ['07', '7'],
  ['0o7', '7'],
  ['-0', '0'],
  ['+1', '1'],
  ['1_0', '10'],
  ['0b11', '3'],
  ['1e2', '100'],
  ['.NaN', '"NaN"'],
  ['True', 'true'],
  ['yes', '"yes"'],
  ['Null', '~'],
  ['2026-02-30', '2026-03-02'],
  ['"<<"', '"<<"'],
  ['? [~, a]\n', '",a"'],
  ['!!str 1', '"1"'],
  ['!!int "1"', '1'],
  ['12345678901234567890', '"12345678901234567000"'],
  ['0.1', '.1'],
  ['1.', '1'],
  ['? |\n  a\n', '"a\\n"'],
  ['! 1', '1'],
  ['1:30', '90'],
  ['0x_1', '1'],
  ['-.inf', '"-Infinity"'],
  ['FALSE', 'false'],
  // Each resolver's edges.
  ['NULL', 'null'],
  ['nULL', '"null"'],
  ['TRUE', '"true"'],
  ['tRUE', 'true'],
  ['off', '"off"'],
  ['0', '"0"'],
  ['-1', '"-1"'],
  ['+0', '0'],
  ['00', '0'],
  ['0b', '"0b"'],
  ['0x', '"0x"'],
  ['0xFF', '255'],
  ['0xff', '0xFF'],
  ['-0x10', '-16'],
  ['0o17', '15'],
  ['0o8', '"0o8"'],
  ['0b102', '"0b102"'],
  ['9007199254740993', '9007199254740992'],
  ['1.5', '"1.5"'],
  ['1.50', '1.5'],
  ['-1.5e+3', '-1500'],
  ['1E3', '1000'],
  ['1e', '"1e"'],
  ['1_0.5', '"10.5"'],
  ['.5', '0.5'],
  ['-.5', '-0.5'],
  ['+.inf', '.inf'],
  ['.Inf', '.INF'],
  ['.nan', '.NAN'],
  ['-.nan', '.nan'],
  ['-0.0', '0'],
  ['1e400', '.inf'],
  ['2026-1-1', '2026-01-01'],
  ['2026-01-01 00:00:00', '2026-01-01'],
  ['2026-01-01t00:00:00z', '2026-01-01'],
  ['2026-01-01T01:00:00+01:00', '2026-01-01'],
  ['2026-01-01T01:00:00+01', '2026-01-01'],
  ['2026-01-01T00:00:00.5Z', '2026-01-01T00:00:00.500Z'],
  ['2026-01-01T00:00:00.1234Z', '2026-01-01T00:00:00.123Z'],
  ['2026-01-01T00:00:00', '2026-01-01'],
  ['2026-01-01   00:00:00 Z', '2026-01-01'],
  ['2026-13-01', '"2026-13-01"'],
  ['2026-02-29', '2026-03-01'],
  ['? [1, true]\n', '"1,true"'],
  ['? [~]\n', '""'],
  ['? []\n', '""'],
  ['? [2026-01-01]\n', '? [2026-01-01T00:00:00Z]\n'],
  ['? [{a: 1}]\n', '"[object Object]"'],
  ['? [[a]]\n', 'b'],
  ["'1'", '"1"'],
  ['"a b"', 'a b'],
  ['? >\n  a\n  b\n', '"a b\\n"'],
  ['!!float 1', '1'],
  ['!!bool true', '"true"'],
  ['!!null null', '"null"'],
  ['!!timestamp 2026-01-01', '2026-01-01T00:00:00Z'],
  // Tags on collection keys (review round 1 F-5): js-yaml accepts none, `!`, `!!seq` on a sequence
  // and `!!map` on a map, and refuses any other.
  ['? !foo [a]\n', 'b'],
  ['? !!map [a]\n', 'b'],
  ['? !!str {a: 1}\n', 'b'],
  ['? !!str [a]\n', 'b'],
  ['? !foo {a: 1}\n', 'b'],
  ['? !!seq {a: 1}\n', 'b'],
  ['? ! [a]\n', '"a"'],
  ['? !!seq [a]\n', 'b'],
  ['? !!map {a: 1}\n', '"[object Object]"'],
];

/** Rows of three keys or more, as written. */
const MAPPINGS: readonly string[] = [
  'x0: &k x1\nx1: a\n*k : b\n',
  'x0: &k 1\n"1": a\n*k : b\n',
  'x0: &k [a, b]\n"a,b": a\n*k : b\n',
  'x0: &k x1\n*k : a\n',
  'b: &x {c: 1}\nm:\n  <<: *x\n  c: 2\n',
  'b: &x {c: 1}\nm:\n  c: 2\n  <<: *x\n',
  'b: &x {c: 1}\nm:\n  <<: *x\n  c: 2\n  c: 3\n',
  'b: &x {c: 1}\nm:\n  <<: [*x, *x]\n',
  'm: {1: a, "1": b}\n',
  'm:\n  - {true: a, "true": b}\n',
  '&a k: a\nk: b\n',
  'k: a\n? &b k\n: b\n',
  // Merge keys by their tag (review round 1 F-5): a quoted or empty `!!merge` key merges in both.
  'x: &x {c: 1}\n!!merge "<<": *x\n',
  'x: &x {c: 1}\n!!merge : *x\n',
  'x: &x {c: 1}\nm:\n  !!merge "<<": *x\n  c: 2\n  c: 3\n',
  // A quoted empty `!!merge` key (review round 2 F-7): js-yaml cannot resolve it.
  "!!merge '': {c: 1}\n",
  '!!merge "": {c: 1}\n',
  // An empty key (bug-040): refused by js-yaml in a block mapping unless it is explicit (`?`) or
  // carries a tag or an anchor; read in a flow collection.
  ': a\nb: c\n',
  ':\n',
  '- : a\n',
  'x:\n  : a\n',
  '? : a\n',
  'a: 1\n# c\n: 3\n',
  '? \n: a\nb: c\n',
  '?\n: a\n',
  'x: {: a}\n',
  'x: [: a]\n',
  'x: {a, : b}\n',
  '!!null : a\n',
  '!!str : a\n',
  '&x : a\n',
];

/** A pair row's text: an explicit `?` key ends with its line break, so its `:` starts the next line. */
function pairText(first: string, second: string): string {
  return `${first}: a\n${second}: b\n`;
}

// A tag js-yaml does not accept on a key's node (the table tags keys only): refused for that key.
const KEY_ERRORS =
  /^(duplicated mapping key|nested arrays are not supported inside keys|unknown tag !<[^>]+>|unacceptable node kind for !<[^>]+> tag.*|incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line|cannot resolve a node with !<tag:yaml\.org,2002:merge> explicit tag)$/;

function jsYamlVerdict(text: string): 'refused' | 'read' | 'other' {
  try {
    load(text);
    return 'read';
  } catch (error) {
    return KEY_ERRORS.test((error as { reason?: string }).reason ?? '') ? 'refused' : 'other';
  }
}

function serverVerdict(text: string): 'refused' | 'read' | 'other' {
  try {
    parseYaml(text, 'f.md');
    return 'read';
  } catch (error) {
    return /\((duplicate key|unsupported key|empty key) /.test((error as Error).message) ? 'refused' : 'other';
  }
}

describe('AC-2 the server and js-yaml 4.3.2 agree on every row of the key table (bug-037)', () => {
  const rows = [...PAIRS.map(([a, b]) => pairText(a, b)), ...MAPPINGS];
  for (const text of rows) {
    it(JSON.stringify(text), () => {
      const expected = jsYamlVerdict(text);
      expect(expected, 'a row js-yaml refuses for another reason than its keys').not.toBe('other');
      expect(serverVerdict(text)).toBe(expected);
    });
  }

  it('the table covers both verdicts', () => {
    const verdicts = new Set(rows.map(jsYamlVerdict));
    expect(verdicts).toEqual(new Set(['refused', 'read']));
  });
});

describe('declared residual of the merge key (review round 1 F-5)', () => {
  it('`!!str <<` is a plain key for js-yaml, a merge for the `yaml` library: refused when its value is no map', () => {
    expect(jsYamlVerdict('!!str <<: y\n')).toBe('read');
    expect(() => parseYaml('!!str <<: y\n', 'f.md')).toThrow(/Merge sources must be maps/);
  });
});
