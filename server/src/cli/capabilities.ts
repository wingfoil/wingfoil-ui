/**
 * The capability table `contracts/capabilities.json` (spec-001 §6, adr-001 D3, REQ-INT-03) and
 * what it gives a project: each capability is **enabled**, **read-only** with the reason, or
 * **hidden**.
 *
 * | Condition (first match wins) | State | Reason |
 * |------------------------------|-------|--------|
 * | a project condition of the capability does not hold | hidden | — |
 * | the version is outside the supported range (or unrecognised) | read-only | `unsupported-version` with the range |
 * | no released WingFoil provides it (`minVersion: null`) | read-only | `not-released` |
 * | the version is below `minVersion` | read-only | `needs-version` with `minVersion` |
 * | otherwise | enabled | — |
 *
 * The version notice lists the capabilities *of this release* the project lacks: those whose
 * minimum version lies inside the supported range but above the project's ({@link CapabilityReport.missing}).
 * The role a capability needs is not evaluated here (spec-003 §6, REQ-SEC-07).
 */
import type { Capability, CapabilityTable } from '@wingfoil-ui/contracts';
import { readFileSync } from 'node:fs';
import { schemaProblems } from '../contracts.js';
import { classifyVersion, compareSemVer, parseSemVer, type SupportedRange, type VersionClass } from './version.js';

export type { Capability } from '@wingfoil-ui/contracts';

function readContract(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../contracts/${file}`, import.meta.url), 'utf8')) as unknown;
}

/** Validate a capability table against `contracts/capabilities.schema.json`; throws on the first problems. */
export function checkCapabilityTable(table: unknown): readonly Capability[] {
  const problems = schemaProblems('capabilities.schema.json', table);
  if (problems) {
    throw new Error(`contracts/capabilities.json: ${problems.join('; ')}`);
  }
  const capabilities = (table as CapabilityTable).capabilities;
  const ids = new Set(capabilities.map((c) => c.id));
  if (ids.size !== capabilities.length) throw new Error('contracts/capabilities.json: duplicate capability id');
  return capabilities;
}

/** The capability table of this release, read and checked once, at load. */
export const CAPABILITIES: readonly Capability[] = checkCapabilityTable(readContract('capabilities.json'));

/** State of a capability for a project. */
export type CapabilityState = 'enabled' | 'read-only' | 'hidden';

/** Why a capability is read-only: a key of the web catalogue and its arguments (spec-008 §5). */
export type CapabilityReason =
  | { code: 'unsupported-version'; range: { min: string; max: string } }
  | { code: 'not-released' }
  | { code: 'needs-version'; minVersion: string };

/** A capability evaluated for a project. */
export interface CapabilityStatus {
  id: string;
  state: CapabilityState;
  /** Present when `state` is `read-only`. */
  reason?: CapabilityReason;
}

/** A capability of this release the project's version lacks (the version notice, S-08.3). */
export interface MissingCapability {
  id: string;
  minVersion: string;
}

/** The capabilities of a project. */
export interface CapabilityReport {
  /** Every capability of the table, in its order. */
  capabilities: CapabilityStatus[];
  /** The version notice: empty → "Every capability of this release is available" (S-08.1). */
  missing: MissingCapability[];
}

/** Options of {@link evaluateCapabilities}. */
export interface EvaluateOptions {
  /** Project-condition ids that hold for the project (default: none). */
  conditions?: Iterable<string>;
  /** The table (default: {@link CAPABILITIES}). */
  table?: readonly Capability[];
}

/** Evaluate the capability table for a project whose version is `version`, against `range`. */
export function evaluateCapabilities(
  version: Pick<VersionClass, 'version' | 'inRange'>,
  range: SupportedRange,
  options: EvaluateOptions = {},
): CapabilityReport {
  const holds = new Set(options.conditions ?? []);
  const table = options.table ?? CAPABILITIES;
  const projectVersion = version.inRange && version.version !== null ? parseSemVer(version.version) : undefined;
  const capabilities: CapabilityStatus[] = [];
  const missing: MissingCapability[] = [];
  for (const c of table) {
    if (!c.conditions.every((condition) => holds.has(condition))) {
      capabilities.push({ id: c.id, state: 'hidden' });
    } else if (!projectVersion) {
      capabilities.push({
        id: c.id,
        state: 'read-only',
        reason: { code: 'unsupported-version', range: { min: range.min, max: range.max } },
      });
    } else if (c.minVersion === null) {
      capabilities.push({ id: c.id, state: 'read-only', reason: { code: 'not-released' } });
    } else if (compareSemVer(projectVersion, parseSemVer(c.minVersion)!) < 0) {
      capabilities.push({ id: c.id, state: 'read-only', reason: { code: 'needs-version', minVersion: c.minVersion } });
      if (classifyVersion(c.minVersion, range).inRange) missing.push({ id: c.id, minVersion: c.minVersion });
    } else {
      capabilities.push({ id: c.id, state: 'enabled' });
    }
  }
  return { capabilities, missing };
}
