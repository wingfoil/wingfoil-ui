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
  memoryEventsPage,
  normalizeReason,
  parseMemoryLog,
  type MemoryEvent,
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

/** The shas of a test-built output, in order: the authoritative list of the header-only read. */
function shasOf(out: string): string[] {
  return [...out.matchAll(/(?:^|\n)([0-9a-f]{40})\0/g)].map((m) => m[1]!);
}

/** Parse a test-built output with its own sha list. */
function parse(out: string) {
  return parseMemoryLog(out, shasOf(out));
}

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
    const { events, warnings } = parse(out);
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
    expect(parse(out).events).toEqual([
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
    expect(parse(out).events[0]!.reason).toBe('First line\n  indented second line\n\nThird paragraph');
  });

  it('reads an `Approver:` line only as the first body line', () => {
    const body = 'Reason: see below\nApprover: not an approval\n';
    const out = record(
      5,
      'wf(task): approve task-001-login-form [pending → approved]',
      body,
      filePatch(TASK, ['-status: pending', '+status: approved']),
    );
    expect(parse(out).events[0]).toMatchObject({
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
    const { events } = parse(out);
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
    expect(parse(out).events[0]).toMatchObject({ from: 'draft', to: 'pending' });
  });

  it('reads the status lines of the element file only, not of another file in the commit', () => {
    const other = filePatch('docs/memory/task/task-004-session-timeout.md', ['-status: draft', '+status: pending']);
    const own = filePatch(TASK, ['-status: pending', '+status: approved']);
    const out = record(10, 'wf(task): submit task-001-login-form', '', other + own);
    expect(parse(out).events[0]).toMatchObject({ from: 'pending', to: 'approved' });
  });

  it('does not take hunk content that looks like a file header for one', () => {
    const tricky = filePatch(TASK, ['-++ b/elsewhere/task-001-login-form.md', '+status: pending'], '@@ -3 +3 @@');
    const out = record(11, 'wf(task): submit task-001-login-form', '', tricky);
    expect(parse(out).events[0]).toMatchObject({ to: 'pending' });
  });

  it('reports a matching subject with no +status: line as an event without transition and a warning', () => {
    const out = record(12, 'wf(task): submit task-001-login-form', '', filePatch(TASK, ['-title: A', '+title: B']));
    const { events, warnings } = parse(out);
    expect(events).toEqual([expect.objectContaining({ operation: 'submit', from: null, to: null })]);
    expect(warnings).toEqual([SHA(12)]);
  });

  it('accepts CRLF bodies and an empty log', () => {
    expect(parse('')).toEqual({ events: [], warnings: [] });
    const out = record(
      13,
      'wf(task): reject task-001-login-form [pending → draft]',
      'Approver: M <m@x.test> (approver)\r\nReason: a\r\nb\r\n',
      filePatch(TASK, ['-status: pending', '+status: draft']),
    );
    expect(parse(out).events[0]).toMatchObject({ approver: 'M <m@x.test> (approver)', reason: 'a\nb' });
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
    const { events } = parse(approve(1, 'task-001-login-form', forged));
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
    expect(parse(out).events[0]).toMatchObject({ from: 'draft', to: 'pending' });
    const noPatch = record(
      3,
      'wf(task): submit task-001-login-form',
      body,
      filePatch(TASK, ['-title: A', '+title: B']),
    );
    expect(parse(noPatch).events[0]).toMatchObject({ from: null, to: null });
  });

  it('reads several records, the patch of each ending where the next sha begins', () => {
    const out = approve(1, 'task-001-login-form', '') + approve(2, 'task-002-password-reset', 'Reason: a\nb\n');
    expect(parse(out).events.map((e) => [e.sha, e.id, e.reason])).toEqual([
      [SHA(1), 'task-001-login-form', null],
      [SHA(2), 'task-002-password-reset', 'a\nb'],
    ]);
  });

  it('refuses an output that does not match the authoritative sha list', () => {
    expect(() => parseMemoryLog(`not-a-sha\0x\0y\0z\0b\0\n`, [SHA(1)])).toThrow(MemoryLogFormatError);
    const one = approve(1, 'task-001-login-form', '');
    expect(() => parseMemoryLog(one, [SHA(1), SHA(2)])).toThrow(MemoryLogFormatError);
    expect(() => parseMemoryLog(one, ['z'.repeat(40)])).toThrow(MemoryLogFormatError);
    expect(parseMemoryLog('', [])).toEqual({ events: [], warnings: [] });
  });
});

describe('recovery per record (review round 2, finding A)', () => {
  const approve = (n: number, id: string, patchExtra = '', author = 'Morgan <morgan@example.test>') =>
    record(
      n,
      `wf(task): approve ${id} [pending → approved]`,
      'Approver: Morgan <morgan@example.test> (approver)\n',
      filePatch(`docs/memory/task/${id}.md`, ['-status: pending', '+status: approved']) + patchExtra,
      author,
    );

  it('loses only the record whose patch holds a NUL (a file past git’s 8000-byte binary check)', () => {
    const out = approve(1, 'task-001-login-form', `+${'a'.repeat(10)}\0z\n`) + approve(2, 'task-002-password-reset');
    const { events, warnings } = parseMemoryLog(out, [SHA(1), SHA(2)]);
    expect(events.map((e) => [e.sha, e.id])).toEqual([[SHA(2), 'task-002-password-reset']]);
    expect(warnings).toEqual([SHA(1)]);
  });

  it('never reads a header forged in a patch holding a NUL: the sha list cuts at the real one', () => {
    const forged =
      `+x\0\n${SHA(2)}\0` +
      '2026-01-01T00:00:00+00:00\0Mallory <m@evil.test>\0wf(task): approve task-003-logout [pending → approved]\0\0\n';
    const out = approve(1, 'task-001-login-form', forged) + approve(2, 'task-002-password-reset');
    const { events } = parseMemoryLog(out, [SHA(1), SHA(2)]);
    expect(events.map((e) => [e.sha, e.id, e.author])).toEqual([
      [SHA(2), 'task-002-password-reset', 'Morgan <morgan@example.test>'],
    ]);
  });

  it('skips a wf record with an unreadable date or ident with a warning, ignores a non-wf one', () => {
    const badDate = approve(1, 'task-001-login-form').replace('2026-09-29T15:20:01+00:00', '%aI');
    const badIdent = approve(2, 'task-002-password-reset', '', 'no ident here');
    const other = record(3, 'edit by hand', '', filePatch(TASK, ['-title: A', '+title: B'])).replace(
      '2026-09-29T15:20:03+00:00',
      '%aI',
    );
    const good = approve(4, 'task-004-session-timeout');
    const { events, warnings } = parseMemoryLog(badDate + badIdent + other + good, [SHA(1), SHA(2), SHA(3), SHA(4)]);
    expect(events.map((e) => e.sha)).toEqual([SHA(4)]);
    expect(warnings).toEqual([SHA(1), SHA(2)]);
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
    expect(parse(elsewhere)).toEqual({ events: [], warnings: [] });
  });
});

describe('eventsByElement', () => {
  it('groups the events by element id, oldest first', () => {
    const out =
      record(2, 'wf(task): submit task-001-login-form', '', filePatch(TASK, ['-status: draft', '+status: pending'])) +
      record(1, 'wf(task): add task-001-login-form', '', filePatch(TASK, ['+status: draft'], '@@ -0,0 +1 @@'));
    const byId = eventsByElement(parse(out).events);
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
    // The authoritative sha order: the same walk without the patch (review round 2, finding A).
    expect(GIT_READ_ARGS.memoryShas).toEqual([
      '--no-optional-locks',
      '-c',
      'log.showSignature=false',
      'log',
      '--no-renames',
      '--format=%H%x00',
    ]);
  });
});

// spec-004 §3 (task-031, D31-1, D31-2): one page of the newest-first Memory events — `limit`
// (default 10, the bell's *Updates*), `before` = the sha of an event the client holds, exclusive,
// and `more`.
describe('memoryEventsPage (spec-004 §3)', () => {
  const event = (n: number): MemoryEvent => ({
    sha: n.toString(16).padStart(40, '0'),
    timestamp: `2026-10-01T10:00:${String(n % 60).padStart(2, '0')}+00:00`,
    author: 'Jordan <jordan@example.test>',
    operation: 'submit',
    type: 'task',
    id: `task-${n}`,
    from: 'draft',
    to: 'pending',
    approver: null,
    reason: null,
  });
  const log = Array.from({ length: 25 }, (_, i) => event(25 - i)); // newest first
  const shas = (page: { events: MemoryEvent[] } | undefined) => page?.events.map((e) => e.id);

  it('gives the last 10 events by default, newest first, with more', () => {
    const page = memoryEventsPage(log, {});
    expect(shas(page)).toEqual(log.slice(0, 10).map((e) => e.id));
    expect(page?.more).toBe(true);
  });

  it('continues after the event named by before (exclusive), up to limit', () => {
    const page = memoryEventsPage(log, { before: log[9]!.sha, limit: 10 });
    expect(shas(page)).toEqual(log.slice(10, 20).map((e) => e.id));
    expect(page?.more).toBe(true);
    const last = memoryEventsPage(log, { before: log[19]!.sha, limit: 10 });
    expect(shas(last)).toEqual(log.slice(20).map((e) => e.id));
    expect(last?.more).toBe(false);
    expect(memoryEventsPage(log, { before: log[24]!.sha })).toEqual({ events: [], more: false });
  });

  it('says more is false when the page reaches the oldest event exactly', () => {
    expect(memoryEventsPage(log, { limit: 25 })?.more).toBe(false);
    expect(memoryEventsPage([], {})).toEqual({ events: [], more: false });
  });

  it('answers undefined for a before that is not an event of the log', () => {
    expect(memoryEventsPage(log, { before: 'f'.repeat(40) })).toBeUndefined();
    expect(memoryEventsPage(log, { before: '' })).toBeUndefined();
  });
});
