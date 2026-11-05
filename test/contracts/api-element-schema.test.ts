// spec-011 §5 (task-057) — `shortId` in the element read, the `/elements` rows and the Today rows
// (`element.schema.json`, `elements.schema.json`, `today.schema.json`), and the element read's 404
// and 409 bodies (`element.refusal.schema.json`). The routes' real answers are validated against
// the same schemas in `test/server/http/project-routes.test.ts` and `today-routes.test.ts`.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AmbiguousCandidate, ElementRefusalBody } from '../../contracts/src/api.js';
import { REPO_ROOT } from '../harness/cli.js';

const CONTRACTS = path.join(REPO_ROOT, 'contracts');
const ajv = new Ajv({ allErrors: true });
// Every schema the API schemas refer to, by $id (`../files/…`, `../cli/…`).
for (const dir of ['api', 'cli', 'files']) {
  for (const file of readdirSync(path.join(CONTRACTS, dir))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(CONTRACTS, dir, file), 'utf8')) as object);
  }
}
ajv.addSchema(JSON.parse(readFileSync(path.join(CONTRACTS, 'capabilities.schema.json'), 'utf8')) as object);
const schema = (ref: string) => ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${ref}`)!;
const validRefusal = schema('element.refusal.schema.json');
const validDetail = schema('element.schema.json');
const validList = schema('elements.schema.json');
const validTodayElement = schema('today.schema.json#/definitions/element');

const MATCH = {
  path: 'docs/memory/task/task-046-read-wingfoil.md',
  id: 'task-046-read-wingfoil',
  title: 'Read WingFoil',
  type: 'task',
  status: 'draft',
  tags: [],
  localChanges: false,
};

const FRONTMATTER = { id: MATCH.id, type: MATCH.type, title: MATCH.title, status: MATCH.status };

const candidate = (n: number): AmbiguousCandidate => ({
  id: `task-046-candidate-${String(n).padStart(2, '0')}`,
  shortId: 'task-046',
  title: `Candidate ${n}`,
  type: 'task',
  status: 'draft',
});
const ambiguous = (count: number, more = 0): ElementRefusalBody => ({
  error: {
    code: 'ambiguous-id',
    message: 'Ambiguous id',
    detail: { candidates: Array.from({ length: count }, (_, i) => candidate(i)), more },
  },
});

describe('shortId in element.schema.json, elements.schema.json and today.schema.json', () => {
  it('is optional, and a non-empty string when present', () => {
    for (const element of [MATCH, { ...MATCH, shortId: 'task-046' }]) {
      expect(validDetail({ element, frontmatter: FRONTMATTER, body: '' }), JSON.stringify(validDetail.errors)).toBe(
        true,
      );
      expect(validList({ elements: [element], warnings: [] }), JSON.stringify(validList.errors)).toBe(true);
    }
    const { path: _path, tags: _tags, ...todayElement } = MATCH;
    expect(validTodayElement(todayElement)).toBe(true);
    expect(validTodayElement({ ...todayElement, shortId: 'task-046' })).toBe(true);
    expect(validDetail({ element: { ...MATCH, shortId: '' }, frontmatter: FRONTMATTER, body: '' })).toBe(false);
    expect(validList({ elements: [{ ...MATCH, shortId: 46 }], warnings: [] })).toBe(false);
    expect(validTodayElement({ ...todayElement, shortId: '' })).toBe(false);
  });
});

describe('element.refusal.schema.json', () => {
  it.each([
    ['not-found', { error: { code: 'not-found', message: 'Not found' } }],
    ['ambiguous-id with 2 candidates', ambiguous(2)],
    ['ambiguous-id with 20 candidates and more', ambiguous(20, 5)],
  ] as const)('accepts %s', (_name, body) => {
    expect(validRefusal(body), JSON.stringify(validRefusal.errors)).toBe(true);
  });

  const noMore = JSON.parse(JSON.stringify(ambiguous(2))) as { error: { detail: { more?: number } } };
  delete noMore.error.detail.more;
  it.each([
    ['a 404 with a detail', { error: { code: 'not-found', message: 'Not found', detail: {} } }],
    ['another code', { error: { code: 'invalid-request', message: 'Invalid request' } }],
    ['21 candidates', ambiguous(21)],
    ['one candidate', ambiguous(1)],
    ['no more', noMore],
    ['a negative more', ambiguous(2, -1)],
    ['a fractional more', ambiguous(2, 0.5)],
    ['an ambiguous-id without detail', { error: { code: 'ambiguous-id', message: 'Ambiguous id' } }],
    [
      'a candidate with an extra key',
      {
        error: {
          code: 'ambiguous-id',
          message: 'x',
          detail: { candidates: [candidate(0), { ...candidate(1), path: 'x' }], more: 0 },
        },
      },
    ],
    [
      'a candidate without shortId',
      {
        error: {
          code: 'ambiguous-id',
          message: 'x',
          detail: { candidates: [candidate(0), { ...candidate(1), shortId: undefined }], more: 0 },
        },
      },
    ],
    ['an extra key in the envelope', { error: { code: 'not-found', message: 'Not found' }, x: 1 }],
  ])('refuses %s', (_name, body) => {
    expect(validRefusal(JSON.parse(JSON.stringify(body)))).toBe(false);
  });
});
