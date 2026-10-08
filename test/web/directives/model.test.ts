// task-019 — the Directives view's pure helpers (US-R-06, US-G-02; W3-38, W3-42, W3-43): the filter
// of the URL, "only mine" from the server's `mine` (never recomputed from the roles), the panel's
// directives, and the classification of a link inside a directive body.
import type { DirectiveList } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import {
  classifyDirectiveLink,
  directiveHref,
  directiveRepoPath,
  directivesSearch,
  effectiveShow,
  panelDirectives,
  shownDirectives,
} from '../../../web/src/directives/model.js';

type Entry = DirectiveList['entries'][number];

function entry(id: string, roles: string[], global: boolean, mine: boolean, dir = 'custom'): Entry {
  return {
    path: `directives/${dir}/${id}.md`,
    frontmatter: { id, name: id, type: 'directive', kind: dir, title: `Title ${id}` },
    roles,
    global,
    assignment: global ? 'global (all roles)' : roles.join(', '),
    mine,
  };
}

const ENTRIES: Entry[] = [
  entry('d-bound', ['r-dev'], false, true),
  entry('d-other', ['r-qa'], false, false),
  entry('d-global', [], true, true),
];

describe('directivesSearch and effectiveShow', () => {
  it('reads only "all" from the URL; anything else is the default', () => {
    expect(directivesSearch({ show: 'all' })).toEqual({ show: 'all' });
    expect(directivesSearch({ show: 'mine' })).toEqual({});
    expect(directivesSearch({})).toEqual({});
  });
  it('defaults a member to "only mine" and forces "all" outside the team', () => {
    expect(effectiveShow(undefined, true)).toBe('mine');
    expect(effectiveShow('all', true)).toBe('all');
    expect(effectiveShow(undefined, false)).toBe('all');
  });
});

describe('shownDirectives and panelDirectives', () => {
  it('shows the entries the server marked mine, or every entry', () => {
    expect(shownDirectives(ENTRIES, 'mine').map((e) => e.frontmatter.id)).toEqual(['d-bound', 'd-global']);
    expect(shownDirectives(ENTRIES, 'all')).toHaveLength(3);
  });
  it("gives the panel the role view's directives, or the global ones outside the team", () => {
    expect(panelDirectives(ENTRIES, true).map((e) => e.frontmatter.id)).toEqual(['d-bound', 'd-global']);
    expect(panelDirectives(ENTRIES, false).map((e) => e.frontmatter.id)).toEqual(['d-global']);
  });
});

describe('directive paths and links', () => {
  const self = directiveRepoPath(ENTRIES[0]!);
  const byPath = new Map(ENTRIES.map((e) => [directiveRepoPath(e), e.frontmatter.id]));
  const classify = (href: string) => classifyDirectiveLink(href, self, byPath);

  it('places a directive under .wingfoil/ and links its page', () => {
    expect(self).toBe('.wingfoil/directives/custom/d-bound.md');
    expect(directiveHref('p x', 'd/1')).toBe('/p/p%20x/directives/d%2F1');
    expect(directiveHref('p', 'd', 'Key rules')).toBe('/p/p/directives/d#Key%20rules');
  });

  it('opens http(s) in a new tab and keeps in-page anchors', () => {
    expect(classify('https://example.test/x')).toEqual({ kind: 'external', href: 'https://example.test/x' });
    expect(classify('#rules')).toEqual({ kind: 'anchor', fragment: 'rules' });
  });

  it('opens another directive in the UI', () => {
    expect(classify('./d-other.md#a')).toEqual({
      kind: 'document',
      path: '.wingfoil/directives/custom/d-other.md',
      fragment: 'a',
    });
    expect(classify('../custom/d-global.md')).toEqual({
      kind: 'document',
      path: '.wingfoil/directives/custom/d-global.md',
      fragment: '',
    });
  });

  it('lets a repository path wait while the directive list is not read (review F3)', () => {
    expect(classifyDirectiveLink('./d-other.md', self, undefined)).toEqual({
      kind: 'unresolved',
      path: '.wingfoil/directives/custom/d-other.md',
    });
    expect(classifyDirectiveLink('../../dna.yaml', self, undefined)).toEqual({
      kind: 'unresolved',
      path: '.wingfoil/dna.yaml',
    });
    expect(classifyDirectiveLink('#a', self, undefined)).toEqual({ kind: 'anchor', fragment: 'a' });
  });

  it('marks every other repository path "not shown in the UI", and refuses the rest', () => {
    expect(classify('../../dna.yaml')).toEqual({ kind: 'refused', mark: 'hidden' });
    expect(classify('../../../docs/x.md')).toEqual({ kind: 'refused', mark: 'hidden' });
    expect(classify('../../../../x')).toEqual({ kind: 'refused', mark: 'outside' });
    expect(classify('mailto:a@b.test')).toEqual({ kind: 'refused', mark: 'unsupported' });
  });
});
