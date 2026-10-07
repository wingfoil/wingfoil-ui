// task-020 — resolving and classifying a document link (US-R-08, US-R-09; REQ-SEC-06; decisions
// W3-30, W3-32, W3-33): every href of a rendered document goes through `resolveLink` (pure, no
// request) and then `classifyLink` against the docs index, the Memory elements and the server's
// answers for the other repository paths.
import { describe, expect, it } from 'vitest';
import { classifyLink, resolveLink, type LinkLookup } from '../../../web/src/docs/links.js';

const DOC = 'docs/01_vision/00_index.md';

describe('resolveLink — external links (W3-32)', () => {
  it.each([
    ['https://example.test/guide', 'https://example.test/guide'],
    ['http://example.test/a?b=1#c', 'http://example.test/a?b=1#c'],
    ['HTTPS://Example.test/x', 'https://example.test/x'],
    ['  https://example.test/  ', 'https://example.test/'],
  ])('%s is external', (href, normalised) => {
    expect(resolveLink(href, DOC)).toEqual({ kind: 'external', href: normalised });
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/png;base64,AAAA',
    'file:///etc/hosts',
    'mailto:someone@example.test',
    'ftp://example.test/x',
    '//evil.example/x',
    '\\\\evil.example\\share',
    '/\\evil.example',
    'C:\\Windows\\win.ini',
    'https://exa mple.test/',
    '',
    '   ',
  ])('%j is not supported', (href) => {
    expect(resolveLink(href, DOC)).toEqual({ kind: 'unsupported' });
  });
});

describe('resolveLink — repository paths (W3-33, REQ-SEC-06)', () => {
  it.each([
    ['02_product-vision.md', 'docs/01_vision/02_product-vision.md', ''],
    ['./02_product-vision.md', 'docs/01_vision/02_product-vision.md', ''],
    ['../01_vision/./02_product-vision.md', 'docs/01_vision/02_product-vision.md', ''],
    ['02_product-vision.md#pillars', 'docs/01_vision/02_product-vision.md', 'pillars'],
    ['02_product-vision.md?plain=1#pillars', 'docs/01_vision/02_product-vision.md', 'pillars'],
    ['sub/dir/x.md', 'docs/01_vision/sub/dir/x.md', ''],
    ['../04_memory/design/dls/dl-001-x.md', 'docs/04_memory/design/dls/dl-001-x.md', ''],
    ['../../README.md', 'README.md', ''],
    ['/docs/02_requirements/00_index.md', 'docs/02_requirements/00_index.md', ''],
    ['my%20file.md', 'docs/01_vision/my file.md', ''],
    ['caf%C3%A9.md', 'docs/01_vision/café.md', ''],
    ['sub%2Fx.md', 'docs/01_vision/sub/x.md', ''],
    ['sub\\x.md', 'docs/01_vision/sub/x.md', ''],
    ['x.md#S%C3%A9ction', 'docs/01_vision/x.md', 'Séction'],
    ['../04_memory/', 'docs/04_memory', ''],
    ['?plain=1', DOC, ''],
  ])('%s → %s', (href, path, fragment) => {
    expect(resolveLink(href, DOC)).toEqual({ kind: 'path', path, fragment });
  });

  it('a lone fragment is an anchor of the same document', () => {
    expect(resolveLink('#key-decisions', DOC)).toEqual({ kind: 'anchor', fragment: 'key-decisions' });
  });

  it.each([
    '../../../etc/hosts',
    '../../..',
    '%2e%2e/%2e%2e/%2e%2e/etc/hosts',
    '%2E%2E%2F%2E%2E%2F%2E%2E%2Fetc%2Fhosts',
    '..%2F..%2F..%2Fetc%2Fhosts',
    '..\\..\\..\\etc\\hosts',
    '/../etc/hosts',
    '/..',
    'sub/../../../../x.md',
  ])('%s leaves the repository', (href) => {
    expect(resolveLink(href, DOC)).toEqual({ kind: 'outside' });
  });

  it.each(['x%00.md', 'x%zz.md', '%E0%A4%A.md', 'x%0A.md'])('%s is not supported (encoding)', (href) => {
    expect(resolveLink(href, DOC)).toEqual({ kind: 'unsupported' });
  });

  it('resolves against a document at the repository root', () => {
    expect(resolveLink('docs/a.md', 'README.md')).toEqual({ kind: 'path', path: 'docs/a.md', fragment: '' });
    expect(resolveLink('../a.md', 'README.md')).toEqual({ kind: 'outside' });
  });
});

describe('classifyLink', () => {
  const lookup = (over: Partial<LinkLookup> = {}): LinkLookup => ({
    documents: new Set(['docs/01_vision/02_product-vision.md', 'docs/01_vision/00_index.md']),
    elements: new Map([['docs/04_memory/design/dls/dl-001-x.md', 'dl-001-x']]),
    probes: new Map(),
    ...over,
  });

  it('an indexed document opens in the UI, with its fragment', () => {
    expect(classifyLink(resolveLink('02_product-vision.md#a', DOC), lookup())).toEqual({
      kind: 'document',
      path: 'docs/01_vision/02_product-vision.md',
      fragment: 'a',
    });
  });

  it('a Memory file opens its element panel', () => {
    expect(classifyLink(resolveLink('../04_memory/design/dls/dl-001-x.md', DOC), lookup())).toEqual({
      kind: 'element',
      eid: 'dl-001-x',
    });
  });

  it('a path neither indexed nor an element waits for the elements, then for the server', () => {
    const target = resolveLink('missing-file.md', DOC);
    expect(classifyLink(target, lookup({ elements: undefined }))).toEqual({
      kind: 'pending',
      path: 'docs/01_vision/missing-file.md',
    });
    expect(classifyLink(target, lookup())).toEqual({ kind: 'pending', path: 'docs/01_vision/missing-file.md' });
  });

  it.each([
    ['served', { kind: 'document', path: 'docs/01_vision/missing-file.md', fragment: '' }],
    ['missing', { kind: 'refused', mark: 'broken' }],
    ['outside', { kind: 'refused', mark: 'outside' }],
    ['hidden', { kind: 'refused', mark: 'hidden' }],
  ] as const)('the server answer %s classifies it (W3-30)', (answer, expected) => {
    const probes = new Map([['docs/01_vision/missing-file.md', answer]]);
    expect(classifyLink(resolveLink('missing-file.md', DOC), lookup({ probes }))).toEqual(expected);
  });

  it('outside, unsupported, external, anchor and the repository root', () => {
    expect(classifyLink(resolveLink('../../../etc/hosts', DOC), lookup())).toEqual({
      kind: 'refused',
      mark: 'outside',
    });
    expect(classifyLink(resolveLink('javascript:alert(1)', DOC), lookup())).toEqual({
      kind: 'refused',
      mark: 'unsupported',
    });
    expect(classifyLink(resolveLink('https://example.test/', DOC), lookup())).toEqual({
      kind: 'external',
      href: 'https://example.test/',
    });
    expect(classifyLink(resolveLink('#a', DOC), lookup())).toEqual({ kind: 'anchor', fragment: 'a' });
    expect(classifyLink(resolveLink('../..', DOC), lookup())).toEqual({ kind: 'refused', mark: 'hidden' });
  });

  it('compares paths in NFC', () => {
    const documents = new Set(['docs/01_vision/caf\u00e9.md']);
    expect(classifyLink(resolveLink('cafe\u0301.md', DOC), lookup({ documents }))).toMatchObject({
      kind: 'document',
    });
  });
});
