// task-072 AC-2 (bug-035; spec-004 §5, D72-1 … D72-9) — the repository display texts outside the
// fields task-056 named, on the hostile repository variant (`addHostileRepositoryText`): each comes
// back with U+202E and ESC as the visible escapes `\u202e` and `\x1b`, escaped once, where the route
// serialises it; the keys next to them stay raw; a member's name is the same escaped text in every
// body (the web compares them, D72-3); a documentation path stays usable as an address and gets its
// display `label` (D72-6); the error details the catalogue shows are escaped (D72-9).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies */
import type { FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { registerProjectListRoutes } from '../../../server/src/http/projects.js';
import { createLogger } from '../../../server/src/logging.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import { ProjectList } from '../../../server/src/projects/project-list.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { pinnedCli } from '../../harness/cli.js';
import {
  addHostileRepositoryText,
  buildFixture,
  copyFixture,
  escapedMark,
  hostileMark,
  HOSTILE_DNA_LABELS as L,
  type Fixture,
  type HostileRepository,
} from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git, run } from '../../harness/run.js';
import { auditedSnapshots } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

/** The hostile documentation file (its name holds U+202E and ESC). */
const DOC = `docs/guide/${hostileMark('doc')}.md`;
const DOC_LABEL = `docs/guide/${escapedMark('doc')}.md`;

const RLO = String.fromCodePoint(0x202e);
const ESC = String.fromCodePoint(0x1b);
/** A raw U+202E or ESC in a text: never in a display field. */
const rawText = (text: string): boolean => text.includes(RLO) || text.includes(ESC);
/** The same in a JSON text, which writes a raw ESC as the six characters `\u001b`. */
const rawJson = (json: string): boolean => json.includes(RLO) || json.includes('\\u001b');

interface World {
  fx: Fixture;
  registry: Snapshots;
  app: FastifyInstance;
  pid: string;
}

let root: string;
let kanban: Fixture;
let hostile: HostileRepository;
let main: World;

/** An app with the project routes and the project list over `fx`. */
async function world(fx: Fixture): Promise<World> {
  const audited = auditedSnapshots(fx.env);
  const registry = audited.snapshots;
  const store = await createMemoryStateStore();
  const pid = (await store.add({ path: fx.dir, name: fx.name, remote: '' })).id;
  const projects = new ProjectList({
    store,
    snapshots: registry,
    bus: audited.bus,
    runner: audited.runner,
    writeLock: new InProcessWriteLock(),
    stateDir: path.join(root, `state-${path.basename(fx.dir)}`),
    env: fx.env,
    homedir: fx.home,
  });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: registry });
      registerProjectListRoutes(a, { projects });
    },
  });
  return { fx, registry, app, pid };
}

const worlds: World[] = [];

/** A documentation folder (`dna add paths.docs`) holding the hostile document. */
async function hostileDocument(fx: Fixture): Promise<void> {
  await run(
    process.execPath,
    [pinnedCli().script, '--format', 'json', 'dna', 'add', 'paths.docs', '--value', 'docs/guide'],
    {
      cwd: fx.dir,
      env: fx.env,
    },
  );
  await mkdir(path.join(fx.dir, 'docs', 'guide'), { recursive: true });
  await writeFile(path.join(fx.dir, DOC), '# A hostile document\n');
  await git(fx.dir, ['add', '-A'], fx.env);
  await git(fx.dir, ['commit', '-qm', 'docs: a hostile document'], fx.env);
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-repository-text-')));
  kanban = await buildFixture('kanban', { root: path.join(root, 'kanban') });
  const fx = await copyFixture(kanban, path.join(root, 'hostile'));
  await hostileDocument(fx);
  hostile = await addHostileRepositoryText(fx);
  main = await world(fx);
  worlds.push(main);
}, HEAVY_MS);

afterAll(async () => {
  for (const w of worlds) {
    await w.app.close();
    await w.registry.closeAll();
  }
  await rm(root, { recursive: true, force: true });
});

async function get(url: string, w: World = main): Promise<any> {
  const res = await w.app.inject({ method: 'GET', url: `/api/p/${w.pid}${url}`, headers: AUTH });
  expect(res.statusCode, `${url}: ${res.body.slice(0, 300)}`).toBe(200);
  return res.json();
}

describe('the project header and the project list (D72-3, D72-4)', () => {
  it('the name, the identity name and email are escaped; the roles stay raw', async () => {
    const header = await get('');
    expect(header.name).toBe(escapedMark(L.projectName));
    expect(header.identity).toMatchObject({
      kind: 'member',
      name: escapedMark(L.member),
      email: 'alex\\u202e\\x1b@example.test',
    });
    expect(header.identity.roles).toContain('tech-lead');
    expect(rawJson(JSON.stringify(header))).toBe(false);
  });

  it('the project list names the project and its remote escaped (after a header read refreshed them)', async () => {
    await get('');
    const res = await main.app.inject({ method: 'GET', url: '/api/projects', headers: AUTH });
    expect(res.statusCode).toBe(200);
    const item = res.json().projects.find((p: any) => p.id === main.pid);
    expect(item.name).toBe(escapedMark(L.projectName));
    expect(item.remote).toBe('https://example.test/r\\u202eo\\x1b.git');
    expect(rawText(hostile.remote)).toBe(true);
  });

  it('already-listed names the stored project escaped, in its detail and its message', async () => {
    await get('');
    const res = await main.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { path: main.fx.dir },
    });
    expect(res.statusCode).toBe(422);
    const { error } = res.json();
    expect(error.code).toBe('already-listed');
    expect(error.detail.name).toBe(escapedMark(L.projectName));
    expect(error.message).toContain(escapedMark(L.projectName));
    expect(rawJson(res.body)).toBe(false);
  });
});

describe('/config (D72-2)', () => {
  it('every DNA text is escaped; role names, member roles and agent roles stay raw', async () => {
    const dna = (await get('/config')).dna.data;
    expect(dna.project).toMatchObject({
      name: escapedMark(L.projectName),
      description: escapedMark(L.description),
      methodology: escapedMark(L.methodology),
    });
    expect(dna.modules).toContainEqual({
      name: escapedMark(L.module),
      description: escapedMark(L.moduleDescription),
      path: escapedMark(L.modulePath),
    });
    expect(dna.stacks.technologies).toContainEqual({
      name: escapedMark(L.technology),
      category: escapedMark(L.category),
      version: escapedMark(L.version),
      notes: escapedMark(L.notes),
    });
    expect(dna.stacks.methodologies).toContainEqual({
      name: escapedMark(L.stackMethodology),
      phase: escapedMark(L.phase),
    });
    expect(dna.team.roles[0].description).toBe(escapedMark(L.roleDescription));
    expect(dna.team.agents[0].name).toBe(escapedMark(L.agent));
    expect(dna.team.members).toContainEqual(
      expect.objectContaining({ name: escapedMark(L.member), email: 'alex\\u202e\\x1b@example.test' }),
    );
    expect(dna.paths.hostile).toEqual([escapedMark(L.docsPath)]);
    // The keys, as the DNA holds them.
    const file = parse(await readFile(path.join(main.fx.dir, '.wingfoil', 'dna.yaml'), 'utf8')) as any;
    expect(dna.team.roles.map((r: any) => r.name)).toEqual(file.team.roles.map((r: any) => r.name));
    expect(dna.team.members.map((m: any) => m.roles)).toEqual(file.team.members.map((m: any) => m.roles));
    expect(dna.team.agents.map((a: any) => a.executes_as)).toEqual(file.team.agents.map((a: any) => a.executes_as));
    expect(rawJson(JSON.stringify(dna))).toBe(false);
  });

  it('a workflow description is escaped; the workflow names stay raw', async () => {
    const workflows = (await get('/config')).workflows.data.workflows as any[];
    const bug = workflows.find((w) => w.name === 'bug-ingest');
    expect(bug.description).toBe(escapedMark(L.workflow));
    expect(workflows.map((w) => w.name)).toContain('sw-life-cycle');
  });
});

describe('the same escaped name in every body (D72-3)', () => {
  it('the DNA member, the header identity and the descriptors name Alex with one text', async () => {
    const name = escapedMark(L.member);
    const header = await get('');
    const dna = (await get('/config')).dna.data;
    const list = await get('/elements');
    expect(header.identity.name).toBe(name);
    expect(dna.team.members.map((m: any) => m.name)).toContain(name);
    const actors = list.elements.flatMap((e: any) =>
      e.descriptor ? [e.descriptor.actor.member?.name, ...(e.descriptor.actor.members ?? [])] : [],
    );
    expect(actors).toContain(name);
    expect(rawJson(JSON.stringify(list.elements.map((e: any) => e.descriptor)))).toBe(false);
    const today = await get('/today');
    expect(rawJson(JSON.stringify(today))).toBe(false);
  });
});

describe('directives (D72-5)', () => {
  it('the list entry and the page name and title the directive escaped; the id stays raw', async () => {
    const list = await get('/directives');
    const entry = list.entries.find((e: any) => e.frontmatter.id === hostile.directive);
    expect(entry.frontmatter).toMatchObject({
      name: escapedMark(L.directiveName),
      title: escapedMark(L.directiveTitle),
    });
    const page = await get(`/directives/${hostile.directive}`);
    expect(page.entry.frontmatter.title).toBe(escapedMark(L.directiveTitle));
    expect(page.frontmatter).toMatchObject({
      id: hostile.directive,
      name: escapedMark(L.directiveName),
      title: escapedMark(L.directiveTitle),
    });
    expect(page.body).toContain('# A hostile directive');
  });
});

describe('history (D72-8)', () => {
  it('a state written by hand reaches from and to escaped', async () => {
    const history = await get(`/elements/${hostile.handState.id}/history`);
    const state = escapedMark(L.state);
    expect(history.entries.map((e: any) => [e.from, e.to])).toEqual(
      expect.arrayContaining([
        ['draft', state],
        [state, 'draft'],
      ]),
    );
    expect(rawJson(JSON.stringify(history))).toBe(false);
  });
});

describe('documentation and files (D72-6, D72-7)', () => {
  it('a document keeps its raw path (the address) and gets an escaped label', async () => {
    const docs = await get('/docs');
    const doc = docs.documents.find((d: any) => d.path === DOC);
    expect(doc).toEqual({ path: DOC, label: DOC_LABEL });
    for (const d of docs.documents) expect(rawText(d.label)).toBe(false);
    const content = await get(`/files/content?path=${encodeURIComponent(DOC)}`);
    expect(content).toMatchObject({ path: DOC, label: DOC_LABEL, content: '# A hostile document\n' });
  });

  it('a file-tree entry name is escaped; its path stays the address', async () => {
    const tree = await get(`/files/tree?path=${encodeURIComponent('docs/guide')}`);
    const entry = tree.entries.find((e: any) => e.path === DOC);
    expect(entry.name).toBe(`${escapedMark('doc')}.md`);
  });
});

describe('error details the catalogue shows (D72-9)', () => {
  it('read-error: the directive file outside the project is named escaped in the message and the detail', async () => {
    const fx = await copyFixture(kanban, path.join(root, 'linked'));
    const outside = path.join(root, 'outside-directive.md');
    await writeFile(
      outside,
      [
        '---',
        'id: linked',
        'name: linked',
        'type: directive',
        'kind: custom',
        'title: "Linked"',
        'format: 1',
        '---',
        '',
        'x',
        '',
      ].join('\n'),
    );
    const link = `link-${hostileMark('d')}.md`;
    await symlink(outside, path.join(fx.dir, '.wingfoil', 'directives', 'custom', link));
    await git(fx.dir, ['add', '-A'], fx.env);
    await git(fx.dir, ['commit', '-qm', 'docs: a linked directive'], fx.env);
    const w = await world(fx);
    worlds.push(w);
    const res = await w.app.inject({ method: 'GET', url: `/api/p/${w.pid}/directives/linked`, headers: AUTH });
    expect(res.statusCode, res.body).toBe(502);
    const { error } = res.json();
    expect(error.code).toBe('read-error');
    const shown = `.wingfoil/directives/custom/link-${escapedMark('d')}.md`;
    expect(error.detail.file).toBe(shown);
    expect(error.message).toContain(shown);
    expect(rawJson(res.body)).toBe(false);
  });

  it('an ambiguous identity names its members escaped', async () => {
    const fx = await copyFixture(kanban, path.join(root, 'ambiguous'));
    const file = path.join(fx.dir, '.wingfoil', 'dna.yaml');
    const dna = parse(await readFile(file, 'utf8')) as any;
    const morgan = dna.team.members.find((m: any) => m.name === 'Morgan');
    const alex = dna.team.members.find((m: any) => m.name === 'Alex');
    morgan.name = hostileMark('Morgan');
    morgan.email = alex.email;
    await writeFile(file, `${JSON.stringify(dna, null, 1).replace(/\u202e/g, '\\u202e')}\n`);
    await git(fx.dir, ['add', '-A'], fx.env);
    await git(fx.dir, ['commit', '-qm', 'docs: two members, one email'], fx.env);
    await git(fx.dir, ['config', 'user.email', alex.email], fx.env);
    const w = await world(fx);
    worlds.push(w);
    const header = await get('', w);
    expect(header.identity.kind).toBe('ambiguous');
    expect(header.identity.members).toEqual(expect.arrayContaining([escapedMark('Morgan'), 'Alex']));
  });
});
