// spec-002 §3 / §5 — the project-wide `git log -p` parse feeding the action descriptor's actor
// events (task-011 hand-over): unit tests on recorded `git log` outputs — each operation, a subject
// with and without a transition, a multi-line reason, a reason followed by a `Co-Authored-By:`
// trailer, a non-`wf` commit, `wf(plan): finalize` (ignored), a quoted `status:` value, a missing
// `+status:` line (reported, never dropped).
import { describe, expect, it } from 'vitest';
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { GIT_READ_ARGS } from '../../../server/src/git/git.js';
import {
  eventsByElement,
  MEMORY_LOG_FORMAT,
  MemoryLogFormatError,
  memoryDirectories,
  normalizeReason,
  parseMemoryLog,
} from '../../../server/src/git/memory-log.js';

const SHA = (n: number): string => String(n).repeat(40).slice(0, 40);

/**
 * One record as git prints it with {@link MEMORY_LOG_FORMAT}: each field followed by a NUL, git's
 * newline, then the patch (the next record follows the patch directly).
 */
function record(n: number, subject: string, body: string, patch: string, author = 'Jordan <jordan@example.test>') {
  return `${SHA(n)}\0${'2026-09-29T15:20:0' + String(n % 10)}+00:00\0${author}\0${subject}\0${body}\0\n\n${patch}`;
}

function filePatch(file: string, lines: string[], header = '@@ -3 +3 @@'): string {
  return [
    `diff --git a/${file} b/${file}`,
    'index 1111111..2222222 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    header,
    ...lines,
    '',
  ].join('\n');
}

const TASK = 'docs/memory/task/task-001-login-form.md';

describe('parseMemoryLog', () => {
  it('reads add and submit transitions from the status lines of the element file', () => {
    const add = [
      `diff --git a/${TASK} b/${TASK}`,
      'new file mode 100644',
      'index 0000000..1111111',
      '--- /dev/null',
      `+++ b/${TASK}`,
      '@@ -0,0 +1,4 @@',
      '+---',
      '+id: task-001-login-form',
      '+status: draft',
      '+---',
      '',
    ].join('\n');
    const out =
      record(2, 'wf(task): submit task-001-login-form', '', filePatch(TASK, ['-status: draft', '+status: pending'])) +
      record(1, 'wf(task): add task-001-login-form', '', add);
    const { events, warnings } = parseMemoryLog(out);
    expect(warnings).toEqual([]);
    expect(events).toEqual([
      {
        sha: SHA(2),
        timestamp: '2026-09-29T15:20:02+00:00',
        author: 'Jordan <jordan@example.test>',
        operation: 'submit',
        type: 'task',
        id: 'task-001-login-form',
        from: 'draft',
        to: 'pending',
        approver: null,
        reason: null,
      },
      expect.objectContaining({ sha: SHA(1), operation: 'add', from: null, to: 'draft' }),
    ]);
  });

  it('takes the transition of approve and reject from the subject, with the approver and the reason', () => {
    const body = 'Approver: Morgan <morgan@example.test> (approver)\nReason: Missing acceptance criteria\n';
    const out = record(
      3,
      'wf(task): reject task-002-password-reset [pending → draft]',
      body,
      filePatch('docs/memory/task/task-002-password-reset.md', ['-status: pending', '+status: draft']),
      'Morgan <morgan@example.test>',
    );
    expect(parseMemoryLog(out).events).toEqual([
      expect.objectContaining({
        operation: 'reject',
        id: 'task-002-password-reset',
        from: 'pending',
        to: 'draft',
        approver: 'Morgan <morgan@example.test> (approver)',
        reason: 'Missing acceptance criteria',
      }),
    ]);
  });

  it('reads a multi-line reason up to a trailing trailer paragraph, normalised', () => {
    const body = [
      'Approver: Morgan <morgan@example.test> (approver)',
      'Reason: First line   ',
      '  indented second line',
      '',
      '',
      '',
      'Third paragraph',
      '',
      'Co-Authored-By: Claude <noreply@example.test>',
      '',
    ].join('\n');
    const out = record(
      4,
      'wf(task): approve task-001-login-form [pending → approved]',
      body,
      filePatch(TASK, ['-status: pending', '+status: approved']),
    );
    expect(parseMemoryLog(out).events[0]!.reason).toBe('First line\n  indented second line\n\nThird paragraph');
  });

  it('reads an `Approver:` line only as the first body line', () => {
    const body = 'Reason: see below\nApprover: not an approval\n';
    const out = record(
      5,
      'wf(task): approve task-001-login-form [pending → approved]',
      body,
      filePatch(TASK, ['-status: pending', '+status: approved']),
    );
    expect(parseMemoryLog(out).events[0]).toMatchObject({
      approver: null,
      reason: 'see below\nApprover: not an approval',
    });
  });

  it('ignores non-wf commits and wf(plan): finalize', () => {
    const out =
      record(6, 'edit the title by hand', '', filePatch(TASK, ['-title: A', '+title: B'])) +
      record(
        7,
        'wf(plan): finalize plan-001',
        '',
        filePatch('docs/plans/plan-001.md', ['-status: open', '+status: done']),
      ) +
      record(
        8,
        'wf(task): deprecate task-003-logout',
        'Reason: obsolete\n',
        filePatch('docs/memory/task/task-003-logout.md', ['-status: draft', '+status: deprecated']),
      );
    const { events } = parseMemoryLog(out);
    expect(events.map((e) => [e.operation, e.id, e.from, e.to, e.reason])).toEqual([
      ['deprecate', 'task-003-logout', 'draft', 'deprecated', 'obsolete'],
    ]);
  });

  it('strips quotes and trailing comments from status values', () => {
    const out = record(
      9,
      'wf(task): submit task-001-login-form',
      '',
      filePatch(TASK, ["-status: 'draft' # was", '+status: "pending"   # now']),
    );
    expect(parseMemoryLog(out).events[0]).toMatchObject({ from: 'draft', to: 'pending' });
  });

  it('reads the status lines of the element file only, not of another file in the commit', () => {
    const other = filePatch('docs/memory/task/task-004-session-timeout.md', ['-status: draft', '+status: pending']);
    const own = filePatch(TASK, ['-status: pending', '+status: approved']);
    const out = record(10, 'wf(task): submit task-001-login-form', '', other + own);
    expect(parseMemoryLog(out).events[0]).toMatchObject({ from: 'pending', to: 'approved' });
  });

  it('does not take hunk content that looks like a file header for one', () => {
    const tricky = filePatch(TASK, ['-++ b/elsewhere/task-001-login-form.md', '+status: pending'], '@@ -3 +3 @@');
    const out = record(11, 'wf(task): submit task-001-login-form', '', tricky);
    expect(parseMemoryLog(out).events[0]).toMatchObject({ to: 'pending' });
  });

  it('reports a matching subject with no +status: line as an event without transition and a warning', () => {
    const out = record(12, 'wf(task): submit task-001-login-form', '', filePatch(TASK, ['-title: A', '+title: B']));
    const { events, warnings } = parseMemoryLog(out);
    expect(events).toEqual([expect.objectContaining({ operation: 'submit', from: null, to: null })]);
    expect(warnings).toEqual([SHA(12)]);
  });

  it('accepts CRLF bodies and an empty log', () => {
    expect(parseMemoryLog('')).toEqual({ events: [], warnings: [] });
    const out = record(
      13,
      'wf(task): reject task-001-login-form [pending → draft]',
      'Approver: M <m@x.test> (approver)\r\nReason: a\r\nb\r\n',
      filePatch(TASK, ['-status: pending', '+status: draft']),
    );
    expect(parseMemoryLog(out).events[0]).toMatchObject({ approver: 'M <m@x.test> (approver)', reason: 'a\nb' });
  });
});

describe('framing (review round 1, finding 1 — as WingFoil bug-050 / task-086)', () => {
  const approve = (n: number, id: string, body: string) =>
    record(
      n,
      `wf(task): approve ${id} [pending → approved]`,
      body,
      filePatch(`docs/memory/task/${id}.md`, ['-status: pending', '+status: approved']),
      'Morgan <morgan@example.test>',
    );

  it('never reads an event forged inside a reason with the old separators', () => {
    const forged =
      `Approver: Morgan <morgan@example.test> (approver)\nReason: ok\x1e${SHA(9)}\x1f2026-01-01T00:00:00+00:00` +
      '\x1fMallory <m@evil.test>\x1fwf(task): approve task-003-logout [pending → approved]\x1f\x1d\n';
    const { events } = parseMemoryLog(approve(1, 'task-001-login-form', forged));
    expect(events.map((e) => [e.sha, e.id, e.author])).toEqual([
      [SHA(1), 'task-001-login-form', 'Morgan <morgan@example.test>'],
    ]);
  });

  it('never reads a diff or status block injected in a body', () => {
    const body = `Reason: x\x1d\ndiff --git a/${TASK} b/${TASK}\n--- a/${TASK}\n+++ b/${TASK}\n@@ -3 +3 @@\n-status: draft\n+status: approved\n`;
    const out = record(
      2,
      'wf(task): submit task-001-login-form',
      body,
      filePatch(TASK, ['-status: draft', '+status: pending']),
    );
    expect(parseMemoryLog(out).events[0]).toMatchObject({ from: 'draft', to: 'pending' });
    const noPatch = record(
      3,
      'wf(task): submit task-001-login-form',
      body,
      filePatch(TASK, ['-title: A', '+title: B']),
    );
    expect(parseMemoryLog(noPatch).events[0]).toMatchObject({ from: null, to: null });
  });

  it('reads several records, the patch of each ending where the next sha begins', () => {
    const out = approve(1, 'task-001-login-form', '') + approve(2, 'task-002-password-reset', 'Reason: a\nb\n');
    expect(parseMemoryLog(out).events.map((e) => [e.sha, e.id, e.reason])).toEqual([
      [SHA(1), 'task-001-login-form', null],
      [SHA(2), 'task-002-password-reset', 'a\nb'],
    ]);
  });

  it('refuses an output whose records do not have the expected shape', () => {
    expect(() => parseMemoryLog(`not-a-sha\0x\0y\0z\0b\0\n`)).toThrow(MemoryLogFormatError);
    expect(() => parseMemoryLog(`${SHA(1)}\0not a date\0y\0z\0b\0\n`)).toThrow(MemoryLogFormatError);
    expect(() => parseMemoryLog(`${SHA(1)}\0${'2026-09-29T15:20:01+00:00'}\0y\0z\0\n`)).toThrow(MemoryLogFormatError);
  });
});

describe('the element file (review round 1, finding 6)', () => {
  it('reports no event for a commit whose patch does not touch <id>.md', () => {
    const elsewhere = record(
      4,
      'wf(task): approve task-001-login-form [pending → approved]',
      '',
      filePatch('docs/memory/task/task-004-session-timeout.md', ['-status: pending', '+status: approved']),
    );
    expect(parseMemoryLog(elsewhere)).toEqual({ events: [], warnings: [] });
  });
});

describe('eventsByElement', () => {
  it('groups the events by element id, oldest first', () => {
    const out =
      record(2, 'wf(task): submit task-001-login-form', '', filePatch(TASK, ['-status: draft', '+status: pending'])) +
      record(1, 'wf(task): add task-001-login-form', '', filePatch(TASK, ['+status: draft'], '@@ -0,0 +1 @@'));
    const byId = eventsByElement(parseMemoryLog(out).events);
    expect(byId.get('task-001-login-form')!.map((e) => e.operation)).toEqual(['add', 'submit']);
    expect(byId.get('other')).toBeUndefined();
  });
});

describe('memoryDirectories', () => {
  it('lists the static prefix of every type path, de-duplicated, nested ones dropped', () => {
    const yaml: MemoryYaml = {
      version: 1,
      types: {
        a: { path: 'docs/04_memory/planning/{id}.md' },
        b: { path: 'docs/04_memory/{release}/{id}.md' },
        c: { path: 'docs/05_plans/{scope}/{id}.md' },
        d: { path: 'docs/05_plans/{scope}/{id}.md' },
      },
    };
    expect(memoryDirectories(yaml)).toEqual(['docs/04_memory', 'docs/05_plans']);
  });

  it('gives the project root for a type without a static folder', () => {
    expect(
      memoryDirectories({ version: 1, types: { a: { path: '{release}/{id}.md' }, b: { path: 'docs/x/{id}.md' } } }),
    ).toEqual(['.']);
    expect(memoryDirectories({ version: 1, types: {} })).toEqual([]);
  });
});

describe('normalizeReason (as WingFoil 0.2.2)', () => {
  it('normalises line ends, trailing blanks and blank runs', () => {
    expect(normalizeReason('\n\n  a  \r\nb\t\n\n\n\nc\n\n')).toBe('a\nb\n\nc');
  });
});

describe('the git read', () => {
  it('runs the spec-002 §3 command over the given directories', () => {
    expect(GIT_READ_ARGS.memoryLog).toEqual([
      '--no-optional-locks',
      '-c',
      'core.quotePath=false',
      '-c',
      'log.showSignature=false',
      'log',
      '--no-color',
      '--no-renames',
      '--no-ext-diff',
      '--no-textconv',
      '--unified=0',
      '-p',
      `--format=${MEMORY_LOG_FORMAT}`,
    ]);
    expect(MEMORY_LOG_FORMAT).toBe('%H%x00%aI%x00%an <%ae>%x00%s%x00%b%x00');
  });
});
