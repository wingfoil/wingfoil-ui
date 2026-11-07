// adr-003 D1, spec-006 §1 — `contracts/state/console-address.schema.json`: the shape of a console
// address file `consoles/<port>.json` (task-058 AC-2, D58-8).
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConsoleAddressFile } from '../../contracts/src/state.js';
import { REPO_ROOT } from '../harness/cli.js';

const schema = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'contracts/state/console-address.schema.json'), 'utf8'),
) as object;
const validate = new Ajv({ allErrors: true }).compile(schema);

/** The example of adr-003 D1, typed with the contract type (a type drift fails `typecheck`). */
const example: ConsoleAddressFile = {
  format: 1,
  url: 'http://127.0.0.1:4870/',
  port: 4870,
  portFixed: true,
  pid: 41237,
  host: 'alex-laptop',
  started: '2026-11-03T09:12:44.512Z',
  version: '0.3.0',
};

const FIELDS = ['format', 'url', 'port', 'portFixed', 'pid', 'host', 'started', 'version'] as const;

describe('console-address.schema.json', () => {
  it('accepts the example of adr-003 D1 and an OS-chosen port without --port', () => {
    expect(validate(example)).toBe(true);
    expect(validate({ ...example, url: 'http://127.0.0.1:41993/', port: 41993, portFixed: false })).toBe(true);
  });

  it.each(FIELDS)('refuses a file without %s', (field) => {
    const copy: Record<string, unknown> = { ...example };
    delete copy[field];
    expect(validate(copy)).toBe(false);
  });

  it.each([
    ['another property (a token)', { token: 'x' }],
    ['another property (a project id)', { projects: ['p_7kq2m9x4r1tz'] }],
    ['format 2', { format: 2 }],
    ['a url carrying a token fragment', { url: 'http://127.0.0.1:4870/#token=abc' }],
    ['a url with a path', { url: 'http://127.0.0.1:4870/p/p_7kq2m9x4r1tz/' }],
    ['a url on another host', { url: 'http://localhost:4870/' }],
    ['a url on IPv6', { url: 'http://[::1]:4870/' }],
    ['an https url', { url: 'https://127.0.0.1:4870/' }],
    ['port 0', { port: 0 }],
    ['port 65536', { port: 65536 }],
    ['a port as a string', { port: '4870' }],
    ['portFixed as a string', { portFixed: 'true' }],
    ['pid 0', { pid: 0 }],
    ['a fractional pid', { pid: 1.5 }],
    ['an empty host', { host: '' }],
    ['a local start time', { started: '2026-11-03T10:12:44.512+01:00' }],
    ['a start time that is not a time', { started: 'yesterday' }],
    ['an empty version', { version: '' }],
  ])('refuses %s', (_label, patch) => {
    expect(validate({ ...example, ...patch })).toBe(false);
  });
});
