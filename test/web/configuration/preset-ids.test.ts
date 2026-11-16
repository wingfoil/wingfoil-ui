// task-079 — the preset ids and the names the dialog shows (AC-1; D79-4, Q1 (a)): `@wingfoil-ui/contracts`
// exports types only, so the web holds its own list of the three ids, kept equal here to the request
// schema's enum and to the server's table; the name and the commit subject the dialog renders for each
// id are the server's, so the dialog never names another commit than the one the server makes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createIntl } from 'react-intl';
import { expect, it } from 'vitest';
import { presetCommitSubject, UI_PRESET_NAMES, UI_PRESETS } from '../../../server/src/presets/ui-config.js';
import { PRESET_IDS } from '../../../web/src/configuration/preset-control.js';
import { selectorOf } from '../../../web/src/configuration/selector.js';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import { REPO_ROOT } from '../../harness/cli.js';

const intl = createIntl({ locale: 'en', messages: en as Record<string, string> });

it('PRESET_IDS equals the request schema’s enum and the server’s UI_PRESET_NAMES, in order', () => {
  const schema = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'ui-config.preset.request.schema.json'), 'utf8'),
  ) as { properties: { preset: { enum: string[] } } };
  expect([...PRESET_IDS]).toEqual(schema.properties.preset.enum);
  expect([...PRESET_IDS]).toEqual([...UI_PRESET_NAMES]);
});

it.each([...UI_PRESET_NAMES])('%s: the name is the server’s label, the subject the server’s commit', (id) => {
  const preset = selectorOf(id);
  expect(intl.formatMessage({ id: 'settings.preset.name' }, { preset, id })).toBe(UI_PRESETS[id].label);
  expect(intl.formatMessage({ id: 'settings.preset.commit' }, { preset, id })).toBe(presetCommitSubject(id));
});

it('an unknown id renders as written (the select’s other case)', () => {
  expect(intl.formatMessage({ id: 'settings.preset.name' }, { preset: 'zz', id: 'zz' })).toBe('zz');
});
