// task-040 review round 2 (bug-017, S2-1): every verbatim tool message the API sends — `git-refused`,
// `cli-refused`, the sync status's `lastError`, a write's `push.message` — is made by the one
// sanitiser, `redactLocalPaths` (`server/src/git/redact.ts`: paths and userinfo redacted, control
// and bidi characters as visible escapes, capped). The producers are enumerated from the source, so
// a new one fails this test until it is listed with how it sanitises; each is also fed a control
// and bidi marker where a unit can reach it (the add and clone routes: `test/server/http/projects.test.ts`).
// Round 3 (S3-1, S3-2) follows the API's fields too: a CLI `warnings` list and git-derived
// `detail.files`. Limits (review R3-3): a tripwire on the source text — a producer that passes its
// message or field through a variable built elsewhere is not seen by the scan; the behavioural tests
// below and in the route suites are what prove the sanitised output.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CliRefusedError, WingfoilCli } from '../../server/src/cli/adapter.js';
import { GitTransport, relativeToProject } from '../../server/src/writes/transport.js';
import { REPO_ROOT } from '../harness/cli.js';
import { FakeProcessRunner } from './process/fake-runner.js';

const ESC = String.fromCharCode(0x1b);
const RLO = String.fromCharCode(0x202e);
const MARKER = `deny ${ESC}[31m${RLO}txt.exe`;
const SAFE = 'deny \\x1b[31m\\u202etxt.exe';

/** Every `.ts` file under `dir`. */
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await sources(p)));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** A line that places a tool message in an API body or the sync status. */
const PRODUCER =
  /'git-refused'|'cli-refused'|\.fetchFailed\(|\.updateFailed\(|status: 'failed', message|warnings: lines\(|\{ files: /;

/**
 * The reviewed producers, file → how its message is sanitised (a call on the same file). A line
 * with a fixed or a catalogue code only (no tool text) is listed as such.
 */
const PRODUCERS: Record<string, readonly RegExp[]> = {
  'server/src/writes/transport.ts': [/redactLocalPaths\(/, /neutralise\(/],
  'server/src/sync/auto-sync.ts': [/transport\.message\(/],
  'server/src/writes/auto-push.ts': [/transport\.message\(/],
  'server/src/writes/governed.ts': [/redactLocalPaths\(/],
  'server/src/cli/adapter.ts': [/redactLocalPaths\(/, /warnings: lines\(result\.stderr\)\.map\(/],
  'server/src/projects/project-list.ts': [/redactLocalPaths\(/],
};

describe('every producer of a verbatim tool message goes through the sanitiser', () => {
  it('the producers found in the source are the reviewed ones, each calling the sanitiser', async () => {
    const found = new Set<string>();
    for (const file of await sources(path.join(REPO_ROOT, 'server', 'src'))) {
      const text = await readFile(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (rel === 'server/src/git/sync-status.ts') continue; // the store, not a producer
      if (text.split('\n').some((l) => PRODUCER.test(l) && !l.trim().startsWith('*') && !l.trim().startsWith('//'))) {
        found.add(rel);
        expect(PRODUCERS[rel], `${rel} places a tool message: list it with its sanitiser`).toBeDefined();
        for (const call of PRODUCERS[rel]!) expect(text, `${rel} does not call ${call.source}`).toMatch(call);
      }
    }
    expect([...found].sort()).toEqual(Object.keys(PRODUCERS).sort());
  });

  it("the transport's message (routes, sync lastError, auto-push): a marker from git comes out escaped", () => {
    const snapshot = { localRoots: { project: [], repository: [] }, topLevel: '/nowhere' };
    const message = GitTransport.prototype.message.call(
      undefined,
      snapshot as never,
      { stderr: `remote: ${MARKER}\n`, ended: 'exit', exitCode: 1, signal: null } as never,
      [],
    );
    expect(message).toBe(`remote: ${SAFE}`);
  });

  it("the CLI's refusal (cli-refused): a marker from the CLI comes out escaped", async () => {
    const cli = new WingfoilCli({
      cli: { source: 'path', projectRoot: '/nowhere', file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner: new FakeProcessRunner().answer({ exitCode: 1, stderr: JSON.stringify({ error: MARKER }) }),
    });
    const error = (await cli.json(['paths']).catch((e: unknown) => e)) as CliRefusedError;
    expect(error).toBeInstanceOf(CliRefusedError);
    expect(error.cliMessage).toBe(SAFE);
  });

  it('git-derived file names (detail.files of local-changes-in-the-way) come out escaped', () => {
    expect(relativeToProject([`docs/a${RLO}b.md`, 'x.md'], 'docs/')).toEqual(['a\\u202eb.md', '../x.md']);
  });
});

// Review round 4 (R4-2): the CLI's warning that names the directive in force is sanitised text; a
// path holding a backslash is written `\\` there, and still finds its entry.
describe('directiveInForce reads the sanitised warning', () => {
  it('a shadowed directive whose path holds a backslash', async () => {
    const { directiveInForce } = await import('../../server/src/reads/project-reads.js');
    const entry = (p: string) => ({ path: p, frontmatter: { id: 'd' } }) as never;
    const list = {
      entries: [entry('directives/built-in/d.md'), entry('directives/custom/a\\b.md'), entry('directives/custom/z.md')],
      warnings: [
        "directive 'd' defined in directives/built-in/d.md, directives/custom/a\\\\b.md; using directives/custom/a\\\\b.md",
      ],
    };
    expect(directiveInForce(list as never, 'd')).toMatchObject({ path: 'directives/custom/a\\b.md' });
  });
});
