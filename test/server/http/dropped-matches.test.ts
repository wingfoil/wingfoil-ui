// task-070 AC-1 (bug-024, RP3-14 D10; spec-001 §2, spec-004 §5; D70-3, D70-4) and AC-5 (bug-036, the
// declared limitation of D70-9 (a)) — the reads behind `memory search` on the real CLIs of the
// support matrix, on copies of the kanban fixture with Memory files that are not elements committed
// under a Memory path:
//
// - WingFoil 0.2.2 returns a file without frontmatter (and a deprecated file without `type`) as a
//   match: the Memory list, the element read, its history and Today answer 200 with the valid
//   elements, `/elements` names the dropped file in `warnings`, `?archived=true` the archived one;
// - WingFoil 0.3.1 leaves them out with no warning (W-47), and a frontmatter that does not parse
//   with its `W_MEMORY_UNREADABLE` warning, which stays a warning;
// - WingFoil 0.2.2 exits 2 on a frontmatter that does not parse, with no list and no file named:
//   the reads answer 500 `internal` — the declared limitation, pinned here so a change shows.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies */
import type { FastifyInstance } from 'fastify';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { buildFixture, copyFixture, memberByName, type Fixture } from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { cliBuildFor } from '../../contracts/support.js';
import { auditedSnapshots } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const LOGIN = 'task-001-login-form';

const NOTES = 'docs/memory/bug/notes.md';
const PARTIAL = 'docs/memory/bug/partial.md';
const BROKEN = 'docs/memory/bug/broken.md';
const NOTES_WARNING = `memory search left out ${NOTES}: not a Memory element (id, title, type, status missing or not text)`;
const PARTIAL_WARNING = `memory search left out ${PARTIAL}: not a Memory element (type missing or not text)`;

let ws: TempWorkspace;
const templates = new Map<string, Fixture>();
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];
let n = 0;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-070-matches-');
  const root = await realpath(ws.dir);
  templates.set('0.3.1', await buildFixture('kanban', { root: path.join(root, 'kanban-0.3.1') }));
  templates.set(
    '0.2.2',
    await buildFixture('kanban', {
      root: path.join(root, 'kanban-0.2.2'),
      cli: await cliBuildFor('0.2.2'),
      cliVersion: '0.2.2',
    }),
  );
}, HEAVY_MS);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws?.dispose();
});

/** The files committed on the copy (project-relative path → content). */
type Files = Record<string, string>;

const NON_ELEMENTS: Files = {
  [NOTES]: 'Just notes, no frontmatter.\n',
  [PARTIAL]: '---\nid: partial-x\ntitle: Partial\nstatus: deprecated\n---\nbody\n',
};

/** A copy of the `version` kanban fixture with `files` committed, and a reader on it. */
async function start(version: string, files: Files) {
  n += 1;
  const fx = await copyFixture(templates.get(version)!, path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', memberByName('Morgan').email], fx.env);
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(fx.dir, rel)), { recursive: true });
    await writeFile(path.join(fx.dir, rel), text);
  }
  await git(fx.dir, ['add', '--', ...Object.keys(files)], fx.env);
  await git(fx.dir, ['commit', '--quiet', '-m', 'docs: files that are not elements'], fx.env);
  const audited = auditedSnapshots(fx.env);
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const pid = (await store.add({ path: fx.dir, name: fx.name, remote: '' })).id;
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(new Writable({ write: (_c, _e, cb) => cb() })),
    security,
    register: (a) => registerProjectRoutes(a, { store, snapshots: audited.snapshots }),
  });
  apps.push(app);
  return async (url: string): Promise<{ status: number; body: any }> => {
    const res = await app.inject({ method: 'GET', url: `/api/p/${pid}${url}`, headers: AUTH });
    return { status: res.statusCode, body: res.json() };
  };
}

const ids = (body: any): string[] => (body.elements as { id: string }[]).map((e) => e.id);

describe('WingFoil 0.2.2 — a file that is not an element no longer hides the project (bug-024)', () => {
  it(
    '/elements: 200, the valid elements, one warning naming the file',
    async () => {
      const get = await start('0.2.2', NON_ELEMENTS);
      const res = await get('/elements');
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
      expect(ids(res.body)).toContain(LOGIN);
      expect(ids(res.body)).toHaveLength(5);
      expect(res.body.warnings).toEqual([NOTES_WARNING]);
    },
    HEAVY_MS,
  );

  it(
    '/elements?archived=true also names the dropped archived match (D70-4), each warning once',
    async () => {
      const get = await start('0.2.2', NON_ELEMENTS);
      const res = await get('/elements?archived=true');
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
      expect(res.body.warnings).toEqual([NOTES_WARNING, PARTIAL_WARNING]);
      expect(ids(res.body)).not.toContain('partial-x');
    },
    HEAVY_MS,
  );

  it(
    'the element read, its history, Today and the header answer 200 on the valid matches',
    async () => {
      const get = await start('0.2.2', NON_ELEMENTS);
      for (const url of [`/elements/${LOGIN}`, `/elements/${LOGIN}/history`, '/today', '']) {
        const res = await get(url);
        expect(res.status, `${url}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
      }
      const today = (await get('/today')).body;
      expect(JSON.stringify(today)).toContain(LOGIN);
      expect(JSON.stringify(today)).not.toContain('notes.md');
    },
    HEAVY_MS,
  );
});

describe('WingFoil 0.3.1 — what the pinned CLI already leaves out', () => {
  it(
    'the same files are absent without a warning (W-47); a broken frontmatter is its CLI warning',
    async () => {
      const get = await start('0.3.1', { ...NON_ELEMENTS, [BROKEN]: '---\nid: [unclosed\ntype: bug\n---\n' });
      const res = await get('/elements?archived=true');
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
      expect(ids(res.body)).toContain(LOGIN);
      expect(res.body.warnings).toHaveLength(1);
      expect(res.body.warnings[0]).toMatch(new RegExp(`^W_MEMORY_UNREADABLE \\(${BROKEN}\\): unreadable frontmatter`));
    },
    HEAVY_MS,
  );
});

describe('WingFoil 0.2.2 — a frontmatter that does not parse (bug-036, the declared limitation)', () => {
  it(
    'memory search exits 2 with no list: the reads behind it answer 500 internal, no CLI text',
    async () => {
      const get = await start('0.2.2', { [BROKEN]: '---\nid: [unclosed\ntype: bug\n---\n' });
      for (const url of ['/elements', '/today']) {
        const res = await get(url);
        expect(res.status, url).toBe(500);
        expect(res.body).toEqual({ error: { code: 'internal', message: 'Internal error' } });
      }
    },
    HEAVY_MS,
  );
});
