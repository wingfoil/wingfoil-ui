/**
 * The direct read of `.wingfoil/memory.yaml` (spec-001 §4.1, adr-001 D1a): only the keys the UI
 * uses, checked against `contracts/files/memory-yaml.schema.json`, and WingFoil 0.2.2's resolution
 * of a type's states (`resolveStateMachine` and `resolveTransitionTarget` of its
 * `memory/state-machine.js`). Replaced by a CLI read verb when WingFoil adds one.
 */
import path from 'node:path';
import type { MemoryTypeDef, MemoryYaml, StateMachine } from '@wingfoil-ui/contracts';
import { nodeReadFs, readConfined, type ReadFs } from './confine.js';
import { checkShape, parseYaml } from './frontmatter.js';

/** Path of the file, relative to the project root. */
export const MEMORY_YAML = '.wingfoil/memory.yaml';

/** WingFoil's built-in machine, for a type with no `states` and no `defaults.states`. */
export const BUILT_IN_STATES: StateMachine = Object.freeze({
  sequence: ['draft', 'pending', 'approved'],
  gates: { pending: { reject: 'draft' } },
});

/** The implicit state every element can reach (`memory deprecate`). */
export const DEPRECATED = 'deprecated';

/** A verb that moves an element. */
export type TransitionOp = 'submit' | 'approve' | 'reject' | 'deprecate';

interface RawStates {
  sequence: string[];
  gates?: Record<string, { reject: string }>;
  waiting?: string[];
}

interface RawType {
  path: string;
  id_pattern: string;
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
  return {
    sequence: [...raw.sequence],
    ...(raw.gates
      ? { gates: Object.fromEntries(Object.entries(raw.gates).map(([k, g]) => [k, { reject: g.reject }])) }
      : {}),
    ...(raw.waiting ? { waiting: [...raw.waiting] } : {}),
  };
}

function pickType(raw: RawType): MemoryTypeDef {
  const required = raw.template?.frontmatter?.required;
  return {
    path: raw.path,
    id_pattern: raw.id_pattern,
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
  return parseMemoryYaml(await readConfined(path.join(root, '.wingfoil'), 'memory.yaml', fs), MEMORY_YAML);
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
