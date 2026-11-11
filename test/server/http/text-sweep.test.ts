// task-056 AC-1, AC-4 (RP3-18 K1, bug-027; spec-004 §5, spec-012 §9) — the executable form of the
// design's enumeration: every string leaf of every response schema of `contracts/api/` has a class,
//
// | Class | What | Rule |
// |-------|------|------|
// | a | tool message, commit text | `redactLocalPaths` (escaped, redacted, capped) |
// | b | repository display text K1 names | `neutralise` (escaped) |
// | c | key: id, type, state, role, a path the page sends back | as returned |
// | d | document content: frontmatter values, bodies, file content | as written |
// | e | server-made or validated: fixed messages, enums, shas, dates, the caller's own input | as made |
// | r | repository display text outside K1's fields | as returned: the known gap of bug-035 |
//
// so a field added later fails here until it is classified; and one hostile fixture (the
// hostile-text variant of the kanban fixture, a `memory.yaml` type and a `ui.yaml` with bidi and C1
// characters) read through every GET route of the project shows no (a) or (b) field holding a Cc,
// Cf, Cs, Zl or Zp character other than newline and tab, no (a) field over 4 000 characters or
// naming a local folder, the keys byte for byte those of `memory search`, and the document content
// as written. When bug-035 is fixed, its rows become (b) and are asserted too.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies and schemas walked generically */
import type { FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { MAX_MESSAGE } from '../../../server/src/git/redact.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { ECHOED_UI_FIELDS } from '../../../server/src/ui-config/body.js';
import { pinnedCli, REPO_ROOT } from '../../harness/cli.js';
import {
  addHostileText,
  buildFixture,
  copyFixture,
  type Fixture,
  type HostileElement,
} from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git, run } from '../../harness/run.js';
import { auditedSnapshots } from '../snapshot/support.js';

/** The classes of the enumeration. */
type TextClass = 'a' | 'b' | 'c' | 'd' | 'e' | 'r';

/** One rule: the fields `pattern` matches (`<schema> <path>`), their class, and why. */
interface Rule {
  pattern: RegExp;
  cls: TextClass;
  note?: string;
}

/** The gap of the (r) rows. */
const BUG_035 = 'bug-035-repository-text-outside-the-named-display-fields-reaches-the-page-unescaped';

/** `progress.phases.value[]` → `progress\.phases\.value\[\]`. */
const fieldPattern = (field: string): string => field.replace(/[.[\]]/g, (c) => `\\${c}`);

/** A descriptor's own fields, alone (`descriptor`) or nested (`….descriptor`). */
const DESCRIPTOR = '(?:^descriptor |\\.descriptor)\\.';
/** The repository status, alone or nested (`project`, `git.response`). */
const REPOSITORY = '(?:^repository |\\.repository)\\.';
/** The `ui` section, alone or in `/config`. */
const UI = '^(?:config \\.ui|ui-config )\\.';

/** The enumeration (the design's AC-1 table), first match wins. */
const RULES: readonly Rule[] = [
  // The error envelopes.
  {
    pattern:
      /^(?:error|cli\.refusal|element\.refusal|git\.refusal|projects\.refusal|write\.refusal|ui-config\.preset\.refusal) \.(?:error\.)?code$/,
    cls: 'e',
  },
  {
    pattern:
      /^(?:error|cli\.refusal|element\.refusal|git\.refusal|projects\.refusal|write\.refusal|ui-config\.preset\.refusal) \.(?:error\.)?message$/,
    cls: 'a',
    note: 'a tool message (cli-refused, git-refused) or a fixed one',
  },
  { pattern: /^element\.refusal \.error\.detail\.candidates\[\]\.title$/, cls: 'b' },
  { pattern: /^element\.refusal \.error\.detail\.candidates\[\]\.(?:id|shortId|type|status)$/, cls: 'c' },
  { pattern: /^git\.refusal \.error\.detail\.files\[\]$/, cls: 'b' },
  { pattern: /^projects\.refusal \.error\.detail\.name$/, cls: 'r', note: BUG_035 },
  { pattern: /^projects\.refusal \.error\.detail\.(?:path|pid|command|stateDir)$/, cls: 'e' },
  { pattern: /^write\.refusal \.error\.detail\.(?:file|command|commit)$/, cls: 'e' },
  // task-060: the preset write's refusal; `failure` quotes the shipped preset only (D60-5).
  {
    pattern: /^ui-config\.preset\.refusal \.error\.detail\.(?:file|command|commit|failure)$/,
    cls: 'e',
    note: 'the server’s own text (task-060)',
  },
  // task-070 (D70-6, D70-11): a WingFoil 0.3.x refusal's reasons, tool messages as the message.
  {
    pattern: /^(?:cli|write|ui-config\.preset)\.refusal \.error\.detail\.reasons\[\]$/,
    cls: 'a',
    note: 'a refusal reason (task-070)',
  },
  // The action descriptor, wherever it is.
  { pattern: new RegExp(`${DESCRIPTOR}(?:id|type|status|verbs\\[\\]\\.(?:to|role)|actor\\.role)$`), cls: 'c' },
  { pattern: new RegExp(`${DESCRIPTOR}(?:verbs\\[\\]\\.reason\\.range|rejection\\.at|since)$`), cls: 'e' },
  { pattern: new RegExp(`${DESCRIPTOR}rejection\\.(?:by|reason)$`), cls: 'a', note: 'commit text (bug-027)' },
  {
    pattern: new RegExp(`${DESCRIPTOR}actor\\.(?:member\\.name|member\\.email|members\\[\\])$`),
    cls: 'r',
    note: BUG_035,
  },
  // Elements: `/elements`, `/elements/:eid`, the Today rows.
  { pattern: /^(?:elements \.elements\[\]|element \.element|today .*\.element)\.title$/, cls: 'b' },
  {
    pattern:
      /^(?:elements \.elements\[\]|element \.element|today .*\.element)\.(?:path|id|shortId|type|status|tags\[\])$/,
    cls: 'c',
  },
  { pattern: /^elements \.(?:warnings\[\]|message)$/, cls: 'a' },
  { pattern: /^(?:elements|element) \.(?:typesError|eventsError)\.code$/, cls: 'e' },
  { pattern: /^(?:elements|element) \.(?:typesError|eventsError)\.message$/, cls: 'a' },
  {
    pattern: /^element \.frontmatter\.rejection_reason$/,
    cls: 'a',
    note: 'written by `memory reject` from its reason: commit text, the one frontmatter field outside (d) (review round 1)',
  },
  { pattern: /^element \.(?:frontmatter\..+|body)$/, cls: 'd' },
  { pattern: /^element \.(?:required\[\]\.field|states\..+)$/, cls: 'c' },
  { pattern: /^today \.(?:view|summary\[\]\.role)$/, cls: 'c' },
  // History and the Memory events.
  { pattern: /^history \.entries\[\]\.(?:from|to)$/, cls: 'r', note: BUG_035 },
  { pattern: /^history \.(?:id|path)$/, cls: 'c' },
  { pattern: /^history \.entries\[\]\.(?:sha|timestamp)$/, cls: 'e' },
  { pattern: /^history \.entries\[\]\.(?:subject|reason|author|approver)$/, cls: 'a', note: 'commit text (bug-027)' },
  { pattern: /^memory-events \.events\[\]\.(?:sha|timestamp)$/, cls: 'e' },
  { pattern: /^memory-events \.events\[\]\.(?:type|id|from|to)$/, cls: 'c', note: 'keys from the subject (D56-8)' },
  { pattern: /^memory-events \.events\[\]\.(?:author|approver|reason)$/, cls: 'a', note: 'commit text (bug-027)' },
  // Directives.
  { pattern: /^directives? \.(?:entries\[\]|entry)\.frontmatter\.(?:name|title)$/, cls: 'r', note: BUG_035 },
  {
    pattern:
      /^directives? \.(?:entries\[\]|entry)\.(?:path|frontmatter\.(?:id|type|kind|tags\[\]|ref\[\])|roles\[\]|assignment)$/,
    cls: 'c',
  },
  { pattern: /^directive \.frontmatter\.(?:name|title)$/, cls: 'r', note: BUG_035 },
  { pattern: /^directive \.(?:frontmatter\..+|body)$/, cls: 'd' },
  { pattern: /^directives \.warnings\[\]$/, cls: 'a' },
  // Documentation and files.
  { pattern: /^docs \.(?:roots\[\]|documents\[\]\.path)$/, cls: 'r', note: BUG_035 },
  { pattern: /^file-tree \.(?:path|entries\[\]\.path)$/, cls: 'c' },
  { pattern: /^file-tree \.entries\[\]\.name$/, cls: 'r', note: BUG_035 },
  { pattern: /^file-content \.path$/, cls: 'c' },
  { pattern: /^file-content \.content$/, cls: 'd' },
  // The repository status.
  {
    pattern: new RegExp(`${REPOSITORY}(?:state|head|sync\\.\\w+\\.(?:lastSuccessAt|lastError\\.at))$`),
    cls: 'e',
  },
  {
    pattern: new RegExp(`${REPOSITORY}(?:branch|upstream|sync\\.update\\.lastError\\.detail\\.files\\[\\])$`),
    cls: 'b',
  },
  { pattern: new RegExp(`${REPOSITORY}sync\\.\\w+\\.lastError\\.message$`), cls: 'a' },
  // The identity and the header.
  { pattern: /^(?:identity|project) \.identity\.(?:email|name|members\[\])$/, cls: 'r', note: BUG_035 },
  { pattern: /^(?:identity|project) \.(?:identity\.roles\[\]|roleViews\[\]|roleView)$/, cls: 'c' },
  { pattern: /^project \.name$/, cls: 'r', note: BUG_035 },
  { pattern: /^project \.(?:id|wingfoil\.version|capabilities\..+|readOnly\[\]\.range|dnaError\.code)$/, cls: 'e' },
  { pattern: /^project \.(?:wingfoil\.text|dnaError\.message)$/, cls: 'a' },
  // The project list.
  { pattern: /^projects\.(?:item|list\.response) \.(?:projects\[\]\.)?(?:name|remote)$/, cls: 'r', note: BUG_035 },
  { pattern: /^projects\.(?:item|list\.response) \.(?:projects\[\]\.)?(?:id|path|command)$/, cls: 'e' },
  // The server and the settings.
  { pattern: /^(?:server|settings) .+$/, cls: 'e' },
  // A write's answer.
  { pattern: /^write\.response \.(?:commits\[\]\.(?:sha|subject)|push\.code)$/, cls: 'e' },
  { pattern: /^write\.response \.push\.message$/, cls: 'a' },
  // `/config`.
  { pattern: /^config \.\w+\.warnings\[\]$/, cls: 'a' },
  { pattern: /^config \.\w+\.error\.code$/, cls: 'e' },
  { pattern: /^config \.\w+\.error\.message$/, cls: 'a' },
  {
    pattern:
      /^config \.dna\.data\.(?:team\.roles\[\]\.name|team\.members\[\]\.roles\[\]|team\.agents\[\]\.executes_as\[\]|paths\..+)$/,
    cls: 'c',
  },
  { pattern: /^config \.dna\.data\..+$/, cls: 'r', note: BUG_035 },
  { pattern: /^config \.paths\.data\..+$/, cls: 'c' },
  { pattern: /^config \.workflows\.data\.(?:message|diagnostics\[\]\..+)$/, cls: 'a' },
  { pattern: /^config \.workflows\.data\.baseline\.commit$/, cls: 'e' },
  {
    pattern:
      /^config \.workflows\.data\.(?:manifest\.include\[\]|workflows\[\]\.(?:name|kind|element|phases\[\]\.(?:name|role|approval\.by_role|fallback\.step|fallback\.set_state|include|iterate_over)))$/,
    cls: 'c',
  },
  { pattern: /^config \.workflows\.data\..+$/, cls: 'r', note: BUG_035 },
  { pattern: /^config \.types\.data\..+$/, cls: 'c' },
  { pattern: new RegExp(`${UI}status\\.warning\\.failure$`), cls: 'a' },
  { pattern: new RegExp(`${UI}progress\\.scope\\.current\\.title$`), cls: 'b' },
  { pattern: new RegExp(`${UI}progress\\.scope\\.current\\.(?:id|shortId|type|status)$`), cls: 'c' },
  {
    pattern: new RegExp(`${UI}(?:${ECHOED_UI_FIELDS.map(fieldPattern).join('|')})$`),
    cls: 'b',
    note: 'ECHOED_UI_FIELDS (task-068)',
  },
];

/** The class of `key` (`<schema> <path>`), or `undefined`. */
function classOf(key: string): Rule | undefined {
  return RULES.find((r) => r.pattern.test(key));
}

const CONTRACTS = path.join(REPO_ROOT, 'contracts');

/** The response schemas of `contracts/api/` (the request bodies are the caller's own input). */
async function responseSchemas(): Promise<string[]> {
  return (await readdir(path.join(CONTRACTS, 'api'))).filter(
    (f) => f.endsWith('.schema.json') && !f.endsWith('.request.schema.json'),
  );
}

const loaded = new Map<string, any>();
async function load(file: string): Promise<any> {
  let s = loaded.get(file);
  if (s === undefined) loaded.set(file, (s = JSON.parse(await readFile(path.join(CONTRACTS, file), 'utf8'))));
  return s;
}

/** The schema node `ref` names, from `file` (relative to `contracts/`), and its file. */
async function resolveRef(ref: string, file: string): Promise<[any, string]> {
  const [target, fragment = ''] = ref.split('#');
  const into = !target
    ? file
    : target.startsWith('https://')
      ? target.replace(/^https:\/\/[^/]+\/contracts\//, '')
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
  let node = await load(into);
  for (const part of fragment.split('/').filter(Boolean)) node = node[part];
  return [node, into];
}

/** Every string leaf of `node` (no enum, no const), as `.a.b[].c`; a record's keys as `.<key>`. */
async function leaves(node: any, file: string, at: string, out: Set<string>, seen: ReadonlySet<string>): Promise<void> {
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') {
    const key = `${file}${node.$ref}`;
    if (!seen.has(key)) {
      const [target, into] = await resolveRef(node.$ref, file);
      await leaves(target, into, at, out, new Set([...seen, key]));
    }
  }
  for (const k of ['oneOf', 'anyOf', 'allOf']) for (const s of node[k] ?? []) await leaves(s, file, at, out, seen);
  for (const k of ['if', 'then', 'else']) if (node[k]) await leaves(node[k], file, at, out, seen);
  const types: unknown[] = Array.isArray(node.type) ? node.type : [node.type];
  if (types.includes('string') && node.enum === undefined && node.const === undefined) out.add(at);
  for (const [k, v] of Object.entries(node.properties ?? {})) await leaves(v, file, `${at}.${k}`, out, seen);
  for (const v of Object.values(node.patternProperties ?? {})) await leaves(v, file, `${at}.<key>`, out, seen);
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    await leaves(node.additionalProperties, file, `${at}.<key>`, out, seen);
  }
  if (node.items) await leaves(node.items, file, `${at}[]`, out, seen);
}

/** `<schema> <path>` of every string leaf of every response schema. */
async function schemaFields(): Promise<string[]> {
  const out: string[] = [];
  for (const f of await responseSchemas()) {
    const found = new Set<string>();
    await leaves(await load(`api/${f}`), `api/${f}`, '', found, new Set());
    for (const at of found) out.push(`${f.replace(/\.schema\.json$/, '')} ${at}`);
  }
  return out;
}

/** Every string of `body` with its path (`.a.b[].c`). */
function strings(body: unknown, at = ''): [string, string][] {
  if (typeof body === 'string') return [[at, body]];
  if (Array.isArray(body)) return body.flatMap((v) => strings(v, `${at}[]`));
  if (body && typeof body === 'object') return Object.entries(body).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  return [];
}

/** A character the API must never send in an (a) or (b) field: Cc, Cf, Cs, Zl, Zp but newline and tab. */
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

describe('the enumeration of AC-1', () => {
  it('every string field of every response schema of contracts/api/ has a class', async () => {
    const fields = await schemaFields();
    expect(fields.length).toBeGreaterThan(300);
    expect(fields.filter((f) => classOf(f) === undefined)).toEqual([]);
  });

  it('every (r) row names bug-035, the known gap', async () => {
    const gap = (await schemaFields()).filter((f) => classOf(f)?.cls === 'r');
    expect(gap.length).toBeGreaterThan(0);
    for (const f of gap) expect(classOf(f)!.note, f).toBe(BUG_035);
  });
});

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

let root: string;
let fx: Fixture;
let hostile: HostileElement;
let registry: Snapshots;
let app: FastifyInstance;
let pid: string;

/** A `memory.yaml` type and a `ui.yaml` whose strings hold a bidi override and a C1 control (task-068's K1 case). */
const T = 't\u202e\u0085x';
const S = 's\u202e\u0085x';
async function hostileUiYaml(dir: string): Promise<void> {
  // JSON is YAML; the controls written as YAML double-quoted escapes.
  const yamlOf = (data: unknown) =>
    JSON.stringify(data, null, 1)
      .replace(/\u202e/g, '\\u202e')
      .replace(/\u0085/g, '\\x85');
  const file = path.join(dir, '.wingfoil', 'memory.yaml');
  const memory = parse(await readFile(file, 'utf8')) as any;
  memory.types[T] = {
    path: 'docs/memory/tx/{id}.md',
    states: { sequence: ['draft', S], gates: { [S]: { reject: 'draft' } } },
  };
  await writeFile(file, yamlOf(memory));
  await writeFile(
    path.join(dir, '.wingfoil', 'ui.yaml'),
    yamlOf({
      version: 1,
      taxonomy: {
        categories: { [T]: 'work' },
        patterns: [{ match: '^m\u202e\u0085\\d', category: 'requirement' }],
        requires: { [T]: ['requirement'] },
      },
      progress: { mode: 'sequence', scope: { type: T }, phases: ['ph\u202e\u0085'], iterates: T, defects: T },
      holds: { [T]: { [S]: { approve: 'never' } } },
      artifacts: [{ path: 'p\u202e', phase: 'ph\u202e\u0085' }],
    }),
  );
}

/** The name and the content of the hostile document (the file tree's `name` (r), its content (d)). */
const DOC_NAME = 'notes \u202etxt.md';
const DOC_TEXT = 'Document \u202etext\u200b as written\n';

/** A documentation folder (`dna add paths.docs`, the CLI's verb) holding one hostile document. */
async function hostileDocument(fixture: Fixture): Promise<void> {
  await run(
    process.execPath,
    [pinnedCli().script, '--format', 'json', 'dna', 'add', 'paths.docs', '--value', 'docs/guide'],
    {
      cwd: fixture.dir,
      env: fixture.env,
    },
  );
  await mkdir(path.join(fixture.dir, 'docs', 'guide'), { recursive: true });
  await writeFile(path.join(fixture.dir, 'docs', 'guide', DOC_NAME), DOC_TEXT);
  await git(fixture.dir, ['add', '-A'], fixture.env);
  await git(fixture.dir, ['commit', '-qm', 'docs: a hostile document'], fixture.env);
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-text-sweep-')));
  const kanban = await buildFixture('kanban', { root: path.join(root, 'kanban') });
  fx = await copyFixture(kanban, path.join(root, 'hostile'));
  hostile = await addHostileText(fx);
  await hostileDocument(fx);
  await hostileUiYaml(fx.dir);
  registry = auditedSnapshots(fx.env).snapshots;
  const store = await createMemoryStateStore();
  pid = (await store.add({ path: fx.dir, name: fx.name, remote: '' })).id;
  app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerProjectRoutes(a, { store, snapshots: registry }),
  });
}, HEAVY_MS);

afterAll(async () => {
  await app?.close();
  await registry?.closeAll();
  await rm(root, { recursive: true, force: true });
});

async function get(url: string): Promise<any> {
  const res = await app.inject({ method: 'GET', url: `/api/p/${pid}${url}`, headers: AUTH });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 300)}`).toBe(200);
  return res.json();
}

/** The `memory search` matches of the fixture, as the pinned CLI prints them. */
async function searchMatches(): Promise<any[]> {
  const out = await run(process.execPath, [pinnedCli().script, '--format', 'json', 'memory', 'search'], {
    cwd: fx.dir,
    env: fx.env,
  });
  return (JSON.parse(out.stdout) as { matches: any[] }).matches;
}

describe('the sweep of AC-4 (one hostile fixture, every GET route of the project)', () => {
  it('no (a) or (b) field holds an unsafe character; (a) fields are capped and name no local folder', async () => {
    const detail = `/elements/${hostile.id}`;
    const docs = await get('/docs');
    const doc = docs.documents[0]?.path as string | undefined;
    const tree = docs.roots[0] as string | undefined;
    const routes: [string, string][] = [
      ['project', ''],
      ['config', '/config'],
      ['elements', '/elements'],
      ['elements', '/elements?archived=true'],
      ['element', detail],
      ['history', `${detail}/history`],
      ['directives', '/directives'],
      ['docs', '/docs'],
      ['today', '/today'],
      ['memory-events', '/events/memory?limit=100'],
    ];
    const directives = await get('/directives');
    if (directives.entries[0]) routes.push(['directive', `/directives/${directives.entries[0].frontmatter.id}`]);
    if (doc) routes.push(['file-content', `/files/content?path=${encodeURIComponent(doc)}`]);
    if (tree) routes.push(['file-tree', `/files/tree?path=${encodeURIComponent(tree)}`]);
    expect(
      [doc, tree].every((v) => v !== undefined),
      'the fixture has documents',
    ).toBe(true);
    const problems: string[] = [];
    const gap = new Set<string>();
    let checked = 0;
    for (const [schema, url] of routes) {
      for (const [at, text] of strings(await get(url))) {
        const key = `${schema} ${at}`;
        const rule = classOf(key);
        if (rule === undefined) {
          // An enum or const value of its schema (no string leaf: the first test classifies those),
          // made by the server: never an unsafe character.
          if (UNSAFE.test(text)) problems.push(`${url} ${at}: an unsafe character in an enum value`);
          continue;
        }
        const unsafe = UNSAFE.test(text);
        if (rule.cls === 'a' || rule.cls === 'b') {
          checked += 1;
          if (unsafe) problems.push(`${url} ${at}: an unsafe character`);
        }
        if (rule.cls === 'a') {
          if (text.length > MAX_MESSAGE) problems.push(`${url} ${at}: ${text.length} characters`);
          if (text.includes(fx.dir) || text.includes(homedir())) problems.push(`${url} ${at}: a local folder`);
        }
        if (rule.cls === 'r' && unsafe) gap.add(key);
      }
    }
    expect(problems).toEqual([]);
    // The hostile texts did reach (a) and (b) fields: the sweep is not vacuous.
    expect(checked).toBeGreaterThan(50);
    // The known gap of bug-035, listed: the hostile document's name in the file tree reaches it.
    expect([...gap]).toEqual(expect.arrayContaining(['file-tree .entries[].name', 'docs .documents[].path']));
    for (const key of gap) expect(classOf(key)!.note).toBe(BUG_035);
  });

  it('a title with U+202E and U+200B is escaped in /elements, /elements/:eid and the Today rows', async () => {
    const escaped = 'Hostile \\u202eeltit\\u200b title';
    const list = await get('/elements');
    expect(list.elements.find((e: any) => e.id === hostile.id).title).toBe(escaped);
    expect((await get(`/elements/${hostile.id}`)).element.title).toBe(escaped);
    const today = await get('/today');
    const rows = [
      ...(today.requiresYou ?? []),
      ...today.waitingOnOthers,
      ...(today.summary ?? []).flatMap((l: any) => l.items),
    ].filter((r: any) => r.element.id === hostile.id);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.element.title).toBe(escaped);
  });

  it('ids, types, states and paths are byte for byte those of memory search', async () => {
    const matches = await searchMatches();
    const list = await get('/elements');
    expect(list.elements.map((e: any) => [e.id, e.type, e.status, e.path])).toEqual(
      matches.map((m) => [m.id, m.type, m.status, m.path]),
    );
    const byId = new Map(matches.map((m) => [m.id, m]));
    const today = await get('/today');
    for (const r of [...(today.requiresYou ?? []), ...today.waitingOnOthers]) {
      const m = byId.get(r.element.id);
      expect(m, r.element.id).toBeDefined();
      expect([r.element.type, r.element.status]).toEqual([m.type, m.status]);
    }
  });

  it('the frontmatter rejection_reason, written by memory reject, is commit text (class a)', async () => {
    const detail = await get(`/elements/${hostile.id}`);
    const reason = detail.frontmatter.rejection_reason as string;
    expect(typeof reason).toBe('string');
    expect(UNSAFE.test(reason)).toBe(false);
    expect(reason.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(reason.includes(fx.dir) || reason.includes(homedir())).toBe(false);
    expect(reason).toBe(detail.descriptor.rejection.reason);
  });

  it('the document content stays as written (class d): the body keeps its U+202E', async () => {
    const detail = await get(`/elements/${hostile.id}`);
    expect(detail.body).toContain(hostile.bodyLine);
    expect(detail.frontmatter.title).toBe(hostile.title);
    const content = await get(`/files/content?path=${encodeURIComponent(`docs/guide/${DOC_NAME}`)}`);
    expect(content.content).toBe(DOC_TEXT);
  });

  it('the ui section is escaped once (task-068), never twice', async () => {
    const ui = (await get('/config')).ui;
    expect(ui.progress.phases.value).toEqual(['ph\\u202e\\x85']);
    expect(ui.taxonomy.patterns.value).toEqual([{ match: '^m\\u202e\\x85\\d', category: 'requirement' }]);
  });
});
