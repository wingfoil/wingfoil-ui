// task-056 AC-3 (bug-027, RP3-14 D13; spec-001 §3, spec-002 §1, spec-004 §5) — the commit texts the
// API serialises pass through the sanitiser of tool messages (`redactLocalPaths`: bounded, local
// folders redacted, control and bidi characters as visible escapes, capped at 4 000): the history
// entries' `subject`, `reason`, `author`, `approver`, the Memory events' `author`, `approver`,
// `reason`, and the descriptor's `rejection` in `/elements`, `/elements/:eid` and Today — after the
// descriptor matched the authors' emails, so a member whose committed name holds a bidi character is
// still the member. On a copy of the kanban fixture with the hostile-text variant (pinned CLI, real
// git).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies */
import type { FastifyInstance } from 'fastify';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { MAX_MESSAGE, neutralise } from '../../../server/src/git/redact.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import {
  addHostileText,
  buildFixture,
  copyFixture,
  memberByName,
  type Fixture,
  type HostileElement,
} from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { auditedSnapshots } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

/** A character the API must never send raw: Cc, Cf, Cs, Zl, Zp but newline and tab. */
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

let root: string;
let fx: Fixture;
let hostile: HostileElement;
let registry: Snapshots;
let app: FastifyInstance;
let pid: string;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-commit-text-')));
  const kanban = await buildFixture('kanban', { root: path.join(root, 'kanban') });
  fx = await copyFixture(kanban, path.join(root, 'hostile'));
  hostile = await addHostileText(fx);
  const audited = auditedSnapshots(fx.env);
  registry = audited.snapshots;
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
  expect(res.statusCode, res.body.slice(0, 300)).toBe(200);
  return res.json();
}

/** `text` as a sanitised tool message: no unsafe character, capped, no local folder. */
function expectSanitised(text: unknown, label: string): void {
  expect(typeof text, label).toBe('string');
  const s = text as string;
  expect(UNSAFE.test(s), `${label}: an unsafe character`).toBe(false);
  expect(s.length, `${label}: over the cap`).toBeLessThanOrEqual(MAX_MESSAGE);
  expect(s.includes(fx.dir), `${label}: the project folder`).toBe(false);
  expect(s.includes(homedir()), `${label}: the home folder`).toBe(false);
}

/** Every row of a Today body. */
function todayRows(today: any): any[] {
  return [
    ...(today.requiresYou ?? []),
    ...today.waitingOnOthers,
    ...(today.summary ?? []).flatMap((l: any) => l.items),
  ];
}

describe('commit texts in the API (bug-027)', () => {
  it('history: subject, reason, author and approver are escaped, redacted and capped', async () => {
    const history = await get(`/elements/${hostile.id}/history`);
    const edit = history.entries.find((e: any) => e.operation === null && e.subject.startsWith('edit '));
    const reject = history.entries.find((e: any) => e.operation === 'reject');
    expect(edit, 'the plain edit commit').toBeDefined();
    expect(reject, 'the reject').toBeDefined();
    for (const entry of history.entries) {
      for (const field of ['subject', 'reason', 'author', 'approver'] as const) {
        if (entry[field] !== null) expectSanitised(entry[field], `${entry.operation ?? 'edit'}.${field}`);
      }
    }
    expect(edit.subject).toContain('\\u202etxt.exe\\u200b \\x1b[31m \\x07');
    expect(edit.subject).toContain('<project>/docs/x.md');
    expect(edit.reason).toContain('because \\u202etxt.exe');
    expect(edit.author).toBe(`${neutralise(hostile.names.Jordan)} <${memberByName('Jordan').email}>`);
    expect(reject.approver).toContain(neutralise(hostile.names.Morgan));
    expect(reject.reason).toContain('Rejected \\u202etxt.exe');
    // The hostile texts are over the cap: head and tail around the omission line.
    expect(edit.subject).toContain('\n…\n');
  });

  it('/events/memory: author, approver and reason are escaped, redacted and capped', async () => {
    const page = await get('/events/memory?limit=100');
    const reject = page.events.find((e: any) => e.id === hostile.id && e.operation === 'reject');
    expect(reject, 'the reject event').toBeDefined();
    for (const event of page.events) {
      for (const field of ['author', 'approver', 'reason'] as const) {
        if (event[field] !== null) expectSanitised(event[field], `${event.sha}.${field}`);
      }
    }
    expect(reject.reason).toContain('Rejected \\u202etxt.exe');
    expect(reject.author).toBe(`${neutralise(hostile.names.Morgan)} <${memberByName('Morgan').email}>`);
  });

  it('the rejection in /elements, /elements/:eid and Today is sanitised; the actor is the member, matched by email', async () => {
    const list = await get('/elements');
    const detail = await get(`/elements/${hostile.id}`);
    const today = await get('/today');
    const descriptors = [
      list.elements.find((e: any) => e.id === hostile.id).descriptor,
      detail.descriptor,
      ...todayRows(today)
        .filter((r: any) => r.element.id === hostile.id)
        .map((r: any) => r.descriptor),
    ];
    expect(descriptors.length).toBeGreaterThanOrEqual(3);
    for (const d of descriptors) {
      expect(d.rejection, 'the rejection').toBeDefined();
      expect(d.rejection.by).toBe(neutralise(hostile.names.Morgan));
      expectSanitised(d.rejection.reason, 'rejection.reason');
      expect(d.rejection.reason).toContain('Rejected \\u202etxt.exe');
      // The submitter's committed name holds U+202E: still the member Jordan, by email (spec-003 §4).
      expect(d.actor).toMatchObject({
        kind: 'member',
        member: { name: 'Jordan', email: memberByName('Jordan').email },
      });
    }
    // Every element's rejection of the base fixture is unchanged text (nothing to escape).
    const plain = list.elements.find((e: any) => e.id !== hostile.id && e.descriptor?.rejection);
    expect(plain.descriptor.rejection.reason).toBe('Missing acceptance criteria');
  });
});
