// spec-008 §4, §7: every error code of spec-004 §4–§5 and spec-006 §3 maps to a catalogue key with
// its detail as arguments; tool output (cli-refused, git-refused) is kept verbatim.
import { expect, it } from 'vitest';
import type { ProjectRefusalCode } from '../../../contracts/src/index.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { ApiError } from '../../../web/src/api/client.js';
import { ERROR_CODES, errorMessage, type ErrorCode } from '../../../web/src/api/error-message.js';
import { messageArguments } from '../../../web/scripts/catalogue.mjs';

/** spec-004 §4–§5 codes. */
const SPEC_004 = [
  'forbidden-origin',
  'unauthenticated',
  'not-found',
  'invalid-request',
  'not-in-team',
  'unsupported-version',
  'local-changes',
  'stale-copy',
  'element-changed',
  'cli-refused',
  'cli-output',
  'cli-timeout',
  'internal',
  'git-refused',
  'read-error',
];
/** spec-006 §3 codes (checked against the contracts type at compile time). */
const SPEC_006: ProjectRefusalCode[] = [
  'folder-not-found',
  'not-wingfoil',
  'already-listed',
  'directory-not-empty',
  'cli-not-found',
  'state-dir-inside-project',
  'directory-inside-project',
  'inside-state-dir',
  'git-refused',
];
const catalogue = en as Record<string, string>;

it('knows every code of spec-004 §4–§5 and spec-006 §3', () => {
  expect([...ERROR_CODES].sort()).toEqual([...new Set([...SPEC_004, ...SPEC_006])].sort());
});

it.each([...new Set([...SPEC_004, ...SPEC_006])])('maps %s to error.<lowerCamel code> in the catalogue', (code) => {
  const camel = code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const m = errorMessage(new ApiError(422, code, 'message', undefined));
  expect(m.descriptor.id).toBe(`error.${camel}`);
  expect(catalogue[`error.${camel}`]).toBeDefined();
});

it('passes the detail as arguments, booleans and absent selectors as select values', () => {
  expect(errorMessage(new ApiError(422, 'folder-not-found', 'x', { path: '/tmp/x' })).values).toEqual({ path: '/tmp/x' });
  expect(errorMessage(new ApiError(422, 'already-listed', 'x', { pid: 'p_1', name: 'kanban', sameRemote: true })).values).toEqual({
    pid: 'p_1',
    name: 'kanban',
    sameRemote: 'true',
  });
  expect(errorMessage(new ApiError(422, 'not-wingfoil', 'x', { path: '/tmp/plain' })).values).toEqual({
    path: '/tmp/plain',
    source: 'local',
  });
  expect(errorMessage(new ApiError(422, 'not-wingfoil', 'x', { source: 'clone' })).values).toEqual({ source: 'clone', path: '' });
});

it('gives every argument of each message a value from a detail of the contract shape', () => {
  for (const code of ERROR_CODES) {
    const m = errorMessage(new ApiError(422, code as ErrorCode, 'x', { path: 'p', stateDir: 's', command: 'c', file: 'f', kind: 'missing', name: 'n', pid: 'p_1', sameRemote: false }));
    for (const arg of messageArguments(catalogue[m.descriptor.id as string]!).args) {
      expect(m.values, `${code} {${arg}}`).toHaveProperty(arg);
    }
  }
});

it('keeps the tool output of cli-refused and git-refused verbatim', () => {
  expect(errorMessage(new ApiError(422, 'cli-refused', 'Error: sard_ref is required', undefined)).verbatim).toBe(
    'Error: sard_ref is required',
  );
  expect(errorMessage(new ApiError(422, 'git-refused', "fatal: repository 'x' not found", undefined)).verbatim).toBe(
    "fatal: repository 'x' not found",
  );
  expect(errorMessage(new ApiError(404, 'not-found', 'Not found', undefined)).verbatim).toBeUndefined();
});

it('renders an unknown code as an internal error', () => {
  expect(errorMessage(new ApiError(500, 'something-new', 'x', undefined)).descriptor.id).toBe('error.internal');
});
