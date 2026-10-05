// spec-001 §3–§5, REQ-INT-01, REQ-ARC-04 — the schemas of `contracts/` against the samples
// captured from the real CLI (`capture-samples.test.ts`, `test/contracts/samples/`): every sample
// of every matrix version validates, a missing field the UI reads fails, unknown additional
// properties pass (a newer CLI may add fields).
import { Ajv } from 'ajv';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLI_COMMANDS, cliSchemaFile } from '../../server/src/cli/commands.js';
import { parseDirective } from '../../server/src/reads/directive.js';
import { parseElement } from '../../server/src/reads/element.js';
import { parseMemoryYaml } from '../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../harness/cli.js';
import { FIXTURE_KINDS } from '../harness/fixtures/index.js';

const matrix = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'matrix.json'), 'utf8')) as {
  pinned: string;
  versions: string[];
};
const ajv = new Ajv({ allErrors: true });

function schema(rel: string): object {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', rel), 'utf8')) as object;
}
const validator = (rel: string) => ajv.compile(schema(rel));
const sample = (version: string, kind: string, rel: string): unknown =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'test', 'contracts', 'samples', `wingfoil-${version}`, kind, rel), 'utf8'));
const sampleDir = (version: string, kind: string, rel = '') =>
  path.join(REPO_ROOT, 'test', 'contracts', 'samples', `wingfoil-${version}`, kind, rel);
const clone = <T>(v: T): T => structuredClone(v);

/** Schema file → the samples it covers (relative to a fixture's sample folder). */
const SAMPLES: Record<string, (kind: string, version: string) => string[]> = {
  'cli/dna-show.schema.json': () => ['dna-show.json'],
  'cli/paths.schema.json': () => ['paths.json'],
  'cli/directives-list.schema.json': () => ['directives-list.json'],
  'cli/workflow-list.schema.json': () => ['workflow-list.json'],
  'cli/memory-search.schema.json': () => [
    'memory-search.json',
    'memory-search-deprecated.json',
    'memory-search-superseded.json',
  ],
  'cli/memory-history.schema.json': (kind, version) =>
    readdirSync(sampleDir(version, kind, 'memory-history')).map((f) => `memory-history/${f}`),
  'cli/memory-submit.schema.json': () => ['memory-submit.json'],
  'cli/memory-approve.schema.json': () => ['memory-approve.json'],
  'cli/memory-reject.schema.json': () => ['memory-reject.json'],
  'cli/memory-add.schema.json': () => ['memory-add.json'],
};

describe('contracts/matrix.json', () => {
  it('lists the pinned version, which the root package pins', () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(matrix.versions).toContain(matrix.pinned);
    expect(pkg.devDependencies.wingfoil).toBe(matrix.pinned);
  });
});

describe('REQ-INT-01 — one schema per consumed command (static list of the adapter)', () => {
  it('every command of the static list has a schema recording the version it was captured from', () => {
    for (const name of Object.keys(CLI_COMMANDS) as (keyof typeof CLI_COMMANDS)[]) {
      const file = cliSchemaFile(name);
      expect(existsSync(path.join(REPO_ROOT, 'contracts', file)), `${name} → ${file}`).toBe(true);
      expect((schema(file) as { $comment?: string }).$comment).toMatch(/^wingfoil 0\.2\.2\b/);
    }
  });

  it('the static list is spec-001 §3', () => {
    expect(Object.keys(CLI_COMMANDS).sort()).toEqual(
      [
        '--version',
        'dna show',
        'paths',
        'directives list',
        'workflow list',
        'memory search',
        'memory history',
        'memory submit',
        'memory approve',
        'memory reject',
        'memory add',
      ].sort(),
    );
  });

  it('every allow-listed file shape has a schema (spec-001 §4)', () => {
    for (const file of ['files/memory-yaml.schema.json', 'files/element.schema.json', 'files/directive.schema.json']) {
      expect((schema(file) as { $comment?: string }).$comment).toMatch(/^wingfoil 0\.2\.2\b/);
    }
  });
});

describe.each(matrix.versions)('samples captured from wingfoil %s', (version) => {
  it.each(Object.keys(SAMPLES))('%s validates every captured sample', (file) => {
    const validate = validator(file);
    let count = 0;
    for (const kind of FIXTURE_KINDS) {
      for (const rel of SAMPLES[file]!(kind, version)) {
        if (!existsSync(sampleDir(version, kind, rel))) continue;
        count += 1;
        expect(validate(sample(version, kind, rel)), `${kind}/${rel}: ${ajv.errorsText(validate.errors)}`).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('cli/version.schema.json validates the --version text (trimmed)', () => {
    const validate = validator('cli/version.schema.json');
    for (const kind of FIXTURE_KINDS) {
      const text = readFileSync(sampleDir(version, kind, 'version.txt'), 'utf8').trim();
      expect(text).toBe(version);
      expect(validate(text)).toBe(true);
    }
    expect(validate('')).toBe(false);
    expect(validate('0.2.2\nwarning')).toBe(false);
  });

  it('the allow-listed files of every fixture parse and validate (memory.yaml, elements, directives)', () => {
    for (const kind of FIXTURE_KINDS) {
      const yaml = readFileSync(sampleDir(version, kind, 'files/memory.yaml'), 'utf8');
      expect(Object.keys(parseMemoryYaml(yaml, '.wingfoil/memory.yaml').types).length).toBeGreaterThan(0);
      const elements = readdirSync(sampleDir(version, kind, 'files/elements'));
      expect(elements.length).toBeGreaterThan(0);
      for (const f of elements) {
        const parsed = parseElement(readFileSync(sampleDir(version, kind, `files/elements/${f}`), 'utf8'), f);
        expect(parsed.frontmatter.id).toBe(f.replace(/\.md$/, ''));
      }
    }
    const directives = path.join('files', 'directives');
    for (const kind of ['kanban', 'custom']) {
      for (const sub of readdirSync(sampleDir(version, kind, directives))) {
        for (const f of readdirSync(sampleDir(version, kind, path.join(directives, sub)))) {
          const text = readFileSync(sampleDir(version, kind, path.join(directives, sub, f)), 'utf8');
          expect(parseDirective(text, f).frontmatter.id).toBe(f.replace(/\.md$/, ''));
        }
      }
    }
  });
});

const pinned = (kind: string, rel: string) => sample(matrix.pinned, kind, rel);

describe('negative cases: a field the UI reads is required, its type checked', () => {
  const cases: [string, string, string, (d: any) => void][] = [
    ['dna show without team', 'cli/dna-show.schema.json', 'dna-show.json', (d) => delete d.team],
    ['dna show with a member without roles', 'cli/dna-show.schema.json', 'dna-show.json', (d) => delete d.team.members[0].roles],
    ['dna show with a module name that is a number', 'cli/dna-show.schema.json', 'dna-show.json', (d) => (d.modules = [{ name: 1 }])],
    ['paths with a string value', 'cli/paths.schema.json', 'paths.json', (d) => (d.sources = 'server/')],
    ['directives list without warnings', 'cli/directives-list.schema.json', 'directives-list.json', (d) => delete d.warnings],
    ['a directive entry without frontmatter.id', 'cli/directives-list.schema.json', 'directives-list.json', (d) => delete d.entries[0].frontmatter.id],
    ['a workflow phase without name', 'cli/workflow-list.schema.json', 'workflow-list.json', (d) => delete d.workflows[0].phases[0].name],
    ['a workflow list without manifest', 'cli/workflow-list.schema.json', 'workflow-list.json', (d) => delete d.manifest],
    ['a search match without status', 'cli/memory-search.schema.json', 'memory-search.json', (d) => delete d.matches[0].status],
    ['a search match with tags as a string', 'cli/memory-search.schema.json', 'memory-search.json', (d) => (d.matches[0].tags = 'a')],
    ['a history entry with an unknown operation', 'cli/memory-history.schema.json', 'memory-history/task-002-password-reset.json', (d) => (d.entries[0].operation = 'merge')],
    ['a history entry without sha', 'cli/memory-history.schema.json', 'memory-history/task-002-password-reset.json', (d) => delete d.entries[0].sha],
    ['a submit without to', 'cli/memory-submit.schema.json', 'memory-submit.json', (d) => delete d.to],
    ['an approve without from', 'cli/memory-approve.schema.json', 'memory-approve.json', (d) => delete d.from],
    ['a reject without reason', 'cli/memory-reject.schema.json', 'memory-reject.json', (d) => delete d.reason],
    ['an add without path', 'cli/memory-add.schema.json', 'memory-add.json', (d) => delete d.path],
  ];
  it.each(cases)('refuses %s', (_label, file, rel, mutate) => {
    const data = clone(pinned('kanban', rel));
    mutate(data);
    expect(validator(file)(data)).toBe(false);
  });

  it('accepts unknown additional properties (a newer CLI may add fields)', () => {
    const data = clone(pinned('kanban', 'memory-search.json')) as { matches: Record<string, unknown>[] } & Record<string, unknown>;
    data.extra = 1;
    data.matches[0]!.score = 0.5;
    expect(validator('cli/memory-search.schema.json')(data)).toBe(true);
  });

  it('accepts a directive without tags (custom directives, captured) and refuses one without title', () => {
    const list = clone(pinned('custom', 'directives-list.json')) as { entries: { frontmatter: Record<string, unknown> }[] };
    expect(list.entries.some((e) => !('tags' in e.frontmatter))).toBe(true);
    const validate = validator('cli/directives-list.schema.json');
    expect(validate(list)).toBe(true);
    delete list.entries[0]!.frontmatter.title;
    expect(validate(list)).toBe(false);
  });

  it('accepts an empty search with its message (W-19)', () => {
    const empty = pinned('kanban', 'memory-search-superseded.json') as { matches: unknown[]; message?: string };
    expect(empty.matches).toEqual([]);
    expect(empty.message).toBe('no documents matched the query');
    expect(validator('cli/memory-search.schema.json')(empty)).toBe(true);
  });
});
