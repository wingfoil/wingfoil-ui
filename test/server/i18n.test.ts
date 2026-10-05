// spec-008 §1, §2, §5 — the server catalogue.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { message } from '../../server/src/i18n/messages.js';

const catalogue = JSON.parse(readFileSync(path.join(REPO_ROOT, 'server/src/i18n/en.json'), 'utf8')) as Record<
  string,
  string
>;

describe('server catalogue', () => {
  it('is one flat object sorted by key, with launcher.* keys only', () => {
    const keys = Object.keys(catalogue);
    expect(keys).toEqual([...keys].sort());
    for (const key of keys) {
      expect(key).toMatch(/^launcher(\.[a-z][a-zA-Z0-9]*)+$/);
      expect(typeof catalogue[key]).toBe('string');
    }
  });

  it('holds the spec-007 lines', () => {
    expect(message('launcher.running', { url: 'http://127.0.0.1:1/#token=x' })).toBe(
      'WingFoil UI is running at http://127.0.0.1:1/#token=x',
    );
    expect(message('launcher.openManually', { url: 'U' })).toBe('Open this URL in your browser: U');
    expect(message('launcher.portInUse', { port: 8080 })).toBe('Port 8080 is already in use');
    expect(message('launcher.stopped')).toBe('WingFoil UI stopped');
    expect(catalogue['launcher.nodeTooOld']).toBe('WingFoil UI needs Node.js 22.12 or later (found {major}.{minor})');
  });

  it('formats numbers without grouping where the text is a port', () => {
    expect(message('launcher.portInUse', { port: 54321 })).toBe('Port 54321 is already in use');
  });
});
