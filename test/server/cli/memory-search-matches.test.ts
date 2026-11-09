// task-070 AC-1 (bug-024, RP3-14 D10; spec-001 §2, spec-004 §5; D70-1 … D70-3, D70-10) — the
// per-match validation of `memory search` in the CLI adapter (fake runner): the envelope as a whole,
// then each match on its own; a failing match is dropped and becomes one warning naming its
// project-relative path and the failing fields (never a value), through the adapter's sanitiser and
// counted with the `stderr` warnings (one cap of 200, one count line). A failing envelope is still
// the read error, and every other command stays strict. The real CLIs: `test/server/http/dropped-matches.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { CliOutputError, cliErrorEnvelope, WingfoilCli } from '../../../server/src/cli/adapter.js';
import { MAX_TOOL_LINES, mergeToolLines } from '../../../server/src/cli/commands.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

const CLI = { source: 'project' as const, projectRoot: '/p', file: process.execPath, prefixArgs: ['/x/cli.js'] };

function cliAnswering(stdout: string, stderr = '') {
  const logger = { error: vi.fn() };
  const runner = new FakeProcessRunner().answer({ stdout, stderr });
  return { cli: new WingfoilCli({ cli: CLI, runner, logger }), logger };
}

const VALID = {
  path: 'docs/memory/bug/bug-001-probe-bug.md',
  id: 'bug-001-probe-bug',
  title: 'Probe bug',
  type: 'bug',
  status: 'draft',
  tags: [],
};
const NOTES = { path: 'docs/memory/bug/notes.md', tags: [] };

const search = (matches: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ query: '', matches, ...extra });

describe('per-match validation of memory search (bug-024)', () => {
  it('keeps the valid matches in order and names each dropped one by its path and fields', async () => {
    const partial = { path: 'docs/memory/bug/partial.md', id: 'x', title: 'Partial', status: 'deprecated', tags: [] };
    const listTitle = {
      path: 'docs/memory/bug/list.md',
      id: 'y',
      title: ['a', 'b'],
      type: 'bug',
      status: 'draft',
      tags: [],
    };
    const second = { ...VALID, path: 'docs/memory/bug/bug-002-b.md', id: 'bug-002-b' };
    const { cli, logger } = cliAnswering(search([VALID, NOTES, partial, listTitle, second]));
    const out = await cli.run('memory search');
    expect(out.data.matches.map((m) => m.id)).toEqual(['bug-001-probe-bug', 'bug-002-b']);
    expect(out.warnings).toEqual([
      'memory search left out docs/memory/bug/notes.md: not a Memory element (id, title, type, status missing or not text)',
      'memory search left out docs/memory/bug/partial.md: not a Memory element (type missing or not text)',
      'memory search left out docs/memory/bug/list.md: not a Memory element (title missing or not text)',
    ]);
    // A dropped match is not an adapter defect: nothing logged, never a value.
    expect(logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify(out.warnings)).not.toContain('Partial');
  });

  it('a match without a text path is named <no path>; a match that is not an object too', async () => {
    const { cli } = cliAnswering(search([{ id: 'z', tags: [] }, 42, VALID]));
    const out = await cli.run('memory search');
    expect(out.data.matches).toEqual([VALID]);
    expect(out.warnings).toEqual([
      'memory search left out <no path>: not a Memory element (path, title, type, status missing or not text)',
      'memory search left out <no path>: not a Memory element (not an object)',
    ]);
  });

  it('the path is CLI text: control and bidi characters escaped, the project folder redacted', async () => {
    const hostile = { path: `/p/docs/memory/bug/notes‮txt\u001b[31m.md`, tags: [] };
    const { cli } = cliAnswering(search([hostile, VALID]));
    const out = await cli.run('memory search');
    expect(out.warnings).toEqual([
      'memory search left out <project>/docs/memory/bug/notes\\u202etxt\\x1b[31m.md: not a Memory element (id, title, type, status missing or not text)',
    ]);
  });

  it('the stderr warnings come first; one cap of 200 and one count line over both', async () => {
    const stderr = ['first', 'second', 'third'].map((w) => JSON.stringify({ warning: w })).join('\n');
    const dropped = Array.from({ length: 201 }, (_, i) => ({ path: `docs/memory/bug/n${i}.md`, tags: [] }));
    const { cli } = cliAnswering(search([...dropped, VALID]), stderr);
    const out = await cli.run('memory search');
    expect(out.data.matches).toEqual([VALID]);
    expect(out.warnings).toHaveLength(MAX_TOOL_LINES + 1);
    expect(out.warnings.slice(0, 4)).toEqual([
      'first',
      'second',
      'third',
      'memory search left out docs/memory/bug/n0.md: not a Memory element (id, title, type, status missing or not text)',
    ]);
    expect(out.warnings.at(-1)).toBe('4 more warnings omitted');
  });

  it('every match failing still answers the envelope: no element, the warnings, the message kept', async () => {
    const { cli } = cliAnswering(search([NOTES]));
    const out = await cli.run('memory search');
    expect(out.data).toEqual({ query: '', matches: [] });
    expect(out.warnings).toHaveLength(1);
  });

  it('the archived searches are the same command and get the same rule', async () => {
    const partial = { path: 'docs/memory/bug/partial.md', id: 'x', title: 'P', status: 'deprecated', tags: [] };
    const { cli } = cliAnswering(search([partial]));
    const out = await cli.run('memory search', { options: { '--status': 'deprecated' } });
    expect(out.data.matches).toEqual([]);
    expect(out.warnings).toEqual([
      'memory search left out docs/memory/bug/partial.md: not a Memory element (type missing or not text)',
    ]);
  });
});

describe('review round 1 (F1, F5, F2)', () => {
  it('F1: a newline, a carriage return or a tab in a file name cannot forge a line of the warning', async () => {
    const forged = { path: 'docs/memory/bug/a\nWARNING forged line\r\tx.md', tags: [] };
    // A literal backslash stays distinguishable from an escape: the sanitiser doubles it.
    const literal = { path: 'docs/memory/bug/b\\x0a.md', tags: [] };
    const { cli } = cliAnswering(search([forged, literal, VALID]));
    const out = await cli.run('memory search');
    expect(out.warnings).toEqual([
      'memory search left out docs/memory/bug/a\\x0aWARNING forged line\\x0d\\x09x.md: not a Memory element (id, title, type, status missing or not text)',
      'memory search left out docs/memory/bug/b\\\\x0a.md: not a Memory element (id, title, type, status missing or not text)',
    ]);
    for (const w of out.warnings) expect(w).not.toMatch(/[\n\r\t]/);
  });

  it('F5: tags is named as a list', async () => {
    const badTags = { ...VALID, path: 'docs/memory/bug/t.md', tags: 'x' };
    const noTags = { path: 'docs/memory/bug/u.md', id: 'u', title: 'U', type: 'bug', status: 'draft' };
    const both = { path: 'docs/memory/bug/v.md', id: 5, tags: [1] };
    const { cli } = cliAnswering(search([badTags, noTags, both]));
    expect((await cli.run('memory search')).warnings).toEqual([
      'memory search left out docs/memory/bug/t.md: not a Memory element (tags missing or not a list of text)',
      'memory search left out docs/memory/bug/u.md: not a Memory element (tags missing or not a list of text)',
      'memory search left out docs/memory/bug/v.md: not a Memory element (id, title, type, status missing or not text; tags missing or not a list of text)',
    ]);
  });

  it('F2: lists merged once more under one cap and one count line, each text once', () => {
    const capped = (prefix: string, n: number) => [
      ...Array.from({ length: MAX_TOOL_LINES }, (_, i) => `${prefix} ${i}`),
      `${n} more warnings omitted`,
    ];
    const merged = mergeToolLines([capped('live', 1), capped('deprecated', 1), ['shared', 'shared']]);
    expect(merged).toHaveLength(MAX_TOOL_LINES + 1);
    expect(merged.slice(0, 2)).toEqual(['live 0', 'live 1']);
    // 200 deprecated lines and one 'shared' left out, plus the two lists' own counts.
    expect(merged.at(-1)).toBe(`${MAX_TOOL_LINES + 1 + 1 + 1} more warnings omitted`);
    expect(merged.filter((w) => w.endsWith('more warnings omitted'))).toHaveLength(1);
    expect(
      mergeToolLines([
        ['a', 'b'],
        ['b', 'c'],
      ]),
    ).toEqual(['a', 'b', 'c']);
    // A CLI line that reads like a count line, in a list under the cap, is a warning like any other.
    expect(mergeToolLines([['3 more warnings omitted']])).toEqual(['3 more warnings omitted']);
  });
});

describe('what stays strict (D70-2)', () => {
  it.each([
    ['matches not an array', JSON.stringify({ query: '', matches: {} })],
    ['query missing', JSON.stringify({ matches: [VALID] })],
    ['message not text', search([], { message: 7 })],
    ['not an object', JSON.stringify([VALID])],
  ])('a failing envelope (%s) is still 502 cli-output, logged', async (_l, stdout) => {
    const { cli, logger } = cliAnswering(stdout);
    const error = await cli.run('memory search').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliOutputError);
    expect(cliErrorEnvelope(error as CliOutputError).status).toBe(502);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('a failing envelope with failing matches too is still the read error', async () => {
    const { cli } = cliAnswering(JSON.stringify({ matches: [NOTES] }));
    await expect(cli.run('memory search')).rejects.toBeInstanceOf(CliOutputError);
  });

  it('dna show with a bad field is still 502: no other command is read per item', async () => {
    const { cli } = cliAnswering(
      JSON.stringify({
        version: 1,
        modules: [],
        stacks: {},
        team: { members: [{ name: 3, roles: [] }], roles: [] },
        paths: {},
      }),
    );
    await expect(cli.run('dna show')).rejects.toBeInstanceOf(CliOutputError);
  });
});
