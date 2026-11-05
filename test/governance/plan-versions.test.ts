// task-051 AC-1 (dl-011, dl-006 action 6, dl-009 action 11): a plan's frontmatter `version` equals
// the first token of its Context `**Version:**` line. Both present → equal; exactly one present →
// a failure; neither present → the plan carries no version and is versioned by git alone
// (directive `doc-versioning`), which is how a plan made by `workflow start` is left by its
// template. Every `.md` file under `docs/05_plans/` must be a plan. The only exemptions are the
// commented entries of `EXEMPT` — closed plans of this repository's history — and each entry must
// still match the file, so the list cannot rot.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

const PLANS = path.join(REPO_ROOT, 'docs', '05_plans');

/** The versions one plan file carries; `undefined` where it carries none. */
export interface PlanVersions {
  /** The frontmatter `type`. */
  type: string | undefined;
  /** The frontmatter `version` (an empty string counts as none). */
  frontmatter: string | undefined;
  /** The first token of the first `**Version:**` line of the `## Context` section. */
  context: string | undefined;
}

/** One exemption: a closed plan whose versions differ for reasons of this repository's history. */
export interface PlanExemption {
  /** The plan, relative to `docs/05_plans/`. */
  file: string;
  frontmatter: string | undefined;
  context: string | undefined;
}

/** Read the frontmatter `type`, `version` and the Context `**Version:**` of a plan file's text. */
export function readPlanVersions(text: string): PlanVersions {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const field = (name: string): string | undefined => {
    const m = new RegExp(`^${name}:[ \\t]*(?:"([^"]*)"|'([^']*)'|([^\\s#]*))`, 'm').exec(fm?.[1] ?? '');
    const value = m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
    return value === '' ? undefined : value;
  };
  const body = fm ? text.slice(fm[0].length) : text;
  const context = /^## Context[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)?.[1] ?? '';
  const version = /^\*\*Version:\*\*[ \t]*([^\s·]+)/m.exec(context)?.[1];
  return { type: field('type'), frontmatter: field('version'), context: version };
}

/** What is wrong with a plan's versions, or `undefined` when they agree (or neither is present). */
export function planVersionFinding(file: string, v: PlanVersions): string | undefined {
  if (v.type !== 'plan') return `${file}: not a plan (type ${String(v.type)}) under docs/05_plans/`;
  if (v.frontmatter === undefined && v.context === undefined) return undefined;
  if (v.frontmatter === v.context) return undefined;
  return `${file}: frontmatter version ${v.frontmatter ?? '(none)'} ≠ Context Version ${v.context ?? '(none)'}`;
}

/**
 * Closed plans exempted from the rule (the approver, 2026-11-05, task-051 Q2): `done` plans of the
 * v0.1 era, closed before dl-006 action 6 applied (from `minor-v0.2` on), whose Context has no
 * `**Version:**` line — adding one would write a version history that never existed. Each entry
 * records the values the file must still have; the plans whose Context line exists were aligned by
 * the approver's `memory amend` instead.
 */
export const EXEMPT: readonly PlanExemption[] = [
  // The rl-v1 initial design (v0.1 era, `done`): frontmatter 1.0, no Context version line.
  { file: 'rl-v1/initial-design-rl-v1-plan.md', frontmatter: '1.0', context: undefined },
  // The release planning of v0.1 (`done`): frontmatter 1.0, no Context version line.
  { file: 'rl-v1/rel-v0.1/release-planning-rel-v0.1-plan.md', frontmatter: '1.0', context: undefined },
  // The lean inception, before the first release line (`done`): frontmatter 1.0, no Context version line.
  { file: 'sw-life-cycle/lean-inception-inception-plan.md', frontmatter: '1.0', context: undefined },
  // The specification downcast, before the first release line (`done`): frontmatter 1.0, no Context version line.
  { file: 'sw-life-cycle/specification-downcast-specification-plan.md', frontmatter: '1.0', context: undefined },
];

/** Every `.md` file under `dir`, relative to it, sorted. */
function markdownFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? markdownFiles(path.join(dir, e.name), `${prefix}${e.name}/`)
        : e.name.endsWith('.md')
          ? [`${prefix}${e.name}`]
          : [],
    )
    .sort();
}

const plan = (body: string, version = '0.2', type = 'plan'): string =>
  `---\nid: x-plan\ntype: ${type}\nstatus: done\nversion: "${version}"         # optional — plan version\n---\n\n${body}`;

describe('readPlanVersions and planVersionFinding', () => {
  it('accepts equal versions and reads only the first token of the Context line', () => {
    const v = readPlanVersions(plan('## Context\n\n**Version:** 0.2 · **Date:** 2026-11-04 (0.1: x; 0.2: y)\n'));
    expect(v).toEqual({ type: 'plan', frontmatter: '0.2', context: '0.2' });
    expect(planVersionFinding('a.md', v)).toBeUndefined();
  });

  it('names the file and both values when they differ', () => {
    const v = readPlanVersions(plan('## Context\n\n**Version:** 0.3 · **Date:** 2026-11-04\n'));
    expect(planVersionFinding('a.md', v)).toBe('a.md: frontmatter version 0.2 ≠ Context Version 0.3');
  });

  it('fails when only one of them is present', () => {
    expect(planVersionFinding('a.md', readPlanVersions(plan('## Context\n\nNo version line.\n')))).toBe(
      'a.md: frontmatter version 0.2 ≠ Context Version (none)',
    );
    expect(planVersionFinding('b.md', readPlanVersions(plan('## Context\n\n**Version:** 0.1\n', '')))).toBe(
      'b.md: frontmatter version (none) ≠ Context Version 0.1',
    );
  });

  it('accepts a plan with neither — a `workflow start` plan left as its template made it', () => {
    const v = readPlanVersions(plan('## Context\n\n<!-- Why this phase runs now -->\n\n## Phases / Steps\n', ''));
    expect(v).toEqual({ type: 'plan', frontmatter: undefined, context: undefined });
    expect(planVersionFinding('a.md', v)).toBeUndefined();
  });

  it('ignores a `**Version:**` line outside the Context section', () => {
    const v = readPlanVersions(plan('## Context\n\nText.\n\n## Session log\n\n**Version:** 0.2\n', ''));
    expect(v.context).toBeUndefined();
  });

  it('fails on a file that is not a plan', () => {
    expect(planVersionFinding('notes.md', readPlanVersions(plan('', '', 'task')))).toBe(
      'notes.md: not a plan (type task) under docs/05_plans/',
    );
  });
});

describe('the plans of docs/05_plans/', () => {
  const files = markdownFiles(PLANS);
  const exempt = new Map(EXEMPT.map((e) => [e.file, e]));

  it('finds the plans', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every plan carries equal versions, or none (exemptions aside)', () => {
    const findings = files
      .filter((f) => !exempt.has(f))
      .map((f) => planVersionFinding(f, readPlanVersions(readFileSync(path.join(PLANS, f), 'utf8'))))
      .filter((x): x is string => x !== undefined);
    expect(findings).toEqual([]);
  });

  it('every exemption names an existing plan that still has the recorded versions', () => {
    const stale = EXEMPT.filter((e) => {
      if (!files.includes(e.file)) return true;
      const v = readPlanVersions(readFileSync(path.join(PLANS, e.file), 'utf8'));
      return v.type !== 'plan' || v.frontmatter !== e.frontmatter || v.context !== e.context;
    }).map((e) => e.file);
    expect(stale).toEqual([]);
  });
});
