// spec-006 §2 — opaque project ids (REQ-SEC-04, X-05.1).
import { describe, expect, it } from 'vitest';
import { isProjectId, newProjectId, PROJECT_ID_PATTERN } from '../../../server/src/state/ids.js';

describe('newProjectId', () => {
  it('is p_ + 12 lower-case Crockford base32 characters', () => {
    for (let i = 0; i < 200; i++) expect(newProjectId()).toMatch(/^p_[0-9abcdefghjkmnpqrstvwxyz]{12}$/);
  });

  it('encodes 60 random bits, most significant first', () => {
    expect(newProjectId(() => Buffer.alloc(8, 0))).toBe('p_000000000000');
    expect(newProjectId(() => Buffer.alloc(8, 0xff))).toBe('p_zzzzzzzzzzzz');
    // 0x0123456789abcdef: the top 60 bits are 0x0123456789abcde → base32 digits.
    expect(newProjectId(() => Buffer.from('0123456789abcdef', 'hex'))).toBe('p_04hmasw9nf6y');
  });

  it('draws a different id every time (10 000 draws, no collision)', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newProjectId()));
    expect(ids.size).toBe(10_000);
  });
});

describe('isProjectId', () => {
  it.each(['p_7kq2m9x4r1tz', 'p_000000000000'])('accepts %s', (id) => {
    expect(isProjectId(id)).toBe(true);
    expect(PROJECT_ID_PATTERN.test(id)).toBe(true);
  });

  it.each([
    '../../etc',
    'p_7KQ2M9X4R1TZ',
    'p_7kq2m9x4r1t',
    'p_7kq2m9x4r1tzz',
    'p_7kq2m9x4r1to',
    '/home/alex/kanban',
    '',
  ])('refuses %s', (id) => {
    expect(isProjectId(id)).toBe(false);
  });
});
