// spec-008 §6: the key-rendering catalogue keeps every argument as a placeholder (X-09.2).
import { expect, it } from 'vitest';
import { keyCatalogue, messageArguments } from '../../../web/scripts/catalogue.mjs';

it('lists simple, plural, select and nested arguments once, and tags apart', () => {
  expect(messageArguments('Folder not found: {path}')).toEqual({ args: ['path'], tags: [] });
  expect(
    messageArguments('{count, plural, one {# element in {type}} other {# elements in {type}}} by <b>{name}</b>'),
  ).toEqual({ args: ['count', 'type', 'name'], tags: ['b'] });
  expect(messageArguments('{source, select, clone {a} other {b {path}}}')).toEqual({ args: ['source', 'path'], tags: [] });
  expect(messageArguments('No argument')).toEqual({ args: [], tags: [] });
});

it('replaces every message by its key and its argument placeholders', () => {
  expect(
    keyCatalogue({
      'memory.list.title': 'Memory',
      'error.folderNotFound': 'Folder not found: {path}',
      'memory.list.count': '{count, plural, one {# element} other {# elements}} of <b>{type}</b>',
    }),
  ).toEqual({
    'memory.list.title': 'memory.list.title',
    'error.folderNotFound': 'error.folderNotFound {path}',
    'memory.list.count': 'memory.list.count {count} {type}',
  });
});
