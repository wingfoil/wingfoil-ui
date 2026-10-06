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
  - Refusals, in the spec-004 §4 order: unknown `:pid` → 404 `not-found` (checked before the body is
    parsed, in the route's `onRequest` hook — corrected at review); body failing its schema → 400
    `invalid-request`; user not identified as exactly one member (not in team, no email, ambiguous) → 403 `not-in-team`; a role the member
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

### red / green / refactor (2026-10-05)

- **Red** (`ebb9d3a`): `test/server/identity/{identity,git-email,project-identity}.test.ts`,
  `test/server/http/role-view.test.ts`, `test/contracts/api-identity-schema.test.ts`,
  `test/launcher/role-view.test.ts` — all failed on the missing modules (`Cannot find module
  '…/server/src/identity/identity.js'`, `'…/http/role-view.js'`). The three new rows in
  `test/launcher/local-security.test.ts` (`PUT …/role-view` → 401 / 403 / 404 on an unknown id)
  passed at once: the guards and the JSON 404 already existed — characterization, as they should.
- **Green** (`ce28ab9`):
  - `contracts/src/api.ts` (`Identity`, `IdentityView`, `RoleViewRequest`, exported by the package
    index), `contracts/api/identity.schema.json`, `contracts/api/role-view.request.schema.json`.
  - `server/src/identity/identity.ts` — pure `matchIdentity(email, members)`,
    `identityView(identity, storedRoleView)`, `directivesForRoleView(entries, role)`.
  - `server/src/identity/git-email.ts` — `readGitEmail(root, { runner, git, env?, signal? })`
    (`git config --get user.email`; exit 1 / blank → `undefined`; any other end →
    `GitConfigError` without git's stderr), `findGit({ env?, platform? })` (absolute `PATH`
    entries, executable check on POSIX, `git.exe` on Windows).
  - `server/src/identity/project-identity.ts` — port `IdentitySource.identify(project, signal?)`,
    adapter `createLocalIdentitySource({ runner, env?, logger? })` (`findGit` once per source,
    `discoverCli` + `ProjectReads.dna()` and the git email in parallel, fresh on every call),
    `projectIdentityView(source, entry)` → `IdentityView`, `GitNotFoundError`.
  - `server/src/http/role-view.ts` — `registerRoleViewRoute(app, { store, identity })`; the
    project lookup is a route `onRequest` hook (an unknown id is 404 even with an unparsable body);
    the body is validated by a strict Ajv of its own (Fastify's default validator coerces `3` to
    `"3"` and drops extra properties); CLI failures through `cliErrorEnvelope`; `store.update` only.
  - `server/src/launcher/start.ts` — `buildApp({ register })` registers the route with the opened
    state store and a local identity source over the launcher's process runner (one localized
    block).
- **Deviations:** none from the ACs. The refusal of a role not held (400 `invalid-request`) and
  the 204 are decisions of this task (design note): spec-004 §4 has no row for the former —
  **spec gap for the coordinator** (proposed wording in the design note). `PUT role-view` runs git
  and `dna show` to know the member's roles: rows 1–6 of spec-004 §4 "start no process" are written
  for governed writes; once task-010's watched identity exists the route should use it instead.
- **Load:** the full runs saw only the two known bug-001 timing tests fail (load 47–75 on 12
  cores, `/proc/loadavg`); in one run three `beforeAll` hooks also timed out (fixture build in
  `test/harness/fixtures.test.ts`, the 10 s console start in two `local-security.test.ts`
  describes), and the two files re-run alone passed 38/38 (load 57).
- **Checks** (HEAD after this note): `npm run -s typecheck`, `lint` clean · `format:check` "All
  matched files use Prettier code style!" · `docs:api` OK · `npx vitest run --coverage
  --coverage.reportOnFailure`: 47 files, **619 passed / 2 failed (bug-001) / 1 skipped**,
  coverage **96.34 %** statements / 89.8 % branches / 96.46 % functions / 98.21 % lines
  (`server/src/identity` 98.38 % statements, 100 % lines; `http/role-view.ts` 92 % / 100 % lines) ·
  `test:e2e` 3/3 · `check_tasks.py` OK. Task files alone: 71/71 (identity units, route, schemas,
  fixture integration, bin).
- **Hand-overs:**
  - **task-012** (`GET /api/p/:pid`): embed `await projectIdentityView(identity, store.get(pid)!)`
    — shape `IdentityView` / `contracts/api/identity.schema.json` (`$ref` it from the header
    schema). The source is created in `runLauncher` (`createLocalIdentitySource({ runner:
    processes, logger })`); share one instance between the PUT route and the header (move it to a
    `const` next to `state` when registering both). Map `CliError` / `CliNotFoundError` with
    `cliErrorEnvelope`; `GitConfigError` / `GitNotFoundError` are 500 `internal`. Read-only reason
    = `identity.kind !== 'member'`; the ambiguous warning names `identity.members`.
  - **task-010** (cache, watcher, events): the effective email for the cache key is
    `readGitEmail(root, { runner, git })` (`findGit` resolves `git`; reuse it for every git read
    rather than a second resolver); a `repo` event is due when it changes (S-12.3) and when the DNA
    changes (S-13.3, S-15.3 — a HEAD/working-tree change). Wrap `IdentitySource` with the cached
    snapshot so `PUT role-view` and spec-004 §4 row 5 read the watched identity, not a fresh one.
  - **task-016** (screens): selector shown when `roleViews.length > 1`; `roleView` is already the
    effective one (fallback applied on read); after `PUT` (204) refetch `GET /api/p/:pid`. Badges /
    notices from `identity.kind` (`not-in-team` with `email`, `no-identity` with the command
    `git config user.email <your email>`, `ambiguous` with "`email` matches N members: names").
  - **task-019** (Directives view): "only mine" = `directivesForRoleView(entries, roleView)`
    (bound or global; `[]` without a role view, R-06.4) — the bin test checks it equals
    `directives list --role developer` on the custom fixture.
  - **task-008**: the project-list routes register next to the role-view route in the same
    `register` callback of `runLauncher`.

### review (2026-10-05)

- Independent review, round 1: **PASS** with findings, fixed on this branch:
  - 1 (minor) inherited `GIT_DIR`/`GIT_WORK_TREE`/… made `git config --get user.email` read another
    repository: `readGitEmail` now runs git with `gitConfigEnv(env ?? process.env)`, which drops
    `REPOSITORY_LOCATING_VARIABLES` (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`,
    `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_NAMESPACE`,
    `GIT_CEILING_DIRECTORIES`, `GIT_DISCOVERY_ACROSS_FILESYSTEM`; case-insensitive) and keeps
    `HOME`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`. Real-git test: with `GIT_DIR`/`GIT_WORK_TREE`
    pointing at another repository, plain git reads riley's email and `readGitEmail` reads the
    project's jordan. Only the identity reads changed: the process runner and the CLI environment
    are not (coordinator's scope — **hand-over:** the `wingfoil` processes, and git reads of
    task-010, still inherit those variables).
  - 2 exact pid: `kanban.id.toUpperCase()` and the id with a leading/trailing space (encoded) → 404.
  - 4 characterization rows with a known pid: malformed JSON → 400, a `__proto__` key → 400
    (Fastify's proto-poisoning check), `application/xml` → 415, `text/plain` → 400 (Fastify parses
    text bodies; the schema refuses a string) — the identity source never called, nothing stored.
  - 5 `identify` gets an `AbortSignal` aborted when the client goes before the answer (listener on
    the response `close`, removed once `identify` settles); in the adapter a failed read aborts the
    parallel one, and the caller's signal aborts both (tests with a hanging fake runner on a real
    fixture copy).
  - 6 only a found `git` path is cached (test: `PATH` empty → `GitNotFoundError`, then fixed →
    member).
  - 7 design note corrected (`onRequest`, not `preValidation`). 8 TSDoc of `email` and of
    `RoleViewRouteOptions` fields; the local-security header comment wrapped.
- Checks: affected files (`test/server/identity`, `test/server/http/role-view.test.ts`,
  `test/contracts/api-identity-schema.test.ts`, `test/launcher/role-view.test.ts`,
  `test/launcher/local-security.test.ts`) all pass — 96 tests, then `role-view.test.ts` 20/20 after
  the last fix (load 35–50) · typecheck, lint clean · format:check clean · `docs:api` OK.
- Round 2: **PASS** with two nits, fixed: (a) a read cancelled because the client disconnected no
  longer reaches the application error handler (which logged `request failed` at error level and
  tried a 500 on a closed socket): the route logs it at debug and hijacks the reply. Test over a
  real socket (`role-view.test.ts`, "client gone"): the request destroyed while the identity read
  waits → 0 log lines at error level, nothing stored; without the fix it fails (one level-50
  line). (b) the corrected design-note line wrapped. Checks: `role-view.test.ts` 21/21 ·
  typecheck, lint, format:check clean.

### integration (2026-10-06)

- `main` (tasks 006 and 011 done, Wave 2 spec amendments 90d4f81 + d4338a9 — spec-004 §3
  identity addendum, §4 row 5a and rows per write kind — bug-002) merged into the branch.
  Conflicts: `contracts/src/index.ts` (all export blocks kept), `test/README.md` (0.9). The
  REQ-ARC-05 lint rule of task-011 reports nothing on this task's code.
- Full gates on the merge, load 30–39: typecheck, lint, format:check clean; `test:coverage` 844
  passed, 1 skipped, coverage 96.92 % statements / 91.76 % branches; `docs:api` OK; `test:e2e`
  3/3; `check_tasks.py` OK.
- Left for the task-010 merge (bug-002): this task's local git-environment cleaning in
  `server/src/identity/git-email.ts` is replaced by task-010's shared `gitEnv()` /
  `resolveGit()` (one helper, one git resolver). task-012 switches the identity to the watched
  state (`view.state.email`, AC added on main).
- Reviews: round 1 PASS (3 minor + 6 nit fixed), round 2 PASS (2 nit fixed).
