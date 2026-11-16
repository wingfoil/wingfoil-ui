// task-079 — the rule of *Use preset* (AC-1, spec-005 §5; D79-2, Q5 (a) of W3-1): hidden, disabled with
// the reason of spec-003 §6 in its order, or enabled, from the project header and the served `ui`
// section only; the server re-checks every one of them.
import type { Identity, ProjectHeader, RepositoryCopy, UiConfig } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { presetControl } from '../../../web/src/configuration/preset-control.js';
import { BO, header, OUTSIDER } from '../dna/data.js';
import { UI_DECLARED, UI_IGNORED, UI_INFERRED } from './data.js';

/** Bo's header with `copy` (and `behind`) and an optional out-of-range version. */
function headerWith(copy: RepositoryCopy, over: { behind?: number; range?: string; identity?: Identity } = {}) {
  const h: ProjectHeader = header(over.identity ?? BO, 'r-dev');
  h.repository = { ...h.repository, copy, behind: over.behind ?? 0 };
  if (over.range !== undefined) h.readOnly = [...h.readOnly, { code: 'version-unsupported', range: over.range }];
  return h;
}

describe('hidden', () => {
  it.each<[string, ProjectHeader | undefined, UiConfig | undefined]>([
    ['the header not read yet', undefined, UI_INFERRED],
    ['/config not read yet, or no ui section (memory.yaml unreadable)', headerWith('in-sync'), undefined],
    ['ui.yaml exists and is used (C-02.3)', headerWith('in-sync'), UI_DECLARED],
    ['ui.yaml exists and is ignored', headerWith('in-sync'), UI_IGNORED],
    ['a user not in the team (C-02.5)', headerWith('in-sync', { identity: OUTSIDER }), UI_INFERRED],
    ['no identity', headerWith('in-sync', { identity: { kind: 'no-identity' } }), UI_INFERRED],
    [
      'an ambiguous identity',
      headerWith('in-sync', { identity: { kind: 'ambiguous', email: 'x@x.test', members: ['Bo', 'Cy'] } }),
      UI_INFERRED,
    ],
  ])('%s', (_name, h, ui) => {
    expect(presetControl(h, ui)).toEqual({ kind: 'hidden' });
  });

  it('a member after a failed `dna show` is matched against no member: hidden', () => {
    const h = headerWith('in-sync', { identity: OUTSIDER });
    h.dnaError = { code: 'cli-output', message: 'x' };
    expect(presetControl(h, UI_INFERRED)).toEqual({ kind: 'hidden' });
  });
});

describe('disabled, with the reason of spec-003 §6 in its order', () => {
  it('the WingFoil version out of range', () => {
    expect(presetControl(headerWith('in-sync', { range: '0.2.2 – 0.3.x' }), UI_INFERRED)).toEqual({
      kind: 'disabled',
      reason: { code: 'version-unsupported', range: '0.2.2 – 0.3.x' },
    });
  });

  it('the copy behind, with the count (C-02.4)', () => {
    expect(presetControl(headerWith('behind', { behind: 1 }), UI_INFERRED)).toEqual({
      kind: 'disabled',
      reason: { code: 'copy-behind', commits: 1 },
    });
  });

  it('the copy diverged', () => {
    expect(presetControl(headerWith('diverged'), UI_INFERRED)).toEqual({
      kind: 'disabled',
      reason: { code: 'copy-diverged' },
    });
  });

  it('the copy detached', () => {
    expect(presetControl(headerWith('detached'), UI_INFERRED)).toEqual({
      kind: 'disabled',
      reason: { code: 'copy-detached' },
    });
  });

  it('the version comes before the copy', () => {
    expect(presetControl(headerWith('behind', { behind: 2, range: '0.2.2' }), UI_INFERRED)).toEqual({
      kind: 'disabled',
      reason: { code: 'version-unsupported', range: '0.2.2' },
    });
  });
});

describe('enabled', () => {
  it.each<RepositoryCopy>(['in-sync', 'ahead', 'no-remote', 'no-upstream'])('the copy %s', (copy) => {
    expect(presetControl(headerWith(copy), UI_INFERRED)).toEqual({ kind: 'enabled' });
  });
});
