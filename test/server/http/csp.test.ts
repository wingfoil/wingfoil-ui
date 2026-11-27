// task-084 (bug-039) — the Content-Security-Policy header on the HTML responses of the console
// (spec-004 §1, §5). The hash of the theme script is computed here, independently of the server.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { createLogger } from '../../../server/src/logging.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const logger = createLogger(new Writable({ write: (_c, _e, cb) => cb() }));
const THEME_SCRIPT = /<script id="wfui-theme">([\s\S]*?)<\/script>/;

function themeHash(html: string): string {
  const match = THEME_SCRIPT.exec(html);
  if (!match) throw new Error('no theme script in the html');
  return `'sha256-${createHash('sha256').update(match[1]!, 'utf8').digest('base64')}'`;
}

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find((tokens) => tokens[0] === name);
  return found ? found.slice(1) : [];
}

let realHtml: string;
let staticDir: string;
let emptyDir: string;

beforeAll(async () => {
  realHtml = await readFile(path.resolve(__dirname, '../../../web/index.html'), 'utf8');
  staticDir = await mkdtemp(path.join(tmpdir(), 'wfui-csp-'));
  await writeFile(path.join(staticDir, 'index.html'), realHtml);
  emptyDir = await mkdtemp(path.join(tmpdir(), 'wfui-csp-empty-'));
});

afterAll(async () => {
  await rm(staticDir, { recursive: true, force: true });
  await rm(emptyDir, { recursive: true, force: true });
});

async function policyOf(url: string): Promise<string> {
  const app = await buildApp({ staticDir, logger, security });
  const res = await app.inject({ method: 'GET', url, headers: AUTH });
  await app.close();
  expect(res.statusCode).toBe(200);
  const header = res.headers['content-security-policy'];
  expect(typeof header).toBe('string');
  return header as string;
}

describe('Content-Security-Policy on the page responses', () => {
  it('GET / allows the theme script by its hash and scripts from self only', async () => {
    const script = directive(await policyOf('/'), 'script-src');
    expect(script).toContain("'self'");
    expect(script).toContain(themeHash(realHtml));
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it.each(['/index.html', '/p/p_abcdefghijkl/memory', '/p/x/docs/README.md'])(
    '%s carries the same policy as /',
    async (url) => {
      expect(await policyOf(url)).toBe(await policyOf('/'));
    },
  );

  it('denies objects, frames and defaults, with no remote source and no data: image', async () => {
    const policy = await policyOf('/');
    expect(directive(policy, 'default-src')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'frame-src')).toEqual(["'none'"]);
    expect(directive(policy, 'img-src')).toEqual(["'self'"]);
    expect(directive(policy, 'connect-src')).toEqual(["'self'"]);
    expect(directive(policy, 'font-src')).toEqual(["'self'"]);
    expect(policy).not.toMatch(/https?:|data:|\*/);
  });
});

describe('scope of the header', () => {
  it('is absent from JSON responses, 404 assets and an event stream', async () => {
    const app = await buildApp({
      staticDir,
      logger,
      security,
      register: (instance) => {
        instance.get('/api/test-stream', (_req, reply) =>
          reply.header('content-type', 'text/event-stream').send('data: 1\n\n'),
        );
      },
    });
    for (const url of ['/api/nothing', '/assets/missing.js', '/api/test-stream']) {
      const res = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(res.headers['content-security-policy'], url).toBeUndefined();
    }
    await app.close();
  });

  it('a staticDir without index.html: JSON 404 without the header, no crash', async () => {
    const app = await buildApp({ staticDir: emptyDir, logger, security });
    const res = await app.inject({ method: 'GET', url: '/', headers: AUTH });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-security-policy']).toBeUndefined();
    await app.close();
  });
});

describe('the policy follows the served file', () => {
  it('changes the hash when the theme script is edited', async () => {
    const edited = realHtml.replace('<script id="wfui-theme">', '<script id="wfui-theme">/* x */');
    const dir = await mkdtemp(path.join(tmpdir(), 'wfui-csp-edit-'));
    try {
      await writeFile(path.join(dir, 'index.html'), edited);
      const app = await buildApp({ staticDir: dir, logger, security });
      const res = await app.inject({ method: 'GET', url: '/', headers: AUTH });
      await app.close();
      const script = directive(String(res.headers['content-security-policy']), 'script-src');
      expect(script).toContain(themeHash(edited));
      expect(script).not.toContain(themeHash(realHtml));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
