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
//
// so a field added later fails here until it is classified; and one hostile fixture (the
// hostile-text variant of the kanban fixture, a `memory.yaml` type and a `ui.yaml` with bidi and C1
// characters) read through every GET route of the project shows no (a) or (b) field holding a Cc,
// Cf, Cs, Zl or Zp character other than newline and tab, no (a) field over 4 000 characters or
// naming a local folder, the keys byte for byte those of `memory search`, and the document content
// as written.
//
// task-072 (bug-035, D72-10): the class (r) — repository display text outside K1's fields, served
// raw — is gone: its rows are (b) or (c). The hostile repository variant (`addHostileRepositoryText`)
// is added to the fixture, and two more guards make a field or a route added later fail here until
// it is handled: every GET route the launcher registers is swept or exempt with its reason (*route
// coverage*), and every (b) leaf of the swept schemas is reached by the fixture with its U+202E
// escaped exactly once, or names the test that covers it (*per-field reach*).
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
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerElementWriteRoutes } from '../../../server/src/http/element-writes.js';
import { registerEventStream } from '../../../server/src/http/events.js';
import { registerGitRoutes } from '../../../server/src/http/git-routes.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { registerProjectListRoutes } from '../../../server/src/http/projects.js';
import { registerRoleViewRoute } from '../../../server/src/http/role-view.js';
import { registerServerRoute } from '../../../server/src/http/server-route.js';
import { registerSettingsRoutes } from '../../../server/src/http/settings.js';
import { registerUiConfigPresetRoute } from '../../../server/src/http/ui-config-preset.js';
import { createLogger } from '../../../server/src/logging.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import { ProjectList } from '../../../server/src/projects/project-list.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { ECHOED_UI_FIELDS } from '../../../server/src/ui-config/body.js';
import { pinnedCli, REPO_ROOT } from '../../harness/cli.js';
import {
  addHostileRepositoryText,
  addHostileText,
  buildFixture,
  copyFixture,
  type Fixture,
  type HostileElement,
  type HostileRepository,
} from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git, run } from '../../harness/run.js';
import { auditedSnapshots } from '../snapshot/support.js';

/** The classes of the enumeration. */
type TextClass = 'a' | 'b' | 'c' | 'd' | 'e';

/** One rule: the fields `pattern` matches (`<schema> <path>`), their class, and why. */
interface Rule {
  pattern: RegExp;
  cls: TextClass;
  note?: string;
}

/** The rows that were (r), the gap of bug-035, until task-072. */
const BUG_035 = 'bug-035 (task-072)';

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
  { pattern: /^projects\.refusal \.error\.detail\.name$/, cls: 'b', note: BUG_035 },
  { pattern: /^projects\.refusal \.error\.detail\.(?:path|pid|command|stateDir)$/, cls: 'e' },
  // task-072 review round 1 F-1: `read-error` and `write-incomplete` name a repository path the
  // catalogue shows.
  { pattern: /^write\.refusal \.error\.detail\.file$/, cls: 'b', note: BUG_035 },
  { pattern: /^write\.refusal \.error\.detail\.(?:command|commit)$/, cls: 'e' },
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
  {
    pattern: new RegExp(`${DESCRIPTOR}(?:id|type|status|verbs\\[\\]\\.(?:to|role|reason\\.state)|actor\\.role)$`),
    cls: 'c',
  },
  { pattern: new RegExp(`${DESCRIPTOR}(?:verbs\\[\\]\\.reason\\.range|rejection\\.at|since)$`), cls: 'e' },
  { pattern: new RegExp(`${DESCRIPTOR}rejection\\.(?:by|reason)$`), cls: 'a', note: 'commit text (bug-027)' },
  {
    pattern: new RegExp(`${DESCRIPTOR}actor\\.(?:member\\.name|member\\.email|members\\[\\])$`),
    cls: 'b',
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
  { pattern: /^history \.entries\[\]\.(?:from|to)$/, cls: 'b', note: BUG_035 },
  { pattern: /^history \.(?:id|path)$/, cls: 'c' },
  { pattern: /^history \.entries\[\]\.(?:sha|timestamp)$/, cls: 'e' },
  { pattern: /^history \.entries\[\]\.(?:subject|reason|author|approver)$/, cls: 'a', note: 'commit text (bug-027)' },
  { pattern: /^memory-events \.events\[\]\.(?:sha|timestamp)$/, cls: 'e' },
  { pattern: /^memory-events \.events\[\]\.(?:type|id)$/, cls: 'c', note: 'keys from the subject (D56-8)' },
  // task-072 review round 1 F-2: only shown (the bell's *Updates*), as a history entry's states.
  { pattern: /^memory-events \.events\[\]\.(?:from|to)$/, cls: 'b', note: BUG_035 },
  { pattern: /^memory-events \.events\[\]\.(?:author|approver|reason)$/, cls: 'a', note: 'commit text (bug-027)' },
  // Directives.
  { pattern: /^directives? \.(?:entries\[\]|entry)\.frontmatter\.(?:name|title)$/, cls: 'b', note: BUG_035 },
  {
    pattern:
      /^directives? \.(?:entries\[\]|entry)\.(?:path|frontmatter\.(?:id|type|kind|tags\[\]|ref\[\])|roles\[\]|assignment)$/,
    cls: 'c',
  },
  { pattern: /^directive \.frontmatter\.(?:name|title)$/, cls: 'b', note: BUG_035 },
  { pattern: /^directive \.(?:frontmatter\..+|body)$/, cls: 'd' },
  { pattern: /^directives \.warnings\[\]$/, cls: 'a' },
  // Documentation and files.
  {
    pattern: /^docs \.(?:roots\[\]|documents\[\]\.path)$/,
    cls: 'c',
    note: 'the addresses of /files/tree and /files/content (D72-6)',
  },
  { pattern: /^docs \.documents\[\]\.label$/, cls: 'b', note: BUG_035 },
  { pattern: /^file-tree \.(?:path|entries\[\]\.path)$/, cls: 'c' },
  { pattern: /^file-tree \.entries\[\]\.name$/, cls: 'b', note: BUG_035 },
  { pattern: /^file-content \.path$/, cls: 'c' },
  { pattern: /^file-content \.label$/, cls: 'b', note: BUG_035 },
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
  { pattern: /^(?:identity|project) \.identity\.(?:email|name|members\[\])$/, cls: 'b', note: BUG_035 },
  { pattern: /^(?:identity|project) \.(?:identity\.roles\[\]|roleViews\[\]|roleView)$/, cls: 'c' },
  { pattern: /^project \.name$/, cls: 'b', note: BUG_035 },
  { pattern: /^project \.(?:id|wingfoil\.version|capabilities\..+|readOnly\[\]\.range|dnaError\.code)$/, cls: 'e' },
  { pattern: /^project \.(?:wingfoil\.text|dnaError\.message)$/, cls: 'a' },
  // The project list.
  { pattern: /^projects\.(?:item|list\.response) \.(?:projects\[\]\.)?(?:name|remote)$/, cls: 'b', note: BUG_035 },
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
      /^config \.dna\.data\.(?:team\.roles\[\]\.name|team\.members\[\]\.roles\[\]|team\.agents\[\]\.executes_as\[\])$/,
    cls: 'c',
  },
  { pattern: /^config \.dna\.data\..+$/, cls: 'b', note: BUG_035 },
  { pattern: /^config \.paths\.data\..+$/, cls: 'c' },
  { pattern: /^config \.workflows\.data\.(?:message|diagnostics\[\]\..+)$/, cls: 'a' },
  { pattern: /^config \.workflows\.data\.baseline\.commit$/, cls: 'e' },
  {
    pattern:
      /^config \.workflows\.data\.(?:manifest\.include\[\]|workflows\[\]\.(?:name|kind|element|phases\[\]\.(?:name|role|approval\.by_role|fallback\.step|fallback\.set_state|include|iterate_over)))$/,
    cls: 'c',
  },
  { pattern: /^config \.workflows\.data\..+$/, cls: 'b', note: BUG_035 },
  { pattern: /^config \.types\.data\..+$/, cls: 'c' },
  { pattern: new RegExp(`${UI}status\\.warning\\.failure$`), cls: 'a' },
  { pattern: new RegExp(`${UI}progress\\.scope\\.current\\.title$`), cls: 'b' },
  { pattern: new RegExp(`${UI}progress\\.scope\\.current\\.(?:id|shortId|type|status)$`), cls: 'c' },
  {
    pattern: new RegExp(`${UI}(?:${ECHOED_UI_FIELDS.map(fieldPattern).join('|')})$`),
    cls: 'b',
    note: 'ECHOED_UI_FIELDS (task-068)',
  },
  // `/progress` (task-059 D59-10) and the missing-reference flag of `/elements`.
  { pattern: /^progress \.ui\.warning\.failure$/, cls: 'a' },
  { pattern: /^progress \.scope\.current\.title$/, cls: 'b' },
  { pattern: /^progress \.scope\.current\.(?:id|shortId|type|status)$/, cls: 'c' },
  {
    pattern: /^progress \.(?:scope\.type|figures\.(?:iterated|openDefects)\.type)$/,
    cls: 'b',
    note: 'type names echoed from ui.yaml, escaped as /config ui echoes them',
  },
  {
    pattern: /^progress \.figures\.completion\.references\[\]\.id$/,
    cls: 'b',
    note: 'a pattern reference escaped (§9); an element reference the target id of memory search',
  },
  { pattern: /^progress \.(?:figures\.\w+\.(?:ids|doneIds)\[\]|unreadable\[\]|capped\[\])$/, cls: 'c' },
  { pattern: /^progress \.figures\.(?:phase|phaseCompletion)\.reason\..+$/, cls: 'e' },
  { pattern: /^elements \.missingReferences\.(?:unreadable|capped)\[\]$/, cls: 'c' },
  // `/traceability` (task-074 D74-8, D74-9); the row descriptors by the DESCRIPTOR rule above.
  { pattern: /^traceability \.(?:ui\.warning\.failure|eventsError\.message)$/, cls: 'a' },
  {
    pattern: /^traceability \.(?:scope\.type|scope\.current\.title|elements\[\]\.title)$/,
    cls: 'b',
    note: 'a title escaped; the scope type echoed from ui.yaml, escaped as /config ui echoes it',
  },
  {
    pattern: /^traceability \.(?:references\[\]\.id|figures\.completion\.references\[\]\.id)$/,
    cls: 'b',
    note: 'a pattern reference escaped (§9); an element reference the target id of memory search',
  },
  {
    pattern:
      /^traceability \.(?:scope\.current\.(?:id|shortId|type|status)|references\[\]\.linked\[\]|figures\.completion\.ids\[\]|missing\[\]\.id|elements\[\]\.(?:path|id|shortId|type|status|tags\[\])|unreadable\[\]|capped\[\])$/,
    cls: 'c',
  },
  { pattern: /^traceability \.(?:figures\.phaseCompletion\.reason\..+|eventsError\.code)$/, cls: 'e' },
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

  it('the former gap of bug-035 is classified display text or key (task-072)', async () => {
    const former = (await schemaFields()).filter((f) => classOf(f)?.note === BUG_035);
    expect(former.length).toBeGreaterThan(40);
    for (const f of former) expect(classOf(f)!.cls, f).toBe('b');
  });
});

/**
 * The GET routes of the sweep: the route as Fastify registers it, the schema its 200 body follows.
 * A GET route the launcher registers that is neither here nor in {@link EXEMPT_ROUTES} fails *route
 * coverage* (task-072 D72-10).
 */
const SWEPT_ROUTES: Readonly<Record<string, string>> = {
  '/api/p/:pid': 'project',
  '/api/p/:pid/config': 'config',
  '/api/p/:pid/elements': 'elements',
  '/api/p/:pid/elements/:eid': 'element',
  '/api/p/:pid/elements/:eid/history': 'history',
  '/api/p/:pid/directives': 'directives',
  '/api/p/:pid/directives/:did': 'directive',
  '/api/p/:pid/docs': 'docs',
  '/api/p/:pid/files/tree': 'file-tree',
  '/api/p/:pid/files/content': 'file-content',
  '/api/p/:pid/today': 'today',
  '/api/p/:pid/events/memory': 'memory-events',
  '/api/p/:pid/progress': 'progress',
  '/api/projects': 'projects.list.response',
  '/api/p/:pid/traceability': 'traceability',
};

/** The GET routes not swept, and why. */
const EXEMPT_ROUTES: Readonly<Record<string, string>> = {
  '/api/server': 'server-made (the version, the shell warnings): class (e)',
  '/api/settings': "the user's own settings: class (e)",
  '/api/events': 'the event stream: names of events and keys (spec-004 §6)',
};

/**
 * The (b) leaves of the swept schemas the hostile fixture cannot reach, each with the test that
 * covers it (task-072 D72-10). A (b) leaf neither reached nor listed fails *per-field reach*.
 */
/** The test of the writer of every Today row's actor (review round 1 F-4). */
const TODAY_ACTOR =
  "server/http/serialise › descriptorBody › the actor's member name and email and its members' names escaped";

const REACHED_ELSEWHERE: Readonly<Record<string, string>> = {
  'project .repository.branch': 'git refuses a control character in a ref name: server/http/repository-status',
  'project .repository.upstream': 'as the branch: server/http/repository-status',
  'project .repository.sync.update.lastError.detail.files[]': 'a failed update: server/http/repository-status',
  'project .identity.members[]': 'an ambiguous identity: server/http/repository-text',
  // Today places each row by its descriptor (spec-003 §5): a member actor is never a gate of
  // *Requires you*, and the identified user holds every role, so no gate waits on
  // others. Every row of every list is written by `descriptorBody` (project-routes `todayOf`).
  'today .requiresYou[].descriptor.actor.member.name': TODAY_ACTOR,
  'today .requiresYou[].descriptor.actor.member.email': TODAY_ACTOR,
  'today .waitingOnOthers[].descriptor.actor.members[]': TODAY_ACTOR,
  'config .workflows.data.workflows[].phases[].description':
    'WingFoil 0.2.x only: server/http/serialise (workflowsBody)',
  'config .workflows.data.workflows[].phases[].actions[]': 'WingFoil 0.2.x only: server/http/serialise (workflowsBody)',
  'config .workflows.data.workflows[].phases[].produces[]':
    'WingFoil 0.2.x only: server/http/serialise (workflowsBody)',
  // task-074 D74-6: Traceability names only the elements a reference, a link or the missing flag
  // names, and none of the hostile fixture's member-actor rows is one. Its rows are `/elements`'s
  // (project-routes `listedRow`, `descriptorBody`): the leaves are reached by this sweep as
  // `elements .elements[].descriptor.actor.member.name|email`, and by the test TODAY_ACTOR names
  // (review round 1 F-3).
  'traceability .elements[].descriptor.actor.member.name': `this sweep › elements .elements[].descriptor.actor.member.name; ${TODAY_ACTOR}`,
  'traceability .elements[].descriptor.actor.member.email': `this sweep › elements .elements[].descriptor.actor.member.email; ${TODAY_ACTOR}`,
};

/** `.a.<key>[]` → a pattern matching `.a.<any key>[]` of a body. */
const leafPattern = (leaf: string): RegExp =>
  new RegExp(`^${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<key>/g, '[^.]+')}$`);

/** U+202E escaped exactly once (an odd run of backslashes before `u202e` would be an escaped backslash). */
const ONCE = /(?<!\\)\\u202e/;
const TWICE = /\\\\u202e/;

/**
 * The route modules `server/src/launcher/start.ts` registers, each registered here on stand-ins
 * (registration reads no option but the event stream's bus): their GET routes are what *route
 * coverage* checks.
 */
const REGISTRARS: Readonly<Record<string, (a: FastifyInstance) => void>> = {
  registerServerRoute: (a) => registerServerRoute(a, { store: {} as never, version: '0.0.0' }),
  registerProjectRoutes: (a) => registerProjectRoutes(a, { store: {} as never, snapshots: {} as never }),
  registerRoleViewRoute: (a) => registerRoleViewRoute(a, { store: {} as never, identity: {} as never }),
  registerEventStream: (a) => void registerEventStream(a, { bus: new InProcessEventBus() }),
  registerProjectListRoutes: (a) => registerProjectListRoutes(a, { projects: {} as never }),
  registerSettingsRoutes: (a) => registerSettingsRoutes(a, { store: {} as never, bus: new InProcessEventBus() }),
  registerElementWriteRoutes: (a) =>
    registerElementWriteRoutes(a, {
      store: {} as never,
      snapshots: {} as never,
      writeLock: new InProcessWriteLock(),
      bus: new InProcessEventBus(),
      push: {} as never,
    }),
  // task-060: the preset write (a POST; it registers no GET route).
  registerUiConfigPresetRoute: (a) =>
    registerUiConfigPresetRoute(a, {
      store: {} as never,
      snapshots: {} as never,
      writeLock: new InProcessWriteLock(),
      bus: new InProcessEventBus(),
      push: {} as never,
    }),
  registerGitRoutes: (a) =>
    registerGitRoutes(a, { store: {} as never, snapshots: {} as never, writeLock: new InProcessWriteLock() }),
};

describe('route coverage (task-072 D72-10)', () => {
  it('the sweep registers every route module the launcher registers', async () => {
    const start = await readFile(path.join(REPO_ROOT, 'server', 'src', 'launcher', 'start.ts'), 'utf8');
    const registered = [...start.matchAll(/\b(register\w+)\(routes\b/g)].map((m) => m[1]).sort();
    expect(registered).toEqual(Object.keys(REGISTRARS).sort());
  });

  it('every GET route of those modules is swept or exempt with its reason', async () => {
    const gets: string[] = [];
    const routesApp = await buildApp({
      staticDir: '/nonexistent',
      logger: createLogger(sink),
      security,
      register: (a) => {
        a.addHook('onRoute', (r) => {
          const methods = Array.isArray(r.method) ? r.method : [r.method];
          if (methods.includes('GET')) gets.push(r.url);
        });
        for (const register of Object.values(REGISTRARS)) register(a);
      },
    });
    try {
      const unswept = gets.filter((u) => !(u in SWEPT_ROUTES) && !(u in EXEMPT_ROUTES));
      expect(unswept).toEqual([]);
      for (const u of Object.keys(SWEPT_ROUTES)) expect(gets, u).toContain(u);
      // Review round 1 F-4: an exempt route that is gone is not left listed.
      for (const u of Object.keys(EXEMPT_ROUTES)) expect(gets, u).toContain(u);
    } finally {
      await routesApp.close();
    }
  });
});

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

let root: string;
let fx: Fixture;
let hostile: HostileElement;
let repository: HostileRepository;
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
    // A state after the gate (task-072): the gate is then not the type's last state, so its element can
    // be the current one.
    states: { sequence: ['draft', S, 'x-end'], gates: { [S]: { reject: 'draft' } } },
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
  // task-072 (after task-059): two elements of the scope type, written to the working tree as a
  // project may hold them — the current one, in the gate state, whose title holds U+202E and NEL
  // (`/progress` and `/config` `scope.current.title`), and one in its scope (it carries the current
  // one's id) whose `ref` matches the hostile pattern (`completion.references[].id`).
  const folder = path.join(dir, 'docs', 'memory', 'tx');
  await mkdir(folder, { recursive: true });
  const element = (fields: Record<string, string>) =>
    `---\n${Object.entries(fields)
      .map(
        ([k, v]) =>
          `${k}: ${JSON.stringify(v)
            .replace(/\u202e/g, '\\u202e')
            .replace(/\u0085/g, '\\x85')}`,
      )
      .join('\n')}\n---\n\nBody.\n`;
  await writeFile(
    path.join(folder, `${SCOPE_CURRENT}.md`),
    element({ id: SCOPE_CURRENT, type: T, title: 'Scope \u202ecurrent\u0085', status: S }),
  );
  await writeFile(
    path.join(folder, 'tx-002-in-scope.md'),
    element({
      id: 'tx-002-in-scope',
      type: T,
      title: 'In scope',
      status: 'draft',
      parent: SCOPE_CURRENT,
      ref: 'm\u202e\u00851',
    }),
  );
}

/** The current element of the hostile scope type (task-072). */
const SCOPE_CURRENT = 'tx-001-current';

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
  // task-072: the repository display texts outside K1's fields (bug-035).
  repository = await addHostileRepositoryText(fx);
  await hostileUiYaml(fx.dir);
  const audited = auditedSnapshots(fx.env);
  registry = audited.snapshots;
  const store = await createMemoryStateStore();
  pid = (await store.add({ path: fx.dir, name: fx.name, remote: '' })).id;
  const projects = new ProjectList({
    store,
    snapshots: registry,
    bus: audited.bus,
    runner: audited.runner,
    writeLock: new InProcessWriteLock(),
    stateDir: path.join(root, 'state'),
    env: fx.env,
    homedir: fx.home,
  });
  app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: registry });
      registerProjectListRoutes(a, { projects });
    },
  });
}, HEAVY_MS);

afterAll(async () => {
  await app?.close();
  await registry?.closeAll();
  await rm(root, { recursive: true, force: true });
});

async function get(url: string): Promise<any> {
  const res = await app.inject({
    method: 'GET',
    url: url.startsWith('/api/') ? url : `/api/p/${pid}${url}`,
    headers: AUTH,
  });
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
      // task-072: the history of a state written by hand, the hostile directive, the project list
      // (after the header, which refreshes the stored name and remote).
      ['history', `/elements/${repository.handState.id}/history`],
      ['directive', `/directives/${repository.directive}`],
      ['projects.list.response', '/api/projects'],
      ['progress', '/progress'],
      ['traceability', '/traceability'],
      ['traceability', '/traceability?scope=project'],
    ];
    // Today in every role view of the identified user (task-072): each list holds rows.
    for (const view of (await get('')).roleViews as string[]) routes.push(['today', `/today?view=${view}`]);
    // Every element's detail: its descriptor's actor in each kind the fixture has (task-072).
    for (const e of (await get('/elements')).elements)
      if (e.id !== hostile.id) routes.push(['element', `/elements/${e.id}`]);
    const directives = await get('/directives');
    if (directives.entries[0]) routes.push(['directive', `/directives/${directives.entries[0].frontmatter.id}`]);
    if (doc) routes.push(['file-content', `/files/content?path=${encodeURIComponent(doc)}`]);
    if (tree) routes.push(['file-tree', `/files/tree?path=${encodeURIComponent(tree)}`]);
    expect(
      [doc, tree].every((v) => v !== undefined),
      'the fixture has documents',
    ).toBe(true);
    const problems: string[] = [];
    const reached = new Set<string>();
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
          if (TWICE.test(text)) problems.push(`${url} ${at}: escaped twice`);
        }
        if (rule.cls === 'b' && ONCE.test(text)) reached.add(key);
        if (rule.cls === 'a') {
          if (text.length > MAX_MESSAGE) problems.push(`${url} ${at}: ${text.length} characters`);
          if (text.includes(fx.dir) || text.includes(homedir())) problems.push(`${url} ${at}: a local folder`);
        }
      }
    }
    expect(problems).toEqual([]);
    // The hostile texts did reach (a) and (b) fields: the sweep is not vacuous.
    expect(checked).toBeGreaterThan(50);
    // Per-field reach (task-072 D72-10, AC-2): every (b) leaf of every swept schema was seen holding
    // the hostile U+202E escaped once, or names the test that covers it.
    // Review round 1 F-3: every route of SWEPT_ROUTES was read here, with its schema.
    const read = new Set(
      routes.map(([schema, url]) => {
        const at = (url.startsWith('/api/') ? url : `/api/p/${pid}${url}`).split('?')[0]!;
        const route = Object.keys(SWEPT_ROUTES).find((r) => new RegExp(`^${r.replace(/:[a-z]+/g, '[^/]+')}$`).test(at));
        return `${route} ${schema}`;
      }),
    );
    expect(Object.entries(SWEPT_ROUTES).filter(([r, schema]) => !read.has(`${r} ${schema}`))).toEqual([]);
    const swept = new Set(routes.map(([schema]) => schema));
    const leavesB = (await schemaFields()).filter((f) => swept.has(f.split(' ')[0]!) && classOf(f)?.cls === 'b');
    const unreached = leavesB.filter((leaf) => {
      if (leaf in REACHED_ELSEWHERE) return false;
      const [schema, at] = leaf.split(' ') as [string, string];
      const pattern = leafPattern(at);
      return ![...reached].some((k) => k.startsWith(`${schema} `) && pattern.test(k.slice(schema.length + 1)));
    });
    expect(unreached).toEqual([]);
    // Every (b) leaf listed as reached elsewhere is still a (b) leaf of a swept schema.
    for (const leaf of Object.keys(REACHED_ELSEWHERE)) expect(leavesB, leaf).toContain(leaf);
  });

  it('a title with U+202E and U+200B is escaped in /elements, /elements/:eid and the Today rows', async () => {
    const escaped = 'Hostile \\u202eeltit\\u200b title';
    const list = await get('/elements');
    expect(list.elements.find((e: any) => e.id === hostile.id).title).toBe(escaped);
    expect((await get(`/elements/${hostile.id}`)).element.title).toBe(escaped);
    const today = await get('/today');
    const rows = [...(today.requiresYou ?? []), ...today.waitingOnOthers].filter(
      (r: any) => r.element.id === hostile.id,
    );
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
