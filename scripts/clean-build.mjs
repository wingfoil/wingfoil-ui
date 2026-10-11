// Removes the build outputs before the `prepack` build (task-025 review round 1): `tsc -b` never
// deletes the output of a removed source, so a packed `server/dist` could otherwise carry stale
// modules. Cross-platform (no shell `rm`).
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUTPUTS = [
  'server/dist',
  'server/tsconfig.tsbuildinfo',
  'contracts/dist',
  'contracts/tsconfig.tsbuildinfo',
  'web/dist',
  'web/tsconfig.tsbuildinfo',
];

for (const output of OUTPUTS) {
  rmSync(fileURLToPath(new URL(`../${output}`, import.meta.url)), { recursive: true, force: true });
}
