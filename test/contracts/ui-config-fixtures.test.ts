// spec-005 §5–§6, AC-6, AC-7, task-054 D54-8, D54-10 — on fixtures built with every matrix CLI:
// each preset passes the checks on its own template (Kanban and Scrum initialised by the CLI, the
// sw-life-cycle preset on the custom fixture), the sw-life-cycle preset is refused on kanban; the
// variant "the custom fixture with the sw-life-cycle preset" — one `chore(ui)` commit writing only
// `.wingfoil/ui.yaml`, alone and with the pre-packs states in either order — gives the declared
// values of §5 and leaves the CLI reading the project.
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderPreset, UI_PRESETS } from '../../server/src/presets/ui-config.js';
import { readMemoryYaml } from '../../server/src/reads/memory-yaml.js';
import { readUiYaml } from '../../server/src/reads/ui-yaml.js';
import { checkUiYaml } from '../../server/src/ui-config/check.js';
import { effectiveUiConfig } from '../../server/src/ui-config/effective.js';
import { parseUiYaml } from '../../server/src/ui-config/parse.js';
import {
  buildFixture,
  copyFixture,
  usePrePacksStates,
  usePresetUiConfig,
  type Fixture,
} from '../harness/fixtures/index.js';
import { git } from '../harness/run.js';
import { cliBuildFor, matrixVersions, rawCli } from './support.js';

const versions = await matrixVersions();
let root: string;
const built: Record<string, Record<'kanban' | 'scrum' | 'custom', Fixture>> = {};
let n = 0;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ui-fixtures-')));
  for (const version of versions) {
    const cli = await cliBuildFor(version);
    const at = (kind: string) => ({ root: path.join(root, version, kind), cli, cliVersion: version });
    built[version] = {
      kanban: await buildFixture('kanban', at('kanban')),
      scrum: await buildFixture('scrum', at('scrum')),
      custom: await buildFixture('custom', at('custom')),
    };
  }
}, 1_200_000); // three fixture builds per matrix version

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const checkOn = async (name: keyof typeof UI_PRESETS, fx: Fixture) => {
  const parsed = parseUiYaml(renderPreset(name));
  return checkUiYaml(parsed.ok ? parsed.data : undefined, await readMemoryYaml(fx.dir));
};

async function copy(fx: Fixture): Promise<Fixture> {
  n += 1;
  return copyFixture(fx, path.join(root, `copy-${n}`));
}

describe.each(versions)('WingFoil %s', (version) => {
  it('AC-6 — each preset passes on its own template; sw-life-cycle is refused on kanban', async () => {
    const fx = built[version]!;
    expect(await checkOn('kanban', fx.kanban)).toMatchObject({ ok: true });
    expect(await checkOn('scrum', fx.scrum)).toMatchObject({ ok: true });
    expect(await checkOn('sw-life-cycle', fx.custom)).toMatchObject({ ok: true });
    expect(await checkOn('sw-life-cycle', fx.kanban)).toEqual({
      ok: false,
      failure: 'type service is not declared in memory.yaml',
    });
  });

  it.each([
    ['alone', [usePresetUiConfig]],
    ['after the pre-packs states', [usePrePacksStates, usePresetUiConfig]],
    ['before the pre-packs states', [usePresetUiConfig, usePrePacksStates]],
  ] as const)('AC-7 — the custom fixture with the sw-life-cycle preset, %s', async (_label, steps) => {
    const fx = await copy(built[version]!.custom);
    const head = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
    for (const step of steps) await step(fx);
    const log = (await git(fx.dir, ['log', '--format=%s', `${head}..HEAD`], fx.env)).stdout.trim().split('\n');
    expect(log).toContain('chore(ui): apply the WingFoil sw-life-cycle preset');
    const preset = (
      await git(fx.dir, ['log', '-1', '--format=%H', '--grep', '^chore(ui): apply'], fx.env)
    ).stdout.trim();
    const files = (await git(fx.dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', preset], fx.env)).stdout;
    expect(files.trim().split('\n')).toEqual(['.wingfoil/ui.yaml']);
    expect((await git(fx.dir, ['status', '--porcelain'], fx.env)).stdout).toBe('');

    const e = effectiveUiConfig(await readUiYaml(fx.dir), await readMemoryYaml(fx.dir), { project: [fx.dir] });
    expect(e.status).toEqual({ source: 'file' });
    expect(e.progress.scope).toEqual({ value: { type: 'release' }, origin: 'declared' });
    expect(Object.fromEntries([...e.categories.value].filter(([, c]) => c !== null))).toEqual(
      UI_PRESETS['sw-life-cycle'].content.taxonomy!.categories,
    );
    expect(e.patterns.value.map(({ match, category }) => ({ match, category }))).toEqual(
      UI_PRESETS['sw-life-cycle'].content.taxonomy!.patterns,
    );
    expect(Object.fromEntries(e.requires.value)).toEqual(UI_PRESETS['sw-life-cycle'].content.taxonomy!.requires);
    // The CLI still reads the project (ui.yaml is invisible to its loaders, W-11).
    const search = await rawCli(fx, ['memory', 'search']);
    expect(search.code).toBe(0);
  });
});
