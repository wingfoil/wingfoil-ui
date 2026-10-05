// TT-ARC-05 (REQ-ARC-05 — methodology independence): a lint rule finds every string literal equal
// to a type or state name of the three fixtures in `server/` and `web/`, outside `presets/` and the
// tests; on the repository it finds none but the one justified exception it is told about.
import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../harness/cli.js';

const eslint = new ESLint({ cwd: REPO_ROOT });
const RULE = 'REQ-ARC-05';

/** Messages of the REQ-ARC-05 rule only. */
async function arc05(code: string, file = 'server/src/sample.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO_ROOT, file) });
  const messages = result?.messages ?? [];
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`parse error: ${fatal.map((m) => m.message).join('; ')}`);
  return messages.filter((m) => m.severity === 2 && m.message.includes(RULE)).map((m) => m.message);
}

interface States {
  sequence: string[];
  gates?: Record<string, { reject: string }>;
  waiting?: string[];
}

/** The oracle: every type and state name of the three fixtures, from their captured samples. */
function fixtureNames(): string[] {
  const names = new Set<string>(['deprecated']);
  const addStates = (s?: States) => {
    for (const x of s?.sequence ?? []) names.add(x);
    for (const [g, { reject }] of Object.entries(s?.gates ?? {})) names.add(g).add(reject);
    for (const x of s?.waiting ?? []) names.add(x);
  };
  for (const kind of ['kanban', 'custom', 'unknown']) {
    const dir = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2', kind);
    const yaml = parse(readFileSync(path.join(dir, 'files/memory.yaml'), 'utf8'), { merge: true }) as {
      defaults?: { states?: States };
      types: Record<string, { states?: States }>;
    };
    addStates(yaml.defaults?.states);
    for (const [type, def] of Object.entries(yaml.types)) {
      names.add(type);
      addStates(def.states);
    }
    const search = JSON.parse(readFileSync(path.join(dir, 'memory-search.json'), 'utf8')) as {
      matches: { status: string }[];
    };
    for (const m of search.matches) names.add(m.status);
  }
  return [...names].sort();
}

describe('REQ-ARC-05 lint rule', () => {
  const names = fixtureNames();

  it('knows the names of the three fixtures (sanity of the oracle)', () => {
    expect(names).toEqual(expect.arrayContaining(['task', 'story', 'note', 'in-review', 'on-hold', 'ready-to-build']));
    expect(names).toHaveLength(39);
  });

  it.each(names)('reports the literal %j in server/', async (name) => {
    expect(await arc05(`export const x = ${JSON.stringify(name)};\n`)).toHaveLength(1);
  });

  it.each([
    ['a template literal', 'export const x = `in-review`;\n'],
    ['a literal type', "export type T = 'backlog' | 'x';\n"],
    ['an object key', "export const o = { 'in-progress': 1 };\n"],
    ['a comparison', "export const f = (s: string) => s === 'approved';\n"],
    ['an unquoted object key', "export const colour = { draft: 'grey', x: 'green' };\n"],
    ['an unquoted key of a type literal', 'export type S = { approved: boolean };\n'],
    ['an interface member', 'export interface S {\n  approved: boolean;\n}\n'],
    ['an enum member', 'export enum K {\n  draft,\n  x,\n}\n'],
    ['a class property', 'export class C {\n  pending = 1;\n}\n'],
    ['an anchored regex alternation', 'export const re = /^(draft|x)$/;\n'],
    ['a non-capturing regex group', 'export const re = /^(?:x|in-review)$/;\n'],
    ['a regex word between \\b', 'export const re = /\\bdone\\b/;\n'],
    ['web/', "export const x = 'shaping';\n", 'web/src/sample.ts'],
    [
      'web/src/presets/ (only server/src/presets/ is exempt)',
      "export const x = 'draft';\n",
      'web/src/presets/sample.ts',
    ],
    [
      'a test-named file under server/ (tests live in test/)',
      "export const x = 'draft';\n",
      'server/src/sample.test.ts',
    ],
  ])('reports %s', async (_name, code, file?: string) => {
    expect(await arc05(code, file)).not.toEqual([]);
  });

  it.each([
    ['another word', "export const x = 'submit';\n"],
    ['a name inside a longer string', "export const x = 'the task list';\n"],
    ['a template with an expression', 'export const f = (s: string) => `${s}draft`;\n'],
    ['an import source', "import { x } from './task';\nexport { x };\n"],
    [
      'identifiers and member access',
      'export function f(task: Map<string, string>, note: string) {\n  return task.get(note) ?? task.size;\n}\n',
    ],
    ['a shorthand property', 'const task = 1;\nexport const o = { task };\n'],
    ['a computed key', "const k = 'x';\nexport const o = { [k]: 1 };\n"],
    ['a regex with the name inside a longer word', 'export const re = /^task-\\d+$/;\n'],
  ])('accepts %s', async (_name, code) => {
    expect(await arc05(code)).toEqual([]);
  });

  it.each([['server/src/presets/sample.ts'], ['test/server/sample.test.ts'], ['contracts/src/sample.ts']])(
    'does not apply to %s',
    async (file) => {
      expect(await arc05("export const x = 'draft';\n", file)).toEqual([]);
    },
  );

  it('finds 0 literals in server/ and web/ but the two justified `open`s (macOS program, --no-open option)', async () => {
    // Inline disables are ignored here: every literal the rule would report is listed.
    const raw = new ESLint({ cwd: REPO_ROOT, allowInlineConfig: false });
    const results = await raw.lintFiles(['server', 'web']);
    const hits = results.flatMap((r) =>
      r.messages
        .filter((m) => m.message.includes(RULE))
        .map((m) => `${path.relative(REPO_ROOT, r.filePath)}: ${m.message}`),
    );
    expect(hits).toEqual([
      expect.stringMatching(/^server\/src\/launcher\/opener\.ts: .*"open"/),
      expect.stringMatching(/^server\/src\/launcher\/options\.ts: .*"open"/),
    ]);
  }, 120_000);
});
