// task-060 D60-2 (spec-004 §3, §5; spec-005 §5): `ui-config.preset.request.schema.json` (its enum is
// the shipped presets), `ui-config.preset.refusal.schema.json` (each code with its detail), and the
// preset write's 200 against `write.response.schema.json`.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UiConfigPresetRefusalCode, UiConfigPresetRequest, WriteResponse } from '../../contracts/src/index.js';
import { UI_PRESET_NAMES } from '../../server/src/presets/ui-config.js';
import { REPO_ROOT } from '../harness/cli.js';

const ajv = new Ajv({ allErrors: true });
for (const dir of ['api', 'cli', 'files']) {
  for (const file of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) {
    if (file.endsWith('.schema.json')) {
      ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', dir, file), 'utf8')) as object);
    }
  }
}
ajv.addSchema(
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'capabilities.schema.json'), 'utf8')) as object,
);
const byId = (file: string) => ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
const request = byId('ui-config.preset.request.schema.json');
const refusal = byId('ui-config.preset.refusal.schema.json');
const response = byId('write.response.schema.json');
const SHA = 'a'.repeat(40);

describe('ui-config.preset.request.schema.json', () => {
  it('its enum is UI_PRESET_NAMES', () => {
    const schema = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'ui-config.preset.request.schema.json'), 'utf8'),
    ) as { properties: { preset: { enum: string[] } } };
    expect(schema.properties.preset.enum).toEqual([...UI_PRESET_NAMES]);
  });

  it('accepts each preset; refuses another value, an extra key, no key', () => {
    for (const preset of UI_PRESET_NAMES) expect(request({ preset } satisfies UiConfigPresetRequest)).toBe(true);
    for (const body of [{ preset: 'Kanban' }, { preset: 'kanban', x: 1 }, {}, { preset: 1 }, []]) {
      expect(request(body), JSON.stringify(body)).toBe(false);
    }
  });
});

describe('ui-config.preset.refusal.schema.json', () => {
  const plain: UiConfigPresetRefusalCode[] = [
    'forbidden-origin',
    'unauthenticated',
    'not-found',
    'invalid-request',
    'not-in-team',
    'unsupported-version',
    'ui-config-exists',
    'stale-copy',
    'git-refused',
    'cli-output',
    'cli-timeout',
    'internal',
  ];

  it('the codes without detail', () => {
    for (const code of plain) {
      expect(refusal({ error: { code, message: 'm' } }), code).toBe(true);
      expect(refusal({ error: { code, message: 'm', detail: {} } }), code).toBe(false);
    }
  });

  it('ui-config-invalid needs detail.failure; write-incomplete detail.file is ui.yaml, commit optional', () => {
    expect(refusal({ error: { code: 'ui-config-invalid', message: 'm', detail: { failure: 'f' } } })).toBe(true);
    expect(refusal({ error: { code: 'ui-config-invalid', message: 'm' } })).toBe(false);
    const file = '.wingfoil/ui.yaml';
    expect(refusal({ error: { code: 'write-incomplete', message: 'm', detail: { file } } })).toBe(true);
    expect(refusal({ error: { code: 'write-incomplete', message: 'm', detail: { file, commit: SHA } } })).toBe(true);
    expect(refusal({ error: { code: 'write-incomplete', message: 'm', detail: { file: 'x.md' } } })).toBe(false);
    expect(
      refusal({
        error: { code: 'read-error', message: 'm', detail: { file: '.wingfoil/memory.yaml', kind: 'outside' } },
      }),
    ).toBe(true);
    expect(refusal({ error: { code: 'local-changes', message: 'm' } })).toBe(false);
  });
});

describe('the 200 (write.response.schema.json)', () => {
  it('result {file, preset}, one chore(ui) commit, push', () => {
    const body: WriteResponse = {
      result: { file: '.wingfoil/ui.yaml', preset: 'kanban' },
      commits: [{ sha: SHA, subject: 'chore(ui): apply the Kanban preset' }],
      push: { status: 'off' },
    };
    expect(response(body)).toBe(true);
  });
});
