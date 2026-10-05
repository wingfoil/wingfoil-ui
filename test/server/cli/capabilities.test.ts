// REQ-INT-03, adr-001 D3, spec-001 §6 — each capability is enabled, read-only with the reason or
// hidden, from the detected version, the supported range and the project conditions.
import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  evaluateCapabilities,
  type Capability,
  type CapabilityStatus,
} from '../../../server/src/cli/capabilities.js';
import { classifyVersion, rangeFromMatrix } from '../../../server/src/cli/version.js';

const v01 = rangeFromMatrix({ pinned: '0.2.2', versions: ['0.2.2'] });
const v04 = rangeFromMatrix({ pinned: '0.3.0', versions: ['0.2.2', '0.3.0'] });

const table: Capability[] = [
  { id: 'gate-decision', name: 'Gate decision', minVersion: '0.2.2', via: 'memory approve/reject', conditions: [] },
  { id: 'workflow-next-step', name: 'Next workflow step', minVersion: '0.3.0', via: null, conditions: [] },
  { id: 'agent-launch', name: 'Agent launch', minVersion: '0.3.0', via: null, conditions: [] },
  { id: 'field-editing', name: 'Field editing', minVersion: null, via: null, conditions: [] },
  { id: 'push', name: 'Push', minVersion: '0.2.2', via: 'git push', conditions: ['remote'] },
];

function byId(statuses: readonly CapabilityStatus[]): Record<string, CapabilityStatus> {
  return Object.fromEntries(statuses.map((s) => [s.id, s]));
}

describe('evaluateCapabilities', () => {
  it('S-08.1 — 0.2.2 in the v0.1 range: the 0.2.2 capabilities enabled, nothing of this release missing', () => {
    const result = evaluateCapabilities(classifyVersion('0.2.2', v01), v01, { table, conditions: ['remote'] });
    const s = byId(result.capabilities);
    expect(s['gate-decision']).toEqual({ id: 'gate-decision', state: 'enabled' });
    expect(s['push']).toEqual({ id: 'push', state: 'enabled' });
    // Above the range: not a capability of this release, read-only with the version it needs.
    expect(s['workflow-next-step']).toEqual({
      id: 'workflow-next-step',
      state: 'read-only',
      reason: { code: 'needs-version', minVersion: '0.3.0' },
    });
    expect(s['field-editing']).toEqual({
      id: 'field-editing',
      state: 'read-only',
      reason: { code: 'not-released' },
    });
    expect(result.missing).toEqual([]);
  });

  it('S-08.3 shape — 0.2.2 in a 0.2.2–0.3.x range: the 0.3 capabilities are listed as missing', () => {
    const result = evaluateCapabilities(classifyVersion('0.2.2', v04), v04, { table });
    expect(result.missing).toEqual([
      { id: 'workflow-next-step', minVersion: '0.3.0' },
      { id: 'agent-launch', minVersion: '0.3.0' },
    ]);
    expect(byId(result.capabilities)['agent-launch']?.state).toBe('read-only');
    const newer = evaluateCapabilities(classifyVersion('0.3.0', v04), v04, { table });
    expect(byId(newer.capabilities)['agent-launch']?.state).toBe('enabled');
    expect(newer.missing).toEqual([]);
  });

  it.each(['0.4.0', '0.2.0', 'banana', '0.2.3-rc.1'])(
    'S-09.1 / S-09.2 — %s outside the range: 0 enabled, every applicable capability read-only naming the range',
    (text) => {
      const result = evaluateCapabilities(classifyVersion(text, v01), v01, { table, conditions: ['remote'] });
      expect(result.capabilities.filter((c) => c.state === 'enabled')).toHaveLength(0);
      for (const c of result.capabilities) {
        expect(c).toEqual({
          id: c.id,
          state: 'read-only',
          reason: { code: 'unsupported-version', range: { min: '0.2.2', max: '0.2.x' } },
        });
      }
      expect(result.missing).toEqual([]);
    },
  );

  it('S-11.2 shape — a capability whose project condition does not hold is hidden, whatever the version', () => {
    expect(byId(evaluateCapabilities(classifyVersion('0.2.2', v01), v01, { table }).capabilities)['push']).toEqual({
      id: 'push',
      state: 'hidden',
    });
    expect(byId(evaluateCapabilities(classifyVersion('0.4.0', v01), v01, { table }).capabilities)['push']).toEqual({
      id: 'push',
      state: 'hidden',
    });
  });

  it('defaults to the table of contracts/capabilities.json, in its order', () => {
    const result = evaluateCapabilities(classifyVersion('0.2.2', v01), v01);
    expect(result.capabilities.map((c) => c.id)).toEqual(CAPABILITIES.map((c) => c.id));
  });
});
