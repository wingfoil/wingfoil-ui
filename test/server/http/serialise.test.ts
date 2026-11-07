// task-056 review round 2 — `frontmatterBody` (`server/src/http/serialise.ts`): the frontmatter's
// `rejection_reason` is commit text (class (a)) as a whole, whatever its shape: a hand-committed
// list or object has every string leaf sanitised, its shape kept, the keys of a nested object left
// as keys; the other fields stay as written (class (d)).
import { describe, expect, it } from 'vitest';
import { frontmatterBody, toolTextSanitiser } from '../../../server/src/http/serialise.js';

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
    const value = [`a ${RLO}${ESC}[31m ${ROOT}/x`, { [`k${RLO}`]: '\nv ', n: 1, nested: [`${ESC}`] }, null, true];
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
