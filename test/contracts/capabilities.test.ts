// REQ-INT-03 (fit criterion: a minimum version for 100 % of the capabilities), spec-001 §5–6 — the
// capability table of `contracts/`, and REQ-INT-02 "README review": the support matrix and the
// capability table published in the package README match the JSON files.
import { Ajv } from 'ajv';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedRange } from '../../server/src/cli/version.js';
import { REPO_ROOT } from '../harness/cli.js';

interface Entry {
  id: string;
  name: string;
  minVersion: string | null;
}

async function json(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, file), 'utf8')) as unknown;
}

describe('contracts/capabilities.json', () => {
  it('validates against contracts/capabilities.schema.json', async () => {
    const validate = new Ajv({ allErrors: true }).compile((await json('contracts/capabilities.schema.json')) as object);
    const table = await json('contracts/capabilities.json');
    expect(validate.errors ?? null).toBeNull();
    expect(validate(table), JSON.stringify(validate.errors)).toBe(true);
  });

  it('declares a minimum version for 100 % of the capabilities (null = in no released WingFoil)', async () => {
    const { capabilities } = (await json('contracts/capabilities.json')) as { capabilities: Entry[] };
    expect(capabilities.length).toBeGreaterThan(0);
    const declared = capabilities.filter((c) => Object.hasOwn(c, 'minVersion'));
    expect(declared.length / capabilities.length).toBe(1);
    expect(new Set(capabilities.map((c) => c.id)).size).toBe(capabilities.length);
  });

  it('holds the rows of spec-001 §6 with their minimum versions', async () => {
    const { capabilities } = (await json('contracts/capabilities.json')) as { capabilities: Entry[] };
    expect(Object.fromEntries(capabilities.map((c) => [c.id, c.minVersion]))).toEqual({
      'type-definitions': '0.2.2',
      'element-content': '0.2.2',
      'directive-body': '0.2.2',
      'gate-decision': '0.2.2',
      'workflow-position': '0.3.0',
      'workflow-next-step': '0.3.0',
      'workflow-start': '0.3.0',
      'agent-launch': '0.3.0',
      'field-editing': null,
    });
  });

  it('refuses an entry without minVersion, with a bad version or an unknown key', async () => {
    const validate = new Ajv({ allErrors: true }).compile((await json('contracts/capabilities.schema.json')) as object);
    const ok = { id: 'x', name: 'X', minVersion: '0.2.2', via: null, conditions: [] };
    expect(validate({ capabilities: [ok] })).toBe(true);
    const { minVersion: _drop, ...noMin } = ok;
    expect(validate({ capabilities: [noMin] })).toBe(false);
    expect(validate({ capabilities: [{ ...ok, minVersion: '0.3' }] })).toBe(false);
    expect(validate({ capabilities: [{ ...ok, id: 'Not Kebab' }] })).toBe(false);
    expect(validate({ capabilities: [{ ...ok, extra: 1 }] })).toBe(false);
  });
});

describe('package README — support matrix (REQ-INT-02 README review)', () => {
  it('publishes the supported range, the matrix versions and every capability with its minimum version', async () => {
    const readme = await readFile(path.join(REPO_ROOT, 'README.md'), 'utf8');
    const section = readme.split(/^## /m).find((s) => s.startsWith('Supported WingFoil versions'));
    expect(section, 'README section "## Supported WingFoil versions"').toBeDefined();
    const { versions } = (await json('contracts/matrix.json')) as { versions: string[] };
    const range = supportedRange();
    expect(section).toContain(`**${range.min} to ${range.max}**`);
    for (const version of versions) expect(section).toContain(`\`${version}\``);
    const { capabilities } = (await json('contracts/capabilities.json')) as { capabilities: Entry[] };
    for (const c of capabilities) {
      const row = section!.split('\n').find((line) => line.startsWith(`| ${c.name} |`));
      expect(row, `README row of ${c.name}`).toBeDefined();
      expect(row).toContain(c.minVersion ?? 'not released');
    }
  });
});
