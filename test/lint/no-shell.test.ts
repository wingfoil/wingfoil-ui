// TT-SEC-05 (REQ-SEC-05): a lint rule finds every use of `exec`, `execSync` or `shell: true` in `server/`.
import { ESLint } from 'eslint';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

const eslint = new ESLint({ cwd: REPO_ROOT });

async function errors(code: string, file = 'server/src/sample.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO_ROOT, file) });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.message);
}

const FORBIDDEN: Record<string, string> = {
  'named exec': "import { exec } from 'node:child_process';\nexec('ls');\n",
  'named execSync': "import { execSync } from 'child_process';\nexecSync('ls');\n",
  'aliased exec': "import { exec as run } from 'node:child_process';\nrun('ls');\n",
  'namespace import': "import * as cp from 'node:child_process';\ncp.exec('ls');\n",
  'default import': "import cp from 'node:child_process';\ncp.execSync('ls');\n",
  require: "const cp = require('node:child_process');\ncp.exec('ls');\n",
  'dynamic import': "const cp = await import('node:child_process');\ncp.exec('ls');\n",
  'shell: true': "import { spawn } from 'node:child_process';\nspawn('ls', [], { shell: true });\n",
  'shell: a string':
    "import { execFile } from 'node:child_process';\nexecFile('ls', [], { shell: '/bin/sh' }, () => {});\n",
  'shell: a variable': "import { spawn } from 'node:child_process';\nconst s = true;\nspawn('ls', [], { shell: s });\n",
};

const ALLOWED: Record<string, string> = {
  execFile: "import { execFile } from 'node:child_process';\nexecFile('git', ['status'], () => {});\n",
  'spawn without shell': "import { spawn } from 'node:child_process';\nspawn('git', ['status'], { shell: false });\n",
  'RegExp#exec': "export const m = /a(b)/.exec('ab');\n",
};

describe('REQ-SEC-05 lint rule in server/', () => {
  it.each(Object.entries(FORBIDDEN))('reports %s', async (_name, code) => {
    expect(await errors(code)).not.toEqual([]);
  });

  it.each(Object.entries(ALLOWED))('accepts %s', async (_name, code) => {
    expect(await errors(code)).toEqual([]);
  });

  it('names REQ-SEC-05 in the message', async () => {
    expect((await errors(FORBIDDEN['named exec']!)).join('\n')).toContain('REQ-SEC-05');
  });
});
