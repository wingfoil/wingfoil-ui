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
export type {
  ApiCapabilities,
  ApiCapability,
  ApiCapabilityReason,
  ApiError,
  ApiRange,
  ApiWingfoilVersion,
  ConfigSection,
  DirectiveDetail,
  DirectiveList,
  DocumentationIndex,
  ElementDetail,
  ElementList,
  FileContent,
  FileTree,
  Identity,
  IdentityView,
  ListedElement,
  ProjectConfig,
  ProjectHeader,
  ReadOnlyReason,
  RequiredField,
  RoleViewRequest,
  ServerInfo,
} from './api.js';
export type {
  Availability,
  CloneRequest,
  ProjectAddRequest,
  ProjectListItem,
  ProjectListResponse,
  ProjectRefusalBody,
  ProjectRefusalCode,
} from './projects.js';
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
export type {
  AgentEventData,
  RepoEventData,
  ServerEvent,
  ServerEventMap,
  ServerEventName,
  WriteEventData,
} from './events.js';
export type { ElementFrontmatter, MemoryTypeDef, MemoryYaml, StateMachine } from './files.js';
export type { ProjectEntry, StateFile, StateWarning } from './state.js';
export type { ActionLogEntry, UiSettings, UiTheme } from './state.js';
export type { ActorBasis } from './descriptor.js';
export type {
  MemoryEventEntry,
  MemoryEventsPage,
  Today,
  TodayAction,
  TodayActionRow,
  TodayElement,
  TodayRow,
  TodaySummaryLine,
} from './today.js';
export type {
  ElementDecisionRequest,
  ElementSubmitRequest,
  WriteCommit,
  WritePush,
  WritePushStatus,
  WriteRefusalCode,
  WriteResponse,
} from './writes.js';
