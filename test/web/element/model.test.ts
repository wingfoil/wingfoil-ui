// task-018 — pure helpers of the element panel (web/src/element/model.ts).
import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@wingfoil-ui/contracts';
import {
  actorName,
  fieldEntries,
  historyLines,
  memberName,
  stateChips,
  summaryOf,
} from '../../../web/src/element/model.js';

describe('memberName', () => {
  it('keeps the name of "Name <email>" and "Name <email> (role)"', () => {
    expect(memberName('Jordan <jordan@example.test>')).toBe('Jordan');
    expect(memberName('Morgan <morgan@example.test> (approver)')).toBe('Morgan');
    expect(memberName('  Ana María  <a@b>')).toBe('Ana María');
  });
  it('returns a text without an email as written', () => {
    expect(memberName('workflow')).toBe('workflow');
  });
});

describe('stateChips', () => {
  const seq = ['s1', 's2', 's3'];
  it('marks the states before the current one past and after it future', () => {
    expect(stateChips(seq, 's2')).toEqual([
      { name: 's1', position: 'past' },
      { name: 's2', position: 'current' },
      { name: 's3', position: 'future' },
    ]);
  });
  it('shows the sequence unmarked and the current state after it when it is outside the sequence', () => {
    expect(stateChips(seq, 'x')).toEqual([
      { name: 's1', position: 'other' },
      { name: 's2', position: 'other' },
      { name: 's3', position: 'other' },
      { name: 'x', position: 'current' },
    ]);
  });
  it('shows only the current state without the type states', () => {
    expect(stateChips(undefined, 'x')).toEqual([{ name: 'x', position: 'current' }]);
  });
});

describe('summaryOf', () => {
  it('takes the first paragraph, skipping comments and headings', () => {
    const body = '\n<!-- scaffold\n comment -->\n\n## Context\n\nFirst line\nsecond line.\n\nNext paragraph.\n';
    expect(summaryOf(body)).toBe('First line second line.');
  });
  it('is undefined for a body of comments and headings only', () => {
    expect(summaryOf('<!-- a -->\n\n# Title\n\n## Decision\n\n<!-- b -->\n')).toBeUndefined();
    expect(summaryOf('')).toBeUndefined();
  });
  it('drops a comment inside a paragraph', () => {
    expect(summaryOf('Text <!-- hidden --> kept.')).toBe('Text kept.');
  });
});

describe('fieldEntries', () => {
  it('lists the fields beyond the four core ones with their values', () => {
    expect(
      fieldEntries({
        id: 'x',
        type: 't',
        title: 'T',
        status: 's',
        ref: 'US-1',
        depends_on: ['a', 'b'],
        empty: '',
        none: null,
        list: [],
        n: 3,
        flag: false,
        obj: { k: 1 },
      }),
    ).toEqual([
      { field: 'ref', values: ['US-1'] },
      { field: 'depends_on', values: ['a', 'b'] },
      { field: 'empty', values: [] },
      { field: 'none', values: [] },
      { field: 'list', values: [] },
      { field: 'n', values: ['3'] },
      { field: 'flag', values: ['false'] },
      { field: 'obj', values: ['{"k":1}'] },
    ]);
  });
});

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  sha: 'a'.repeat(40),
  author: 'Jordan <jordan@example.test>',
  timestamp: '2026-09-29T15:20:00+00:00',
  operation: 'add',
  from: null,
  to: 's1',
  approver: null,
  reason: null,
  subject: 'wf(t): add x',
  ...over,
});

describe('actorName and historyLines', () => {
  it('names the approver of a reject, else the author', () => {
    expect(actorName(entry({ operation: 'reject', approver: 'Morgan <m@x> (approver)' }))).toBe('Morgan');
    expect(actorName(entry({}))).toBe('Jordan');
  });
  it('lists the newest entry first with a short hash', () => {
    const lines = historyLines([entry({ sha: '1'.repeat(40) }), entry({ sha: '2'.repeat(40), operation: 'submit' })]);
    expect(lines.map((l) => l.shortSha)).toEqual(['2222222', '1111111']);
    expect(lines[0]).toMatchObject({ operation: 'submit', name: 'Jordan', sha: '2'.repeat(40) });
  });
  it('maps a commit that is not a WingFoil verb to the "edit" operation', () => {
    expect(historyLines([entry({ operation: null })])[0]?.operation).toBe('edit');
  });
});
