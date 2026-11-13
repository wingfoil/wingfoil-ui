// task-056 review round 2 — `frontmatterBody` (`server/src/http/serialise.ts`): the frontmatter's
// `rejection_reason` is commit text (class (a)) as a whole, whatever its shape: a hand-committed
// list or object has every string leaf sanitised, its shape kept, the keys of a nested object left
// as keys; the other fields stay as written (class (d)).
import { describe, expect, it } from 'vitest';
import {
  descriptorBody,
  dnaBody,
  frontmatterBody,
  memoryEventBody,
  toolTextSanitiser,
  workflowsBody,
} from '../../../server/src/http/serialise.js';

const RLO = String.fromCodePoint(0x202e);
const ESC = String.fromCodePoint(0x1b);
const ROOT = '/nowhere/project';
const sanitise = toolTextSanitiser({ project: [ROOT], home: null });

describe('frontmatterBody', () => {
  it('a string rejection_reason is sanitised; the other fields stay as written', () => {
    const out = frontmatterBody({ id: 'x', title: `t${RLO}`, rejection_reason: `a ${RLO} ${ROOT}/x` }, sanitise);
    expect(out).toEqual({ id: 'x', title: `t${RLO}`, rejection_reason: 'a \\u202e <project>/x' });
  });

  it('a list or object rejection_reason has every string leaf sanitised, its shape and keys kept', () => {
    const value = [`a ${RLO}${ESC}[31m ${ROOT}/x`, { [`k${RLO}`]: '\nv\u2028', n: 1, nested: [`${ESC}`] }, null, true];
    const out = frontmatterBody({ id: 'x', rejection_reason: value }, sanitise);
    expect(out.rejection_reason).toEqual([
      'a \\u202e\\x1b[31m <project>/x',
      { [`k${RLO}`]: '\nv\\u2028', n: 1, nested: ['\\x1b'] },
      null,
      true,
    ]);
  });

  it('a frontmatter without rejection_reason is returned as it is', () => {
    const fm = { id: 'x', status: 's' };
    expect(frontmatterBody(fm, sanitise)).toBe(fm);
  });
});

// task-072 D72-2 — the open CLI sections of `/config`: every string escaped but the listed keys and
// the texts the adapter already sanitised; a field a newer CLI adds is escaped too.
describe('dnaBody and workflowsBody (task-072)', () => {
  const h = `x${RLO}${ESC}y`;
  const e = 'x\\u202e\\x1by';

  it('the DNA: every text escaped, role names, member and agent roles and record keys raw, shapes kept', () => {
    const dna = {
      version: 1,
      project: { name: h, description: h, extra: [h, { deep: h }] },
      modules: [{ name: h, path: h }],
      stacks: { technologies: [{ name: h, category: h }], methodologies: [{ name: h }] },
      team: {
        members: [{ name: h, email: h, roles: [`r${RLO}`] }],
        roles: [{ name: `r${RLO}`, description: h }],
        agents: [{ name: h, executes_as: [`r${RLO}`], approval_authority: false }],
      },
      paths: { [`k${RLO}`]: [h] },
    };
    expect(dnaBody(dna as never)).toEqual({
      version: 1,
      project: { name: e, description: e, extra: [e, { deep: e }] },
      modules: [{ name: e, path: e }],
      stacks: { technologies: [{ name: e, category: e }], methodologies: [{ name: e }] },
      team: {
        members: [{ name: e, email: e, roles: [`r${RLO}`] }],
        roles: [{ name: `r${RLO}`, description: e }],
        agents: [{ name: e, executes_as: [`r${RLO}`], approval_authority: false }],
      },
      paths: { [`k${RLO}`]: [e] },
    });
  });

  it('a WingFoil 0.2.x list: descriptions, actions and products escaped; names, kinds, roles, steps raw', () => {
    const list = {
      manifest: { version: 1, include: [`w${RLO}.yaml`] },
      workflows: [
        {
          name: `n${RLO}`,
          kind: 'main',
          element: `t${RLO}`,
          description: h,
          phases: [
            {
              name: `p${RLO}`,
              description: h,
              role: `r${RLO}`,
              actions: [h],
              produces: [h],
              approval: { by_role: `r${RLO}` },
              fallback: { step: `s${RLO}`, set_state: `s${RLO}` },
              include: `w${RLO}.yaml`,
              iterate_over: `i${RLO}`,
              optional: false,
            },
          ],
        },
      ],
    };
    const out = workflowsBody(list as never) as never as typeof list;
    expect(out.manifest).toEqual(list.manifest);
    expect(out.workflows[0]).toEqual({
      ...list.workflows[0],
      description: e,
      phases: [{ ...list.workflows[0]!.phases[0], description: e, actions: [e], produces: [e] }],
    });
  });

  it('a WingFoil 0.3.x list: the description escaped; the name raw; the sanitised texts never escaped twice', () => {
    const list = {
      baseline: { commit: 'a'.repeat(40) },
      workflows: [
        { name: `n${RLO}`, startable: true, includable: false, description: h, executableNow: true, more: h },
      ],
      diagnostics: [{ code: 'C', severity: 'warning', file: 'f', path: 'p', message: 'already \\u202e' }],
      message: 'already \\x1b',
      diagnosticsOmitted: 3,
    };
    expect(workflowsBody(list as never)).toEqual({
      ...list,
      workflows: [{ ...list.workflows[0], description: e, more: e }],
    });
  });
});

// task-072 review round 1 — F-2: a Memory event's `from` and `to` are only shown (the bell's
// *Updates*): class (b); its `type` and `id` stay keys. F-4: the actor's member and members, as every
// row of every Today list writes them (`descriptorBody`, `todayOf`).
describe('memoryEventBody and descriptorBody (task-072 review round 1)', () => {
  const h = `s${RLO}${ESC}`;
  const e = 's\\u202e\\x1b';

  it("an event's from and to escaped, its type and id raw", () => {
    const event = {
      sha: 'a'.repeat(40),
      timestamp: 't',
      operation: null,
      type: `t${RLO}`,
      id: `i${RLO}`,
      from: h,
      to: h,
      author: 'A',
      approver: null,
      reason: null,
    };
    expect(memoryEventBody(event as never, sanitise)).toMatchObject({ type: `t${RLO}`, id: `i${RLO}`, from: e, to: e });
  });

  it("the actor's member name and email and its members' names escaped, the role raw", () => {
    const descriptor = {
      id: 'x',
      type: 'task',
      status: 's',
      kind: 'gate',
      tone: 'human',
      verbs: [],
      actor: { kind: 'role', role: `r${RLO}`, member: { name: h, email: h }, members: [h, 'Plain'] },
    };
    expect(descriptorBody(descriptor as never, sanitise).actor).toEqual({
      kind: 'role',
      role: `r${RLO}`,
      member: { name: e, email: e },
      members: [e, 'Plain'],
    });
  });
});
