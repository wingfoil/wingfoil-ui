/**
 * The heavy gates on GitHub Actions (task-071, dl-016; decisions D71-1 … D71-17, W2-2): the
 * invariants of `.github/workflows/gates.yml`.
 *
 * - AC-1: it runs on a push of a `task/**` or `design/**` branch and by `workflow_dispatch` (the
 *   `scope` and `specs` inputs), never on pull requests or tags; one run per ref; every job a limit.
 * - AC-2, AC-3: the jobs of the `task` and `wave` scopes and what each one runs.
 * - AC-4: the only uploads are the coverage totals and the Playwright reports (on failure).
 * - AC-5: read-only permissions, no secret, every action pinned to the commit `publish.yml` pins,
 *   no expression in a `run:` line and the inputs only in `env:` values and job conditions.
 *
 * The security rules are one function, {@link problems}, run on the real file (no problem) and on
 * deliberately wrong copies of it (each mutation must be caught), so no rule passes vacuously (AC-6).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../harness/cli.js';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}
interface Job {
  needs?: string | string[];
  if?: string;
  permissions?: unknown;
  'timeout-minutes'?: number;
  'runs-on'?: string;
  strategy?: { 'fail-fast'?: boolean; matrix?: Record<string, unknown[]> };
  env?: Record<string, unknown>;
  steps?: Step[];
}
interface Workflow {
  name?: string;
  on?: Record<string, unknown>;
  permissions?: unknown;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  env?: Record<string, unknown>;
  jobs?: Record<string, Job>;
}

const WORKFLOWS = path.join(REPO_ROOT, '.github', 'workflows');
const read = (name: string): string => readFileSync(path.join(WORKFLOWS, name), 'utf8');
const PUBLISH = read('publish.yml');
const PUBLISH_WF = parse(PUBLISH) as Workflow & { env: Record<string, string> };

/** `owner/repo` → the commit `publish.yml` pins it to, with its tag. */
function pins(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of text.matchAll(/^\s*-?\s*uses: ([\w.-]+\/[\w.-]+)@([0-9a-f]{40}) # (v\d+\.\d+\.\d+)$/gm))
    map.set(m[1]!, `${m[2]!} # ${m[3]!}`);
  return map;
}
const PUBLISH_PINS = pins(PUBLISH);

const isMap = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const stepsOf = (job: Job): Step[] => job.steps ?? [];
const runsOf = (job: Job): string[] => stepsOf(job).flatMap((s) => (s.run ? [s.run] : []));

/** Every string value of `node` with its key path (`jobs.x.steps.0.env.SPECS`). */
function strings(node: unknown, at = ''): [string, string][] {
  if (typeof node === 'string') return [[at, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${at}.${i}`));
  if (isMap(node)) return Object.entries(node).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k));
  return [];
}

/** The only expressions `gates.yml` may contain (review F2: an allow-list, not a deny-list). */
const EXPRESSIONS = new Set([
  'github.ref',
  'env.NODE_VERSION',
  "inputs.scope != 'wave'",
  "inputs.scope == 'wave'",
  'inputs.specs',
  'matrix.shard',
  'matrix.engine',
  'failure()',
]);

/** Every key and every string value of `node`, at any depth. */
function keysAndValues(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(keysAndValues);
  if (isMap(node)) return Object.entries(node).flatMap(([k, v]) => [k, ...keysAndValues(v)]);
  return [];
}

const UPLOAD_PATHS = new Set(['coverage-totals/coverage-totals.json', 'playwright-report/']);

/** The AC-1, AC-4 and AC-5 rules: one line per breach, none for a sound workflow. */
function problems(text: string): string[] {
  const out: string[] = [];
  let wf: Workflow;
  try {
    wf = parse(text) as Workflow;
  } catch {
    return ['not YAML'];
  }
  if (!isMap(wf)) return ['not a workflow'];
  const jobs: Record<string, Job> = isMap(wf.jobs) ? (wf.jobs as Record<string, Job>) : {};
  if (Object.keys(jobs).length === 0) out.push('no job');

  // AC-1 — triggers, inputs, concurrency, limits.
  const on = isMap(wf.on) ? wf.on : {};
  if (JSON.stringify(Object.keys(on).sort()) !== '["push","workflow_dispatch"]') out.push('triggers');
  if (JSON.stringify(on['push']) !== JSON.stringify({ branches: ['task/**', 'design/**'] })) out.push('push filter');
  const inputs = isMap(on['workflow_dispatch']) ? on['workflow_dispatch']['inputs'] : undefined;
  const scope = isMap(inputs) ? inputs['scope'] : undefined;
  const specs = isMap(inputs) ? inputs['specs'] : undefined;
  if (!isMap(inputs) || JSON.stringify(Object.keys(inputs).sort()) !== '["scope","specs"]') out.push('inputs');
  if (
    !isMap(scope) ||
    scope['type'] !== 'choice' ||
    JSON.stringify(scope['options']) !== '["task","wave"]' ||
    scope['default'] !== 'task'
  )
    out.push('scope input');
  if (!isMap(specs) || specs['type'] !== 'string' || specs['default'] !== '') out.push('specs input');
  const concurrency: NonNullable<Workflow['concurrency']> = isMap(wf.concurrency) ? wf.concurrency : {};
  if (concurrency.group !== 'gates-${{ github.ref }}' || concurrency['cancel-in-progress'] !== true)
    out.push('concurrency');
  for (const [name, job] of Object.entries(jobs)) {
    const limit = job['timeout-minutes'];
    if (typeof limit !== 'number' || limit <= 0 || limit > 60) out.push(`limit ${name}`);
  }

  // AC-5 — permissions, credentials, pins.
  if (JSON.stringify(wf.permissions) !== JSON.stringify({ contents: 'read' })) out.push('permissions');
  for (const [name, job] of Object.entries(jobs)) if ('permissions' in job) out.push(`job permissions ${name}`);
  // On the raw text and on every parsed key and value: a double-quoted escape (`\x24{{`, `\x67ithub`)
  // is visible only once parsed (review R2-F1).
  const sources = [text, ...keysAndValues(wf)];
  if (
    sources.some((s) =>
      /\bsecrets\b|github\.token|GITHUB_TOKEN|github\.event\b|head_ref|pull_request|workflow_run/.test(s),
    )
  )
    out.push('event or credential reference');
  // The pins on the parsed values (any YAML style, review F3), the release tag on the lines.
  let parsedUses = 0;
  for (const [name, job] of Object.entries(jobs)) {
    if ('uses' in job) out.push(`unpinned reusable workflow ${name}`);
    for (const s of stepsOf(job)) {
      if (s.uses === undefined) continue;
      parsedUses += 1;
      const m = /^([\w.-]+\/[\w.-]+)@([0-9a-f]{40})$/.exec(String(s.uses));
      if (!m) out.push(`unpinned ${String(s.uses)}`);
      else if (PUBLISH_PINS.get(m[1]!)?.split(' ')[0] !== m[2]) out.push(`pin differs from publish.yml ${m[1]!}`);
    }
  }
  // An anchored or aliased step parses to more `uses` values than there are `uses:` lines, so it fails
  // this count: deliberate, on the safe side (review R2-F3).
  const useLines = text.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
  if (useLines.length !== parsedUses) out.push('unpinned: a uses outside a plain `uses:` line');
  for (const line of useLines) {
    const m = /uses: ([\w.-]+\/[\w.-]+)@([0-9a-f]{40}) # (v\d+\.\d+\.\d+)$/.exec(line);
    if (!m) out.push(`unpinned ${line.trim()}`);
    else if (PUBLISH_PINS.get(m[1]!) !== `${m[2]!} # ${m[3]!}`) out.push(`pin differs from publish.yml ${m[1]!}`);
  }
  for (const [name, job] of Object.entries(jobs)) {
    if ('continue-on-error' in job) out.push(`continue-on-error ${name}`);
    for (const s of stepsOf(job)) {
      if ('continue-on-error' in s) out.push(`continue-on-error ${name}`);
      const action = s.uses?.split('@')[0];
      if (action === 'actions/checkout' && s.with?.['persist-credentials'] !== false)
        out.push(`persisted credentials ${name}`);
      if (action === 'actions/setup-node' && s.with?.['package-manager-cache'] !== false) out.push(`npm cache ${name}`);
      if (s.with && 'registry-url' in s.with) out.push(`registry-url ${name}`);
      if (
        action &&
        !['actions/checkout', 'actions/setup-node', 'actions/setup-python', 'actions/upload-artifact'].includes(action)
      )
        out.push(`action ${action}`);
    }
  }

  // AC-5 — no expression in a shell line, a shell or a working directory; the inputs (dot or
  // bracket form) only in env values and job conditions (review F1).
  for (const [at, value] of strings(wf)) {
    if (/\.run$/.test(at) && value.includes('${{')) out.push(`expression in run ${at}`);
    if (/\.(?:shell|working-directory)$/.test(at) && value.includes('${{'))
      out.push(`expression in a shell field ${at}`);
    if (/\binputs\s*[.[]/.test(value) && !/\.env\.[^.]+$/.test(at) && !/^jobs\.[^.]+\.if$/.test(at))
      out.push(`input outside env or a job condition ${at}`);
  }
  // AC-5 — every expression is one of the few the workflow needs: no whole context
  // (`toJSON(github)` holds the job token), no function but `failure()` (review F2).
  // Read on the raw text and on every parsed key and value (review R2-F1). The raw text also counts a
  // `${{` written in a YAML comment, and the parsed values count a step an anchor repeats: both only
  // add findings, never hide one — deliberate, on the safe side (review R2-F3).
  for (const source of sources) {
    const expressions = [...source.matchAll(/\$\{\{([^}]*)\}\}/g)].map((m) => m[1]!.trim());
    if (expressions.length !== (source.match(/\$\{\{/g) ?? []).length) out.push('expression not allowed: unclosed');
    for (const e of expressions) if (!EXPRESSIONS.has(e)) out.push(`expression not allowed ${e}`);
  }

  // AC-4 — uploads.
  for (const [name, job] of Object.entries(jobs)) {
    for (const s of stepsOf(job)) {
      if (!s.uses?.startsWith('actions/upload-artifact@')) continue;
      const p = String(s.with?.['path'] ?? '').trim();
      if (!UPLOAD_PATHS.has(p)) out.push(`upload path ${name} ${p}`);
      if (s.with?.['retention-days'] !== 14) out.push(`retention ${name}`);
      if (p === 'playwright-report/' && s.if !== '${{ failure() }}') out.push(`report upload condition ${name}`);
      if (p !== 'playwright-report/' && s.if !== undefined) out.push(`coverage upload condition ${name}`);
      if ('overwrite' in (s.with ?? {})) out.push(`overwrite ${name}`);
    }
  }
  return out;
}

const FILE = '.github/workflows/gates.yml';
const text = readFileSync(path.join(REPO_ROOT, FILE), 'utf8');
const wf = parse(text) as Required<Workflow> & { jobs: Record<string, Job> };
const jobs = wf.jobs;
const job = (name: string): Job => {
  const j = jobs[name];
  if (!j) throw new Error(`no job ${name}`);
  return j;
};
const index = (j: Job, pred: (s: Step) => boolean): number => stepsOf(j).findIndex(pred);
const runIndex = (j: Job, cmd: string): number => index(j, (s) => s.run?.includes(cmd) ?? false);

describe('gates.yml — the rules (task-071, AC-1, AC-4, AC-5, AC-6)', () => {
  it('the real workflow breaks none', () => {
    expect(problems(text)).toEqual([]);
  });

  // Each mutation of the real file must be caught by the rule it names (AC-6: no vacuous rule).
  const mutations: [string, string, string, string][] = [
    ['a pull_request trigger', 'workflow_dispatch:\n', 'pull_request:\n  workflow_dispatch:\n', 'triggers'],
    [
      'a tag push',
      "branches: ['task/**', 'design/**']",
      "branches: ['task/**', 'design/**']\n    tags: ['v*']",
      'push filter',
    ],
    [
      'main among the branches',
      "branches: ['task/**', 'design/**']",
      "branches: ['task/**', 'design/**', main]",
      'push filter',
    ],
    ['a third input', '      specs:\n', '      extra:\n        type: string\n      specs:\n', 'inputs'],
    ['a free-text scope', 'type: choice', 'type: string', 'scope input'],
    ['runs left running', 'cancel-in-progress: true', 'cancel-in-progress: false', 'concurrency'],
    ['a group not by ref', 'gates-${{ github.ref }}', 'gates', 'concurrency'],
    ['write-all', 'permissions:\n  contents: read', 'permissions: write-all', 'permissions'],
    [
      'a job widening its token',
      '  checks:\n',
      '  checks:\n    permissions:\n      contents: write\n',
      'job permissions checks',
    ],
    [
      'a secret',
      "NODE_VERSION: '22.22.2'",
      "NODE_VERSION: '22.22.2'\n  NPM: ${{ secrets.NPM }}",
      'event or credential reference',
    ],
    [
      'the job token',
      "NODE_VERSION: '22.22.2'",
      "NODE_VERSION: '22.22.2'\n  T: ${{ github.token }}",
      'event or credential reference',
    ],
    [
      'an event field',
      "NODE_VERSION: '22.22.2'",
      "NODE_VERSION: '22.22.2'\n  M: ${{ github.event.head_commit.message }}",
      'event or credential reference',
    ],
    ['a tag pin', '@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1', '@v7', 'unpinned'],
    [
      'another commit than publish.yml',
      '@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
      '@0000000000000000000000000000000000000000 # v7.0.1',
      'pin differs from publish.yml',
    ],
    ['credentials persisted', 'persist-credentials: false', 'persist-credentials: true', 'persisted credentials'],
    ['an npm cache', 'package-manager-cache: false', 'package-manager-cache: true', 'npm cache'],
    [
      'an input in a run line',
      'node scripts/e2e-own-specs.mjs',
      'echo ${{ inputs.specs }} && node scripts/e2e-own-specs.mjs',
      'expression in run',
    ],
    [
      'the ref in a run line',
      'npm run test:smoke',
      'echo ${{ github.ref_name }} && npm run test:smoke',
      'expression in run',
    ],
    [
      'an input in a with value',
      'fetch-depth: 0',
      'fetch-depth: ${{ inputs.specs }}',
      'input outside env or a job condition',
    ],
    ['a job with no limit', '    timeout-minutes: 15\n', '\n', 'limit checks'],
    ['a limit over an hour', 'timeout-minutes: 15', 'timeout-minutes: 120', 'limit checks'],
    [
      'the coverage folder uploaded',
      'path: coverage-totals/coverage-totals.json',
      'path: coverage/',
      'upload path coverage',
    ],
    ['a long retention', 'retention-days: 14', 'retention-days: 90', 'retention'],
    ['a report on every run', 'if: ${{ failure() }}', 'if: ${{ always() }}', 'report upload condition'],
    [
      'a step that may fail',
      '      - name: Typecheck\n',
      '      - name: Typecheck\n        continue-on-error: true\n',
      'continue-on-error checks',
    ],
    // Review round 1 (F1 … F3): expressions outside `run:`, the bracket form, a whole context, a
    // flow-style step.
    [
      'an expression in a working directory',
      '      - name: Typecheck\n',
      '      - name: Typecheck\n        working-directory: ${{ github.ref_name }}\n',
      'expression in a shell field',
    ],
    [
      'an expression in a shell',
      '      - name: Typecheck\n',
      '      - name: Typecheck\n        shell: bash -c "${{ github.ref_name }}" {0}\n',
      'expression in a shell field',
    ],
    [
      'an input by brackets outside env',
      'fetch-depth: 0',
      "fetch-depth: ${{ inputs['specs'] }}",
      'input outside env or a job condition',
    ],
    [
      'a whole context in env',
      "NODE_VERSION: '22.22.2'",
      "NODE_VERSION: '22.22.2'\n  CTX: ${{ toJSON(github) }}",
      'expression not allowed',
    ],
    // Review round 2 (R2-F1): a double-quoted escape hides an expression from the raw text.
    [
      'an escaped whole context in env',
      "NODE_VERSION: '22.22.2'",
      'NODE_VERSION: \'22.22.2\'\n  CTX: "\\x24{{ toJSON(\\x67ithub) }}"',
      'expression not allowed',
    ],
    [
      'a flow-style step with a tag pin',
      '      - name: Typecheck\n',
      "      - { uses: actions/setup-python@v5, with: { python-version: '3.12' } }\n      - name: Typecheck\n",
      'unpinned',
    ],
  ];
  it.each(mutations)('catches %s', (_, from, to, rule) => {
    expect(text, `the mutation's anchor ${JSON.stringify(from)}`).toContain(from);
    const found = problems(text.replace(from, to));
    expect(
      found.some((p) => p.startsWith(rule)),
      JSON.stringify(found),
    ).toBe(true);
  });

  it('catches an empty workflow', () => {
    expect(problems('')).not.toEqual([]);
    expect(problems('name: gates\n')).toContain('no job');
  });
});

describe('gates.yml — the jobs (task-071, AC-2, AC-3)', () => {
  it('has the jobs of the two scopes, every one after checks, on the runner image of publish.yml', () => {
    expect(Object.keys(jobs)).toEqual([
      'checks',
      'coverage',
      'contract',
      'e2e-chromium',
      'own-specs',
      'smoke',
      'publish-smoke',
      'e2e-wave',
    ]);
    for (const [name, j] of Object.entries(jobs)) {
      expect(j['runs-on'], name).toBe('ubuntu-24.04');
      if (name !== 'checks') expect(j.needs, name).toBe('checks');
    }
    expect(job('checks').needs).toBeUndefined();
  });

  it('checks: refuses any ref but a task/* or design/* branch first, then typecheck, lint, format:check (D71-14)', () => {
    const checks = job('checks');
    const guard = stepsOf(checks)[0]!;
    expect(guard.uses).toBeUndefined();
    expect(guard.run).toContain('case "$GITHUB_REF" in');
    expect(guard.run).toMatch(/refs\/heads\/task\/\* \| refs\/heads\/design\/\*\)/);
    expect(guard.run).toMatch(/\*\)[^\n]*exit 1/);
    const order = ['npm ci', 'npm run typecheck', 'npm run lint', 'npm run format:check'].map((c) =>
      runIndex(checks, c),
    );
    expect(
      order.every((i) => i > 0),
      JSON.stringify(order),
    ).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('the task-only Playwright jobs and the wave job have opposite scope conditions; the others none (W2-2)', () => {
    expect(job('e2e-chromium').if).toBe("${{ inputs.scope != 'wave' }}");
    expect(job('own-specs').if).toBe("${{ inputs.scope != 'wave' }}");
    expect(job('e2e-wave').if).toBe("${{ inputs.scope == 'wave' }}");
    for (const name of ['checks', 'coverage', 'contract', 'smoke', 'publish-smoke'])
      expect(job(name).if, name).toBeUndefined();
  });

  it('runs every job on the gate Node of publish.yml (D71-13) and installs with npm ci', () => {
    expect(wf.env['NODE_VERSION']).toBe(PUBLISH_WF.env['GATE_NODE_VERSION']);
    for (const [name, j] of Object.entries(jobs)) {
      const node = stepsOf(j).filter((s) => s.uses?.startsWith('actions/setup-node@'));
      expect(node, name).toHaveLength(1);
      expect(node[0]!.with?.['node-version'], name).toBe('${{ env.NODE_VERSION }}');
      expect(
        runsOf(j).filter((r) => r.trim() === 'npm ci'),
        name,
      ).toHaveLength(1);
    }
  });

  it('coverage: Python before the run, the runner-only reporters, the totals with no path (AC-2, AC-4, D71-16)', () => {
    const coverage = job('coverage');
    const python = index(coverage, (s) => s.uses?.startsWith('actions/setup-python@') ?? false);
    const run = runIndex(coverage, 'npm run test:coverage');
    expect(python).toBeGreaterThan(0);
    expect(python).toBeLessThan(run);
    expect(stepsOf(coverage)[python]!.with?.['python-version']).toBe('3.12');
    for (const [name, j] of Object.entries(jobs))
      if (name !== 'coverage')
        expect(
          stepsOf(j).some((s) => s.uses?.startsWith('actions/setup-python@')),
          name,
        ).toBe(false);
    const cmd = runsOf(coverage)[runsOf(coverage).findIndex((r) => r.includes('npm run test:coverage'))]!;
    expect(cmd).toContain('--coverage.reporter=text');
    expect(cmd).toContain('--coverage.reporter=json-summary');
    const totals = runIndex(coverage, 'scripts/coverage-totals.mjs');
    expect(totals).toBeGreaterThan(run);
    expect(stepsOf(coverage)[totals]!.run).toContain(
      'node scripts/coverage-totals.mjs coverage/coverage-summary.json --commit "$GITHUB_SHA" --source gates > coverage-totals/coverage-totals.json',
    );
    const upload = stepsOf(coverage).find((s) => s.uses?.startsWith('actions/upload-artifact@'))!;
    expect(upload.with).toMatchObject({
      name: 'coverage-totals',
      path: 'coverage-totals/coverage-totals.json',
      'if-no-files-found': 'error',
    });
  });

  it('contract, smoke, publish-smoke: one npm script each, no browser', () => {
    for (const [name, cmd] of [
      ['contract', 'npm run test:contract'],
      ['smoke', 'npm run test:smoke'],
      ['publish-smoke', 'npm run test:publish-smoke'],
    ] as const) {
      expect(
        runsOf(job(name)).map((r) => r.trim()),
        name,
      ).toEqual(['npm ci', cmd]);
    }
  });

  it('fetches the whole history where the merge-base or the governance suites need it, depth 1 elsewhere (D71-5)', () => {
    for (const [name, j] of Object.entries(jobs)) {
      const checkout = stepsOf(j).filter((s) => s.uses?.startsWith('actions/checkout@'));
      expect(checkout, name).toHaveLength(1);
      const depth = checkout[0]!.with?.['fetch-depth'];
      if (name === 'coverage' || name === 'own-specs') expect(depth, name).toBe(0);
      else expect(depth, name).toBeUndefined();
    }
  });

  it('installs only the engine a Playwright job runs, with its system packages, before running it', () => {
    const engines: Record<string, string> = {
      'e2e-chromium': 'npx playwright install --with-deps chromium',
      'own-specs': 'npx playwright install --with-deps "$ENGINE"',
      'e2e-wave': 'npx playwright install --with-deps "$ENGINE"',
    };
    for (const [name, j] of Object.entries(jobs)) {
      const all = runsOf(j).join('\n');
      const installs = all.match(/playwright install[^\n]*/g) ?? [];
      if (!(name in engines)) {
        expect(installs, name).toEqual([]);
        expect(all, name).not.toMatch(/test:e2e/);
        continue;
      }
      expect(
        installs.map((l) => `npx ${l}`),
        name,
      ).toEqual([engines[name]]);
      expect(all.indexOf(engines[name]!), name).toBeLessThan(all.search(/npm run test:e2e/));
    }
  });

  it('e2e-chromium: the whole suite on Chromium in shards, an HTML report beside the github one (D71-3)', () => {
    const j = job('e2e-chromium');
    expect(j.strategy?.['fail-fast']).toBe(false);
    const shards = Number(wf.env['E2E_SHARDS']);
    expect(shards).toBeGreaterThanOrEqual(1);
    expect(j.strategy?.matrix).toEqual({ shard: Array.from({ length: shards }, (_, i) => i + 1) });
    const step = stepsOf(j).find((s) => s.run?.includes('test:e2e'))!;
    expect(step.run!.trim()).toBe('npm run test:e2e:chromium -- --reporter=github,html --shard="$SHARD/$E2E_SHARDS"');
    expect(step.env).toEqual({
      SHARD: '${{ matrix.shard }}',
      PLAYWRIGHT_HTML_OUTPUT_DIR: 'playwright-report',
      PLAYWRIGHT_HTML_OPEN: 'never',
    });
  });

  it('e2e-wave: every engine × every shard, each its own job and report (AC-3, G3)', () => {
    const j = job('e2e-wave');
    expect(j.strategy?.['fail-fast']).toBe(false);
    const shards = Number(wf.env['E2E_SHARDS']);
    expect(j.strategy?.matrix).toEqual({
      engine: ['chromium', 'firefox', 'webkit'],
      shard: Array.from({ length: shards }, (_, i) => i + 1),
    });
    const step = stepsOf(j).find((s) => s.run?.includes('test:e2e'))!;
    expect(step.run).toContain(
      'npm run test:e2e -- --project="$ENGINE" --reporter=github,html --shard="$SHARD/$E2E_SHARDS"',
    );
    expect(step.env).toMatchObject({ ENGINE: '${{ matrix.engine }}', SHARD: '${{ matrix.shard }}' });
  });

  it('own-specs: the list from the script, nothing to run → one line and success, else the engine (AC-2, D71-6)', () => {
    const j = job('own-specs');
    expect(j.strategy?.['fail-fast']).toBe(false);
    expect(j.strategy?.matrix).toEqual({ engine: ['firefox', 'webkit'] });
    const select = stepsOf(j).find((s) => s.run?.includes('scripts/e2e-own-specs.mjs'))!;
    expect(select.run!.trim()).toBe('node scripts/e2e-own-specs.mjs --base "origin/$PHASE_BRANCH" > own-specs.txt');
    expect(select.env).toEqual({ SPECS: '${{ inputs.specs }}' });
    expect(wf.env['PHASE_BRANCH']).toMatch(/^design\/dev-loop_v\d+\.\d+$/);
    const runStep = stepsOf(j).find((s) => s.run?.includes('test:e2e'))!;
    const lines = runStep
      .run!.trim()
      .split('\n')
      .map((l) => l.trim());
    expect(lines).toEqual([
      'mapfile -t specs < own-specs.txt',
      'if [ "${#specs[@]}" -eq 0 ]; then',
      'echo "no own e2e spec: nothing to run on $ENGINE"',
      'exit 0',
      'fi',
      // bug-038 (task-059 AC-12, review round 1 F-4): listed specs that select no test on the engine.
      'if npx playwright test --list --pass-with-no-tests --project="$ENGINE" "${specs[@]}" | grep -q \'^Total: 0 tests\'; then',
      'echo "no test of the own specs runs on $ENGINE: nothing to run"',
      'exit 0',
      'fi',
      'npx playwright install --with-deps "$ENGINE"',
      'npm run test:e2e -- --project="$ENGINE" --reporter=github,html "${specs[@]}"',
    ]);
    expect(runStep.env).toEqual({
      ENGINE: '${{ matrix.engine }}',
      PLAYWRIGHT_HTML_OUTPUT_DIR: 'playwright-report',
      PLAYWRIGHT_HTML_OPEN: 'never',
    });
  });

  it('own-specs: listed specs that select no test on the engine pass with a line that says so (bug-038, task-059 AC-12)', () => {
    // `performance.spec.ts` holds only `@perf` tests, which `playwright.config.ts` leaves out on
    // Firefox and WebKit (`grepInvert`). The count comes first, from Playwright's own list; the run
    // itself keeps failing on "No tests found" (a changed list format runs, and fails, never passes
    // silently).
    const lines = stepsOf(job('own-specs'))
      .find((s) => s.run?.includes('test:e2e'))!
      .run!.split('\n')
      .map((l) => l.trim());
    const list = lines.findIndex((l) => l.includes('playwright test --list'));
    expect(list).toBeGreaterThan(-1);
    expect(lines[list]).toContain('--project="$ENGINE" "${specs[@]}"');
    expect(lines.slice(list + 1, list + 4)).toEqual([
      'echo "no test of the own specs runs on $ENGINE: nothing to run"',
      'exit 0',
      'fi',
    ]);
    const run = lines.findIndex((l) => l.startsWith('npm run test:e2e'));
    expect(run).toBeGreaterThan(list);
    expect(lines[run]!.split(/\s+/)).not.toContain('--pass-with-no-tests');
  });

  it('uploads a report from each Playwright job under a name of its own, on failure (AC-4, D71-10, D71-11)', () => {
    const names: Record<string, string> = {
      'e2e-chromium': 'playwright-report-chromium-${{ matrix.shard }}',
      'own-specs': 'playwright-report-own-${{ matrix.engine }}',
      'e2e-wave': 'playwright-report-${{ matrix.engine }}-${{ matrix.shard }}',
    };
    for (const [name, j] of Object.entries(jobs)) {
      const uploads = stepsOf(j).filter((s) => s.uses?.startsWith('actions/upload-artifact@'));
      if (name === 'coverage') continue;
      if (!(name in names)) {
        expect(uploads, name).toEqual([]);
        continue;
      }
      expect(uploads, name).toHaveLength(1);
      expect(uploads[0]!.with, name).toMatchObject({ name: names[name], path: 'playwright-report/' });
      // The upload is the job's last step: nothing runs after it.
      expect(stepsOf(j).at(-1), name).toBe(uploads[0]);
    }
  });

  it('points to its guide in the header', () => {
    const header = text
      .split('\n')
      .filter((l) => l.startsWith('#'))
      .join('\n');
    expect(header).toContain('test/README.md');
    expect(header).toContain('CI gates');
    expect(header).toContain('dl-016');
  });
});
