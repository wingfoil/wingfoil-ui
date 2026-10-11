/**
 * Packaging guard (task-025 AC-1, AC-2; bug-007; decisions ES-8…ES-11, ES-16): the file list of
 * `npm pack` is an allow-list, every run-time file is in it, and the installed package resolves
 * every module the built server imports. Runs `npm pack --dry-run --ignore-scripts` (no build):
 * `test/global-setup.ts` has built `server/dist` and `web/dist`.
 */
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { git } from '../harness/run.js';
import {
  bareImports,
  developmentBuildFiles,
  dryRunPack,
  forbiddenReason,
  isAllowed,
  readManifest,
  requiredFiles,
  serverModules,
  type PackReport,
} from './allow-list.js';

let report: PackReport;
let packed: Set<string>;

beforeAll(async () => {
  report = await dryRunPack();
  packed = new Set(report.files.map((f) => f.path));
});

describe('npm pack (bug-007)', () => {
  it('AC-2 the allow-list refuses the paths of bug-007', () => {
    for (const file of [
      'export/notes.md',
      'export1/a.txt',
      '.idea/workspace.xml',
      '.mcp.json',
      'test/README.md',
      'docs/user-guide.md',
      'server/src/main.ts',
      'server/dist/main.d.ts',
      'server/dist/main.js.map',
      'contracts/dist/index.js',
      'contracts/src/index.ts',
      'web/src/main.tsx',
      'server/node_modules/x/index.js',
      'web/dist/x.tsbuildinfo',
      'server/tsconfig.tsbuildinfo',
    ]) {
      expect(isAllowed(file) && !forbiddenReason(file), file).toBe(false);
    }
    for (const file of ['server/dist/main.js', 'web/dist/assets/index-abc.js', 'contracts/cli/paths.schema.json']) {
      expect(isAllowed(file) && !forbiddenReason(file), file).toBe(true);
    }
  });

  it('AC-2 every packed path is on the allow-list', () => {
    const outside = report.files
      .map((f) => f.path)
      .filter((file) => !isAllowed(file) || forbiddenReason(file))
      .map((file) => `${file}${forbiddenReason(file) ? ` (${forbiddenReason(file)})` : ''}`);
    expect(outside).toEqual([]);
  });

  it('AC-2 every runtime file is packed', async () => {
    const tracked = (await git(REPO_ROOT, ['ls-files', 'contracts'])).stdout.split('\n').filter(Boolean);
    const missing = requiredFiles(tracked).filter((file) => !packed.has(file));
    expect(missing).toEqual([]);
    // The web build is there (a missing `web/dist` would make the list above trivially short).
    expect(packed.has('web/dist/index.html')).toBe(true);
    expect(packed.has('server/dist/main.js')).toBe(true);
  });

  it('AC-2 the packed server build holds exactly one module per server source: no stale file', () => {
    const packedServer = report.files.map((f) => f.path).filter((file) => file.startsWith('server/dist/'));
    const expected = serverModules();
    // A stale module (its source removed: `tsc -b` keeps the output) fails here; `prepack` builds
    // from a clean tree (`scripts/clean-build.mjs`).
    expect(packedServer.filter((file) => !expected.includes(file))).toEqual([]);
    expect(new Set(packedServer)).toEqual(new Set(expected));
  });

  it('AC-2 the packed web build is a production build', () => {
    // The Vitest global setup builds web/dist without the `NODE_ENV=test` of Vitest (review 1).
    expect(developmentBuildFiles(path.join(REPO_ROOT, 'web', 'dist'))).toEqual([]);
  });

  it('AC-2 the bin is packed executable (ES-16)', () => {
    const bin = report.files.find((f) => f.path === 'bin/wingfoil-ui.cjs');
    expect(bin?.mode).toBe(0o755);
  });

  it('AC-1 runtime dependencies are declared and no workspace package is imported at run time', () => {
    const root = readManifest();
    const server = readManifest(path.join(REPO_ROOT, 'server'));
    // ES-9: the root declares exactly the server's run-time dependencies.
    expect(root.dependencies).toEqual(server.dependencies);
    // ES-8: every bare import of the built server is declared; `@wingfoil-ui/contracts` is
    // type-only, so the installed package never needs it.
    const imports = bareImports(path.join(REPO_ROOT, 'server', 'dist'));
    const undeclared = [...imports]
      .filter(([name]) => !(name in (root.dependencies ?? {})))
      .map(([name, files]) => `${name} (${files.join(', ')})`);
    expect(undeclared).toEqual([]);
    expect([...imports.keys()].filter((name) => name.startsWith('@wingfoil-ui/'))).toEqual([]);
  });

  it('AC-1 prepack builds and the package stays private', () => {
    const root = readManifest();
    expect(root.scripts?.prepack).toBe('node scripts/clean-build.mjs && npm run build');
    expect(root.private).toBe(true);
    expect(report.name).toBe('wingfoil-ui');
    expect(report.version).toBe(root.version);
  });
});
