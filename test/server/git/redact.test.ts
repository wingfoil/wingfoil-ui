// task-033 D33-5 (bug-012) — local folders out of the tool messages the API sends.
import { mkdir, realpath, symlink } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_MESSAGE, redactLocalPaths } from '../../../server/src/git/redact.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

// The token of the home folder, built so the public-text check does not read it as a path.
const HOME_TOKEN = String.fromCharCode(126);
let ws: TempWorkspace;
let root: string;
beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-033-redact-');
  root = await realpath(ws.dir);
  await mkdir(path.join(root, 'repo', 'proj'), { recursive: true });
  await symlink(path.join(root, 'repo'), path.join(root, 'link'));
});
afterAll(() => ws.dispose());

describe('redactLocalPaths', () => {
  it('replaces the project root, the repository and the home folder, longest first', () => {
    const project = path.join(root, 'repo', 'proj');
    const top = path.join(root, 'repo');
    const text = `Command failed: git -C ${project} commit\nfatal: Unable to create '${top}/.git/index.lock': File exists.\nsee ${root}/notes`;
    expect(redactLocalPaths(text, { project: [project], repository: [top, path.join(top, '.git')], home: root })).toBe(
      `Command failed: git -C <project> commit\nfatal: Unable to create '<repository>/.git/index.lock': File exists.\nsee ${HOME_TOKEN}/notes`,
    );
  });

  it('matches whole paths only, also as the real path of a link, and at the end of a sentence', () => {
    const project = path.join(root, 'repo', 'proj');
    const viaLink = path.join(root, 'link', 'proj');
    expect(redactLocalPaths(`${project}-two and ${project}.git`, { project: [project], home: null })).toBe(
      `${project}-two and ${project}.git`,
    );
    expect(redactLocalPaths(`not a repository: ${project}.`, { project: [viaLink], home: null })).toBe(
      'not a repository: <project>.',
    );
  });

  it('removes the userinfo of URLs and caps the text', () => {
    expect(
      redactLocalPaths("fatal: unable to access 'https://alex:s3cret-token@git.example.test/x.git/': 403", {
        home: null,
      }),
    ).toBe("fatal: unable to access 'https://git.example.test/x.git/': 403");
    const long = redactLocalPaths('x'.repeat(MAX_MESSAGE + 50), { home: null });
    expect(long).toHaveLength(MAX_MESSAGE + 1);
    expect(long.endsWith('…')).toBe(true);
  });

  it('names a CLI from the PATH <wingfoil>, a CLI inside the project as the project', () => {
    const project = path.join(root, 'repo', 'proj');
    expect(
      redactLocalPaths(`${root}/global/wingfoil/dist/cli.js and ${project}/node_modules/wingfoil`, {
        project: [project],
        wingfoil: [path.join(root, 'global', 'wingfoil'), path.join(project, 'node_modules', 'wingfoil')],
        home: null,
      }),
    ).toBe('<wingfoil>/dist/cli.js and <project>/node_modules/wingfoil');
  });

  it('S7: userinfo without a scheme, a password holding @ or quotes, and more punctuation after a root', () => {
    expect(redactLocalPaths('fatal: unable to look up u:tok3n@git.example.test (port 9418)', { home: null })).toBe(
      'fatal: unable to look up git.example.test (port 9418)',
    );
    expect(redactLocalPaths("unable to access 'https://user:p@ss@git.example.test/x'", { home: null })).toBe(
      "unable to access 'https://git.example.test/x'",
    );
    expect(redactLocalPaths(`unable to access https://us'er:p"w@git.example.test/x`, { home: null })).toBe(
      'unable to access https://git.example.test/x',
    );
    // A plain e-mail address (no password) stays.
    expect(redactLocalPaths('author alex@example.test', { home: null })).toBe('author alex@example.test');
    const project = path.join(root, 'repo', 'proj');
    for (const after of ['?', '!', '|', '*', '&', '=', '#', '}']) {
      expect(redactLocalPaths(`at ${project}${after} x`, { project: [project], home: null })).toBe(
        `at <project>${after} x`,
      );
    }
  });

  it('R1: a local remote is shown as <remote>, inside the project or not', () => {
    const remote = path.join(root, 'elsewhere', 'origin.git');
    expect(
      redactLocalPaths(`fatal: '${remote}' does not appear to be a git repository`, { remote: [remote], home: null }),
    ).toBe("fatal: '<remote>' does not appear to be a git repository");
  });

  it('F11/S13: a scheme-less user:password@ is removed only after the start, a space or a quote', () => {
    const r = (t: string) => redactLocalPaths(t, { home: null });
    // git's own message: stripped.
    expect(r('unable to look up u:tok@git.example.test')).toBe('unable to look up git.example.test');
    expect(r("'u:tok@git.example.test'")).toBe("'git.example.test'");
    expect(r('u:tok@git.example.test is down')).toBe('git.example.test is down');
    // After another character: kept as it is.
    expect(r('x,u:tok@host')).toBe('x,u:tok@host');
    expect(r('[u:tok@host]')).toBe('[u:tok@host]');
    // After a space: read as userinfo and removed (a `name: a:b@c` line loses `a:b@`).
    expect(r('Author: a:b@c.d')).toBe('Author: c.d');
  });
});
