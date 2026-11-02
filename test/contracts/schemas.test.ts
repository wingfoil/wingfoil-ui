// spec-001 §3–§5, REQ-INT-01, REQ-ARC-04 — the schemas of `contracts/` against the samples
// captured from the real CLI (`capture-samples.test.ts`, `test/contracts/samples/`): every sample
// of every matrix version validates, a missing field the UI reads fails, unknown additional
// properties pass (a newer CLI may add fields).
import { Ajv } from 'ajv';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLI_COMMANDS, cliSchemaFile } from '../../server/src/cli/commands.js';
import { classifyVersion } from '../../server/src/cli/version.js';
import { parseDirective } from '../../server/src/reads/directive.js';
import { parseElement } from '../../server/src/reads/element.js';
import { parseMemoryYaml } from '../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../harness/cli.js';
import { FIXTURE_KINDS } from '../harness/fixtures/index.js';
import { behaviours } from './support.js';

const matrix = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'matrix.json'), 'utf8')) as {
  pinned: string;
  versions: string[];
};
const ajv = new Ajv({ allErrors: true });

function schema(rel: string): object {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', rel), 'utf8')) as object;
}
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
function validator(rel: string) {
  if (!compiled.has(rel)) compiled.set(rel, ajv.compile(schema(rel)));
  return compiled.get(rel)!;
}
const sample = (version: string, kind: string, rel: string): unknown =>
  JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'test', 'contracts', 'samples', `wingfoil-${version}`, kind, rel), 'utf8'),
  );
const sampleDir = (version: string, kind: string, rel = '') =>
  path.join(REPO_ROOT, 'test', 'contracts', 'samples', `wingfoil-${version}`, kind, rel);
const clone = <T>(v: T): T => structuredClone(v);

/**
 * The `memory history` samples of a fixture: one per element, plus the 0.3 operations of task-048
 * (`memory-history-operations/`, captured on the custom fixture of every version >= 0.3).
 */
function historySamples(version: string, kind: string): string[] {
  return ['memory-history', 'memory-history-operations'].flatMap((folder) =>
    existsSync(sampleDir(version, kind, folder))
      ? readdirSync(sampleDir(version, kind, folder)).map((f) => `${folder}/${f}`)
      : [],
  );
}

/** Schema file → the samples it covers (relative to a fixture's sample folder). */
const SAMPLES: Record<string, (kind: string, version: string) => string[]> = {
  'cli/dna-show.schema.json': () => ['dna-show.json'],
  'cli/paths.schema.json': () => ['paths.json'],
  'cli/directives-list.schema.json': () => ['directives-list.json', 'directives-list-shadowed.json'],
  'cli/workflow-list.schema.json': () => ['workflow-list.json'],
  'cli/memory-search.schema.json': () => [
    'memory-search.json',
    'memory-search-deprecated.json',
    'memory-search-superseded.json',
  ],
  'cli/memory-history.schema.json': (kind, version) => historySamples(version, kind),
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
      expect(classifyVersion(text).version).toBe(version);
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
  /* eslint-disable @typescript-eslint/no-explicit-any -- mutations of parsed JSON samples */
  const cases: [string, string, string, (d: any) => void][] = [
    ['dna show without team', 'cli/dna-show.schema.json', 'dna-show.json', (d) => delete d.team],
    [
      'dna show with a member without roles',
      'cli/dna-show.schema.json',
      'dna-show.json',
      (d) => delete d.team.members[0].roles,
    ],
    [
      'dna show with a module name that is a number',
      'cli/dna-show.schema.json',
      'dna-show.json',
      (d) => (d.modules = [{ name: 1 }]),
    ],
    ['paths with a string value', 'cli/paths.schema.json', 'paths.json', (d) => (d.sources = 'server/')],
    [
      'directives list without warnings',
      'cli/directives-list.schema.json',
      'directives-list.json',
      (d) => delete d.warnings,
    ],
    [
      'a directive entry without frontmatter.id',
      'cli/directives-list.schema.json',
      'directives-list.json',
      (d) => delete d.entries[0].frontmatter.id,
    ],
    [
      'a search match without status',
      'cli/memory-search.schema.json',
      'memory-search.json',
      (d) => delete d.matches[0].status,
    ],
    [
      'a search match with tags as a string',
      'cli/memory-search.schema.json',
      'memory-search.json',
      (d) => (d.matches[0].tags = 'a'),
    ],
    [
      'a history entry with an unknown operation',
      'cli/memory-history.schema.json',
      'memory-history/task-002-password-reset.json',
      (d) => (d.entries[0].operation = 'merge'),
    ],
    [
      'a history entry without sha',
      'cli/memory-history.schema.json',
      'memory-history/task-002-password-reset.json',
      (d) => delete d.entries[0].sha,
    ],
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

  // Optional in WingFoil 0.2.2 itself (`dist/dna/schema.js`, `dist/workflow/schema.js`): a project
  // may omit them, so the UI must not require them.
  const optional: [string, string, string, (d: any) => void][] = [
    ['dna show without project', 'cli/dna-show.schema.json', 'dna-show.json', (d) => delete d.project],
    ['dna show without project fields', 'cli/dna-show.schema.json', 'dna-show.json', (d) => (d.project = {})],
    [
      'dna show with a member without email',
      'cli/dna-show.schema.json',
      'dna-show.json',
      (d) => delete d.team.members[0].email,
    ],
    [
      'dna show with an agent without approval_authority',
      'cli/dna-show.schema.json',
      'dna-show.json',
      (d) => delete d.team.agents[0].approval_authority,
    ],
    [
      'dna show without technologies and methodologies',
      'cli/dna-show.schema.json',
      'dna-show.json',
      (d) => (d.stacks = {}),
    ],
    ['dna show with a version 1.5', 'cli/dna-show.schema.json', 'dna-show.json', (d) => (d.version = 1.5)],
  ];
  it.each(optional)('accepts %s', (_label, file, rel, mutate) => {
    const data = clone(pinned('kanban', rel));
    mutate(data);
    expect(validator(file)(data)).toBe(true);
  });

  /* eslint-enable @typescript-eslint/no-explicit-any */
  it('accepts unknown additional properties (a newer CLI may add fields)', () => {
    const data = clone(pinned('kanban', 'memory-search.json')) as { matches: Record<string, unknown>[] } & Record<
      string,
      unknown
    >;
    data.extra = 1;
    data.matches[0]!.score = 0.5;
    expect(validator('cli/memory-search.schema.json')(data)).toBe(true);
  });

  it('accepts a directive without tags (custom directives, captured) and refuses one without title', () => {
    const list = clone(pinned('custom', 'directives-list.json')) as {
      entries: { frontmatter: Record<string, unknown> }[];
    };
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

// task-046 AC-2 (D46-3): `workflow list` has one shape per version line, as `oneOf` branches of one
// schema that exclude each other; an output matches exactly one, the branch of its version.
describe('cli/workflow-list.schema.json — the 0.2.x and 0.3.x shapes', () => {
  const file = 'cli/workflow-list.schema.json';
  const definitions = (schema(file) as { definitions?: Record<string, object> }).definitions ?? {};
  const branch = (name: string) => ajv.compile({ definitions, $ref: `#/definitions/${name}` });
  /* eslint-disable @typescript-eslint/no-explicit-any -- mutations of parsed JSON samples */
  const v02 = () => clone(sample('0.2.2', 'kanban', 'workflow-list.json')) as any;
  const v03 = () => clone(sample('0.3.1', 'kanban', 'workflow-list.json')) as any;

  it.each(matrix.versions)('wingfoil %s: every sample matches its own branch only', (version) => {
    const own = behaviours(version).workflowList;
    const other = own === 'v0.2' ? 'v0.3' : 'v0.2';
    for (const kind of FIXTURE_KINDS) {
      const data = sample(version, kind, 'workflow-list.json');
      expect(branch(own)(data), `${kind}: ${own}`).toBe(true);
      expect(branch(other)(data), `${kind}: ${other}`).toBe(false);
    }
  });

  const refused: [string, () => unknown][] = [
    [
      '0.2: a phase without name',
      () => {
        const d = v02();
        delete d.workflows[0].phases[0].name;
        return d;
      },
    ],
    [
      '0.2: no manifest',
      () => {
        const d = v02();
        delete d.manifest;
        return d;
      },
    ],
    [
      '0.2: a workflow without phases',
      () => {
        const d = v02();
        delete d.workflows[0].phases;
        return d;
      },
    ],
    [
      '0.3: no baseline',
      () => {
        const d = v03();
        delete d.baseline;
        return d;
      },
    ],
    [
      '0.3: no diagnostics',
      () => {
        const d = v03();
        delete d.diagnostics;
        return d;
      },
    ],
    [
      '0.3: a workflow without executableNow',
      () => {
        const d = v03();
        delete d.workflows[0].executableNow;
        return d;
      },
    ],
    [
      '0.3: a workflow without startable',
      () => {
        const d = v03();
        delete d.workflows[0].startable;
        return d;
      },
    ],
    [
      '0.3: a baseline commit that is not a sha',
      () => {
        const d = v03();
        d.baseline.commit = 'main';
        return d;
      },
    ],
    [
      '0.3: a baseline rev other than HEAD',
      () => {
        const d = v03();
        d.baseline.rev = 'main';
        return d;
      },
    ],
    [
      '0.3: a diagnostic without message',
      () => {
        const d = v03();
        d.diagnostics = [{ code: 'W_X', severity: 'warning', file: 'f', path: '' }];
        return d;
      },
    ],
    [
      '0.3: a description that is a number',
      () => {
        const d = v03();
        d.workflows[0].description = 1;
        return d;
      },
    ],
    ['both shapes at once', () => ({ ...v02(), ...v03(), workflows: v02().workflows })],
    ['0.2 workflows with a 0.3 envelope', () => ({ ...v03(), workflows: v02().workflows })],
  ];
  it.each(refused)('refuses %s', (_label, make) => {
    expect(validator(file)(make())).toBe(false);
  });

  const accepted: [string, () => unknown][] = [
    [
      '0.2: no manifest.version',
      () => {
        const d = v02();
        delete d.manifest.version;
        return d;
      },
    ],
    [
      '0.2: a workflow without description',
      () => {
        const d = v02();
        delete d.workflows[0].description;
        return d;
      },
    ],
    [
      '0.3: a null description',
      () => {
        const d = v03();
        d.workflows[0].description = null;
        return d;
      },
    ],
    ['0.3: no workflows, with its message', () => ({ ...v03(), workflows: [], message: 'no workflows defined' })],
    [
      '0.3: a diagnostic',
      () => {
        const d = v03();
        d.diagnostics = [{ code: 'W_X', severity: 'warning', file: 'f', path: '', message: 'm' }];
        return d;
      },
    ],
  ];
  it.each(accepted)('accepts %s', (_label, make) => {
    expect(validator(file)(make()), ajv.errorsText(validator(file).errors)).toBe(true);
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  it.each(matrix.versions)(
    'wingfoil %s: the samples pass as the workflows section of GET /api/p/:pid/config',
    (version) => {
      const api = new Ajv({ allErrors: true });
      for (const dir of ['api', 'cli', 'files']) {
        for (const f of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) api.addSchema(schema(path.join(dir, f)));
      }
      const validate = api.getSchema('https://wingfoil-ui.local/contracts/api/config.schema.json')!;
      const error = { code: 'cli-output', message: 'Unexpected output' };
      for (const kind of FIXTURE_KINDS) {
        const body = {
          dna: { error },
          paths: { error },
          workflows: { data: sample(version, kind, 'workflow-list.json') },
          types: { error },
        };
        expect(validate(body), `${kind}: ${JSON.stringify(validate.errors)}`).toBe(true);
      }
    },
  );
});

// task-048 D48-1 (bug-026): each `memory history` entry has one shape per version line — 0.2.2's
// five operations without `wingfoil`, 0.3.x's eleven with it — as two definitions that exclude each
// other; every captured entry matches its own version's definition only.
describe('cli/memory-history.schema.json — the 0.2.x and 0.3.x entries', () => {
  const file = 'cli/memory-history.schema.json';
  const definitions = (schema(file) as { definitions?: Record<string, object> }).definitions ?? {};
  const entry = (name: string) => ajv.compile({ definitions, $ref: `#/definitions/${name}` });
  type Entry = Record<string, unknown>;
  const entriesOf = (version: string, kind: string): Entry[] =>
    historySamples(version, kind).flatMap((rel) => (sample(version, kind, rel) as { entries: Entry[] }).entries);
  const operations = (version: string) =>
    FIXTURE_KINDS.flatMap((kind) => entriesOf(version, kind)).map((e) => e.operation);

  it.each(matrix.versions)('wingfoil %s: every entry matches its own definition only', (version) => {
    const own = behaviours(version).historyEntry;
    const other = own === 'v0.2' ? 'v0.3' : 'v0.2';
    let count = 0;
    for (const kind of FIXTURE_KINDS) {
      for (const e of entriesOf(version, kind)) {
        count += 1;
        expect(entry(own)(e), `${kind} ${String(e.sha)}: ${own}`).toBe(true);
        expect(entry(other)(e), `${kind} ${String(e.sha)}: ${other}`).toBe(false);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('the 0.3.1 samples hold every operation 0.3 adds (finalize, park, amend, start, sync, assign)', () => {
    expect([...new Set(operations('0.3.1'))]).toEqual(
      expect.arrayContaining(['start', 'finalize', 'sync', 'amend', 'park', 'assign']),
    );
  });

  // task-048 review round 1, n-4: the API's entry is the CLI's v0.3 entry without `wingfoil`.
  it('the API history entry has the fields of the CLI v0.3 entry but wingfoil, closed', () => {
    const api = schema('api/history.schema.json') as {
      properties: { entries: { items: { properties: object; required: string[]; additionalProperties: boolean } } };
    };
    const cli = definitions['v0.3'] as { properties: Record<string, unknown>; required: string[] };
    const { wingfoil: _dropped, ...fields } = cli.properties;
    const item = api.properties.entries.items;
    expect(item.properties).toEqual(fields);
    expect(item.required).toEqual(cli.required.filter((r) => r !== 'wingfoil'));
    expect(item.additionalProperties).toBe(false);
  });

  const base = (version: string): Entry => clone(entriesOf(version, 'kanban').find((e) => e.operation === 'submit')!);
  const refused: [string, () => Entry][] = [
    ['0.2: an operation 0.2.2 does not record', () => ({ ...base('0.2.2'), operation: 'finalize' })],
    ['0.3: an operation outside the eleven', () => ({ ...base('0.3.1'), operation: 'start-fix' })],
    ['0.3: a wingfoil that is a number', () => ({ ...base('0.3.1'), wingfoil: 1 })],
    [
      '0.3: no wingfoil, with an operation of 0.3',
      () => {
        const e: Entry = { ...base('0.3.1'), operation: 'park' };
        delete e.wingfoil;
        return e;
      },
    ],
  ];
  it.each(refused)('refuses %s', (_label, make) => {
    const out = { id: 'x', path: 'x.md', entries: [make()] };
    expect(validator(file)(out)).toBe(false);
  });

  const accepted: [string, () => unknown][] = [
    ['no entries', () => ({ id: 'x', path: 'x.md', entries: [] })],
    ['0.3: a null wingfoil', () => ({ id: 'x', path: 'x.md', entries: [{ ...base('0.3.1'), wingfoil: null }] })],
    ['0.2: a null operation', () => ({ id: 'x', path: 'x.md', entries: [{ ...base('0.2.2'), operation: null }] })],
  ];
  it.each(accepted)('accepts %s', (_label, make) => {
    expect(validator(file)(make())).toBe(true);
  });
});
