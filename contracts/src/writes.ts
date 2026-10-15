/**
 * The governed writes on an element (spec-004 §3, §5; v0.2): the request bodies
 * (`contracts/api/element.submit.request.schema.json`, `element.decision.request.schema.json`) and
 * the success body (`contracts/api/write.response.schema.json`).
 */

/** `POST /api/p/:pid/elements/:eid/submit`. */
export interface ElementSubmitRequest {
  /** The status the page showed (spec-004 §4 row 9). */
  expectedStatus: string;
}

/** `POST /api/p/:pid/elements/:eid/approve` and `/reject`. */
export interface ElementDecisionRequest extends ElementSubmitRequest {
  /** At least one non-whitespace character, no NUL, at most 10 000 characters. */
  reason: string;
}

/** A commit made by the write: a `wf(…)` commit of the CLI (REQ-ARC-03). */
export interface WriteCommit {
  sha: string;
  subject: string;
}

/** The auto-push outcome (spec-010 §6). */
export type WritePushStatus = 'pushed' | 'off' | 'failed';

/** The `push` part of a write response. */
export interface WritePush {
  status: WritePushStatus;
  /** On `failed`: a spec-010 §5 code or `push-timeout`, rendered from the catalogue. */
  code?: string;
  /** On `failed`: git's message, verbatim. */
  message?: string;
}

/** 200 of a governed write. */
export interface WriteResponse {
  /** The CLI's output. */
  result: Record<string, unknown>;
  commits: WriteCommit[];
  push: WritePush;
}

/** The codes a governed write refuses with (`contracts/api/write.refusal.schema.json`). */
export type WriteRefusalCode =
  | 'forbidden-origin'
  | 'unauthenticated'
  | 'not-found'
  | 'invalid-request'
  | 'not-in-team'
  | 'unsupported-version'
  | 'local-changes'
  /** Row 8: the copy is behind, diverged or on a detached HEAD (task-033). */
  | 'stale-copy'
  | 'element-changed'
  | 'cli-refused'
  | 'cli-output'
  | 'cli-timeout'
  | 'cli-not-found'
  | 'internal'
  | 'read-error'
  /** The CLI failed and left the element file changed without the write's commit (W2-1); `detail.file`. */
  | 'write-incomplete';
