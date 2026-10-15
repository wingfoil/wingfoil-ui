// spec-008 §4, §7: every error code of spec-004 §4–§5 and spec-006 §3 maps to a catalogue key with
// its detail as arguments; tool output (cli-refused, git-refused) is kept verbatim. Each message may
// use only the arguments its code actually sends: the detail shapes are read from
// contracts/api/projects.refusal.schema.json (spec-006 §3) and spec-004 §5.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import type { ProjectRefusalCode } from '../../../contracts/src/index.js';
import { messageArguments } from '../../../web/scripts/catalogue.mjs';
import { ApiError } from '../../../web/src/api/client.js';
import { ERROR_CODES, errorMessage } from '../../../web/src/api/error-message.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { REPO_ROOT } from '../../harness/cli.js';

const catalogue = en as Record<string, string>;

/** A sample value per property type of a detail schema. */
const SAMPLE: Record<string, unknown> = { string: 'value', boolean: true };

interface Schema {
  $ref?: string;
  const?: unknown;
  enum?: string[];
  oneOf?: Schema[];
  required?: string[];
  properties?: Record<string, Schema>;
  type?: string;
  not?: unknown;
}

/** Every detail shape of each spec-006 §3 code, as sample objects, from the refusal schema. */
function refusalShapes(): Map<string, Record<string, unknown>[]> {
  const schema = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'projects.refusal.schema.json'), 'utf8'),
  ) as {
    properties: { error: { oneOf: Schema[] } };
    definitions: Record<string, Schema>;
  };
  const resolve = (s: Schema): Schema => (s.$ref ? schema.definitions[s.$ref.split('/').at(-1)!]! : s);
  const sample = (s: Schema): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(resolve(s).properties ?? {}).map(([k, p]) => [k, p.const ?? SAMPLE[p.type ?? 'string']]),
    );
  const shapes = new Map<string, Record<string, unknown>[]>();
  for (const branch of schema.properties.error.oneOf) {
    const code = branch.properties!['code']!;
    const codes = code.enum ?? [code.const as string];
    const detail = branch.properties!['detail'];
    const variants = detail === undefined ? [{}] : (resolve(detail).oneOf ?? [detail]).map(sample);
    for (const c of codes) shapes.set(c, variants);
  }
  return shapes;
}

/** spec-004 §4–§5 codes and their `detail` (none unless the spec gives one). */
const SPEC_004: Record<string, Record<string, unknown>[]> = {
  'forbidden-origin': [{}],
  unauthenticated: [{}],
  'not-found': [{}, { kind: 'outside' }],
  'invalid-request': [{}],
  'not-in-team': [{}],
  'unsupported-version': [{}],
  'local-changes': [{}],
  'stale-copy': [{}],
  'element-changed': [{}],
  'cli-refused': [{}],
  'cli-output': [{}],
  'cli-timeout': [{}],
  internal: [{}],
  'git-refused': [{}],
  'read-error': [{ file: 'docs/x.md', kind: 'missing' }],
  // task-033 (spec-010 §5, D33-13).
  'no-remote': [{}],
  'no-fetch-target': [{}],
  'detached-head': [{}],
  'no-upstream': [{}],
  diverged: [{}],
  'local-changes-in-the-way': [{ files: ['docs/a.md'] }],
  // task-034 (spec-010 §6): push.code of a write (D34-10), the automatic fetch killed after 60 s
  // (D34-9), a fetch refused for its refspecs (D34-8, bug-014).
  'push-timeout': [{}],
  'fetch-timeout': [{}],
  'refspec-outside-remotes': [{}],
  // task-032 W2-1, W2-4, W2-5 (write.refusal.schema.json); its text is task-037's (D37-11).
  'write-incomplete': [{ file: 'docs/x.md' }, { file: 'docs/x.md', commit: 'a'.repeat(40) }],
};
/** Client-side code (W3-12): no answer at all. */
const CLIENT: Record<string, Record<string, unknown>[]> = { unreachable: [{}] };

const SPEC_006 = refusalShapes();
const SHAPES = new Map<string, Record<string, unknown>[]>([
  ...Object.entries(SPEC_004),
  ...SPEC_006,
  ...Object.entries(CLIENT),
]);

it('reads every spec-006 §3 code from the refusal schema', () => {
  const expected: ProjectRefusalCode[] = [
    'folder-not-found',
    'not-wingfoil',
    'already-listed',
    'directory-not-empty',
    'cli-not-found',
    'state-dir-inside-project',
    'directory-inside-project',
    'inside-state-dir',
    'git-refused',
    'credentials-in-url',
    // bug-010 (task-033 D33-1; review round 2 F9).
    'remote-not-owned',
    'remote-unreadable',
  ];
  expect([...SPEC_006.keys()].sort()).toEqual([...expected].sort());
});

it('knows every code of spec-004 §4–§5, spec-006 §3 and the client', () => {
  expect([...ERROR_CODES].sort()).toEqual([...SHAPES.keys()].sort());
});

it.each([...SHAPES.keys()])('maps %s to error.<lowerCamel code> in the catalogue', (code) => {
  const camel = code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  expect(errorMessage(new ApiError(422, code, 'message', undefined)).descriptor.id).toBe(`error.${camel}`);
  expect(catalogue[`error.${camel}`]).toBeDefined();
});

it.each([...SHAPES.entries()])('%s: every argument of its message comes from a detail it sends', (code, shapes) => {
  for (const detail of shapes) {
    const m = errorMessage(new ApiError(422, code, 'x', detail));
    for (const arg of messageArguments(catalogue[m.descriptor.id as string]!).args) {
      expect(m.values, `${code} ${JSON.stringify(detail)} → {${arg}}`).toHaveProperty(arg);
    }
  }
});

it('passes the detail as arguments, booleans and absent selectors as select values', () => {
  expect(errorMessage(new ApiError(422, 'folder-not-found', 'x', { path: '/tmp/x' })).values).toEqual({
    path: '/tmp/x',
  });
  expect(
    errorMessage(new ApiError(422, 'already-listed', 'x', { pid: 'p_1', name: 'kanban', sameRemote: true })).values,
  ).toEqual({
    pid: 'p_1',
    name: 'kanban',
    sameRemote: 'true',
  });
  expect(errorMessage(new ApiError(422, 'not-wingfoil', 'x', { path: '/tmp/plain' })).values).toEqual({
    path: '/tmp/plain',
    source: 'local',
  });
  expect(errorMessage(new ApiError(422, 'not-wingfoil', 'x', { source: 'clone' })).values).toEqual({
    source: 'clone',
    path: '',
  });
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

it('renders credentials-in-url without arguments and never shows its message (bug-006)', () => {
  const rendering = errorMessage(new ApiError(422, 'credentials-in-url', 'The URL holds credentials', undefined));
  expect(rendering.descriptor.id).toBe('error.credentialsInUrl');
  expect(rendering.values).toEqual({});
  expect(rendering.verbatim).toBeUndefined();
});

it('renders the files in the way as one list of base names (spec-010 §5, task-033 D33-13)', () => {
  const error = new ApiError(409, 'local-changes-in-the-way', 'x', { files: ['docs/a.md', 'b.md', '../other/c.md'] });
  expect(errorMessage(error).values).toEqual({ files: 'a.md, b.md, and c.md' });
  expect(errorMessage(error, { formatList: (items) => items.join(' + ') }).values).toEqual({
    files: 'a.md + b.md + c.md',
  });
  expect(errorMessage(new ApiError(409, 'local-changes-in-the-way', 'x', { files: ['one.md'] })).values).toEqual({
    files: 'one.md',
  });
});

it('write-incomplete: the commit selector is `none` when the write left no commit (task-037, D37-11)', () => {
  expect(errorMessage(new ApiError(500, 'write-incomplete', 'x', { file: 'docs/x.md' })).values).toEqual({
    file: 'docs/x.md',
    commit: 'none',
  });
  const sha = 'b'.repeat(40);
  expect(errorMessage(new ApiError(500, 'write-incomplete', 'x', { file: 'docs/x.md', commit: sha })).values).toEqual({
    file: 'docs/x.md',
    commit: sha,
  });
  expect(errorMessage(new ApiError(500, 'write-incomplete', 'x', { file: 'f' })).verbatim).toBeUndefined();
});
