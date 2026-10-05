// TT-SEC-05 (REQ-SEC-05): a lint rule finds every use of `exec`, `execSync` or `shell: true` in `server/`.
import { ESLint } from 'eslint';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

const eslint = new ESLint({ cwd: REPO_ROOT });

/** Messages of the REQ-SEC-05 rule only: another rule or a parse error must not satisfy a case. */
async function sec05(code: string, file = 'server/src/sample.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO_ROOT, file) });
  const messages = result?.messages ?? [];
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`parse error: ${fatal.map((m) => m.message).join('; ')}`);
  return messages.filter((m) => m.severity === 2 && m.message.includes('REQ-SEC-05')).map((m) => m.message);
}

const FORBIDDEN: Record<string, string> = {
  'named exec': "import { exec } from 'node:child_process';\nexec('ls');\n",
  'named execSync': "import { execSync } from 'child_process';\nexecSync('ls');\n",
  'aliased exec': "import { exec as run } from 'node:child_process';\nrun('ls');\n",
  'namespace import': "import * as cp from 'node:child_process';\ncp.exec('ls');\n",
  'default import': "import cp from 'node:child_process';\ncp.execSync('ls');\n",
  require: "const cp = require('node:child_process');\ncp.exec('ls');\n",
  'module.require': "const cp = module.require('child_process');\ncp.exec('ls');\n",
  createRequire:
    "import { createRequire } from 'node:module';\nconst cp = createRequire(import.meta.url)('child_process');\ncp.exec('ls');\n",
  getBuiltinModule: "process.getBuiltinModule('node:child_process').exec('ls');\n",
  'dynamic import': "const cp = await import('node:child_process');\ncp.exec('ls');\n",
  'dynamic import, template literal': 'const cp = await import(`node:child_process`);\ncp.exec("ls");\n',
  'dynamic import, computed': "const cp = await import('child_' + 'process');\ncp.exec('ls');\n",
  'shell: true': "import { spawn } from 'node:child_process';\nspawn('ls', [], { shell: true });\n",
  'shell: a string':
    "import { execFile } from 'node:child_process';\nexecFile('ls', [], { shell: '/bin/sh' }, () => {});\n",
  'shell: a variable': "import { spawn } from 'node:child_process';\nconst s = true;\nspawn('ls', [], { shell: s });\n",
  "'shell': true": "import { spawn } from 'node:child_process';\nspawn('ls', [], { 'shell': true });\n",
  'shell assigned':
    "import { spawn } from 'node:child_process';\nconst o: { shell?: boolean } = {};\no.shell = true;\nspawn('ls', [], o);\n",
  'shell assigned, bracket': "const o: Record<string, boolean> = {};\no['shell'] = true;\n",
  'computed key in process options':
    "import { spawn } from 'node:child_process';\nconst k = 'shell';\nspawn('ls', [], { [k]: true });\n",
  'spread in process options':
    "import { spawn } from 'node:child_process';\nconst x = { shell: false };\nspawn('ls', [], { ...x });\n",
  'shell interpreter as program': "import { spawn } from 'node:child_process';\nspawn('sh', ['-c', 'ls']);\n",
  'cmd interpreter as program':
    "import { execFile } from 'node:child_process';\nexecFile('cmd.exe', ['/c', 'dir'], () => {});\n",
};

const ALLOWED: Record<string, string> = {
  execFile: "import { execFile } from 'node:child_process';\nexecFile('git', ['status'], () => {});\n",
  'spawn without shell': "import { spawn } from 'node:child_process';\nspawn('git', ['status'], { shell: false });\n",
  'RegExp#exec': "export const m = /a(b)/.exec('ab');\n",
  'type-only default import': "import type cp from 'node:child_process';\nexport type T = typeof cp;\n",
  'destructured shell field': 'export function f({ shell }: { shell: string }): string {\n  return shell;\n}\n',
  'computed key elsewhere': "const k = 'a';\nexport const o = { [k]: 1 };\n",
};

describe('REQ-SEC-05 lint rule in server/', () => {
  it.each(Object.entries(FORBIDDEN))('reports %s', async (_name, code) => {
    expect(await sec05(code)).not.toEqual([]);
  });

  it.each(Object.entries(ALLOWED))('accepts %s', async (_name, code) => {
    expect(await sec05(code)).toEqual([]);
  });

  it.each(['mts', 'cts', 'js', 'mjs', 'cjs', 'jsx', 'tsx'])('applies to .%s files', async (ext) => {
    const code =
      ext === 'cts' || ext === 'cjs'
        ? FORBIDDEN['require']!
        : "import { exec } from 'node:child_process';\nexec('ls');\n";
    expect(await sec05(code, `server/src/sample.${ext}`)).not.toEqual([]);
  });

  it('does not apply outside server/', async () => {
    expect(await sec05(FORBIDDEN['named exec']!, 'test/harness/sample.ts')).toEqual([]);
  });
});
