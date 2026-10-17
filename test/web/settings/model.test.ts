// task-041 (D41-4): the two number settings are typed in a text field and sent only as a whole
// number inside the range of `contracts/api/settings.schema.json` (spec-006 §2); anything else is
// an error of the field and nothing is sent.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { NUMBER_RANGES, parseWholeNumber } from '../../../web/src/settings/model.js';
import { REPO_ROOT } from '../../harness/cli.js';

const schema = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'settings.schema.json'), 'utf8')) as {
  properties: Record<string, { minimum?: number; maximum?: number }>;
};

it('takes the ranges of the settings schema', () => {
  for (const [key, range] of Object.entries(NUMBER_RANGES)) {
    expect({ key, min: range.min, max: range.max }).toEqual({
      key,
      min: schema.properties[key]!.minimum,
      max: schema.properties[key]!.maximum,
    });
  }
});

it.each([
  ['15', 15],
  ['3600', 3600],
  ['60', 60],
  [' 90 ', 90],
  ['0060', 60],
  ['14', undefined],
  ['3601', undefined],
  ['60.5', undefined],
  ['60.0', undefined],
  ['', undefined],
  ['1e3', undefined],
  ['-20', undefined],
  ['+20', undefined],
  ['20 s', undefined],
  ['٢٠', undefined],
])('fetch interval %j → %j', (text, value) => {
  expect(parseWholeNumber(text, NUMBER_RANGES.fetchIntervalSeconds)).toBe(value);
});

it.each([
  ['100', 100],
  ['100000', 100000],
  ['5000', 5000],
  ['99', undefined],
  ['100001', undefined],
  ['100,000', undefined],
  ['99999999999999999999', undefined],
])('action log cap %j → %j', (text, value) => {
  expect(parseWholeNumber(text, NUMBER_RANGES.actionLogCap)).toBe(value);
});
