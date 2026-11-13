// task-069 AC-2 (D69-8; spec-003 §8) — `contracts/api/descriptor.schema.json`'s `approveHeld`: the
// two holds of spec-005 §4a pass (a held gate as the descriptor builds it, on the 0.3.1 custom
// sample); an unknown condition or code, a count below 1 or not an integer, a missing reason or an
// extra key fail. The schema still compiles in Ajv strict mode.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeElement } from '../../server/src/descriptor/descriptor.js';
import { parseMemoryYaml } from '../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../harness/cli.js';

const schemaText = readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'descriptor.schema.json'), 'utf8');
const validate = new Ajv({ allErrors: true }).compile(JSON.parse(schemaText) as object);
const memoryYaml = parseMemoryYaml(
  readFileSync(path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.3.1/custom/files/memory.yaml'), 'utf8'),
);

function held(condition: 'never' | 'when-references-done', count: number) {
  return describeElement({ id: 'x-1', type: 'release', status: 'releasing' }, [], {
    memoryYaml,
    members: [],
    enablement: { identified: true, version: { supported: true, range: 'r' } },
    holds: { condition: () => condition, referencingNotDone: () => count },
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bodies mutated into invalid shapes
type Json = any;
const clone = (b: unknown): Json => JSON.parse(JSON.stringify(b));

describe('contracts/api/descriptor.schema.json — approveHeld', () => {
  it('compiles in Ajv strict mode', () => {
    expect(() => new Ajv({ strict: true }).compile(JSON.parse(schemaText) as object)).not.toThrow();
  });

  it.each([
    ['never', held('never', 0)],
    ['when-references-done', held('when-references-done', 3)],
  ])('accepts a held gate (%s)', (_label, body) => {
    expect(body.approveHeld).toBeDefined();
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each<[string, (b: Json) => void]>([
    ['an unknown condition', (b) => (b.approveHeld.condition = 'later')],
    ['an unknown code', (b) => (b.approveHeld.reason = { code: 'held-elsewhere' })],
    ['a count of 0', (b) => (b.approveHeld.reason.count = 0)],
    ['a count that is not an integer', (b) => (b.approveHeld.reason.count = 1.5)],
    ['a counted hold without its count', (b) => delete b.approveHeld.reason.count],
    ['a count on held-by-config', (b) => (b.approveHeld.reason = { code: 'held-by-config', count: 1 })],
    ['no reason', (b) => delete b.approveHeld.reason],
    ['no condition', (b) => delete b.approveHeld.condition],
    ['an extra key', (b) => (b.approveHeld.since = 'now')],
    // Review F4: the condition and the reason code go together (spec-005 §4a).
    ['never with a counted reason', (b) => (b.approveHeld.condition = 'never')],
    ['when-references-done with held-by-config', (b) => (b.approveHeld.reason = { code: 'held-by-config' })],
  ])('refuses %s', (_label, mutate) => {
    const body = clone(held('when-references-done', 2));
    mutate(body);
    expect(validate(body)).toBe(false);
  });
});

// task-073 D73-6 (spec-003 §6 rule 5): the `state-limit` reason — `sprint-002`'s submit into the full
// `active` (S-24.7) as the descriptor builds it passes; a missing or invalid parameter, or an extra
// key, fails.
function limited() {
  return describeElement({ id: 'sprint-002', type: 'sprint', status: 'planned' }, [], {
    memoryYaml,
    members: [],
    enablement: { identified: true, version: { supported: true, range: 'r' } },
    occupancy: () => 1,
  });
}

describe('contracts/api/descriptor.schema.json — state-limit (task-073)', () => {
  it('accepts a state-limit reason', () => {
    const body = limited();
    expect(body.verbs[0]?.reason).toEqual({ code: 'state-limit', state: 'active', limit: 1 });
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each<[string, (b: Json) => void]>([
    ['state-limit without limit', (b) => delete b.verbs[0].reason.limit],
    ['state-limit without state', (b) => delete b.verbs[0].reason.state],
    ['a limit of 0', (b) => (b.verbs[0].reason.limit = 0)],
    ['a limit that is not an integer', (b) => (b.verbs[0].reason.limit = 1.5)],
    ['a state that is not a string', (b) => (b.verbs[0].reason.state = 1)],
    ['an extra key', (b) => (b.verbs[0].reason.count = 1)],
  ])('refuses %s', (_label, mutate) => {
    const body = clone(limited());
    expect(body.verbs[0].reason).toBeDefined();
    mutate(body);
    expect(validate(body)).toBe(false);
  });
});
