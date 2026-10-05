---
id: task-010-snapshot-cache-and-live-updates
type: task
title: "Snapshot cache and live updates"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-001-timing-tests-fail-under-external-machine-load"]   # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Working-tree snapshot and cache keyed on HEAD and the working-tree status hash, the local-changes marker per element, batched CLI reads, the repository watcher and the per-page event stream that invalidates views without polling (adr-001 D6, spec-004 §5 `X-Repo-State`, §6).

**Backlog items:** TT-STATE-02, TT-STATE-01, TT-PERF-03, TT-PERF-05, TT-INT-09

## Acceptance Criteria

- **TT-STATE-02** (REQ-STATE-02 — Cache keyed on HEAD and working-tree status): [boolean] A unit test shows a cache miss after a commit and after a working-tree edit, a cache hit when neither changed, and a new identity after a change of `user.email`. *Verified by:* unit.
  Scenarios (`@v0.1`): S-26.1, S-26.3.
- **TT-STATE-01** (REQ-STATE-01 — Working-tree snapshot and local changes): [boolean] For every element file listed by `git status --porcelain`, the element carries the marker; for every other element it does not. *Verified by:* unit · e2e.
  Scenarios (`@v0.1`): S-25.1, S-25.2, S-25.3.
- **TT-PERF-03** (REQ-PERF-03 — Refresh after an external change): [numeric] Change → view updated within 5 s in 20 out of 20 trials. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-25.2, S-26.1, S-26.2, S-27.2, S-12.3, S-13.3, S-15.3.
- **TT-PERF-05** (REQ-PERF-05 — Batched CLI reads): [numeric] Opening Today on a cold cache starts ≤ 6 CLI processes; reopening any view with no commit and no working-tree change starts 0. v0.1 (no Today): opening the Memory list on a cold cache starts ≤ 6 CLI processes. *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-26.3.
- **TT-INT-09** (REQ-INT-09 — Server ↔ browser live updates): [boolean] With one page open and no change for 60 s, the server starts 0 CLI processes; after a change the page updates without a reload (REQ-PERF-03). *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-26.1, S-26.2.

- **bug-001-timing-tests-fail-under-external-machine-load** (absorbed, dl-045 — this task owns the
  performance measurements TT-PERF-03/05): the timing-bound tests (REQ-PERF-06 start test, the
  TypeDoc build test, and this task's TT-PERF measurements) run in a separate sequential test
  project/script, excluded from the default `test`/`test:coverage` gates, executed on a quiet
  machine and reporting the load average with each measurement; the TypeDoc build test removes its
  temporary directory even on timeout. Verified: `npm run test:coverage` passes with load average
  > 40 from external processes; the timing script passes at low load and prints the load.
e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-12.3, S-13.3, S-15.3; task-017-memory-list-and-live-refresh: S-26.1, S-26.3, S-25.1, S-25.2, S-25.3, S-26.2; task-019-dna-directives-and-team-views: S-27.2.

## Implementation Notes

- `adr-001` D6; `spec-004` §5–6; `adr-002` (event bus, repository watcher ports).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-003 Execution Notes read (review included) — routes
  added through `buildApp({ register })` are guarded automatically, `GET /api/events` included
  (cookie or Bearer, Host/Origin, `Sec-Fetch-Site`); every new `/api/` route adds its 401/403 rows
  to `test/launcher/local-security.test.ts`; tests calling `buildApp` pass `security`. task-005
  Execution Notes read (review included) — `ProjectReads` is uncached by design ("caching and
  batching are the caller's"); `element(id)`/`directive(id)` re-run the list command: the cached
  view uses `elementFromMatch`/`directiveFromEntry` on the cached list; S-25.1's marker half is
  this task's; never log `DirectReadError.message`. Wave 1 hand-overs also taken: task-004 —
  re-run `discoverCli` when `node_modules/wingfoil/package.json` changes, git reads through the
  runner (30 s default); task-007 — none for this scope. task-008 (after this task) builds the
  project list on this cache: the API and a hand-over note are left at refactor.
- **Specs:** `adr-001` D6 (cache keyed on HEAD, status hash and effective `user.email`; file
  watching + periodic check), D9; `adr-002` ports *Event bus* (in-process emitter feeding the SSE
  streams) and *Repository watcher* (file watching + periodic check); spec-004 §5 (`X-Repo-State:
  <HEAD sha>.<status hash>`), §6 (`GET /api/events`, SSE, 25 s heartbeat comment, events `repo
  {pid, state}`, `projects`, `settings`, `write`, `agent`); REQ-STATE-01/02, REQ-PERF-03/05,
  REQ-INT-06 (git reads `rev-parse`, `status --porcelain`, `config user.email` only), REQ-INT-09.
  No gap blocking the work; details the specs leave open, decided here without changing an
  interface: the status hash is the first 16 hex digits of SHA-256 over the porcelain entries; an
  unborn HEAD is 40 zeros; `repo.state` is the `X-Repo-State` value; the stream opens with a
  `retry` hint and a comment line.
- **Design (ports and adapters):**
  - `server/src/git/` — `GitReads` over the process runner: `git status --porcelain=v2 --branch
    -z --untracked-files=all` (HEAD from `# branch.oid`, the entries hashed and parsed, renames
    and untracked files included: one process for HEAD and the working tree),
    `git config user.email` (exit 1 = no identity), `git rev-parse --show-prefix
    --absolute-git-dir --git-common-dir` once per project (what to watch, porcelain paths →
    project paths). `git` is resolved to an absolute path on the `PATH` once.
  - `server/src/snapshot/` — `RepoState` (`head`, `statusHash`, `key`, `email`, `changed`: the
    project-relative paths of the porcelain entries); `ProjectSnapshot` per project: the last
    checked state, `check()` (2 git processes; serialised and coalesced), `view()` → a
    `SnapshotView` bound to one state whose reads are memoised per key
    `<CLI generation>:<state key>:<email>` and shared by concurrent callers (one CLI process per
    command and state, REQ-PERF-05): `version`, `dna`, `paths`, `workflows`, `directives`,
    `elements` (each match with `localChanges`), `archivedElements`, `history`, `memoryTypes`,
    `element(id)`, `directive(id)`; deterministic failures (CLI refusal, output and read errors)
    are memoised for the state, process failures and timeouts are not. `discoverCli` runs once per
    CLI generation; a change under `node_modules/wingfoil` starts a new generation.
    `RepositoryWatcher` port + local adapter (`fs.watch`: the project root and its top-level
    directories except `.git`/`node_modules` recursively, `node_modules` and
    `node_modules/wingfoil`, the git dir and common dir, the global git configuration's folders;
    events debounced, then `check()`), plus a periodic check (fallback, default 10 s, git only).
    `Snapshots` registry by project id; a changed state publishes `repo {pid, state}`.
  - `server/src/events/` — `EventBus` port + in-process adapter; `server/src/http/events.ts` —
    `GET /api/events` (hijacked reply, `text/event-stream`, heartbeat 25 s, closed in the stop
    sequence); `repoStateHeader(state)` for read routes (task-012). Event types in
    `contracts/src/events.ts`.
  - Wiring in `runLauncher`: one bus, one `Snapshots` (the launcher's runner), the stream route,
    stop hooks (streams, watchers). No project route here (task-012); tests register stand-ins.
- **Where reads are fresh:** a read request uses the last checked state (0 processes on a warm
  view, S-26.3); the state moves only by the watcher or the periodic check. Writes (v0.2,
  spec-004 §4 rows 7–9) must call `check()`/git directly under the write lock, never the cached
  state.
- **AC classification (T1):**
  - TT-STATE-02 — **red-first** unit (real git + pinned CLI on kanban, watcher off, counting
    runner): hit with no change; miss after a working-tree edit and after a commit; new identity
    (state `email`, new memo) after `git config user.email`; parser units on porcelain v2 `-z`.
  - TT-STATE-01 / S-25.1–S-25.3 (API half) — **red-first** unit: every element whose file is in
    porcelain carries `localChanges`, every other does not (modified title read as the working
    tree, staged, untracked new element, renamed); committed → marker gone.
  - TT-PERF-05 / S-26.3 — **red-first** process audit through stand-in routes on `buildApp`
    (the reads the Memory list needs: header, config, elements): cold ≤ 6 `wingfoil` processes,
    reopen 0 processes. Not timing-bound: stays in the default suite.
  - TT-INT-09 — **red-first**: one SSE stream open on the bin-like app, 60 s with no change → 0
    `wingfoil` processes (git checks of the fallback counted and reported); then a change → `repo`
    event and new data without reconnecting. Default suite (counts, not timing).
  - TT-PERF-03 — **red-first**, timing suite: 20 trials (commit through the CLI, working-tree
    edit, `user.email`, DNA edit), each change → `repo` event → refetched data ≤ 5 s.
  - bug-001 — **characterization** of the move (the tests exist): timing tests in
    `test/timing/*.timing.test.ts`, run by `npm run test:timing` (own Vitest config, files
    sequential, `/proc/loadavg` printed with each measurement), excluded from `test` and
    `test:coverage`; the TypeDoc test aborts its process and removes its temp dir in `afterAll`
    even on timeout (red-first: a timeout test proves the cleanup). Own commits.
