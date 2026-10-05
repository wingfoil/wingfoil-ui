/**
 * The WingFoil version of a project and the supported range (adr-001 D3, REQ-INT-02).
 *
 * - `wingfoil --version` is run once per CLI resolution ({@link VersionCache}); its text must be a
 *   semantic version (SemVer 2.0, no `v` prefix — WingFoil prints `0.2.2`), anything else is
 *   "unrecognised" and outside the range.
 * - The range comes from the support matrix `contracts/matrix.json`: from the lowest version of the
 *   matrix to the release line of the highest (its caret line: `^0.2.2` → `0.2.x`, below `0.3.0`;
 *   `^1.0.3` → `1.x`, below `2.0.0`). A pre-release is in range only when the matrix lists it.
 * - Outside the range a project is read-only with the range in the reason (S-09.1, S-09.2); the
 *   capabilities it gives are evaluated by `./capabilities.ts`.
 */
import type { SupportMatrix } from '@wingfoil-ui/contracts';
import { readFileSync } from 'node:fs';
import { CliOutputError, type WingfoilCli } from './adapter.js';
import type { CliSource, ResolvedCli } from './discovery.js';

export type { SupportMatrix } from '@wingfoil-ui/contracts';

/** A parsed semantic version (SemVer 2.0). */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** Pre-release identifiers (`rc.1` → `['rc', 1]`); empty for a release. */
  prerelease: Array<string | number>;
  /** Build metadata identifiers: ignored by precedence. */
  build: string[];
}

const NUMERIC = '0|[1-9]\\d*';
const PRE_ID = `(?:${NUMERIC}|\\d*[a-zA-Z-][0-9a-zA-Z-]*)`;
const SEMVER = new RegExp(
  `^(${NUMERIC})\\.(${NUMERIC})\\.(${NUMERIC})` +
    `(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?` +
    `(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$`,
);

/** Parse `text` as a semantic version; `undefined` when it is not one (whole text, no `v`, no spaces). */
export function parseSemVer(text: string): SemVer | undefined {
  const m = SEMVER.exec(text);
  if (!m) return undefined;
  const [major, minor, patch] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
  if (![major, minor, patch].every(Number.isSafeInteger)) return undefined;
  const prerelease = m[4] ? m[4].split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [];
  if (prerelease.some((id) => typeof id === 'number' && !Number.isSafeInteger(id))) return undefined;
  return { major, minor, patch, prerelease, build: m[5] ? m[5].split('.') : [] };
}

/** The canonical text of `v`. */
export function formatSemVer(v: SemVer): string {
  const pre = v.prerelease.length > 0 ? `-${v.prerelease.join('.')}` : '';
  const build = v.build.length > 0 ? `+${v.build.join('.')}` : '';
  return `${v.major}.${v.minor}.${v.patch}${pre}${build}`;
}

function compareCore(a: SemVer, b: SemVer): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** SemVer 2.0 precedence: negative when `a` < `b`, 0 when equal (build metadata ignored), positive otherwise. */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const core = compareCore(a, b);
  if (core !== 0) return core;
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return (a.prerelease.length === 0 ? 1 : 0) - (b.prerelease.length === 0 ? 1 : 0);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i += 1) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** The supported range of this UI release (adr-001 D3). */
export interface SupportedRange {
  /** Lowest supported version (the lowest of the matrix), e.g. `0.2.2`. */
  min: string;
  /** Label of the upper end: the release line of the highest matrix version, e.g. `0.2.x`, `1.x`. */
  max: string;
  /** First version above the range (exclusive bound), e.g. `0.3.0`. */
  below: string;
  /** The contract-tested versions (pre-releases are in range only when listed here). */
  versions: readonly string[];
}

/** The range of `matrix` (see the module comment); throws on an empty matrix or a non-semantic entry. */
export function rangeFromMatrix(matrix: SupportMatrix): SupportedRange {
  const parsed = matrix.versions.map((text) => {
    const v = parseSemVer(text);
    if (!v) throw new Error(`contracts/matrix.json: ${text} is not a semantic version`);
    return v;
  });
  if (parsed.length === 0) throw new Error('contracts/matrix.json: the matrix lists no version');
  const sorted = [...parsed].sort(compareSemVer);
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  let max: string;
  let below: string;
  if (high.major > 0) {
    max = `${high.major}.x`;
    below = `${high.major + 1}.0.0`;
  } else if (high.minor > 0) {
    max = `0.${high.minor}.x`;
    below = `0.${high.minor + 1}.0`;
  } else {
    max = `0.0.${high.patch}`;
    below = `0.0.${high.patch + 1}`;
  }
  return { min: formatSemVer(low), max, below, versions: [...matrix.versions] };
}

const MATRIX = JSON.parse(
  readFileSync(new URL('../../../contracts/matrix.json', import.meta.url), 'utf8'),
) as SupportMatrix;
const RANGE = rangeFromMatrix(MATRIX);

/** The supported range of this release, from `contracts/matrix.json` (read once, at load). */
export function supportedRange(): SupportedRange {
  return RANGE;
}

/**
 * Where a version stands against the range: `in-range`; `below` the minimum; `above` the release
 * line; `pre-release` — a pre-release inside the bounds the matrix does not list; `unrecognised`
 * — not a semantic version.
 */
export type RangeState = 'in-range' | 'below' | 'above' | 'pre-release' | 'unrecognised';

/** A `--version` text classified against the range. */
export interface VersionClass {
  /** The text `--version` answered (trimmed), or `null` when it gave no usable line. */
  text: string | null;
  /** The canonical semantic version, or `null` when unrecognised. */
  version: string | null;
  state: RangeState;
  /** `state === 'in-range'`: the project may act (spec-003 §6 rule 2, spec-004 §4 row 6). */
  inRange: boolean;
}

/** Classify the `--version` text `text` against `range` (default: this release's). */
export function classifyVersion(text: string | null, range: SupportedRange = RANGE): VersionClass {
  const parsed = text === null ? undefined : parseSemVer(text);
  if (!parsed) return { text, version: null, state: 'unrecognised', inRange: false };
  const version = formatSemVer(parsed);
  const state = rangeState(parsed, range);
  return { text, version, state, inRange: state === 'in-range' };
}

function rangeState(v: SemVer, range: SupportedRange): RangeState {
  if (compareSemVer(v, parseSemVer(range.min)!) < 0) return 'below';
  // The upper bound compares the release triple: 0.3.0-beta.1 belongs to the 0.3 line, above 0.2.x.
  if (compareCore(v, parseSemVer(range.below)!) >= 0) return 'above';
  if (v.prerelease.length === 0) return 'in-range';
  const listed = range.versions.some((text) => {
    const m = parseSemVer(text);
    return m !== undefined && compareSemVer(m, v) === 0;
  });
  return listed ? 'in-range' : 'pre-release';
}

/** The detected version of a project's CLI: its classification and where the CLI comes from. */
export interface DetectedVersion extends VersionClass {
  /** `path` → the header's "(from PATH)" (S-08.2). */
  source: CliSource;
}

/**
 * Run `cli`'s `--version` and classify it. An answer the adapter refuses as output (empty, several
 * lines) is `unrecognised`; a refusal, timeout or process error propagates.
 */
export async function detectVersion(cli: WingfoilCli, range: SupportedRange = RANGE): Promise<DetectedVersion> {
  let text: string | null;
  try {
    text = await cli.version();
  } catch (error) {
    if (!(error instanceof CliOutputError)) throw error;
    text = null;
  }
  return { ...classifyVersion(text, range), source: cli.source };
}

/**
 * The detected version cached with its CLI resolution (adr-001 D3): one `--version` per
 * {@link ResolvedCli} object — a new `discoverCli` result is a new resolution and is detected
 * again. Concurrent callers share one process; a failed detection is not kept.
 */
export class VersionCache {
  private readonly entries = new WeakMap<ResolvedCli, Promise<DetectedVersion>>();

  constructor(private readonly range: SupportedRange = RANGE) {}

  /** The detected version of `cli`'s resolution, running `--version` on the first call only. */
  detect(cli: WingfoilCli): Promise<DetectedVersion> {
    const key = cli.resolved;
    const cached = this.entries.get(key);
    if (cached) return cached;
    const pending = detectVersion(cli, this.range);
    this.entries.set(key, pending);
    pending.catch(() => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
    });
    return pending;
  }
}
