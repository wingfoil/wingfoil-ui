// spec-005 §2 (amended 2026-11-05), AC-3, task-054 D54-3 — the YAML rules of `ui.yaml`: aliases,
// every explicit tag, non-plain keys and duplicate keys refused, the engine's first error with its
// line (C-04.2), and the cost of a large map bounded (the library's own duplicate check is
// quadratic, design probe P2c).
import { describe, expect, it, vi } from 'vitest';

/** The options of every `parseDocument` call. */
const yamlCalls = vi.hoisted(() => [] as unknown[]);
vi.mock('yaml', async (importOriginal) => {
  const real = await importOriginal<typeof import('yaml')>();
  return {
    ...real,
    parseDocument: (...args: Parameters<typeof real.parseDocument>) => {
      yamlCalls.push(args[1]);
      return real.parseDocument(...args);
    },
  };
});
import { parseUiYaml } from '../../../server/src/ui-config/parse.js';

const failure = (text: string): string => {
  const parsed = parseUiYaml(text);
  if (parsed.ok) throw new Error(`parsed: ${JSON.stringify(parsed.data)}`);
  return parsed.failure;
};

describe('parseUiYaml', () => {
  it('parses the YAML 1.2 core schema; a BOM and an anchor without an alias are accepted', () => {
    expect(parseUiYaml('version: 1\nprogress: { mode: flow }\n')).toEqual({
      ok: true,
      data: { version: 1, progress: { mode: 'flow' } },
    });
    expect(parseUiYaml('﻿version: 1\n')).toEqual({ ok: true, data: { version: 1 } });
    expect(parseUiYaml('version: &v 1\n')).toEqual({ ok: true, data: { version: 1 } });
    expect(parseUiYaml('')).toEqual({ ok: true, data: null });
    // `<<` is a plain key (no merge): the schema refuses it.
    expect(parseUiYaml('progress:\n  <<: { mode: flow }\n')).toEqual({
      ok: true,
      data: { progress: { '<<': { mode: 'flow' } } },
    });
  });

  it('refuses an alias, with its line and column', () => {
    expect(failure('a: &x [1, 2]\nb: *x\n')).toBe('aliases are not allowed (line 2, column 4)');
    expect(failure('a: &a ["x","x"]\nb: &b [*a,*a]\nc: &c [*b,*b]\n')).toBe(
      'aliases are not allowed (line 2, column 8)',
    );
  });

  it.each([
    ['version: !foo 1\n'],
    ['version: !!python/object:os.system 1\n'],
    ['version: !!binary aGVsbG8=\n'],
    ['x: !!set {a, b}\n'],
    ['version: !!str 1\n'],
    ['version: !!int 1\n'],
    ['a:\n  b: [1, !!int 2]\n'],
  ])('refuses every explicit tag: %j', (text) => {
    const line = text.startsWith('a:') ? 2 : 1;
    expect(failure(text)).toMatch(new RegExp(`^tags are not allowed \\(line ${line}, column \\d+\\)$`));
  });

  it('refuses a key that is not a plain scalar', () => {
    expect(failure('? [a, b]\n: 1\n')).toBe('keys must be plain strings (line 1, column 3)');
    expect(failure('{ a: 1 }: 2\n')).toBe('keys must be plain strings (line 1, column 1)');
  });

  it('refuses a duplicate key, at the top and nested', () => {
    expect(failure('version: 1\nversion: 1\n')).toBe('duplicate key version (line 2, column 1)');
    expect(failure('progress:\n  mode: flow\n  mode: sequence\n')).toBe('duplicate key mode (line 3, column 3)');
    expect(failure('a: { "1": x, 1: y }\n')).toBe('duplicate key 1 (line 1, column 14)');
  });

  it('C-04.2 — invalid YAML: the engine message with its line, without the trailing colon', () => {
    expect(failure('progress:\n  mode: flow\n  bad: [unclosed\n')).toBe(
      'Flow sequence in block collection must be sufficiently indented and end with a ] at line 4, column 1',
    );
    expect(failure('a: b: c\n')).toBe('Nested mappings are not allowed in compact mappings at line 1, column 4');
    expect(failure('version: 1\n---\nversion: 1\n')).toMatch(
      /^Source contains multiple documents.* at line 2, column 1$/,
    );
    expect(failure('progress:\n\tmode: flow\n')).toBe('Tabs are not allowed as indentation at line 2, column 1');
  });

  it('a 64 KiB map of 7 000 keys: duplicate keys found by the reader, not by the quadratic library check', () => {
    // The library's `uniqueKeys` costs 1.7 s on this input (design probe P2c): it must stay off, the
    // reader's one-set-per-map check on (a structural test: wall-clock bounds depend on the load, bug-004).
    const lines: string[] = [];
    for (let i = 0, len = 0; len < 64 * 1024 - 20; i++) {
      const line = `k${i}: 1`;
      lines.push(line);
      len += line.length + 1;
    }
    yamlCalls.length = 0;
    expect(parseUiYaml(`${lines.join('\n')}\n`).ok).toBe(true);
    expect(yamlCalls).toEqual([expect.objectContaining({ uniqueKeys: false, merge: false, schema: 'core' })]);
    expect(failure(`${lines.join('\n')}\n${lines[3]!}\n`)).toBe(
      `duplicate key k3 (line ${lines.length + 1}, column 1)`,
    );
  });

  it.each([
    ['repeated tags', `x: ${'!a '.repeat(21_800)}x\n`],
    ['repeated anchors', `x: ${'&a '.repeat(21_800)}x\n`],
  ])('64 KiB of %s: one failure, its text built for the first error only (review round 1 F1)', (_label, text) => {
    // The library's prettyErrors builds an excerpt for every error: quadratic, 1.3–4.3 s on these
    // inputs. Structural check (the option off), plus a generous bound on the fastest of 3 runs.
    expect(text.length).toBeLessThanOrEqual(64 * 1024);
    yamlCalls.length = 0;
    let fastest = Infinity;
    let result = '';
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      result = failure(text);
      fastest = Math.min(fastest, performance.now() - start);
    }
    expect(yamlCalls.every((o) => (o as { prettyErrors?: boolean }).prettyErrors === false)).toBe(true);
    expect(result).toMatch(/ at line 1, column \d+$/);
    expect(fastest).toBeLessThan(1_000);
  });

  it('deep flow nesting is a failure, not a crash', () => {
    expect(failure(`${'['.repeat(2000)}${']'.repeat(2000)}`)).toMatch(/^Maximum call stack size exceeded at line 1/);
  });
});
