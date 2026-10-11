/**
 * Vitest global setup: build `server/` (and the `contracts/` it references) and the browser
 * application `web/dist` once, before any test file runs. The bin tests (`test/launcher/`) and the
 * child-process tests of the state store run the built `server/dist`; building per file made
 * concurrent `tsc -b` runs race on the same output. The packaging guard (`test/package/`) checks
 * that every built file is packed (task-025, ES-11).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const node = (args: string[], cwd: string): void => {
    execFileSync(process.execPath, args, { cwd, stdio: 'inherit', timeout: 180_000 });
  };
  node([fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-b', 'server'], root);
  node(
    [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build', '--logLevel', 'warn'],
    fileURLToPath(new URL('../web', import.meta.url)),
  );
}
