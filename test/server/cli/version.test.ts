// adr-001 D3, REQ-INT-02 — semantic-version parsing, the supported range read from the support
// matrix, and the classification of a detected `--version` text against it.
import { describe, expect, it } from 'vitest';
import {
  classifyVersion,
  compareSemVer,
  formatSemVer,
  parseSemVer,
  rangeFromMatrix,
  supportedRange,
  type SupportMatrix,
} from '../../../server/src/cli/version.js';

function v(text: string) {
  const parsed = parseSemVer(text);
  if (!parsed) throw new Error(`not a version: ${text}`);
  return parsed;
}

describe('parseSemVer', () => {
  it('parses a plain version and the pre-release and build parts', () => {
    expect(parseSemVer('0.2.2')).toEqual({ major: 0, minor: 2, patch: 2, prerelease: [], build: [] });
    expect(parseSemVer('1.10.0-rc.1+sha.5114f85')).toEqual({
      major: 1,
      minor: 10,
      patch: 0,
      prerelease: ['rc', 1],
      build: ['sha', '5114f85'],
    });
    expect(parseSemVer('0.3.0-alpha-1.0a')).toMatchObject({ prerelease: ['alpha-1', '0a'] });
  });

  it.each([
    [''],
    ['banana'],
    ['v0.2.2'],
    ['0.2'],
    ['0.2.2.1'],
    ['00.2.2'],
    ['0.02.2'],
    ['0.2.2-'],
    ['0.2.2-01'],
    ['0.2.2-a..b'],
    ['0.2.2+'],
    [' 0.2.2'],
    ['0.2.2\n0.2.3'],
    ['wingfoil 0.2.2'],
    ['99999999999999999999.0.0'],
    ['0.2.2-9007199254740993'],
  ])('refuses %j (not a semantic version)', (text) => {
    expect(parseSemVer(text)).toBeUndefined();
  });

  it('keeps a numeric pre-release identifier up to 2^53 − 1; a larger one is refused (conservative)', () => {
    expect(parseSemVer('0.2.2-9007199254740991')?.prerelease).toEqual([9007199254740991]);
    expect(parseSemVer('0.2.2-rc.9007199254740992')).toBeUndefined();
  });

  it('formats a version back to its canonical text', () => {
    expect(formatSemVer(v('1.10.0-rc.1+sha.5114f85'))).toBe('1.10.0-rc.1+sha.5114f85');
    expect(formatSemVer(v('0.2.2'))).toBe('0.2.2');
  });
});

describe('compareSemVer (SemVer 2.0 precedence)', () => {
  it('orders the SemVer 2.0 example chain', () => {
    const chain = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.1',
      '1.1.0',
      '2.0.0',
    ];
    for (let i = 0; i + 1 < chain.length; i += 1) {
      expect(compareSemVer(v(chain[i]!), v(chain[i + 1]!))).toBeLessThan(0);
      expect(compareSemVer(v(chain[i + 1]!), v(chain[i]!))).toBeGreaterThan(0);
    }
  });

  it('ignores build metadata', () => {
    expect(compareSemVer(v('0.2.2+a'), v('0.2.2+b'))).toBe(0);
    expect(compareSemVer(v('0.10.0'), v('0.9.9'))).toBeGreaterThan(0);
  });
});

describe('rangeFromMatrix', () => {
  it('v0.1 matrix [0.2.2] → 0.2.2 to 0.2.x (caret line of the highest tested version)', () => {
    const range = rangeFromMatrix({ min: '0.2.2', pinned: '0.2.2', versions: ['0.2.2'] });
    expect(range).toEqual({ min: '0.2.2', max: '0.2.x', below: '0.3.0', versions: ['0.2.2'] });
  });

  it('the lower bound is the declared min, not the lowest listed version', () => {
    expect(rangeFromMatrix({ min: '0.2.2', pinned: '0.3.0', versions: ['0.3.0'] })).toMatchObject({
      min: '0.2.2',
      max: '0.3.x',
    });
  });

  it('refuses a min that is not semantic or lies above a listed version', () => {
    expect(() => rangeFromMatrix({ min: '0.2', pinned: '0.2.2', versions: ['0.2.2'] })).toThrow(/min 0\.2 /);
    expect(() => rangeFromMatrix({ min: '0.2.3', pinned: '0.2.2', versions: ['0.2.2'] })).toThrow(
      /min 0\.2\.3 is above the listed 0\.2\.2/,
    );
  });

  it('several versions: the declared min, the highest gives the line (S-08.3: 0.2.2 to 0.3.x)', () => {
    expect(rangeFromMatrix({ min: '0.2.2', pinned: '0.3.1', versions: ['0.3.1', '0.2.2'] })).toMatchObject({
      min: '0.2.2',
      max: '0.3.x',
      below: '0.4.0',
    });
  });

  it('from 1.0 the line is the major (REQ-INT-02: 0.2.2 to 1.x)', () => {
    expect(rangeFromMatrix({ min: '0.2.2', pinned: '1.0.3', versions: ['0.2.2', '1.0.3'] })).toMatchObject({
      min: '0.2.2',
      max: '1.x',
      below: '2.0.0',
    });
  });

  it('a 0.0.z highest version is its own line', () => {
    expect(rangeFromMatrix({ min: '0.0.4', pinned: '0.0.4', versions: ['0.0.4'] })).toMatchObject({
      max: '0.0.4',
      below: '0.0.5',
    });
  });

  it('refuses a matrix with no version or a version that is not semantic', () => {
    expect(() => rangeFromMatrix({ min: '0.2.2', pinned: '0.2.2', versions: [] })).toThrow(/matrix/);
    expect(() => rangeFromMatrix({ min: '0.2.2', pinned: '0.2.2', versions: ['0.2'] } as SupportMatrix)).toThrow(
      /0\.2/,
    );
  });

  it('supportedRange() reads contracts/matrix.json', () => {
    expect(supportedRange()).toEqual({ min: '0.2.2', max: '0.2.x', below: '0.3.0', versions: ['0.2.2'] });
  });
});

describe('classifyVersion', () => {
  const range = rangeFromMatrix({ min: '0.2.2', pinned: '0.2.2', versions: ['0.2.2'] });

  it.each([
    ['0.2.2', 'in-range'],
    ['0.2.9', 'in-range'],
    ['0.2.2+build.7', 'in-range'],
    ['0.2.1', 'below'],
    ['0.2.0', 'below'],
    ['0.1.9', 'below'],
    ['0.2.2-rc.1', 'below'],
    ['0.3.0', 'above'],
    ['0.4.0', 'above'],
    ['1.0.0', 'above'],
    ['0.3.0-beta.1', 'above'],
    ['0.2.3-rc.1', 'pre-release'],
    ['banana', 'unrecognised'],
    ['v0.2.2', 'unrecognised'],
  ] as const)('%s → %s', (text, state) => {
    const result = classifyVersion(text, range);
    expect(result.state).toBe(state);
    expect(result.inRange).toBe(state === 'in-range');
    expect(result.text).toBe(text);
  });

  it('gives the canonical version when recognised, null otherwise', () => {
    expect(classifyVersion('0.2.2', range).version).toBe('0.2.2');
    expect(classifyVersion('banana', range).version).toBeNull();
    expect(classifyVersion(null, range)).toEqual({ text: null, version: null, state: 'unrecognised', inRange: false });
  });

  it('a pre-release listed in the matrix is in range', () => {
    const withRc = rangeFromMatrix({ min: '0.2.2', pinned: '0.2.2', versions: ['0.2.2', '0.2.3-rc.1'] });
    expect(classifyVersion('0.2.3-rc.1', withRc).state).toBe('in-range');
    expect(classifyVersion('0.2.3-rc.2', withRc).state).toBe('pre-release');
  });
});
