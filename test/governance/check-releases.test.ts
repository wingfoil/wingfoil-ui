// task-051 AC-3: `docs/03_backlog/X_tools/check_releases.py` (the stop-check of `release-conventions`
// › *Seeding a line*) reads the `exempt` lists of the `release` type from `.wingfoil/memory.yaml`
// (no copy in the script) and accepts a `draft` release with no `sprint` (a draft no Sprint selects
// yet; WingFoil checks the required fields at `memory submit`). A release past `draft` with no
// `sprint` and not exempt still fails. Driven on a temporary tree (`--root`) and on the repository.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { run } from '../harness/run.js';

const SCRIPT = path.join(REPO_ROOT, 'docs', '03_backlog', 'X_tools', 'check_releases.py');

const memoryYaml = (exempt: readonly string[]): string => `format: 1
types:
  release:
    path: "docs/04_memory/planning/{release-line}/{id}.md"
    template:
      file: "memory/templates/release.md"
      frontmatter:
        required: [ title, version, release-line, sprint, kind, pillar, features, requirements ]
        lists: [ features ]
        exempt:
          sprint: [ ${exempt.join(', ')} ]
    states:
      sequence: [ draft, planning, in-development, releasing, released ]
  task:
    path: "docs/04_memory/{release}/{id}.md"
    template:
      frontmatter:
        required: [ title, sprint, release ]
`;

const SEQUENCER = `# Sequencer

### v0.1 — One · area **S** · WingFoil ≥ 0.2.2

The first.

| Features | Journeys served |
|----------|-----------------|
| S1 one · S2 two | J0 |

### v0.2 — Two · area **G** · WingFoil ≥ 0.2.2

| Features | Journeys served |
|----------|-----------------|
| G1 three | J1 |

### v0.3 — Three · area **A** · WingFoil ≥ 0.3

| Features | Journeys served |
|----------|-----------------|
| A1 four | J2 |

---
`;

const FEATURES = `# Features

| Id | Feature |
|----|---------|
| S1 | one |
| S2 | two |
| G1 | three |
| A1 | four |

## Later
`;

interface Release {
  status: string;
  sprint?: string;
  pillar?: string;
}
const PILLAR: Record<string, string> = { 'v0.1': 'S', 'v0.2': 'G', 'v0.3': 'A' };
const FEATS: Record<string, string> = { 'v0.1': 'S1, S2', 'v0.2': 'G1', 'v0.3': 'A1' };
const WINGFOIL: Record<string, string> = { 'v0.1': '0.2.2', 'v0.2': '0.2.2', 'v0.3': '0.3' };

function release(version: string, r: Release): string {
  const lines = [
    '---',
    `id: minor-${version}`,
    'type: release',
    `title: "Release ${version}"`,
    `status: ${r.status}`,
    'kind: "minor"',
    `version: "${version}"`,
    `pillar: "${r.pillar ?? PILLAR[version]!}"`,
    `features: [${FEATS[version]!}]`,
    `wingfoil_min: "${WINGFOIL[version]!}"`,
    `requirements: "docs/03_backlog/04_backlog/by-release/${version}.json"`,
    'release-line: "v1"',
    ...(r.sprint === undefined ? [] : [`sprint: "${r.sprint}"   # REQUIRED — the Sprint`]),
    '---',
    '',
    '## Scope',
    '',
  ];
  return lines.join('\n');
}

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A repository-shaped tree with the three releases and the exempt list given. */
function tree(releases: Record<string, Release>, exempt: readonly string[] = ['minor-v0.1']): string {
  const root = mkdtempSync(path.join(tmpdir(), 'task-051-releases-'));
  roots.push(root);
  const write = (rel: string, text: string): void => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  write('.wingfoil/memory.yaml', memoryYaml(exempt));
  write('docs/01_vision/07_sequencer.md', SEQUENCER);
  write('docs/01_vision/06_features.md', FEATURES);
  for (const [version, r] of Object.entries(releases)) {
    write(`docs/03_backlog/04_backlog/by-release/${version}.json`, '[]\n');
    write(`docs/04_memory/planning/v1/minor-${version}.md`, release(version, r));
  }
  return root;
}

const check = (root?: string) => run('python3', [SCRIPT, ...(root ? ['--root', root] : [])], { allowFailure: true });

const BASE: Record<string, Release> = {
  'v0.1': { status: 'released' },
  'v0.2': { status: 'in-development', sprint: 'sprint-001' },
  'v0.3': { status: 'draft' },
};

describe('check_releases.py', () => {
  it('accepts an exempt release and a draft with no sprint', async () => {
    const r = await check(tree(BASE));
    expect(r.stdout).toContain('OK');
    expect(r.code, r.stdout).toBe(0);
  });

  it('fails a planning release with no sprint, naming it', async () => {
    const r = await check(tree({ ...BASE, 'v0.2': { status: 'planning' } }));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('FAIL minor-v0.2.md: required field sprint empty');
    expect(r.stdout).not.toContain('minor-v0.3.md');
  });

  it('reads the exempt list from memory.yaml: a release it does not name fails without sprint', async () => {
    const r = await check(tree(BASE, ['minor-v0.9']));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('FAIL minor-v0.1.md: required field sprint empty');
  });

  it('still requires every other field of a draft', async () => {
    const r = await check(tree({ ...BASE, 'v0.3': { status: 'draft', pillar: '' } }));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('FAIL minor-v0.3.md: required field pillar empty');
  });

  it('passes on this repository', async () => {
    const r = await check();
    expect(r.code, r.stdout).toBe(0);
  });
});
