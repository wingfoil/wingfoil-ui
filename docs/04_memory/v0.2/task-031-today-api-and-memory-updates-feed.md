---
id: task-031-today-api-and-memory-updates-feed
type: task
title: "Today API and Memory updates feed"
status: in-progress
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-PERF-11"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The Today output of spec-003 §5 served by `GET /api/p/:pid/today?view=<role>` — Requires you,
Waiting on others and the all-roles summary — with `actor.basis` (spec-003 §8), and the Memory
events feed `GET /api/p/:pid/events/memory?before=&limit=` for the bell's *Updates* (spec-004 §3,
spec-002 §1, §3). Builds on the existing placement (`server/src/descriptor/placement.ts`) and the
project-wide event parse (`server/src/git/memory-log.ts`). Server foundation of wave 1 (RP-43).

**Backlog items:** TT-PERF-11

## Acceptance Criteria

- **TT-PERF-11** (REQ-PERF-11 — Display limits): [numeric] Bell *Updates*: last 10 Memory events; all-roles summary: ≤ 3 items per role plus "N more". (v0.2 scope: *Recent activity* is a v0.3 card.) *Verified by:* e2e.
  Scenarios (`@v0.2`): S-21.1, S-23.4.
  Here: `summary[].items` holds at most 3 rows and `more` = `count − 3` when positive, else 0; `summary` is absent for a single-role member and for an unidentified user; `events/memory` defaults to `limit` 10, newest first, with `more`.

- Today output (spec-003 §5): for every fixture (kanban, custom, unknown) and every role view of
  each member, `requiresYou` equals the elements placed in Requires you by `placement()` in the
  §5 order (rejected work first, then oldest in state); `waitingOnOthers` excludes them (T-11.3);
  an unidentified user gets `view` and `requiresYou` `null` and Waiting on others computed as for
  a member holding no role (RP-27); `?view=` not in `roleViews` → 400 `invalid-request`.
- A warm `GET …/today` starts 0 processes (snapshot cache, `adr-001` D6).

e2e closure — S-21.1, S-23.4 close in task-042-notification-bell-all-roles-summary-and-empty-today; the Today rows close in task-036-today-requires-you-and-waiting-on-others.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-003` §5 (Today output, hand transitions declared waiting — RP-13), §8 (`actor.basis`:
  `submitter`, `creator`, `last-transition`); `spec-004` §3 (`today.schema.json`,
  `memory-events.schema.json`); `spec-002` §1, §3 (§4 incremental parse is v0.3, RP-9).
- The descriptor schema change (`actor.basis`) touches `contracts/api/descriptor.schema.json`;
  task-033-git-copy-state-repository-status-and-transport-routes later adds the copy-state reasons' computation (codes already in the schema).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-13)

Read: this task; `CLAUDE.md`; the Execution Notes of `depends_on`
task-026 (design, decisions, red/green/refactor, reviews); `release-planning-rel-v0.2-plan` RP-3,
RP-4, RP-9, RP-11, RP-13, RP-27, RP-43, RP-53, RP-55; `dev-loop-rel-v0.2-plan` session 1 (W0-1 …
W0-10, hand-overs); spec-002 (§1–§5), spec-003 (§1–§9), spec-004 (§1–§7, v0.2 addendum);
adr-001 D6; the scenarios T-01.1/T-01.2, T-02.x, T-03.x, T-04.x, T-05.x, T-06.x, T-07.x,
T-11.1–T-11.3, S-21.1–S-21.3, S-23.1–S-23.4; TT-PERF-01, TT-PERF-11 (backlog `v0.2.json`);
tasks 033, 035, 036, 042 (consumers); v0.1 task-010 and task-012 hand-overs (`derived`, snapshot
view, events per HEAD); code: `server/src/descriptor/{descriptor,placement}.ts`,
`server/src/git/memory-log.ts`, `server/src/snapshot/snapshot.ts`,
`server/src/http/{app,project-routes,role-view}.ts`, `server/src/launcher/start.ts`,
`server/src/identity/identity.ts`, `contracts/api/descriptor.schema.json`,
`contracts/src/{api,descriptor}.ts`; tests: `test/server/descriptor/{placement.test,standard}.ts`,
`test/server/http/project-routes.test.ts`, `test/server/snapshot/{support,process-audit.test}.ts`,
`test/launcher/local-security.test.ts`, `test/README.md`.

**depends_on (dl-015 hard gate) — task-026, acknowledged.** New test files use the run's
temporary root and `TempWorkspace` (W0-2, `test/README.md` *Temporary folders*), no new
`wfui-*` entry left in the system temporary directory; every "after a change" assertion first
asserts the precondition (D26-3: the HEAD / state key moved, or did not, before the process count
or the body is compared). No clone, launcher or packaging change, so `clone.ts` (W0-1) and
`test:smoke` are untouched (smoke runs at the wave gate). e2e: none in this task (W0-9 does not
apply). RP-9's "after one commit" Today run on the large fixture is task-036's (its TT-PERF-01
timing row), not this task's; this task gives it the route.

#### AC classification

| AC | kind | first test |
|----|------|------------|
| TT-PERF-11 (server side: `summary` ≤ 3 items + `more`, absent for single-role / unidentified; `events/memory` default 10, newest first, `more`) | **red-first** | `test/server/descriptor/today.test.ts` (pure, S-23.3, S-23.4 with 5 synthetic `pending` gates, S-23.1 Alex 7 lines) and `memory-log.test.ts` (page); API in `today-routes.test.ts`. Fails today: no module, no route. |
| Today output (§5) on kanban/custom/unknown, every member × role view; T-11.3 exclusion; unidentified (RP-27); `?view=` not held → 400 | **red-first** | `today.test.ts` on the captured samples (exhaustive: every member of `memberByName` × each of their roles, plus Riley/no identity) and `today-routes.test.ts` on built fixtures (each member via `git config user.email` on the copy, every role view; the body equals the rows `placement()` gives in `compareRequiresYou` order, and hand-written rows for T-01.1, T-02.1, T-03.1, T-04.1, T-05.1, T-05.2, T-06.1/2, T-11.1–3). |
| `actor.basis` (spec-003 §8) | **red-first** | `descriptor.test.ts` + `standard.ts` oracle (kanban `task-002` `submitter`, `task-004` `creator`, a `work` state `last-transition`; absent on the fallback and on role/engine/none actors); the contract test over built fixtures inherits it from `STANDARD`. |
| Warm `GET …/today` starts 0 processes (adr-001 D6) | **red-first** for the route; the cache mechanism is v0.1's (characterization) | `test/server/snapshot/process-audit.test.ts` (appended `describe`): cold Today ≤ 3 `wingfoil` processes (`memory search`, `dna show`, `--version`) and exactly 2 `git log`; warm Today 0 processes; another role view on the same state 0; `events/memory` after Today 0; after one commit (HEAD asserted moved first) again 2 `git log`. |
| Schemas committed first and checked on every response (RP-43) | **red-first** | every API test body validated against `today.schema.json` / `memory-events.schema.json` (Ajv over `contracts/`, as `project-routes.test.ts`). |
| `local-security.test.ts` rows (REQ-SEC-02/03) | **characterization** (honest: an unknown `/api/` path already answers 401/403/404 through the guards and the not-found handler, so these rows pass before the route exists) | rows appended to `READ_ROUTES`; plus the order row "unknown pid with an invalid query → 404, not 400". |

#### Shapes (contracts first, RP-43)

`contracts/api/today.schema.json` (`$id` `…/contracts/api/today.schema.json`):

```
{ view: string | null,
  requiresYou: [ActionRow] | null,
  waitingOnOthers: [Row],
  summary?: [{ role: string, count: integer ≥ 0, items: [ActionRow] (maxItems 3), more: integer ≥ 0 }] }
Row       = { element: { id, type, title, status, localChanges: boolean }, descriptor: $ref descriptor.schema.json }
ActionRow = Row & { action: "submit" | "rework" | "review" | "approve" | "resolve" }
```

`contracts/api/memory-events.schema.json`: `{ events: [Event], more: boolean }`, `Event` = spec-002
§1 `{ sha, timestamp, author, operation ∈ add|submit|approve|reject|deprecate, type, id, from:
string|null, to: string|null, approver: string|null, reason: string|null }`, all required,
`additionalProperties: false`.

`contracts/api/descriptor.schema.json`: `actor.basis` `enum ["submitter", "creator",
"last-transition"]`, optional (the `$ref`s of `elements`/`element` pick it up).

TypeScript (`contracts/src/`, appended, exported from `index.ts`): `ActorBasis`,
`DescriptorActor.basis?`; `TodayAction` (moved from `RequiresYouAction` of `placement.ts`, which
re-exports it), `TodayElement`, `TodayRow`, `TodayActionRow`, `TodaySummaryLine`, `Today`;
`MemoryEventEntry`, `MemoryEventsPage`.

#### File layout

- `server/src/descriptor/descriptor.ts`: `actorOf` returns `basis` with a member actor (the three
  rules of §4); nothing else changes.
- `server/src/descriptor/today.ts` (new, pure): `today(rows, identity, view)` →
  `Today` from the listed elements with their descriptors, the identity (`Identity` of
  `identity.ts`) and the role view; uses `placement()` / `compareRequiresYou()`; builds `summary`.
  `memoryEventsPage(events, { before, limit })` → `MemoryEventsPage` (in `server/src/git/memory-log.ts`).
- `server/src/snapshot/snapshot.ts`: the per-HEAD event cache keeps the flat, newest-first list
  next to the per-element map (same two git processes, same key); `SnapshotView.eventLog()` added,
  `events()` unchanged for its callers.
- `server/src/http/project-routes.ts`: two handlers and two `route(...)` lines appended at the end
  of `registerProjectRoutes` (reusing `ProjectRead`, `X-Repo-State`, the 404 for an unknown pid and
  the refusal mapping). Query parameters are validated **in the handler**, after the pid lookup, so
  an unknown pid answers 404 before any 400 (spec-004 §4 order; the `route` helper's
  Fastify `querystring` schema would answer 400 first). Descriptors of the non-archived elements
  are memoised per state with `view.derived('descriptors', …)` so every role view and the summary
  reuse one computation. **No change to `app.ts` or `start.ts`** (the routes ride the existing
  `registerProjectRoutes`), no new event-stream event (the `repo` event already invalidates
  `['p', pid, …]`).
- Only non-archived elements (`memory search`, cached) are placed: archived ones are final (actor
  `none`), so no archived search runs.
- No `web/` change; no catalogue string.

#### CLI / git budget and caching

Cold `GET …/today` (first read of a state): `memory search`, `dna show`, `--version` (3 CLI, the
same reads as the Memory list, within TT-PERF-05's ≤ 6), `memory.yaml` (file), `git log -p` + sha
list (2 git), plus the state check every first view does. Warm (same `<generation>:<state>:<email>`
key): **0 processes** for Today in any role view and for `events/memory`. A new HEAD: 2 `git log`
again (full parse, spec-002 §4 / RP-9); a working-tree-only change re-runs the CLI reads (memo key)
but not the git log (keyed by HEAD).

#### Test plan

| Suite | File | What |
|-------|------|------|
| unit | `test/server/descriptor/today.test.ts` (new) | exhaustive member × view on the three samples; named scenarios; summary limits; unidentified; T-11.3 |
| unit | `test/server/descriptor/descriptor.test.ts`, `standard.ts` | `basis` |
| unit | `test/server/git/memory-log.test.ts` (appended) | `memoryEventsPage`: default 10, `more`, `before` cursor, limits |
| API | `test/server/http/today-routes.test.ts` (new; not appended to `project-routes.test.ts`, to stay off a hot file) | schemas, rows per member/view on built fixtures, `?view=` 400, 404 before 400, `X-Repo-State`, events newest first = `git log` order, degraded inputs (D31-3), descriptor equal to `GET /elements`' |
| process audit | `test/server/snapshot/process-audit.test.ts` (appended `describe`) | cold/warm counts above |
| local security | `test/launcher/local-security.test.ts` (appended rows) | `/today`, `/today?view=approver`, `/events/memory`, `/events/memory?limit=5`, `/events/memory?limit=0` (404 on an unknown pid) |
| e2e | none | S-21.1, S-23.4 close in task-042; the Today rows in task-036 |

`test/README.md`: suite rows and version line (append-only). `CHANGELOG.md`: no entry (no
user-visible change; tasks 036/042 add theirs).

#### Tech-spec check

spec-003 §5/§8 and spec-004 §3 give the shapes; the gaps below (D31-1 … D31-6) need the
approver. Once decided, spec-004 §3 (the `before`/`limit` rules) and spec-003 §5 (Waiting on others
order, degraded inputs, roleless member) are amended in place with a dated Process Note.
Observation, outside this task: the existing `GET …/elements?archived=<bad>` on an unknown pid
answers 400 before 404 (Fastify querystring schema) — spec-004 §4's order table is written for
writes, so it may not be a defect; reported to the coordinator, not changed.

#### Shared files (parallel with task-030, task-035; consumed by task-036, task-042, task-033)

| File | Change | Rule |
|------|--------|------|
| `contracts/api/descriptor.schema.json` | `actor.basis` added (task-033 later adds the copy-state reasons' computation, codes already there) | edit one property |
| `contracts/api/today.schema.json`, `memory-events.schema.json` | new | committed first |
| `contracts/src/api.ts`, `contracts/src/descriptor.ts`, `contracts/src/index.ts` | types appended at the end (task-030 appends its settings types to the same files) | append-only |
| `server/src/http/project-routes.ts` | two handlers + two `route(...)` lines at the end | append-only |
| `server/src/snapshot/snapshot.ts` | event cache carries the flat list; `eventLog()` | local edit |
| `server/src/descriptor/descriptor.ts`, `placement.ts` | `basis`; `RequiresYouAction` → re-export of `TodayAction` | local edit |
| `test/server/snapshot/process-audit.test.ts`, `test/server/git/memory-log.test.ts` | appended `describe` | append-only |
| `test/launcher/local-security.test.ts` | `READ_ROUTES` entries appended | append-only (RP-55) |
| `test/README.md` | suite rows + version line | append-only, hot spot |
| `server/src/http/app.ts`, `server/src/launcher/start.ts`, `web/**`, `web/src/i18n/en.json`, `web/src/api/queries.ts` | **not touched** | — |

New shared names for consumers: the types above; `GET /api/p/:pid/today?view=` and
`GET /api/p/:pid/events/memory?before=&limit=`. Proposed (D31-6) web keys for task-036/042:
`queryKeys.project(pid, 'today', { view })` and `queryKeys.project(pid, 'events', 'memory',
{ limit })`; the web passes the header's `roleView` as `view` (omits it when `null`) so the bell
(042) and Today (036) share one cache entry.

#### Open decisions

- **D31-1 — `before` of `events/memory`** (spec-004 names it, no semantics). ★ (a) the `sha` of
  the oldest event the client holds, exclusive (the events after it in the newest-first order);
  a sha not in the log (history rewritten) → 400 `invalid-request`, the client starts again from
  the top; (b) an ISO timestamp, exclusive (author dates are not monotonic in git order: pages
  could skip or repeat events); (c) not implemented in v0.2 (the bell uses `limit` only; 400 when
  given), defined by the v0.3 Timeline task.
- **D31-2 — `limit` bounds.** ★ (a) an integer 1 … 100, default 10; anything else → 400
  `invalid-request`; (b) 1 … 50; (c) any positive integer (a client could ask the whole log of
  the large fixture, 2 000 commits, in one body).
- **D31-3 — Today when an input fails** (the element list degrades with `typesError` /
  `eventsError`; spec-003 §5 has no such fields). ★ (a) no partial Today: the refusal of the
  failed read — 502 `read-error` for `memory.yaml`, the CLI envelope (422/502/504) for
  `memory search` / `dna show`, 500 `internal` for the Memory events (details in the log): without
  events every actor falls back to `tech-lead`, without the DNA the user looks unidentified, so a
  partial list would put wrong rows in Requires you; (b) as `/elements`: 200 with optional
  `typesError` / `eventsError` / `dnaError` and lists from what was read (schema and spec-003 §5
  amended; the web must show the warning); (c) (a) for `memory.yaml` and the DNA, (b) for the
  events. `events/memory` itself: 502 `read-error` (`memory.yaml`), 500 `internal` (git) in every
  option.
- **D31-4 — order of Waiting on others** (spec-003 §5 orders Requires you only). ★ (a) the same
  comparator (rejected first, then longest in the current state, then id) — the longest-blocked
  item first, deterministic; (b) the `memory search` order; (c) by id.
- **D31-5 — `?view=` and identity edge cases.** ★ (a) an unidentified user with any `?view=` →
  400 `invalid-request` (`roleViews` is empty, spec-004 literal); a member whose DNA entry has no
  role → `view: null`, `requiresYou` = the rows whose member actor is them (an array: they are
  identified), no `summary` (spec-003 §5 "`null` when not identified" amended to "`view` `null`
  when there is no role view"); (b) `?view=` ignored for an unidentified user; roleless member as
  (a); (c) a roleless member treated as unidentified (`requiresYou: null`).
- **D31-6 — web query factories.** ★ (a) this task adds the `contracts` types only; task-036
  adds `todayQuery` (key `queryKeys.project(pid, 'today', { view })`) and task-042
  `memoryEventsQuery` (key `queryKeys.project(pid, 'events', 'memory', { limit })`) to
  `web/src/api/queries.ts`, keys fixed now; (b) this task adds both factories to `queries.ts` now
  (a server task touching a web hot spot, with no consumer to test them).

#### Decisions (approver, 2026-10-13)

"All as recommended": D31-1 (a), D31-2 (a), D31-3 (a), D31-4 (a), D31-5 (a), D31-6 (a). The
shared shapes are fixed as proposed (the `contracts` types, `TodayAction` moved out of
`placement.ts`, `actor.basis` in `descriptor.schema.json`, no new event-stream event; the web
queries are task-036's and task-042's with the keys named above). The observation on
`GET …/elements?archived=<bad>` answering 400 before 404 on an unknown pid stays as it is
(spec-004 §4's order table is written for writes); noted here only. Amended in place with dated
Process Notes: spec-004 §3 (`before`, `limit`) and spec-003 §5 (Waiting on others order, no
partial Today on a failed input, a member with no role, an unidentified user with `?view=`).
task-030 merges first; `main` is merged into this branch before submit.

### red / green / refactor (2026-10-13)

- **Contracts first (RP-43)** — `e6398b0`: `contracts/api/today.schema.json`,
  `memory-events.schema.json`, `actor.basis` in `descriptor.schema.json`; types in a new
  `contracts/src/today.ts` (not in `api.ts`, so that task-030's appends there cannot collide) and
  `ActorBasis` in `descriptor.ts`; `index.ts` gets two export blocks at its end (append-only).
- **`actor.basis`** — `d344f05`. Red first: the `standard.ts` oracle and two synthetic rows of
  `descriptor.test.ts` expected `basis` — 7 failures before `descriptor.ts` changed, 50/50 after.
  The contract test over built fixtures (`descriptor-contract.test.ts`) uses the same oracle.
- **Today and the events page (pure)** — `206ec4b`. `server/src/descriptor/today.ts` (`today()`,
  `SUMMARY_ITEMS`); `memoryEventsPage()`, `MEMORY_EVENTS_LIMIT`, `MEMORY_EVENTS_MAX_LIMIT` in
  `memory-log.ts`. Red first: `today.test.ts` failed to load (no module); the four page tests of
  `memory-log.test.ts` failed (`memoryEventsPage is not a function`). `RequiresYouAction` of
  `placement.ts` is now an alias of the contracts' `TodayAction`. The snapshot's per-HEAD event
  cache keeps the flat newest-first list next to the per-element map (`SnapshotView.eventLog()`).
- **Routes** — `8aaaa7f`. Two handlers appended to `project-routes.ts` (no `app.ts`/`start.ts`
  change); query parameters checked in the handlers after the pid lookup. Order of the Today
  reads: `dna show` (its refusal), then the `?view=` check (a 400 costs no `memory search` on a
  cold cache), `memory.yaml`, the events, `memory search`. The rows are memoised per state
  (`derived('today rows')`). `ProjectRead.log` became readonly-public for the events refusal.
  The route tests were written right after the handlers, so they were not red on their own;
  negative check instead: with the two `route(...)` lines removed, `today-routes.test.ts` (the
  Morgan and `limit` tests) failed, 2/2; restored.
- **Audits and rows** — `387e789`: `process-audit.test.ts` — cold Today **3 CLI processes**
  (`dna show`, `--version`, `memory search`) and 5 git (2 `git log`); warm Today, the seven role
  views of Alex and `events/memory`: **0 processes**; after an empty commit (the new state key
  asserted first) `events/memory` runs exactly 2 `git log`. `local-security.test.ts`: six
  `READ_ROUTES` entries appended (98 passed). `test/README.md` 0.28.
- Observation kept as is (approver, 2026-10-13): `GET …/elements?archived=<bad>` on an unknown pid
  answers 400 before 404 (Fastify querystring schema); spec-004 §4's order is written for writes.
- No deviation from the design otherwise. No web change, no catalogue string, no new event.

### checks (2026-10-13, HEAD `30d2a0e`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `lint`, `format:check` | clean | — |
| `npm run test:coverage` | 123 files passed, 1 skipped; **2090 passed / 1 skipped**; statements 96.84 %, branches 91.25 %, functions 97.43 %, lines 98.46 % | 36.4 → 39.9 |
| `npm run docs:api` | OK | — |
| `check_tasks.py v0.2` | OK | — |
| public-text check (`test/docs/public-text.test.ts`) | 67 passed | — |
| `npm run test:e2e:chromium` (regression; no e2e spec of its own) | **133 passed** (14.0 min) | 38.1 → 22.0 |
| `npm run test:timing` | **skipped**: load 19.5 (≥ 12) | 19.5 |

`wfui-*` entries in the system temporary directory after the runs: the 1 pre-existing
`wfui-no-hooks-*` (an earlier v0.1 run); none of this task's; no console left.

e2e closure — none in this task: S-21.1, S-23.4 close in task-042; the Today rows (T-xx) in
task-036. Hand-over to task-036/042: `todayQuery` key `queryKeys.project(pid, 'today', { view })`,
`memoryEventsQuery` key `queryKeys.project(pid, 'events', 'memory', { limit })`; pass the
header's `roleView` as `view` (omit when `null`); `actor.basis` → "Jordan (submitter) must act";
a Today refusal (502 `read-error`, CLI codes, 500 `internal`) is shown as an error, never as
"Nothing requires you". The `memory search` warnings and message are not part of Today
(spec-003 §5): an element the CLI skipped as malformed is silent on Today (the Memory list shows
the warning).

### review (round 1, 2026-10-13)

Independent review: **FAIL** (1 minor, 4 nits); code and tests otherwise verified against D31-1 …
D31-6 (budget, cache keys, `before` never reaching git, the partition, the summary); the
substitute red check of the route tests accepted.

- **F1 (minor)** — spec-003 §5 shape block: `view` "null when not identified" contradicted the
  new bullet, the code and the contracts → "null when there is no role view (not identified, or a
  member holding no role)"; noted in the same Process Note.
- **F2** — `today-routes.test.ts` *no partial Today*: a `memory search` refused by the CLI (a
  stand-in runner, exit 1) → 422 `cli-refused`.
- **F3** — `process-audit.test.ts`: after the new HEAD, `/today` runs exactly 2 `git log`, then
  `events/memory` shares them (0 more).
- **F4** — `today-routes.test.ts`: option-like `before` values (`--all`, `..%2F..`, `-p`,
  `HEAD`, a range) → 400 with 0 processes (events warmed first).
- **F5** — hand-over line above: `memory search` warnings and message are not part of Today.

- Checks after the fixes: `typecheck`, `lint`, `format:check` clean; `today-routes.test.ts`,
  `process-audit.test.ts`, public-text check: 85 passed (3 files); `check_tasks.py v0.2` OK. No
  server code changed, so `test:coverage` was not re-run.

### review (round 2, 2026-10-13)

- Independent fresh-context review: round 1 **FAIL** (1 minor, 4 nits), round 2 **PASS** on
  `1e2f8fb` (no finding): F1–F5 re-verified; the warmed-up 0-process check proves an option-like
  `before` never reaches git; `/today` and `events/memory` share one event cache per HEAD.
