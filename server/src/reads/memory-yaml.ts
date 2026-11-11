/**
 * The direct read of `.wingfoil/memory.yaml` (spec-001 §4.1, adr-001 D1a): only the keys the UI
 * uses, checked against `contracts/files/memory-yaml.schema.json`, and WingFoil 0.2.2's resolution
 * of a type's states (`resolveStateMachine` and `resolveTransitionTarget` of its
 * `memory/state-machine.js`). Replaced by a CLI read verb when WingFoil adds one.
 */
import path from 'node:path';
import type { MemoryTypeDef, MemoryYaml, StateMachine } from '@wingfoil-ui/contracts';
import { nodeReadFs, readConfined, type ReadFs } from './confine.js';
import { BUILT_IN_STATES, DEPRECATED } from '../presets/wingfoil.js';
import { checkShape, parseYaml } from './frontmatter.js';

/** Path of the file, relative to the project root. */
export const MEMORY_YAML = '.wingfoil/memory.yaml';

// WingFoil's own vocabulary lives in `presets/` (REQ-ARC-05); re-exported for the readers' callers.
export { BUILT_IN_STATES, DEPRECATED } from '../presets/wingfoil.js';

/** A verb that moves an element. */
export type TransitionOp = 'submit' | 'approve' | 'reject' | 'deprecate';

const TRANSITION_OPS: readonly string[] = ['submit', 'approve', 'reject', 'deprecate'] satisfies TransitionOp[];

/** Whether `op` is a verb whose target {@link transitionTarget} decides. */
export function isTransitionOp(op: string | null): op is TransitionOp {
  return op !== null && TRANSITION_OPS.includes(op);
}

interface RawStates {
  sequence: string[];
  gates?: Record<string, { reject: string }>;
  waiting?: string[];
  /** Not checked by the schema: any value (WingFoil 0.2.2 accepts and ignores one, task-073 D73-4). */
  limits?: unknown;
}

/**
 * The WIP limits of a machine (WingFoil 0.3.x): the entries of a plain-object `limits` whose value is
 * a positive integer; anything else is dropped, `undefined` when none is left (task-073 D73-4).
 * WingFoil 0.3.x refuses a bad value itself, before anything is counted; 0.2.2 ignores the key.
 */
function pickLimits(raw: unknown): Record<string, number> | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw).filter(
    (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) > 0,
  );
  // Own entries only, on a null prototype: a state named `constructor` or `__proto__` is a plain key
  // (review F-1).
  return kept.length > 0
    ? Object.assign(Object.create(null) as Record<string, number>, Object.fromEntries(kept))
    : undefined;
}

interface RawType {
  path: string;
  id_pattern?: string;
  name?: string;
  description?: string;
  tags?: string[];
  template?: { frontmatter?: { required?: string[] } };
  states?: RawStates;
}

interface RawMemoryYaml {
  version: number;
  defaults?: { states?: RawStates };
  types: Record<string, RawType>;
}

function pickStates(raw: RawStates): StateMachine {
  const limits = pickLimits(raw.limits);
  return {
    sequence: [...raw.sequence],
    ...(raw.gates
      ? { gates: Object.fromEntries(Object.entries(raw.gates).map(([k, g]) => [k, { reject: g.reject }])) }
      : {}),
    ...(raw.waiting ? { waiting: [...raw.waiting] } : {}),
    ...(limits ? { limits } : {}),
  };
}

function pickType(raw: RawType): MemoryTypeDef {
  const required = raw.template?.frontmatter?.required;
  return {
    path: raw.path,
    ...(raw.id_pattern !== undefined ? { id_pattern: raw.id_pattern } : {}),
    ...(raw.name !== undefined ? { name: raw.name } : {}),
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    ...(raw.tags ? { tags: [...raw.tags] } : {}),
    ...(required ? { required: [...required] } : {}),
    ...(raw.states ? { states: pickStates(raw.states) } : {}),
  };
}

/** Parse the text of `memory.yaml`: the spec-001 §4.1 keys, or a `shape` error naming `file`. */
export function parseMemoryYaml(text: string, file: string = MEMORY_YAML): MemoryYaml {
  const data = parseYaml(text, file);
  checkShape('files/memory-yaml.schema.json', data, file);
  const raw = data as RawMemoryYaml;
  const defaults = raw.defaults?.states ? { defaults: { states: pickStates(raw.defaults.states) } } : {};
  return {
    version: raw.version,
    ...defaults,
    types: Object.fromEntries(Object.entries(raw.types).map(([name, t]) => [name, pickType(t)])),
  };
}

/** Read and parse `<root>/.wingfoil/memory.yaml` (confined to the project). */
export async function readMemoryYaml(root: string, fs: ReadFs = nodeReadFs): Promise<MemoryYaml> {
  return parseMemoryYaml(await readConfined(root, path.join(root, '.wingfoil'), 'memory.yaml', fs), MEMORY_YAML);
}

/**
 * The states of `type`: its own `states`, else `defaults.states`, else {@link BUILT_IN_STATES} —
 * each taken as a whole; `undefined` for a type `memory.yaml` does not declare.
 */
export function resolveStates(memoryYaml: MemoryYaml, type: string): StateMachine | undefined {
  if (!Object.hasOwn(memoryYaml.types, type)) return undefined;
  return memoryYaml.types[type]?.states ?? memoryYaml.defaults?.states ?? BUILT_IN_STATES;
}

/** A type's declared states: its sequence, every reject target (also outside it), `deprecated`. */
export function declaredStates(machine: StateMachine): string[] {
  const states = [...machine.sequence];
  for (const gate of Object.keys(machine.gates ?? {}).sort()) {
    const target = machine.gates?.[gate]?.reject;
    if (target !== undefined && !states.includes(target)) states.push(target);
  }
  if (!states.includes(DEPRECATED)) states.push(DEPRECATED);
  return states;
}

/**
 * Where `op` takes an element in state `from`, by WingFoil 0.2.2's rules, or `undefined` when the
 * CLI refuses it: `submit` from a sequence state that is neither a gate nor waiting, to the next;
 * `approve` from a gate that is not waiting, to the next; `reject` from a gate, to its target;
 * `deprecate` from anywhere.
 */
export function transitionTarget(machine: StateMachine, from: string, op: TransitionOp): string | undefined {
  if (op === 'deprecate') return DEPRECATED;
  const index = machine.sequence.indexOf(from);
  const gate = machine.gates?.[from];
  const waiting = (machine.waiting ?? []).includes(from);
  switch (op) {
    case 'submit':
      return index === -1 || gate || waiting ? undefined : machine.sequence[index + 1];
    case 'approve':
      return !gate || waiting ? undefined : machine.sequence[index + 1];
    case 'reject':
      return gate?.reject;
  }
}
