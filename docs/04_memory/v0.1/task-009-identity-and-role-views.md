---
id: task-009-identity-and-role-views
type: task
title: "Identity and role views"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-005-cli-contracts-and-direct-reads", "task-007-local-state-store"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Identity from `git config user.email` matched against `dna.team.members` (single role, several roles, not in team, no identity, duplicates), refreshed when the email changes, and the role views per member, remembered per project (`PUT /api/p/:pid/role-view`, spec-006 `roleView`).

**Backlog items:** TT-STATE-05, TT-STATE-06

## Acceptance Criteria

- **TT-STATE-05** (REQ-STATE-05 — Identity from git): [boolean] Every listed scenario passes; the identity shown always equals the member whose email matches `git config user.email` of the fixture. *Verified by:* unit · e2e.
  Scenarios (`@v0.1`): S-12.1, S-12.2, S-12.3, S-13.1, S-13.3, S-14.1, S-14.2, S-15.1, S-15.3.
- **TT-STATE-06** (REQ-STATE-06 — Role views): [boolean] The role view selector lists exactly the member's roles; switching changes Today's list as the action descriptor computes it for that role. v0.1 (no Today): switching changes the Directives view filtered on "only mine" (S-22.1) and is kept per project (S-22.3). *Verified by:* e2e.
  Scenarios (`@v0.1`): S-22.1, S-22.2, S-22.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-12.1, S-12.2, S-12.3, S-13.1, S-13.3, S-14.1, S-14.2, S-15.1, S-15.3, S-22.1, S-22.2, S-22.3.

## Implementation Notes

- `adr-001` D6 (effective `user.email` in the cache key); directive `cli-only-writes` rule 6 (identity is the project's git identity); `spec-004` §3 (`/api/p/:pid`, `role-view`); `spec-006` §2 `roleView`; `spec-003` §5 (placement per role view).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-003, task-005 and task-007 Execution Notes read,
  reviews included. Taken from them: every route goes through `buildApp({ register })` and is
  guarded automatically, and each new `/api/` route adds its 401/403 rows to
  `test/launcher/local-security.test.ts` (003); the CLI is reached through `discoverCli` →
  `WingfoilCli` → `ProjectReads.dna()`, its output schema-validated, failures mapped by
  `cliErrorEnvelope`; in WingFoil 0.2.2 a member's `email` is optional (a member without one never
  matches) and `project` fields may be absent (005); the role view is persisted with
  `store.update(pid, { roleView })` (only `name`/`remote`/`roleView` are copied), the fallback for
  a role no longer held is applied on read and never stored, `store.get(pid)` is the exact-string
  lookup for the 404, transactions stay short and side-effect free and never nest a store mutation
  (007 — this task needs no transaction: `update` alone is the write). Route and domain tests use
  `createMemoryStateStore()`; the bin's state directory is `WINGFOIL_UI_STATE_DIR`.
- **Specs:** REQ-STATE-05/06, spec-004 §3 (`PUT /api/p/:pid/role-view` `{role}`, `GET /api/p/:pid`
  carries "identity, role views" — the route itself is task-012's), §4 (order 404 → 400 → 403
  `not-in-team`), §5 envelope; spec-006 §2 `roleView` (`""` = the member's first role), §3 (fallback
  on read); `adr-001` D6 (effective `user.email` in the cache key — task-010's); directive
  `cli-only-writes` rules 2 and 6 (identity is the project's git identity; git read directly only
  for what the CLI does not expose: `git config user.email`). Details the specs leave open, decided
  here without changing an interface (reported to the coordinator):
  - `PUT /api/p/:pid/role-view` answers **204** (no body; the client refetches `GET /api/p/:pid`),
    its request schema is `contracts/api/role-view.request.schema.json` (`{ role: string }`,
    non-empty, no other property).
  - Refusals, in the spec-004 §4 order: unknown `:pid` → 404 `not-found` (checked before the body,
    in `preValidation`); body failing its schema → 400 `invalid-request`; user not identified as
    exactly one member (not in team, no email, ambiguous) → 403 `not-in-team`; a role the member
    does not hold → 400 `invalid-request`. spec-004 §4 has no row for the last case: proposed
    addition "role not held by the member → 400 `invalid-request`" (option: a dedicated 422 code).
  - The identity shape for `GET /api/p/:pid` (task-012) is defined here as a schema
    `contracts/api/identity.schema.json` and types in `contracts/src/api.ts`: `identity` is one of
    `{ kind: 'member', email, name, roles }`, `{ kind: 'not-in-team', email }`,
    `{ kind: 'no-identity' }`, `{ kind: 'ambiguous', email, members: [names] }`; plus
    `roleViews` (the member's roles, DNA order, duplicates dropped; `[]` otherwise) and `roleView`
    (the stored role when held, else the first role; `null` without a member). The selector is
    shown when `roleViews.length > 1` (ux-reference §3: shown only with several roles).
  - Email matching: both sides trimmed and compared lower-cased (`String#toLowerCase`, locale
    independent); an empty or whitespace `user.email` is no identity; a member without `email`
    never matches. "Duplicates" = the email matching ≥ 2 members (S-15.1, names in DNA order).
  - The effective email is `git config --get user.email` run in the project folder (git's own
    resolution: repository, then global — as the CLI sees it); exit 1 = unset. `git` is resolved on
    the `PATH` (absolute entries only, as `discoverCli` does) and run through the process runner
    (argument array, no shell, 30 s timeout).
  - "Re-evaluated on change": the identity is computed fresh on every call (git config and
    `dna show` read each time); no cache here. Caching keyed on the effective email and the push to
    the page within 5 s (S-12.3/S-13.3/S-15.3 screen half) are task-010's (event stream) and
    task-016's (screen).
  - "Only mine" for a role view (S-22.1, R-06.1): the directives whose `roles` contain the role or
    that are `global` — a pure function `directivesForRoleView(entries, role)`; no role (not a
    member) → `[]` (R-06.4). The Directives view itself is task-019's.
- **Scope boundaries:** here — the identity domain (`server/src/identity/`), the git email reader,
  the role views and their fallback, the `PUT` route wired in `runLauncher`, the API contracts of
  the identity and of the PUT body. **task-012:** `GET /api/p/:pid` embeds the identity view.
  **task-010:** cache and live updates. **task-016:** header, badge, notices, selector (screens).
  **v0.2:** Today's role-view placement (spec-003 §5).
- **AC classification (T1)** — all **red-first** (no identity code exists):
  - TT-STATE-05 — unit (pure matching) for S-12.1 (single role, selector hidden), S-12.2 (case),
    S-13.1 (not in team), S-14.1 (no email), S-15.1 (two members, names), plus member without
    email, whitespace email, duplicate roles; integration on real kanban copies (real git + pinned
    CLI): S-12.1, S-12.2, S-12.3 (email changed → next evaluation Morgan), S-13.1 (Riley), S-13.3
    (Jordan removed with the CLI → not in team), S-14.1 (no repo/global email), S-14.2 (global
    Casey), S-15.1 / S-15.3 (shared email, then Sam's email changed with the CLI → Jordan).
  - TT-STATE-06 — unit: S-22.2 (Morgan: exactly `approver`, `tech-lead`), default = first role,
    stored role kept, a role no longer held falls back on read; S-22.1 (`directivesForRoleView` on
    the custom fixture's `directives list`: switching approver → developer changes the list to the
    developer-bound + global ones); route tests (`buildApp` + memory store + fake identity): 204 and
    the stored `roleView`, 404/400/403/400 rows and their order; bin test on the kanban and custom
    fixtures seeded into `WINGFOIL_UI_STATE_DIR`: S-22.3 (developer on kanban, approver on custom,
    kept per project and across a restart), a role not held → 400; local-security rows for the new
    route (401/403).
