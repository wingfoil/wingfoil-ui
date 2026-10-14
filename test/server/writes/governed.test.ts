// task-032 — the pure parts of the governed writes: which CLI usage error is the reason's (D32-5)
// and which commit subject is the write's (D32-4, W-15); the push port's default (D32-7).
import { describe, expect, it } from 'vitest';
import { CliInternalError } from '../../../server/src/cli/adapter.js';
import { isWriteSubject, PUSH_OFF, reasonRefusal } from '../../../server/src/writes/governed.js';

const command = { words: ['memory', 'approve'], options: ['--reason'] };

describe('reasonRefusal (D32-5)', () => {
  it('the JSON message of a reason the CLI will not record', () => {
    const message = 'invalid flag value: --reason must not be blank';
    expect(reasonRefusal(new CliInternalError(command, JSON.stringify({ error: message })))).toBe(message);
  });

  it('the same message as plain text', () => {
    expect(reasonRefusal(new CliInternalError(command, 'invalid flag value: --reason x'))).toBe(
      'invalid flag value: --reason x',
    );
  });

  it.each([
    "error: unknown option '--bogus'",
    JSON.stringify({ error: 'missing required argument: --reason' }),
    JSON.stringify({ error: 'invalid flag value: --reasonable' }),
    JSON.stringify({ other: 'invalid flag value: --reason x' }),
    '',
  ])('any other usage error stays an adapter defect: %s', (detail) => {
    expect(reasonRefusal(new CliInternalError(command, detail))).toBeUndefined();
  });
});

describe('isWriteSubject (D32-4)', () => {
  it.each([
    ['wf(task): submit task-001-x', 'submit', true],
    ['wf(task): approve task-001-x [pending → approved]', 'approve', true],
    ['wf(task): reject task-001-x [pending → draft]', 'reject', true],
    ['wf(task): approve task-001-xy [pending → approved]', 'approve', false],
    ['wf(task): reject task-001-x [pending → draft]', 'approve', false],
    ['wf(bug): approve task-001-x [pending → approved]', 'approve', false],
    ['fix: approve task-001-x', 'approve', false],
    ['wf(task): task-001-x [backlog → in-progress]', 'submit', false],
  ] as const)('%s as %s → %s', (subject, verb, expected) => {
    expect(isWriteSubject(subject, 'task', verb, 'task-001-x')).toBe(expected);
  });
});

describe('PUSH_OFF (D32-7)', () => {
  it('answers off without doing anything', async () => {
    expect(await PUSH_OFF.push({ pid: 'p', snapshot: undefined as never })).toEqual({ status: 'off' });
  });
});
