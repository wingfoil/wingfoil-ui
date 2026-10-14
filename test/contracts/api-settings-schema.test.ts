// spec-006 §2, spec-004 §3 (RP-28, RP-39) — `contracts/api/settings.schema.json`: the body of
// `GET /api/settings`, of the `PUT /api/settings` request (the whole object) and of its answer.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UiSettings } from '../../contracts/src/state.js';
import { REPO_ROOT } from '../harness/cli.js';

const schema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api/settings.schema.json'), 'utf8')) as {
  properties: Record<string, { default: unknown }>;
};
const validate = new Ajv({ allErrors: true }).compile(schema);

/** The defaults of spec-006 §2, typed with the contract type (a type drift fails `typecheck`). */
const DEFAULTS: UiSettings = {
  autoFetch: true,
  fetchIntervalSeconds: 60,
  autoUpdate: false,
  autoPush: false,
  theme: 'system',
  confirmAgentLaunch: true,
  actionLogCap: 5000,
};

describe('settings.schema.json', () => {
  it('declares exactly the spec-006 §2 keys, each with its default', () => {
    expect(Object.fromEntries(Object.entries(schema.properties).map(([k, p]) => [k, p.default]))).toEqual(DEFAULTS);
  });

  it('accepts the defaults and the edges of each range', () => {
    expect(validate(DEFAULTS)).toBe(true);
    for (const patch of [
      { fetchIntervalSeconds: 15 },
      { fetchIntervalSeconds: 3600 },
      { actionLogCap: 100 },
      { actionLogCap: 100_000 },
      { theme: 'light' },
      { theme: 'dark' },
      { autoFetch: false, autoUpdate: true, autoPush: true, confirmAgentLaunch: false },
    ]) {
      expect(validate({ ...DEFAULTS, ...patch }), JSON.stringify(patch)).toBe(true);
    }
  });

  it.each([
    ['fetchIntervalSeconds below 15', { fetchIntervalSeconds: 14 }],
    ['fetchIntervalSeconds above 3600', { fetchIntervalSeconds: 3601 }],
    ['fetchIntervalSeconds not whole', { fetchIntervalSeconds: 60.5 }],
    ['fetchIntervalSeconds as a string', { fetchIntervalSeconds: '60' }],
    ['actionLogCap below 100', { actionLogCap: 99 }],
    ['actionLogCap above 100 000', { actionLogCap: 100_001 }],
    ['actionLogCap null', { actionLogCap: null }],
    ['an unknown theme', { theme: 'blue' }],
    ['a boolean as a string', { autoFetch: 'true' }],
    ['a boolean as a number', { autoPush: 1 }],
    ['an unknown key', { newer: true }],
  ])('refuses %s', (_label, patch) => {
    expect(validate({ ...DEFAULTS, ...patch })).toBe(false);
  });

  it.each(Object.keys(DEFAULTS))('refuses an object without %s', (key) => {
    const body: Record<string, unknown> = { ...DEFAULTS };
    delete body[key];
    expect(validate(body)).toBe(false);
  });

  it.each([[[]], [null], ['settings'], [{}]])('refuses %j', (body) => {
    expect(validate(body)).toBe(false);
  });
});
