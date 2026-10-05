/**
 * Vitest global setup: build `server/` (and the `contracts/` it references) once, before any test
 * file runs. The bin tests (`test/launcher/`) and the child-process tests of the state store run
 * the built `server/dist`; building per file made concurrent `tsc -b` runs race on the same output.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-b', 'server'],
    {
      cwd: root,
      stdio: 'inherit',
      timeout: 180_000,
    },
  );
}
