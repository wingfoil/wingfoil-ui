// task-033 D33-5 (bug-012) — local folders out of the tool messages the API sends.
import { mkdir, realpath, symlink } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_MESSAGE, redactLocalPaths } from '../../../server/src/git/redact.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';

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
    const text = `Command failed: git -C ${project} commit\nfatal: Unable to create '${top}/.git/index.lock': File exists.\nsee ${root}/x/notes`;
    expect(redactLocalPaths(text, { project: [project], repository: [top, path.join(top, '.git')], home: root })).toBe(
      `Command failed: git -C <project> commit\nfatal: Unable to create '<repository>/.git/index.lock': File exists.\nsee ~/x/notes`,
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
    // bug-017 (task-040): the cap keeps the head and the tail of the text.
    const long = redactLocalPaths('x'.repeat(MAX_MESSAGE + 50), { home: null });
    expect(long.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(long).toContain('\n…\n');
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

// bug-017 (task-040, review round 1 S3, S4): what is sent is safe to show — control characters
// (except newline and tab) and the bidirectional controls become visible escapes; a long text keeps
// its end, where git's own rejection line is (a hook's output comes first), and the cap never
// splits an escape or a redaction token.
describe('bug-017 — control characters and the cap', () => {
  it.each([
    ['ESC (ANSI colour)', 'remote: \u001b[31mdenied\u001b[0m', 'remote: \\x1b[31mdenied\\x1b[0m'],
    ['CR (a line rewritten)', 'ok\rfatal: fake', 'ok\\x0dfatal: fake'],
    ['BEL, NUL, DEL and a C1 control', 'a\u0007b\u0000c\u007fd\u009be', 'a\\x07b\\x00c\\x7fd\\x9be'],
    ['RIGHT-TO-LEFT OVERRIDE', 'file \u202etxt.exe', 'file \\u202etxt.exe'],
    [
      'the other bidi controls',
      '\u202a\u202b\u202c\u202d\u2066\u2067\u2068\u2069',
      '\\u202a\\u202b\\u202c\\u202d\\u2066\\u2067\\u2068\\u2069',
    ],
  ])('%s becomes a visible escape', (_name, text, expected) => {
    expect(redactLocalPaths(text, { home: null })).toBe(expected);
  });

  it('keeps newlines and tabs, and an ordinary non-ASCII text', () => {
    expect(redactLocalPaths('a\tb\nc — è ü 中', { home: null })).toBe('a\tb\nc — è ü 中');
  });

  it('neutralises after the paths are redacted: a path followed by ESC is still redacted', () => {
    const project = path.join(root, 'repo', 'proj');
    expect(redactLocalPaths(`${project}\u001b[K`, { project: [project], home: null })).toBe('<project>\\x1b[K');
  });

  it("a long hook output keeps git's concluding lines", () => {
    const text = `${'remote: noise\n'.repeat(2000)} ! [remote rejected] HEAD -> main (pre-receive hook declined)\nerror: failed to push some refs to '<remote>'`;
    const out = redactLocalPaths(text, { home: null });
    expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(out.startsWith('remote: noise')).toBe(true);
    expect(out).toContain('\n…\n');
    expect(
      out.endsWith(
        "! [remote rejected] HEAD -> main (pre-receive hook declined)\nerror: failed to push some refs to '<remote>'",
      ),
    ).toBe(true);
  });

  it('the cap never splits an escape or a redaction token', () => {
    const project = path.join(root, 'repo', 'proj');
    for (let shift = 0; shift < 12; shift++) {
      const unit = `\u001b${project}`;
      const text = 'y'.repeat(shift) + unit.repeat(MAX_MESSAGE); // 13 characters each once redacted
      const out = redactLocalPaths(text, { project: [project], home: null });
      expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE);
      const [head, tail] = out.split('\n…\n');
      // Every backslash starts a whole escape, every `<` a whole token.
      for (const part of [head!, tail!]) {
        expect(part.replace(/\\x1b|<project>/g, '')).toMatch(/^y*$/);
      }
    }
  });
});

// task-040 review round 2 (bug-017: S2-2, R2-5, R2-6, S2-7): neutralised by Unicode category, a
// backslash written `\\` first so every escape in the output is one, CRLF folded to a newline, the
// scheme-less userinfo rule seeing through a control character, a cap that never splits a pair.
describe('bug-017 — review round 2', () => {
  const c = (n: number) => String.fromCodePoint(n);

  it.each([
    [0x200e, '\\u200e'],
    [0x200f, '\\u200f'],
    [0x061c, '\\u061c'],
    [0xfeff, '\\ufeff'],
    [0x200b, '\\u200b'],
    [0x200d, '\\u200d'],
    [0x2028, '\\u2028'],
    [0x2029, '\\u2029'],
    [0x00ad, '\\xad'],
    [0x180e, '\\u180e'],
    [0xe0001, '\\u{e0001}'],
  ])('code point %d (Cf, Zl, Zp) becomes a visible escape', (code, escaped) => {
    expect(redactLocalPaths(`a${c(code)}b`, { home: null })).toBe(`a${escaped}b`);
  });

  it('a lone surrogate (Cs) becomes a visible escape; a pair (an emoji) and a combining mark stay', () => {
    expect(redactLocalPaths(`a${String.fromCharCode(0xd800)}b`, { home: null })).toBe('a\\ud800b');
    expect(redactLocalPaths('ok 😀 a\u034fb', { home: null })).toBe('ok 😀 a\u034fb');
  });

  it('a literal backslash is written \\\\, so a printed "\\x1b" is told from a real ESC', () => {
    expect(redactLocalPaths('C:\\dir and \\x1b', { home: null })).toBe('C:\\\\dir and \\\\x1b');
    expect(redactLocalPaths(`${c(0x1b)}`, { home: null })).toBe('\\x1b');
  });

  it('CRLF becomes a newline, a lone CR stays visible', () => {
    expect(redactLocalPaths('a\r\nb\rc', { home: null })).toBe('a\nb\\x0dc');
  });

  it('the scheme-less userinfo rule sees through a control character before it', () => {
    expect(redactLocalPaths(`${c(0x1b)}u:tok@git.example.test`, { home: null })).toBe('\\x1bgit.example.test');
    expect(redactLocalPaths(`x${c(0x200e)}u:tok@git.example.test`, { home: null })).toBe('x\\u200egit.example.test');
  });

  it('the cap never splits a surrogate pair, whatever the offset', () => {
    const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
    for (let shift = 0; shift < 4; shift++) {
      const out = redactLocalPaths('y'.repeat(shift) + '😀'.repeat(MAX_MESSAGE), { home: null });
      expect(out.length).toBeLessThanOrEqual(MAX_MESSAGE);
      expect(lone.test(out)).toBe(false);
    }
  });

  it('the cap never splits an escaped backslash or a long escape', () => {
    for (let shift = 0; shift < 12; shift++) {
      const out = redactLocalPaths('y'.repeat(shift) + `\\${c(0xe0001)}`.repeat(MAX_MESSAGE), { home: null });
      const [head, tail] = out.split('\n…\n');
      for (const part of [head!, tail!]) expect(part.replace(/\\\\|\\u\{e0001\}/g, '')).toMatch(/^y*$/);
    }
  });
});
