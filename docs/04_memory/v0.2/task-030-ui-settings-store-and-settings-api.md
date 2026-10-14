---
id: task-030-ui-settings-store-and-settings-api
type: task
title: "UI settings store and settings API"
status: done
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-09"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The UI settings of C4 in the local state store and their API: the `settings` keys, types,
defaults and ranges of spec-006 §2, the `actionLog` field with its cap (`actionLogCap`, trimmed
when the cap is lowered), `GET /api/settings` and `PUT /api/settings` (the whole object, RP-28),
and the `settings` event of spec-004 §6. Server foundation of wave 1 (RP-43).

**Backlog items:** TT-STATE-09

## Acceptance Criteria

- **TT-STATE-09** (REQ-STATE-09 — UI settings defaults): [boolean] A first start shows exactly these defaults; changing one takes effect within 120 s without a restart. *Verified by:* e2e.
  Scenarios (`@v0.2`): C-07.1, C-07.3, Y-07.2.
  Here: a first start (no `settings` in `state.json`, or a v0.1 file with `{}`) reads exactly the defaults of spec-006 §2; a stored value of the wrong type or out of range reads as its default, an unknown key is dropped at the next write (RP-39); `PUT` with any key missing, a wrong type or an out-of-range integer → 400 `invalid-request`, nothing stored; a valid `PUT` → 200 with the stored settings and one `settings` event; lowering `actionLogCap` trims the oldest `actionLog` entries in the same write (RP-38). The "within 120 s" part is proved by task-034-auto-sync-scheduler-and-auto-push (`test:timing` on Chromium; in `test:e2e`, C-07.3 runs with `fetchIntervalSeconds` = 15, RP-53).

e2e closure — scenarios that need a screen are proved here by API and unit tests and close in:
task-041-ui-settings-page-and-theme-setting: C-07.1, C-07.3; task-040-update-and-push-from-the-sidebar: Y-07.2.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-006` §2 (settings table, `actionLog`), §4 (lock, atomic write), §5 (no secret); `spec-004`
  §3 (`settings.schema.json`), §4 v0.2 note (`PUT /api/settings`: rows 1, 2, 4), §6 (`settings`);
  `contracts/state/state.schema.json` gains `settings` and `actionLog` shapes.
- RP-19 (`fetchIntervalSeconds` 15–3600, default 60), RP-26 (`actionLogCap` 100–100 000, default
  5 000), RP-28, RP-38, RP-39; RP-15 (`confirmAgentLaunch` stored, effective from WingFoil 0.3).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-13)

Read: this task; task-026's Execution Notes (the only `depends_on`, hard gate dl-015); plan
`release-planning-rel-v0.2-plan` RP-15, RP-19, RP-26, RP-28, RP-38, RP-39, RP-43, RP-53, RP-55;
`dev-loop-rel-v0.2-plan` Session 1 (W0-1 … W0-10, hand-overs); spec-006 §1–§6, spec-004 §1–§7,
adr-001 D5/D10, adr-002; SARD REQ-STATE-09; `ui-settings.feature` (C-07.1 … C-07.3),
`push.feature` (Y-07.2); the consumers task-032, task-034, task-040, task-041; `test/README.md`;
`server/src/state/` (`store.ts`, `schema.ts`, `file-store.ts`, `memory-store.ts`),
`server/src/http/` (`app.ts`, `role-view.ts`), `server/src/launcher/start.ts`, `server/src/events/bus.ts`,
`contracts/src/state.ts`, `events.ts`, `contracts/state/state.schema.json`,
`test/launcher/local-security.test.ts`, `test/contracts/state-schema.test.ts`,
`test/server/snapshot/support.ts`, `test/server/http/read-console.ts`.

**depends_on (task-026, dl-015).** Nothing of its product change (the clone hooks path) touches
this task. What constrains it: every new temporary folder follows `test/README.md` *Temporary
folders* (`TempWorkspace` for new suites, under the run's `wfui-run-*` root, W0-2); fresh-read
preconditions (W0-3) — a test that compares a re-read state asserts the change it relies on
first; `test:smoke` stays green (the packed install reads `contracts/api/settings.schema.json`,
already covered by `files: contracts/api/*.schema.json`); e2e per W0-9 (this task has no e2e
spec, see below).

#### AC classification

| AC part | kind | red-first test |
|---------|------|----------------|
| first start (no file, or a v0.1 file with `settings: {}`) reads exactly the spec-006 §2 defaults | **red-first** | `test/server/state/settings.test.ts` (normalisation), `test/server/http/settings.test.ts` (`GET` → the 7 defaults), `test/launcher/settings.test.ts` (bin, no state file; seeded v0.1 file) |
| a stored wrong type / out-of-range value reads as its default; an unknown key is dropped at the next write | **red-first** | `settings.test.ts` table (each key: wrong type, out of range, non-integer, `null`); `store.test.ts` + `file-store.test.ts` (unknown and invalid keys gone from `state.json` after a write, D30-2) |
| `PUT` with a key missing, a wrong type, an out-of-range or non-integer value, an extra key → 400 `invalid-request`, nothing stored, no event | **red-first** | `test/server/http/settings.test.ts` table (strict Ajv, no coercion: `"60"`, `60.5`, `14`, `3601`, `99`, `100001`, `theme: "blue"`, `null`, `[]`, missing each key) |
| a valid `PUT` → 200 with the stored settings, one `settings` event | **red-first** | `settings.test.ts` (route over the memory store + `InProcessEventBus`: exactly one event per valid `PUT`, none on a refusal); the bin test sees the event on `GET /api/events` |
| lowering `actionLogCap` trims the oldest `actionLog` entries in the same write (RP-38) | **red-first** | `store.test.ts` (cap 150 → 100 keeps the newest 100, order kept; raising the cap trims nothing) and `file-store.test.ts` (one write, file holds both) |
| contracts committed first (RP-43), checked against every response | **red-first** | `test/contracts/api-settings-schema.test.ts` (defaults and the spec example accepted; each invalid case refused) committed with the schemas, before the route; every route response in `settings.test.ts` validated with `settings.schema.json` |
| local-security rows (REQ-SEC-02/03) | **red-first** | `local-security.test.ts` rows for `GET`/`PUT /api/settings` (401, 403 origin, 403 cross-site, past the guards: `GET` 200, `PUT {}` 400) — 404 today |
| process audit | **red-first** (the routes start no process) | `test/server/http/settings.test.ts`: an app with the real `Snapshots` over an `AuditedRunner` and an open kanban snapshot; `GET`/`PUT` (and the `settings` event) start 0 processes (`count('git')`, `count('wingfoil')` unchanged) |
| "takes effect within 120 s" | out of scope | task-034 (`test:timing`; C-07.3 at 15 s in `test:e2e`, RP-53) |

The existing characterisation test `state-schema.test.ts` › "keeps settings and actionLog open
for v0.2 (no version bump)" (an `actionLog` entry `{ sha: 'abc' }` accepted) changes on purpose
under D30-1 (a) — rewritten, not deleted: `settings` stays open (any values, so a bad value reads
as its default instead of making the file corrupt), `actionLog` entries get their shape.

#### Contracts (committed first, RP-43)

- **`contracts/api/settings.schema.json`** (new) — the body of `GET` (200), of `PUT` (request)
  and of the `PUT` 200: draft-07, `type: object`, `additionalProperties: false`, all 7 keys
  `required`: `autoFetch`, `autoUpdate`, `autoPush`, `confirmAgentLaunch` booleans;
  `fetchIntervalSeconds` integer 15–3600; `actionLogCap` integer 100–100000; `theme` enum
  `system` | `light` | `dark`; each property with its spec-006 §2 default as `default` and a
  description. The schema is the single source of the ranges: the server's read normalisation
  validates each stored key against that key's sub-schema.
- **`contracts/state/state.schema.json`** — `settings`: still `type: object` with any values
  (description: known keys per `settings.schema.json`; a missing, invalid or unknown key never
  makes the file corrupt, spec-006 §2); `actionLog`: items `{ sha, at }`,
  `additionalProperties: false`, `sha` `^([0-9a-f]{40}|[0-9a-f]{64})$` (SHA-1 or SHA-256 object
  format), `at` the ISO 8601 UTC pattern of `addedAt` (D30-1).
- **`contracts/src/state.ts`** — new `UiSettings` (the 7 keys), `UiTheme`, `ActionLogEntry`
  `{ sha, at }`; `StateFile.settings` stays `Record<string, unknown>` (the stored, unvalidated
  form), `StateFile.actionLog: ActionLogEntry[]`. Exported from `contracts/src/index.ts`.
  `ServerEventMap.settings` already exists (`{}`); no change in `events.ts`.

#### File layout (planned)

- `server/src/state/settings.ts` (new): `DEFAULT_SETTINGS`, `readSettings(stored): UiSettings`
  (per-key validation against `settings.schema.json`, default otherwise), `storedSettings(stored)`
  (known valid keys only — what a write keeps, D30-2), `trimActionLog(log, cap)` (newest `cap`
  entries).
- `server/src/state/store.ts`: `StateStore.settings(): UiSettings` (from the last read);
  `StateStore.putSettings(next): Promise<UiSettings>` (one transaction: re-read, replace the whole
  object, trim `actionLog` to `next.actionLogCap`); `StateDraft` gains `settings: UiSettings` and
  `actionLog: ActionLogEntry[]` (D30-4); `#attempt` compares the normalised state (projects,
  `readSettings`, `actionLog`) to decide "changed" (a no-op still writes nothing and creates no
  directory) and, when it writes, writes `settings` as given by the draft (known keys) and the
  `actionLog` trimmed to the cap. `emptyState()` unchanged (`settings: {}`, `actionLog: []`).
  `schema.ts` `knownFields` unchanged in behaviour (it already keeps `settings` and `actionLog`).
- `server/src/http/settings.ts` (new): `SETTINGS_PATH = '/api/settings'`,
  `registerSettingsRoutes(app, { store, bus })`; `GET` → `await store.reload()` then
  `store.settings()` (D30-3); `PUT` → strict Ajv validator on `settings.schema.json` (no type
  coercion, as `role-view.ts`), `store.putSettings(body)`, `bus.publish({ event: 'settings', data: {} })`,
  200 with the stored settings. No identity, no project, no process (spec-004 §4 rows 1, 2, 4).
- `server/src/launcher/start.ts`: one appended line in `register` —
  `registerSettingsRoutes(routes, { store: state, bus });`.
- Docs: spec-006 Process Note for D30-1/D30-2/D30-3 (dated, "amended in dev-loop task-030") if
  approved as recommended; `test/README.md` version line (0.28) + one *Local state* sentence
  (settings tests, `settings` in a seeded `state.json` may be `{}`). No `CHANGELOG.md` entry: the
  API has no user-visible effect until task-041's page (it adds the user-facing line). No catalogue
  string (the error envelope's message is never shown, spec-008).

#### Test plan

| Suite | File | What |
|-------|------|------|
| contract | `test/contracts/api-settings-schema.test.ts` (new) | defaults and edge values (15, 3600, 100, 100000) accepted; every invalid case refused; `UiSettings` typed sample (type drift fails `typecheck`) |
| contract | `test/contracts/state-schema.test.ts` | `actionLog` entry shapes (SHA-1, SHA-256, bad sha, extra key, bad `at`); `settings` with invalid values still accepted |
| unit | `test/server/state/settings.test.ts` (new) | `readSettings` / `storedSettings` table per key; `trimActionLog` |
| unit | `test/server/state/store.test.ts`, `file-store.test.ts` | `settings()` on a fresh / v0.1 / invalid store; `putSettings` (re-read, whole object, trim in one write, no-op `PUT` with the same object writes nothing but still resolves); unknown/invalid keys dropped at the next real write, kept on a no-op; newer-version store: in memory only (D30-5); two file stores on one directory see each other's `PUT` after `reload()` |
| API | `test/server/http/settings.test.ts` (new) | `GET`/`PUT` over the memory store and an `InProcessEventBus`: 200 bodies validated by the schema; the 400 table (nothing stored, no event); one event per valid `PUT`; the trim; the process audit (0 processes) |
| bin | `test/launcher/settings.test.ts` (new) | the real bin with a test-owned state dir (`TempWorkspace`): first start → defaults (C-07.1 API side, Y-07.2 `autoPush: false`); a seeded v0.1 `state.json` (`settings: {}`) → defaults; a seeded invalid value → its default, then a `PUT` → the file holds only the known keys; `PUT` survives a restart (C-07.2 API side); one `settings` event on `GET /api/events` |
| local security | `test/launcher/local-security.test.ts` | new rows: `GET`/`PUT /api/settings` × {no session 401, foreign origin 403, cross-site 403, past the guards 200 / 400} |

e2e: none in this task (no screen). e2e closure table, as the task body says:

| Scenario | Proved here by | Closes (e2e) in |
|----------|----------------|-----------------|
| C-07.1 | `test/launcher/settings.test.ts` (first start → defaults), `settings.test.ts` | task-041-ui-settings-page-and-theme-setting |
| C-07.3 | `settings.test.ts` (a `PUT` stored and announced at once); the 120 s by task-034 | task-041-ui-settings-page-and-theme-setting |
| Y-07.2 | `test/launcher/settings.test.ts` (`autoPush` defaults to `false`) | task-040-update-and-push-from-the-sidebar |

Tech-spec check: spec-004 and spec-006 cover the routes, bodies, ranges, lock and event; no new
spec. Gaps D30-1 … D30-3 and D30-5 are clarifications of spec-006 §2/§4 (a dated Process Note
when decided); D30-4 is a task-boundary choice.

#### Shared files and shared shapes (parallel with task-031 and task-035)

Touched shared / append-only files:

- `server/src/launcher/start.ts` (the route registration of "app.ts" in RP-43): **one appended
  line** in `register`, after `registerProjectListRoutes`; no import reordering beyond adding one
  import line.
- `contracts/api/settings.schema.json` (new file, no conflict); `contracts/state/state.schema.json`
  (only this task); `contracts/src/state.ts` (types appended); `contracts/src/index.ts` (the
  existing `./state.js` export line extended — task-031 may add its own export lines elsewhere in
  the file).
- `test/launcher/local-security.test.ts`: one appended `describe`/`it.each` block (append-only).
- `test/README.md`: version line (0.28, task-030) + one sentence in *Local state* — merge hot spot,
  task-031 bumps the same line.
- Not touched: `web/` (no catalogue string, no `SCREENS`, no shell layout, no `queries.ts` /
  `projects.ts` — the web side is task-041's), `server/src/http/app.ts`,
  `test/server/http/read-console.ts` (the process audit builds its own app in the new test file).

New shared functions and types other tasks will use (to be fixed by the coordinator):

- **Types** (`@wingfoil-ui/contracts`): `UiSettings`, `UiTheme`, `ActionLogEntry`.
- **Store** (`server/src/state/store.ts`): `StateStore.settings(): UiSettings` — the effective
  settings as last read (task-034 reads them at each tick after `store.reload()`, task-032 reads
  `autoPush`); `StateStore.putSettings(next: UiSettings): Promise<UiSettings>`;
  `StateDraft.settings` / `StateDraft.actionLog` (task-032 appends `{ sha, at }` inside its own
  transaction, the cap applied by the store at write — D30-4).
- **Module** `server/src/state/settings.ts`: `DEFAULT_SETTINGS`, `readSettings`, `trimActionLog`.
- **Route** `server/src/http/settings.ts`: `SETTINGS_PATH`, `registerSettingsRoutes(app, { store, bus })`.
- **Event**: the bus event `{ event: 'settings', data: {} }` after every valid `PUT` (in-process:
  task-034's scheduler may subscribe to re-arm its timer, RP-40; it must compare
  `autoFetch`/`fetchIntervalSeconds` itself, the payload is empty).
- **Web** (for task-041, not added here): the query key `['settings']` (global, not under
  `queryKeys.project`) and a `settingsQuery` in `web/src/api/queries.ts`; the `settings` event
  invalidates it (`EVENT_NAMES` already lists `settings`). Proposed so task-041 and task-042 do not
  pick different keys.

#### Open decisions

- **D30-1 — shape of `actionLog` entries in `state.schema.json`** (spec-006 §2 defines `{sha, at}`
  but not what an invalid stored entry does). ★ (a) strict items (`sha` 40/64 lower-case hex,
  `at` ISO UTC, no other key): an invalid entry makes the file schema-invalid → kept as
  `state.json.corrupt-<UTC>` (spec-006 §4, as an invalid project entry; only a hand edit can
  produce one); (b) open array in the schema, invalid entries dropped at read (keeps the project
  list after a bad hand edit; a spec-006 §4 exception); (c) open array, entries kept as stored
  (the ratio script of task-032 copes).
- **D30-2 — when unknown and invalid stored settings keys are dropped** ("at the next write",
  RP-39). ★ (a) at the next write that changes something (a `PUT`, or any project-list or
  role-view change): the written `settings` holds only known keys with valid values, missing keys
  stay missing (read as defaults); a no-op still writes nothing (spec-006 §4); (b) only at the
  next `PUT /api/settings` (project writes copy `settings` untouched); (c) every write stores the
  whole normalised object with the defaults filled in (freezes today's defaults into every file
  that is written once, and needs the no-op comparison anyway).
- **D30-3 — `GET /api/settings` and a second console.** ★ (a) `GET` re-reads the state file first
  (`reload()`, as `GET /api/projects`), so a page of console B shows a `PUT` made through console
  A at its next read (no cross-console event: the `settings` event is per console); (b) serve the
  settings as last read by this console (B sees A's change only after its own next mutation or
  restart).
- **D30-4 — who appends to `actionLog`.** ★ (a) task-030 provides the shape and the cap
  (`StateDraft.actionLog`, trimmed to `actionLogCap` at every write, unit-tested here); task-032
  only pushes its `{sha, at}` entries inside a transaction; (b) task-030 also adds a store method
  `appendActions(entries)` (task-032 calls it; more API surface fixed before its user exists);
  (c) task-030 handles only the trim at `PUT`; task-032 implements append and cap.
- **D30-5 — `PUT` on a state written by a newer build** (read-only, spec-006 §4). ★ (a) as every
  other mutation of a read-only store: 200, the settings apply for this run only (in memory, not
  written), the `settings` event is sent; the shell already shows `state.newerVersion` ("changes
  are not saved"); (b) refuse with 409 and a new code (`state-read-only`): a spec-004 §5 addition
  and a catalogue string for task-041.

#### Decisions (approver, 2026-10-13)

"All as recommended": D30-1 (a), D30-2 (a), D30-3 (a), D30-4 (a), D30-5 (a). spec-006 amended in
place (§2 `settings` and `actionLog` rows, §4 reads and the newer-version rule) with a dated
Process Note for D30-1, D30-2, D30-3, D30-5. The shared shapes are fixed as stated above
(`UiSettings`, `UiTheme`, `ActionLogEntry`; `StateStore.settings()` / `putSettings()`;
`StateDraft.settings` / `actionLog` with the cap applied by the store; `registerSettingsRoutes` /
`SETTINGS_PATH`; the bus event `{ event: 'settings', data: {} }`); the web `settingsQuery` /
`['settings']` key is left to task-041. Shared files stay append-only (task-031 also appends to
`contracts/src/index.ts`, `local-security.test.ts` and the `test/README.md` version line; 030
merges first).

### red / green / refactor (2026-10-13)

- **Contracts first (RP-43)** — `d456041`: `contracts/api/settings.schema.json`, the `actionLog`
  item shape in `state.schema.json` (D30-1), `UiSettings` / `UiTheme` / `ActionLogEntry` in
  `contracts/src/state.ts` (exported by a new, appended line of `contracts/src/index.ts`).
  `api-settings-schema.test.ts` and the rewritten `state-schema.test.ts` rows; red check: against
  the previous `state.schema.json` the six new action-log refusal rows fail.
- **Red** — `215b90e`: `test/server/state/settings.test.ts`, the settings blocks of
  `store.test.ts` (both adapters) and `file-store.test.ts`, `test/server/http/settings.test.ts`
  (with the process audit): 21 failing tests plus two files that did not load (no module yet).
  The `file-store.test.ts` characterisation "keep settings and actionLog written by another build"
  was rewritten on purpose (its `{ sha: 'a1' }` entry is now invalid, D30-1; it now also shows the
  unknown and invalid keys dropped at a write, D30-2).
- **Green** — `server/src/state/settings.ts` (defaults, `readSettings`, `storedSettings`,
  `trimActionLog`, `validateSettings` — all from the schema), `store.ts` (`settings()`,
  `putSettings()`, `StateDraft.settings` / `actionLog`; "changed" judged on the effective settings,
  the projects and the trimmed log, so a no-op still writes nothing; a draft whose settings fail
  the schema is refused with `InvalidStateError`), `server/src/http/settings.ts`
  (`SETTINGS_PATH`, `registerSettingsRoutes`, strict Ajv validator as `role-view.ts`), one
  appended registration in `server/src/launcher/start.ts`. Then `test/launcher/settings.test.ts`
  (bin: defaults on a first start and on a v0.1 file, invalid stored value, restart, the event on
  `GET /api/events`, a second console — D30-3) and the appended settings block of
  `local-security.test.ts`. Red check of the bin tests: with the registration line disabled, 7 of
  the 9 settings tests fail (the two that pass are the 401/403 guard rows, which hold before routing).
- Process audit: `settings.test.ts` › "GET and PUT /api/settings start 0 processes" — an
  `AuditedRunner` registry with the kanban fixture open (precondition: opening it started
  processes); `GET`, a valid `PUT`, a refused `PUT` → 0 new processes, exactly one `settings` event.
- Deviations from the design: none in behaviour. `contracts/src/index.ts` got a new appended
  export line instead of an extended one (append-only, coordinator). spec-006 has no
  `Version`/`Date` line (its history is the *Process Notes*), so the amendment is recorded only by
  its dated Process Note. No new temporary-folder convention: new suites use `TempWorkspace`
  (`wfui-task-030-*`).

### checks (2026-10-13, HEAD before this note `302dc6a`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api` | OK | — |
| `check_tasks.py v0.2` | OK (17 tasks · 46 items) | — |
| `npm run test:coverage` (includes the public-text check) | 125 files passed, 1 skipped; **2149 passed / 1 skipped**; statements 96.81 %, branches 91.09 %, functions 97.42 %, lines 98.42 % | 8.5 → 21.1 |
| `npm run test:smoke` | **4/4 passed** | 19.3 → 15.8 |
| `npm run test:e2e:chromium` (regression; no e2e spec of this task) | **133 passed** (18.4 min) | 15.8 → 44.5 |
| `npm run test:timing` | **skipped**: load 44.5 (≥ 12) | 44.5 |

`wfui-*` entries in the system temporary directory: 2 before, 5 after — the 3 new ones are the
`wfui-run-*` / `wfui-e2e-run-*` roots of the concurrent runs of task-031 and task-035 (owner pids
alive in those worktrees) and the pre-existing `wfui-no-hooks-*`; none from this worktree; no
console of this worktree left running.

### review (round 1, 2026-10-13)

Independent review: **FAIL** (2 minor, 2 nits); the rest verified (ACs, D30-1 … D30-5, the
schema as single source, strict `PUT` including `__proto__`, `1e300` and a 2 MB body, locking,
local-security rows, test hygiene).

- **F1 (minor)** — a `PUT` with the same values in another key order rewrote `state.json` (the
  no-op was judged by `JSON.stringify`, key order included) and stored the keys in the client's
  order. Change: `settingsToStore(stored, before, next)` in `server/src/state/settings.ts`
  compares key by key over the schema's key list and builds the written object in the schema's
  order; `putSettings` answers `readSettings(...)` (schema order). Red first: `file-store.test.ts`
  › "F1 — … another key order writes nothing" (mtime unchanged) and "… writes the keys in the
  schema order", `settings.test.ts` (route) › "review F1 — …" (the store's snapshot compared byte
  for byte; `toEqual` alone passed on the old code, so the assertion was tightened) — all failed
  on the previous `store.ts`/`settings.ts`, pass now.
- **F2 (minor)** — a newer build's `state.json` whose `actionLog` items carry more fields failed
  the schema in `knownFields` and fell back to an empty state (projects lost). Change:
  `knownFields` (`server/src/state/schema.ts`) reads each entry for `sha` and `at` and leaves out
  the entries still not of this version's shape; a version-1 file stays strict (D30-1). Red first:
  `file-store.test.ts` › "F2 — a newer build's richer action log keeps the file readable"
  (projects read, read-only, `state.newerVersion`, the file untouched) failed before; "D30-1
  stays" shows the same entry in a version-1 file is still corrupt.
- **F3 (nit)** — `putSettings` returns the settings from inside its transaction.
- **F4 (nit)** — decided: a write stores only the keys whose effective value changed plus those
  already stored with a valid value (consistent with D30-2 "a missing key stays missing"); a `PUT`
  follows the same rule (on a `{}` file a `PUT` changing `autoPush` stores `{ autoPush }`; the
  other keys still read as their defaults). `StateDraft.settings` TypeDoc and spec-006 §2/§4 (the
  2026-10-13 Process Note, review addendum) say so. Tests: `file-store.test.ts` › "F4 — a draft
  changing one setting writes that key only" (red before), `settings.test.ts` (unit) ›
  `settingsToStore` rows, and the bin test's expected file content (`{ autoPush, theme }`).
  `storedSettings` is replaced by `settingsToStore`.
- Checks after the fixes (`d11d19c`): `typecheck`, `lint`, `format:check` clean; `docs:api` OK;
  `check_tasks.py v0.2` OK; targeted `test/server/state`, `test/server/http/settings.test.ts`,
  `test/launcher/settings.test.ts`, `test/contracts`: all passed; `test:coverage` 125 files passed,
  1 skipped, **2157 passed / 1 skipped**, statements 96.82 %, branches 91.11 %, functions
  97.43 %, lines 98.43 % (load 15.2 → 21.7).

### review (round 2, 2026-10-13)

- Independent fresh-context review: round 1 **FAIL** (2 minor, 2 nits), round 2 **PASS** on
  `4607754`: F1–F4 re-verified with the original probes; edge cases probed (a key set back to its
  default is written explicitly; an invalid stored key dropped at an unrelated write; two consoles
  PUT concurrently → whole-object last-writer-wins under the lock, spec-006 §4). Nits N1 (re-wrap
  of the spec-006 §4 newer-version bullet) and N2 (spec-006 §2 `actionLog` row cross-reference to
  §4 for a newer build's file) fixed by the coordinator.
