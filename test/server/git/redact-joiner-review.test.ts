// task-087 / bug-045: independent review of the display exception and strict redaction boundaries.
import { describe, expect, it } from 'vitest';
import { neutralise, redactLocalPaths } from '../../../server/src/git/redact.js';

describe.each([
  ['ZWNJ', '\u200c', '\\u200c'],
  ['ZWJ', '\u200d', '\\u200d'],
])('task-087 review — %s', (_name, joiner, escaped) => {
  it('removes scheme-less userinfo after a joiner between letters', () => {
    const out = redactLocalPaths(`x${joiner}user:fictional-password@git.example.test`, { home: null });
    expect(out).toBe(`x${joiner}git.example.test`);
  });

  it('redacts a local folder followed by a joiner and another letter', () => {
    const project = '/task-087-example/project';
    const out = redactLocalPaths(`${project}${joiner}x`, { project: [project], home: null });
    expect(out).toBe(`<project>${escaped}x`);
  });

  it('preserves spelling between supplementary letters and between two combining marks', () => {
    expect(neutralise(`\u{10400}${joiner}\u{10401}`)).toBe(`\u{10400}${joiner}\u{10401}`);
    expect(neutralise(`\u0301${joiner}\u093e`)).toBe(`\u0301${joiner}\u093e`);
  });
});
