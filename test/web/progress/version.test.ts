// task-065 D65-6 — the WingFoil version in the read-only phase texts: a zero patch left out
// ("0.3.0" → "0.3", the scenarios' form, T-15.1), any other version or text as written.
import { expect, it } from 'vitest';
import { majorMinor } from '../../../web/src/progress/version.js';

it.each([
  ['0.3.0', '0.3'],
  ['1.0.0', '1.0'],
  ['0.3.1', '0.3.1'],
  ['0.2.2', '0.2.2'],
  ['0.3.0-rc.1', '0.3.0-rc.1'],
  ['0.3', '0.3'],
  ['next', 'next'],
])('majorMinor(%s) is %s', (version, shown) => {
  expect(majorMinor(version)).toBe(shown);
});
