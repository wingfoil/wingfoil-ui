/**
 * The npm publish pipeline (task-029 AC-1, RP-54; D29-4, D29-5, D29-12): the invariants of
 * `.github/workflows/publish.yml` that keep the publish credential-free and two-gated — a `v*` tag
 * (or a manual gate-and-stage run that can never promote), read-only permissions except the OIDC
 * token of the promote job, the `npm-publish` environment, the repository gates and the staging
 * smoke before any registry is touched, `npm stage publish` (never a live publish), no secret,
 * token or `.npmrc`, and every action pinned to a commit. The OIDC trusted publisher, the
 * environment approval and the stage itself can only run on a real tag push (`docs/publishing.md`).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../harness/cli.js';
import { readManifest } from './allow-list.js';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  shell?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}
interface Job {
  needs?: string | string[];
  if?: string;
  environment?: string | { name: string };
  permissions?: Record<string, string>;
  'timeout-minutes'?: number;
  'runs-on'?: string;
  env?: Record<string, string>;
  steps: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  env?: Record<string, string>;
  jobs: Record<string, Job>;
}

const FILE = path.join(REPO_ROOT, '.github', 'workflows', 'publish.yml');
const text = readFileSync(FILE, 'utf8');
const wf = parse(text) as Workflow;
const jobs = wf.jobs;
const runs = (job: Job): string[] => job.steps.map((s) => s.run ?? '').filter(Boolean);
/** The value of `${{ env.NAME }}` / `${{ jobs.x.env.NAME }}` a `with:` value refers to. */
function resolve(job: Job, value: unknown): string {
  const m = /^\$\{\{\s*env\.(\w+)\s*\}\}$/.exec(String(value));
  return m ? (job.env?.[m[1]!] ?? wf.env?.[m[1]!] ?? '') : String(value);
}
function nodeVersion(job: Job): string {
  const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'));
  return resolve(job, setup?.with?.['node-version']);
}

describe('publish.yml (task-029, AC-1)', () => {
  it('runs on a v<major>.<minor>.<patch> tag push, or by hand (gate and stage only), never on pull requests', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(wf.on.push).toEqual({ tags: ['v[0-9]+.[0-9]+.[0-9]+'] });
  });

  it('grants contents: read by default and id-token: write to the promote job alone', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    for (const [name, job] of Object.entries(jobs)) {
      if (name === 'promote') expect(job.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
      else expect(job.permissions ?? {}, name).not.toHaveProperty('id-token');
      for (const [scope, level] of Object.entries(job.permissions ?? {})) {
        if (!(name === 'promote' && scope === 'id-token')) expect(level, `${name} ${scope}`).not.toBe('write');
      }
    }
  });

  it('chains gate → stage → promote; promote runs for a tag only, in the npm-publish environment', () => {
    expect(Object.keys(jobs)).toEqual(['gate', 'stage', 'promote']);
    expect(jobs.stage!.needs).toBe('gate');
    expect(jobs.promote!.needs).toBe('stage');
    expect(jobs.promote!.environment).toBe('npm-publish');
    expect(jobs.promote!.if).toMatch(/github\.ref_type == 'tag'/);
    for (const [name, job] of Object.entries(jobs)) expect(job['timeout-minutes'], name).toBeGreaterThan(0);
  });

  it('gate: the tag checks (on a tag), then typecheck, lint, format:check, test:coverage, test:smoke, and one pack', () => {
    const gate = jobs.gate!;
    const tagCheck = gate.steps.find((s) => s.run?.includes('scripts/check-release-tag.mjs'));
    expect(tagCheck?.run).toMatch(/check-release-tag\.mjs "\$GITHUB_REF_NAME" "\$GITHUB_SHA"/);
    expect(tagCheck?.if).toMatch(/github\.ref_type == 'tag'/);
    const order = [
      'scripts/check-release-tag.mjs',
      'npm ci',
      'npm run typecheck',
      'npm run lint',
      'npm run format:check',
      'npm run test:coverage',
      'npm run test:smoke',
      'npm pack',
    ];
    const at = order.map((cmd) => runs(gate).findIndex((r) => r.includes(cmd)));
    expect(
      at.every((i) => i >= 0),
      JSON.stringify(at),
    ).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(runs(gate).filter((r) => r.includes('npm pack'))).toHaveLength(1);
    expect(gate.steps.some((s) => s.uses?.startsWith('actions/upload-artifact@'))).toBe(true);
  });

  it('stage: the staging smoke on a local registry with the gate tarball', () => {
    const stage = jobs.stage!;
    expect(stage.steps.some((s) => s.uses?.startsWith('actions/download-artifact@'))).toBe(true);
    const smoke = runs(stage).find((r) => r.includes('npm run test:publish-smoke'));
    expect(smoke).toMatch(/WFUI_PUBLISH_TARBALL=/);
  });

  it('promote: npm stage publish of the gate tarball with provenance, xtrace off, never a live publish or an approval', () => {
    const promote = jobs.promote!;
    const step = promote.steps.find((s) => s.run?.includes('npm stage publish'));
    expect(step).toBeDefined();
    expect(step!.shell).toBeUndefined();
    expect(step!.run!.trim().split('\n')[0]).toBe('set +x');
    expect(step!.run).toMatch(/npm stage publish \.\/dist-pack\/\*\.tgz --provenance --access public/);
    expect(promote.steps.some((s) => s.uses?.startsWith('actions/download-artifact@'))).toBe(true);
    // Live publishing and the approval are the approver's acts, never the workflow's.
    const commands = Object.values(jobs).flatMap(runs).join('\n');
    expect(commands).not.toMatch(/\bnpm\s+publish\b/);
    expect(commands).not.toMatch(/\bstage\s+(?:approve|reject)\b|\bdist-tag\b|\bunpublish\b/);
  });

  it('holds no credential: no secret, no token variable, no .npmrc, no registry-url', () => {
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|_authToken|\.npmrc/);
    for (const job of Object.values(jobs)) {
      for (const s of job.steps) expect(s.with ?? {}).not.toHaveProperty('registry-url');
    }
  });

  it('pins every action to a full commit SHA with its release tag in a comment', () => {
    const uses = text.split('\n').filter((line) => /^\s*-?\s*uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
  });

  it('checks out without persisted credentials and sets up Node without a package-manager cache', () => {
    for (const [name, job] of Object.entries(jobs)) {
      for (const s of job.steps) {
        if (s.uses?.startsWith('actions/checkout@')) expect(s.with?.['persist-credentials'], name).toBe(false);
        if (s.uses?.startsWith('actions/setup-node@')) expect(s.with?.['package-manager-cache'], name).toBe(false);
      }
    }
  });

  it('runs the gate on the dev toolchain floor, the stage on the engines floor, promote on an npm with `stage` (D29-5)', () => {
    const floor = /^>=(\d+\.\d+\.\d+)$/.exec((readManifest() as { engines?: { node?: string } }).engines?.node ?? '');
    expect(nodeVersion(jobs.stage!)).toBe(floor?.[1]);
    expect(nodeVersion(jobs.gate!)).toBe('22.22.2');
    const [major, minor] = nodeVersion(jobs.promote!).split('.').map(Number);
    // npm >= 11.15.0 (staged publishing) is bundled from Node 24.18.0 on.
    expect(major! > 24 || (major === 24 && minor! >= 18)).toBe(true);
  });

  it('points to the publishing guide and its differences from WingFoil’s pipeline', () => {
    const header = text.split('\n').filter((line) => line.startsWith('#'));
    expect(header.join('\n')).toContain('docs/publishing.md');
    expect(header.join('\n')).toContain("Differences from WingFoil's pipeline");
  });
});
