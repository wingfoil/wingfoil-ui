// spec-004 §3, spec-006 §2–§3 — the bodies of the project-list routes (`contracts/api/`):
// `GET /api/projects` (list with availability), `POST /api/projects` `{path}`,
// `POST /api/projects/clone` `{url, directory?}`, and the item both adds answer with. The routes'
// real answers are validated against the same schemas in `test/server/http/projects.test.ts`.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CloneRequest,
  ProjectAddRequest,
  ProjectListItem,
  ProjectListResponse,
} from '../../contracts/src/projects.js';
import { REPO_ROOT } from '../harness/cli.js';

const load = (file: string): object =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts/api', file), 'utf8')) as object;
const ajv = new Ajv({ allErrors: true });
ajv.addSchema(load('projects.item.schema.json'));
const validList = ajv.compile(load('projects.list.response.schema.json'));
const validItem = ajv.getSchema('https://wingfoil-ui.local/contracts/api/projects.item.schema.json')!;
const validAdd = ajv.compile(load('projects.add.request.schema.json'));
const validClone = ajv.compile(load('projects.clone.request.schema.json'));

const OK: ProjectListItem = {
  id: 'p_7kq2m9x4r1tz',
  name: 'kanban',
  path: '/home/alex/projects/kanban',
  remote: 'https://github.com/acme/kanban.git',
  availability: 'ok',
};

describe('projects.item.schema.json and projects.list.response.schema.json', () => {
  const items: ProjectListItem[] = [
    OK,
    { ...OK, remote: '', availability: 'folder-not-found' },
    { ...OK, availability: 'not-wingfoil' },
    { ...OK, availability: 'cli-not-found', command: 'npm install --save-dev wingfoil' },
  ];

  it.each(items.map((i) => [i.availability, i] as const))('accepts an item %s', (_a, item) => {
    expect(validItem(item), JSON.stringify(validItem.errors)).toBe(true);
  });

  it('accepts a list, empty or not', () => {
    const lists: ProjectListResponse[] = [{ projects: [] }, { projects: items }];
    for (const l of lists) expect(validList(l), JSON.stringify(validList.errors)).toBe(true);
  });

  it.each([
    ['an unknown availability', { ...OK, availability: 'gone' }],
    ['a path-like id', { ...OK, id: '../../etc' }],
    ['a missing remote', { id: OK.id, name: OK.name, path: OK.path, availability: 'ok' }],
    ['cli-not-found without its command', { ...OK, availability: 'cli-not-found' }],
    ['a command with another availability', { ...OK, command: 'npm install --save-dev wingfoil' }],
    ['a remote with credentials', { ...OK, remote: 'https://u:p@host/x.git' }],
  ])('refuses %s', (_name, item) => {
    expect(validItem(item)).toBe(false);
  });

  it('refuses a list that is not under projects', () => {
    expect(validList([OK])).toBe(false);
  });
});

describe('request bodies', () => {
  it('accepts { path } and { url, directory? }', () => {
    const add: ProjectAddRequest = { path: '/tmp/kanban' };
    const clones: CloneRequest[] = [{ url: 'file:///srv/remotes/kanban.git' }, { url: 'x', directory: '~/projects/x' }];
    expect(validAdd(add)).toBe(true);
    for (const c of clones) expect(validClone(c)).toBe(true);
  });

  it.each([
    [validAdd, {}],
    [validAdd, { path: '' }],
    [validAdd, { path: 1 }],
    [validAdd, { path: '/x', other: 1 }],
    [validClone, {}],
    [validClone, { url: '' }],
    [validClone, { url: 'x', directory: '' }],
    [validClone, { url: 'x', depth: 1 }],
  ])('refuses %#', (validate, body) => {
    expect(validate(body)).toBe(false);
  });
});
