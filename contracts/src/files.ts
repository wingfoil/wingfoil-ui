/**
 * Types of the files the server reads directly, from the allow-list of adr-001 D1a (spec-001 §4),
 * as the readers return them; the files themselves match `contracts/files/*.schema.json`.
 */

/** A state machine: `types.<type>.states` or `defaults.states` of `memory.yaml`. */
export interface StateMachine {
  /** The ordered forward chain. */
  sequence: string[];
  /** Gate states and where a rejection lands (possibly outside `sequence`). */
  gates?: Record<string, { reject: string }>;
  /** States whose forward edge fires only through a workflow action. */
  waiting?: string[];
}

/** One element type of `memory.yaml`, the keys of spec-001 §4.1 only. */
export interface MemoryTypeDef {
  /** Path pattern with `{id}` and path tokens. */
  path: string;
  /** Id pattern with `{n}`, `{slug}` and other tokens. */
  id_pattern: string;
  name?: string;
  description?: string;
  tags?: string[];
  /** `template.frontmatter.required`. */
  required?: string[];
  /** The type's own states (otherwise `defaults.states`, then the built-in machine). */
  states?: StateMachine;
}

/** The subset of `.wingfoil/memory.yaml` the server reads (spec-001 §4.1). */
export interface MemoryYaml {
  version: number;
  defaults?: { states?: StateMachine };
  types: Record<string, MemoryTypeDef>;
}

/** Frontmatter of a Memory element file: four fields always present, the rest type-specific. */
export interface ElementFrontmatter {
  id: string;
  type: string;
  title: string;
  status: string;
  [field: string]: unknown;
}
