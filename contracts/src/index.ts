/**
 * WingFoil UI contracts: JSON Schemas of the consumed WingFoil CLI output (`cli/`), of the files
 * read directly from the allow-list (`files/`), of `ui.yaml`, of the HTTP API (with the action
 * descriptor of spec-003, `descriptor.ts`) and of the local state
 * file, and the types matching them (adr-002, spec-001 §5). `matrix.json` holds the supported
 * WingFoil versions, `capabilities.json` the capability table.
 *
 * @packageDocumentation
 */
export type {
  DirectiveEntry,
  DirectiveFrontmatter,
  DirectivesList,
  DnaAgent,
  DnaMember,
  DnaMethodology,
  DnaModule,
  DnaPaths,
  DnaRole,
  DnaShow,
  DnaTechnology,
  HistoryEntry,
  HistoryOperation,
  MemoryAdded,
  MemoryHistory,
  MemoryMatch,
  MemoryRejection,
  MemorySearch,
  MemoryTransition,
  Workflow,
  WorkflowList,
  WorkflowPhase,
} from './cli.js';
export type { Identity, IdentityView, RoleViewRequest } from './api.js';
export type { Capability, CapabilityTable, SupportMatrix } from './capabilities.js';
export type {
  ActionDescriptor,
  Bucket,
  DescriptorActor,
  DescriptorMember,
  DescriptorRejection,
  DescriptorVerb,
  DescriptorVerbName,
  DisabledReason,
  StateKind,
  Tone,
} from './descriptor.js';
export type { ElementFrontmatter, MemoryTypeDef, MemoryYaml, StateMachine } from './files.js';
export type { ProjectEntry, StateFile, StateWarning } from './state.js';
