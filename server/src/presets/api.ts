/**
 * Words of the HTTP API (spec-004 §3) that coincide with type or state names of the fixtures. They
 * are the API's own vocabulary, not a methodology's, but REQ-ARC-05's lint rule matches by value, so
 * they live here (the rule's only exemption, spec-005 §5), like the descriptor's (`descriptor.ts`).
 */

/** The query parameter of `GET /api/p/:pid/elements` that adds the archived elements (`=true`). */
export const ARCHIVED_QUERY = 'archived';

/**
 * The count of finished elements in the project-state views (`completion.references[].done`,
 * `iterated.done`, spec-012 §3; task-059 D59-8): `done` is also a fixture state name.
 */
export const DONE_FIELD = 'done' as const;
