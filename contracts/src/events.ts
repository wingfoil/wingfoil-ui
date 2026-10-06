/**
 * Events of the server's event stream `GET /api/events` (spec-004 §6, REQ-INT-09): Server-Sent
 * Events whose `event` field is the name and whose `data` is the JSON payload below.
 */

/** HEAD, the working-tree status or the effective `user.email` of a project changed (REQ-STATE-02). */
export interface RepoEventData {
  /** Opaque project id. */
  pid: string;
  /** The project's repository state, the value of the read responses' `X-Repo-State` header. */
  state: string;
}

/** A write finished (other tabs show the result). */
export interface WriteEventData {
  pid: string;
  /** The element written, when the write had one. */
  eid?: string;
  /** SHA of the commit. */
  commit: string;
}

/** One line of agent output (v0.4, REQ-PERF-08). */
export interface AgentEventData {
  pid: string;
  run: string;
  line: string;
}

/** Payload of each event, by event name (spec-004 §6). */
export interface ServerEventMap {
  repo: RepoEventData;
  /** The project list or a project's availability changed. */
  projects: Record<string, never>;
  /** The UI settings changed (another tab). */
  settings: Record<string, never>;
  write: WriteEventData;
  agent: AgentEventData;
}

/** Name of an event of the stream. */
export type ServerEventName = keyof ServerEventMap;

/** One event: its name and its payload. */
export type ServerEvent = { [N in ServerEventName]: { event: N; data: ServerEventMap[N] } }[ServerEventName];
