// spec-004 §3, §5 (RP-11, RP-43; task-032 D32-6) — the governed-write bodies:
// `element.submit.request`, `element.decision.request` and `write.response`.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ElementDecisionRequest, ElementSubmitRequest, WriteResponse } from '../../contracts/src/writes.js';
import { REPO_ROOT } from '../harness/cli.js';

const compile = (file: string) =>
  new Ajv({ allErrors: true }).compile(
    JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api', file), 'utf8')) as object,
  );
const submit = compile('element.submit.request.schema.json');
const decision = compile('element.decision.request.schema.json');
const response = compile('write.response.schema.json');

const SHA = '4c8ead30f976eccb7b48c3ba75a33ded9fd55e34';

describe('element.submit.request.schema.json', () => {
  it('accepts the spec example', () => {
    const body: ElementSubmitRequest = { expectedStatus: 'draft' };
    expect(submit(body)).toBe(true);
  });

  it.each([
    ['no expectedStatus', {}],
    ['an empty expectedStatus', { expectedStatus: '' }],
    ['an expectedStatus over 200 characters', { expectedStatus: 'x'.repeat(201) }],
    ['a number', { expectedStatus: 1 }],
    ['an extra key', { expectedStatus: 'draft', reason: 'x' }],
    ['null', null],
    ['an array', ['draft']],
  ])('refuses %s', (_label, body) => {
    expect(submit(body)).toBe(false);
  });
});

describe('element.decision.request.schema.json', () => {
  it.each([
    ['a plain reason', 'Looks good'],
    ['a reason starting with a dash', '--version'],
    ['a multi-line reason with quotes', 'line one\n"two" \'three\' $(x) `y`'],
    ['a reason of 10 000 characters', 'r'.repeat(10_000)],
    ['a reason with surrounding whitespace', '  ok  '],
  ])('accepts %s', (_label, reason) => {
    const body: ElementDecisionRequest = { expectedStatus: 'pending', reason };
    expect(decision(body)).toBe(true);
  });

  it.each([
    ['no reason (G-07.2)', { expectedStatus: 'pending' }],
    ['an empty reason', { expectedStatus: 'pending', reason: '' }],
    ['a whitespace-only reason', { expectedStatus: 'pending', reason: ' \t\n ' }],
    ['a reason with a NUL', { expectedStatus: 'pending', reason: 'a\u0000b' }],
    ['a reason over 10 000 characters', { expectedStatus: 'pending', reason: 'r'.repeat(10_001) }],
    ['a reason as a number', { expectedStatus: 'pending', reason: 5 }],
    ['no expectedStatus', { reason: 'ok' }],
    ['an extra key', { expectedStatus: 'pending', reason: 'ok', role: 'approver' }],
  ])('refuses %s', (_label, body) => {
    expect(decision(body)).toBe(false);
  });
});

describe('write.response.schema.json', () => {
  const base: WriteResponse = {
    result: { id: 'task-001-x', path: 'docs/task-001-x.md', from: 'draft', to: 'pending' },
    commits: [{ sha: SHA, subject: 'wf(task): submit task-001-x' }],
    push: { status: 'off' },
  };

  it.each<[string, WriteResponse['push']]>([
    ['off', { status: 'off' }],
    ['pushed', { status: 'pushed' }],
    ['failed with git message', { status: 'failed', message: 'rejected' }],
    ['failed with a code', { status: 'failed', code: 'no-upstream' }],
    ['failed by timeout', { status: 'failed', code: 'push-timeout' }],
  ])('accepts push %s', (_label, push) => {
    expect(response({ ...base, push })).toBe(true);
  });

  it('accepts a SHA-256 commit and no commit', () => {
    expect(response({ ...base, commits: [{ sha: 'a'.repeat(64), subject: 's' }] })).toBe(true);
    expect(response({ ...base, commits: [] })).toBe(true);
  });

  it.each([
    ['an unknown push status', { ...base, push: { status: 'maybe' } }],
    ['the v0.1 pushed boolean', { ...base, pushed: true }],
    ['a code on off', { ...base, push: { status: 'off', code: 'x' } }],
    ['a message on pushed', { ...base, push: { status: 'pushed', message: 'x' } }],
    ['a short sha', { ...base, commits: [{ sha: 'abc', subject: 's' }] }],
    ['a commit without subject', { ...base, commits: [{ sha: SHA }] }],
    ['no push', { result: base.result, commits: base.commits }],
  ])('refuses %s', (_label, body) => {
    expect(response(body)).toBe(false);
  });
});

describe('write.refusal.schema.json (W2-1)', () => {
  const refusal = compile('write.refusal.schema.json');
  const envelope = (code: WriteRefusalCode, detail?: object) => ({
    error: { code, message: 'm', ...(detail ? { detail } : {}) },
  });

  it.each<WriteRefusalCode>([
    'not-found',
    'invalid-request',
    'not-in-team',
    'unsupported-version',
    'local-changes',
    'element-changed',
    'cli-refused',
    'cli-output',
    'cli-timeout',
    'internal',
  ])('accepts %s without detail', (code) => {
    expect(refusal(envelope(code))).toBe(true);
    expect(refusal(envelope(code, { file: 'x' }))).toBe(false);
  });

  it('write-incomplete and read-error need their detail; cli-not-found its path and command', () => {
    expect(refusal(envelope('write-incomplete', { file: 'docs/task-001-x.md' }))).toBe(true);
    expect(refusal(envelope('write-incomplete'))).toBe(false);
    expect(refusal(envelope('write-incomplete', { file: 'x', message: 'Command failed: …' }))).toBe(false);
    expect(refusal(envelope('read-error', { file: 'x.md', kind: 'shape' }))).toBe(true);
    expect(refusal(envelope('read-error', { file: 'x.md', kind: 'other' }))).toBe(false);
    expect(refusal(envelope('cli-not-found', { path: 'p', command: 'npm i' }))).toBe(true);
  });

  it('refuses an unknown code', () => {
    expect(refusal({ error: { code: 'stale-copy', message: 'm' } })).toBe(false);
  });
});
