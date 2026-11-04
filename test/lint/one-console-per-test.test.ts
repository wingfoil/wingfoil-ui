// task-053 (bug-023, dl-009 action 4): no test body of the default suite starts more than one
// console, unless the second console is the behaviour under test (a restart, two consoles at
// once) and the body says so with the marker `// one-console-per-test: kept — <reason>`.
//
// A console start is a call, in an `it` / `test` body (`.each` rows included), of one of the
// console starters of the suite (`STARTERS`), or of a function of the same file that calls one,
// directly or through another such function, or that both copies a fixture (`copyFixture`) and
// builds an app (`buildApp`). A start inside a loop or a `map` / `forEach` / `Promise.all`
// callback counts as more than one. Starts in hooks (`beforeAll`, …) are not in a test body.
//
// Limits: the check is lexical. A starter imported from another support file is seen only when
// it is one of `STARTERS` (a new shared starter joins the list in the same change); a start
// through a dynamic call or a callback handed elsewhere is not seen.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

/** The shared console starters: `server/http/git-console.ts`, `server/http/read-console.ts`, `launcher/launcher.ts`. */
const STARTERS = ['startGitConsole', 'startReadConsole', 'startLauncher'];

/** The folders of `test/` outside the default suite (`vitest.config.ts` `exclude`). */
const OUTSIDE = new Set(['e2e', 'timing', 'smoke', 'node_modules']);

const MARKER = /\/\/\s*one-console-per-test: kept — \S/;
const LOOP_CALLS = new Set(['map', 'forEach', 'all']);

function calleeName(call: ts.CallExpression): string | undefined {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return undefined;
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    (ts.isCallExpression(node) && LOOP_CALLS.has(calleeName(node) ?? ''))
  );
}

/** The leftmost identifier of `it.each(rows)` / `test.skipIf(x)` / `it`. */
function baseName(e: ts.Expression): string | undefined {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return baseName(e.expression);
  if (ts.isCallExpression(e)) return baseName(e.expression);
  return undefined;
}

/** A test body over the limit. */
interface MultiConsoleTest {
  line: number;
  title: string;
  /** Start calls in the body. */
  starts: number;
  /** A start inside a loop. */
  looped: boolean;
}

/** The test bodies of `source` that start more than one console and carry no marker. */
function multiConsoleTests(source: string, fileName = 'sample.test.ts'): MultiConsoleTest[] {
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const locals = new Map<string, ts.Node>();
  const declarations = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) locals.set(n.name.text, n.body);
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    )
      locals.set(n.name.text, n.initializer.body);
    ts.forEachChild(n, declarations);
  };
  declarations(sf);
  const callsIn = (body: ts.Node): Set<string> => {
    const names = new Set<string>();
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const name = calleeName(n);
        if (name) names.add(name);
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    return names;
  };
  const starters = new Set(STARTERS);
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, body] of locals) {
      if (starters.has(name)) continue;
      const calls = callsIn(body);
      if ([...calls].some((c) => starters.has(c)) || (calls.has('copyFixture') && calls.has('buildApp'))) {
        starters.add(name);
        changed = true;
      }
    }
  }
  const found: MultiConsoleTest[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ['it', 'test'].includes(baseName(n.expression) ?? '')) {
      const fn = n.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        let starts = 0;
        let looped = false;
        const count = (x: ts.Node, inLoop: boolean): void => {
          if (ts.isCallExpression(x)) {
            const name = calleeName(x);
            if (name && starters.has(name)) {
              starts += 1;
              if (inLoop) looped = true;
            }
          }
          const nested = inLoop || isLoop(x);
          ts.forEachChild(x, (y) => count(y, nested));
        };
        count(fn.body, false);
        if ((starts > 1 || looped) && !MARKER.test(fn.body.getFullText(sf))) {
          const first = n.arguments[0];
          const title =
            first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
              ? first.text
              : (first?.getText(sf) ?? '');
          found.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, title, starts, looped });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

/** The default suite's test files, relative to the repository. */
function defaultSuiteFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, top: boolean): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!(top && OUTSIDE.has(entry.name)) && entry.name !== 'node_modules') walk(full, false);
      } else if (/\.test\.tsx?$/.test(entry.name)) files.push(path.relative(REPO_ROOT, full));
    }
  };
  walk(path.join(REPO_ROOT, 'test'), true);
  return files.sort();
}

describe('the check itself (inline sources)', () => {
  const titles = (source: string) => multiConsoleTests(source).map((t) => t.title);

  it('two direct starts in one body → found, with the count', () => {
    expect(
      multiConsoleTests(`it('two', async () => { await startGitConsole(a); await startLauncher([], env); });`),
    ).toEqual([{ line: 1, title: 'two', starts: 2, looped: false }]);
  });

  it('one start → not found; one start per it.each row → not found', () => {
    expect(titles(`it('one', async () => { await startGitConsole(a); });`)).toEqual([]);
    expect(titles(`it.each(rows)('%s', async (row) => { await startReadConsole(row); });`)).toEqual([]);
  });

  it('a start in a for … of, a while, or a map / Promise.all callback → found', () => {
    expect(titles(`it('for', async () => { for (const x of xs) await startLauncher(x); });`)).toEqual(['for']);
    expect(titles(`it('while', async () => { while (go()) await startLauncher(x); });`)).toEqual(['while']);
    expect(titles(`test('map', async () => { await Promise.all(xs.map((x) => startGitConsole(x))); });`)).toEqual([
      'map',
    ]);
  });

  it('a file-local wrapper, a wrapper of a wrapper, and copyFixture + buildApp count as starts', () => {
    const wrappers = `
      async function start() { return startGitConsole(t); }
      const again = async () => start();
      async function own() { const fx = await copyFixture(t, d); return buildApp({ fx }); }
      async function copyOnly() { return copyFixture(t, d); }
    `;
    expect(titles(`${wrappers} it('w', async () => { await start(); await again(); });`)).toEqual(['w']);
    expect(titles(`${wrappers} it('o', async () => { await own(); await own(); });`)).toEqual(['o']);
    expect(titles(`${wrappers} it('c', async () => { await copyOnly(); await copyOnly(); });`)).toEqual([]);
  });

  it('starts in a hook are not in a test body', () => {
    expect(titles(`beforeAll(async () => { await startLauncher(a); await startLauncher(b); });`)).toEqual([]);
  });

  it('the marker with a reason keeps a body; an empty reason does not', () => {
    const body = (marker: string) =>
      `it('restart', async () => {\n  ${marker}\n  await startLauncher(a);\n  await startLauncher(a);\n});`;
    expect(titles(body('// one-console-per-test: kept — the restart is the behaviour'))).toEqual([]);
    expect(titles(body('// one-console-per-test: kept — '))).toEqual(['restart']);
  });
});

it('no test body of the default suite starts more than one console without the marker (bug-023)', () => {
  const files = defaultSuiteFiles();
  expect(files.length).toBeGreaterThan(100);
  const found = files.flatMap((file) =>
    multiConsoleTests(readFileSync(path.join(REPO_ROOT, file), 'utf8'), file).map(
      (t) => `${file}:${t.line} ${t.title} (${t.starts}${t.looped ? ', in a loop' : ''})`,
    ),
  );
  expect(found).toEqual([]);
});
