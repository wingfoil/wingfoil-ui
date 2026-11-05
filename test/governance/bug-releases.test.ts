// task-051 AC-2 (dl-009 action 7): a `closed` bug carries the release that fixed it in `release`.
// The triage of a bug fixed in a later release sets it, and the absorption into a task stamps it.
// A bug closed by a reject (wontfix, duplicate) was not fixed and is outside the rule: `memory
// reject` writes `rejection_reason` and only `memory submit` clears it, so a `closed` bug with a
// non-empty `rejection_reason` was closed by a reject (task-051 Q4, the approver, 2026-11-05).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';

const BUGS = path.join(REPO_ROOT, 'docs', '04_memory', 'bugs');

/** The frontmatter fields of a bug the rule reads; an empty value is `''`. */
export interface BugFields {
  id: string;
  status: string;
  release: string;
  releaseOrigin: string;
  rejectionReason: string;
}

/** Read the fields of the rule from a bug file's text. */
export function readBugFields(text: string): BugFields {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  const field = (name: string): string => {
    const m = new RegExp(`^${name}:[ \\t]*(?:"([^"]*)"|'([^']*)'|([^\\s#]*))`, 'm').exec(fm);
    return m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
  };
  return {
    id: field('id'),
    status: field('status'),
    release: field('release'),
    releaseOrigin: field('release-origin'),
    rejectionReason: field('rejection_reason'),
  };
}

/** What is wrong with a bug's `release`, or `undefined` when the rule holds. */
export function bugReleaseFinding(b: BugFields): string | undefined {
  if (b.status !== 'closed' || b.release !== '' || b.rejectionReason !== '') return undefined;
  return `${b.id}: closed with an empty release (release-origin ${b.releaseOrigin || '(none)'})`;
}

const bug = (fields: Record<string, string>): string =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: "${v}"   # a comment`)
    .join('\n')}\n---\n\n## Description\n`;

describe('readBugFields and bugReleaseFinding', () => {
  it('names a closed bug with an empty release, with its release-origin', () => {
    const b = readBugFields(bug({ id: 'bug-001-x', status: 'closed', 'release-origin': 'v0.1', release: '' }));
    expect(bugReleaseFinding(b)).toBe('bug-001-x: closed with an empty release (release-origin v0.1)');
  });

  it('accepts a closed bug that carries its release', () => {
    expect(bugReleaseFinding(readBugFields(bug({ id: 'b', status: 'closed', release: 'v0.2' })))).toBeUndefined();
  });

  it('leaves out a bug closed by a reject (a non-empty rejection_reason)', () => {
    const b = readBugFields(bug({ id: 'b', status: 'closed', release: '', rejection_reason: 'duplicate of bug-002' }));
    expect(b.rejectionReason).toBe('duplicate of bug-002');
    expect(bugReleaseFinding(b)).toBeUndefined();
  });

  it('fails a bug whose frontmatter does not parse (no id or status read)', () => {
    expect(bugReleaseFinding(readBugFields('id: bug-009-x\r\nstatus: closed\r\n'), 'bug-009-x.md')).toBe(
      'bug-009-x.md: no id or status read from its frontmatter',
    );
    const crlf = bug({ id: 'bug-010-y', status: 'closed', release: '' }).replace(/\n/g, '\r\n');
    expect(bugReleaseFinding(readBugFields(crlf), 'bug-010-y.md')).toBe(
      'bug-010-y.md: no id or status read from its frontmatter',
    );
  });

  it('leaves out a bug that is not closed', () => {
    expect(bugReleaseFinding(readBugFields(bug({ id: 'b', status: 'triaged', release: '' })))).toBeUndefined();
  });
});

describe('the bugs of docs/04_memory/bugs/', () => {
  const files = readdirSync(BUGS)
    .filter((f) => f.startsWith('bug-') && f.endsWith('.md'))
    .sort();

  it('finds the bugs', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every closed bug carries its release, unless a reject closed it', () => {
    const findings = files
      .map((f) => bugReleaseFinding(readBugFields(readFileSync(path.join(BUGS, f), 'utf8')), f))
      .filter((x): x is string => x !== undefined);
    expect(findings).toEqual([]);
  });
});
