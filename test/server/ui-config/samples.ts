// The `memory.yaml` of each fixture as captured from every matrix version
// (`test/contracts/samples/`), parsed by the server's reader: the projects the `ui.yaml` checks run
// against in the unit tests.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';

/** The versions of `contracts/matrix.json`. */
export const MATRIX: readonly string[] = (
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'matrix.json'), 'utf8')) as { versions: string[] }
).versions;

/** The captured `memory.yaml` of `kind` on `version`. */
export function sampleMemoryYaml(version: string, kind: 'kanban' | 'custom' | 'unknown'): MemoryYaml {
  const file = path.join(
    REPO_ROOT,
    'test',
    'contracts',
    'samples',
    `wingfoil-${version}`,
    kind,
    'files',
    'memory.yaml',
  );
  return parseMemoryYaml(readFileSync(file, 'utf8'));
}

/** The pinned version's custom fixture (the packs' states). */
export const customPacks = (): MemoryYaml => sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'custom');
/** The pinned version's kanban fixture. */
export const kanban = (): MemoryYaml => sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'kanban');
