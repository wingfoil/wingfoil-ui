// spec-011 §3 (task-057 AC-2; the approver's Q1-a) — the resolution of the element read's `:eid`
// over the state's `memory search` lists, without fixtures: (1) a live full id, (2) an archived
// full id, (3) a live short id, (4) an archived short id only when no live element has it, else
// none; several matches in one step → the 409's detail, at most 20 candidates ordered by full id,
// `more` the rest, titles through the character escape of repository texts (RP3-18 K1).
import { describe, expect, it } from 'vitest';
import type { MemoryMatch } from '../../../contracts/src/cli.js';
import { AMBIGUOUS_CANDIDATES_MAX, resolveElementId } from '../../../server/src/http/element-address.js';
import { shortIdOf } from '../../../server/src/reads/short-id.js';

const PATTERNS: Record<string, string> = { task: 'task-{n}-{slug}', sprint: 'sprint-{n}', mixed: 'task-{n}' };
const shortIds = (m: { id: string; type: string }) => shortIdOf(m.id, PATTERNS[m.type]);

function match(id: string, type = 'task', status = 'draft', title = `Title of ${id}`): MemoryMatch {
  return { path: `docs/${type}/${id}.md`, id, title, type, status, tags: [] };
}

/** The lists, and how often the archived ones were asked for (each ask = the two lazy searches). */
function lists(live: MemoryMatch[], archived: MemoryMatch[] = []) {
  const calls = { archived: 0 };
  return {
    calls,
    source: {
      live: async () => live,
      archived: async () => {
        calls.archived += 1;
        return archived;
      },
      shortIds,
    },
  };
}

describe('resolveElementId — the order of spec-011 §3', () => {
  it('step 1: a live full id, without the archived lists', async () => {
    const { source, calls } = lists([match('task-046-a')], [match('task-046-b', 'task', 'deprecated')]);
    expect(await resolveElementId('task-046-a', source)).toEqual({ id: 'task-046-a' });
    expect(calls.archived).toBe(0);
  });

  it('step 2: an archived full id wins over a live short id (a full id always wins, Q1-a)', async () => {
    // An archived element whose full id equals a live element's short id.
    const { source } = lists([match('task-046-live')], [match('task-046', 'mixed', 'deprecated')]);
    expect(await resolveElementId('task-046', source)).toEqual({ id: 'task-046' });
  });

  it('step 3: one live short id → that element', async () => {
    const { source } = lists([match('task-046-a'), match('task-047-b')], [match('task-046-c', 'task', 'deprecated')]);
    expect(await resolveElementId('task-046', source)).toEqual({ id: 'task-046-a' });
  });

  it('step 3 skips an element whose short id is its full id (sprint-001 is found by step 1 only)', async () => {
    const { source } = lists([match('sprint-001', 'sprint')]);
    expect(await resolveElementId('sprint-001', source)).toEqual({ id: 'sprint-001' });
    expect(await resolveElementId('sprint-01', source)).toBeUndefined();
  });

  it('step 4: an archived short id only when no live element has it', async () => {
    const archived = [match('task-050-old', 'task', 'superseded')];
    expect(await resolveElementId('task-050', lists([match('task-046-a')], archived).source)).toEqual({
      id: 'task-050-old',
    });
    // A live match is chosen over an archived one with the same short id; no archived candidate.
    const both = lists([match('task-050-new')], [...archived, match('task-050-older', 'task', 'deprecated')]);
    expect(await resolveElementId('task-050', both.source)).toEqual({ id: 'task-050-new' });
  });

  it('step 5: no match → none; the comparison is exact (E2)', async () => {
    const { source } = lists([match('task-046-a')], [match('task-047-b', 'task', 'deprecated')]);
    for (const eid of ['task-46', 'task-0046', 'TASK-046', 'task-046-', 'task-04', ' task-046', 'task-046-A', '']) {
      expect(await resolveElementId(eid, source), eid).toBeUndefined();
    }
  });
});

describe('resolveElementId — an ambiguous short id (409 detail)', () => {
  it('lists the candidates of the live step, ordered by full id, with their short ids', async () => {
    const live = [match('task-046-b', 'task', 'approved'), match('task-046-a'), match('task-047-c')];
    const { source } = lists(live, [match('task-046-0', 'task', 'deprecated')]);
    expect(await resolveElementId('task-046', source)).toEqual({
      ambiguous: {
        candidates: [
          { id: 'task-046-a', shortId: 'task-046', title: 'Title of task-046-a', type: 'task', status: 'draft' },
          { id: 'task-046-b', shortId: 'task-046', title: 'Title of task-046-b', type: 'task', status: 'approved' },
        ],
        more: 0,
      },
    });
  });

  it('lists archived candidates only when no live element matches', async () => {
    const archived = [match('task-050-b', 'task', 'deprecated'), match('task-050-a', 'task', 'superseded')];
    const result = await resolveElementId('task-050', lists([match('task-046-a')], archived).source);
    expect(result).toMatchObject({ ambiguous: { candidates: [{ id: 'task-050-a' }, { id: 'task-050-b' }], more: 0 } });
  });

  it(`caps the candidates at ${AMBIGUOUS_CANDIDATES_MAX} and counts the rest`, async () => {
    expect(AMBIGUOUS_CANDIDATES_MAX).toBe(20);
    const many = Array.from({ length: 25 }, (_, i) => match(`task-046-${String(24 - i).padStart(2, '0')}`));
    const result = (await resolveElementId('task-046', lists(many).source)) as {
      ambiguous: { candidates: { id: string }[]; more: number };
    };
    expect(result.ambiguous.candidates.map((c) => c.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `task-046-${String(i).padStart(2, '0')}`),
    );
    expect(result.ambiguous.more).toBe(5);
  });

  it('orders by code unit, whatever the locale (uppercase before lowercase)', async () => {
    const result = await resolveElementId('task-046', lists([match('task-046-b'), match('task-046-B')]).source);
    expect(result).toMatchObject({ ambiguous: { candidates: [{ id: 'task-046-B' }, { id: 'task-046-b' }] } });
  });

  it('escapes the titles (NUL, bidi override, backslash), never the ids, types or states', async () => {
    const hostile = 'Evil\u0000 ‮txt.exe \\ end';
    const result = await resolveElementId(
      'task-046',
      lists([match('task-046-a', 'task', 'draft', hostile), match('task-046-b')]).source,
    );
    const [first] = (result as { ambiguous: { candidates: { title: string; id: string }[] } }).ambiguous.candidates;
    expect(first!.title).toBe('Evil\\x00 \\u202etxt.exe \\\\ end');
    expect(first!.id).toBe('task-046-a');
  });
});
