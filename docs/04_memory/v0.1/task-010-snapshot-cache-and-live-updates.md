---
id: task-010-snapshot-cache-and-live-updates
type: task
title: "Snapshot cache and live updates"
status: in-review
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-001-timing-tests-fail-under-external-machine-load", "bug-002-inherited-git-variables-redirect-git-and-cli-reads-to-another-repository"]   # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Working-tree snapshot and cache keyed on HEAD and the working-tree status hash with content fingerprint, the local-changes marker per element, batched CLI reads, the repository watcher and the per-page event stream that invalidates views without polling (adr-001 D6, spec-004 §5 `X-Repo-State`, §6).

**Backlog items:** TT-STATE-02, TT-STATE-01, TT-PERF-03, TT-PERF-05, TT-INT-09

## Acceptance Criteria

- **TT-STATE-02** (REQ-STATE-02 — Cache keyed on HEAD and working-tree status): [boolean] A unit test shows a cache miss after a commit and after a working-tree edit, including a second edit of an already-modified file, a cache hit when neither changed, and a new identity after a change of `user.email`. *Verified by:* unit.
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
- **bug-002-inherited-git-variables-redirect-git-and-cli-reads-to-another-repository** (absorbed, dl-045, decided by the user
  2026-10-06 — this task owns the shared git module): one helper (`gitEnv(env)`) drops the
  repository-locating and config-injecting `GIT_*` variables (case-insensitive) and keeps `HOME`,
  `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`; it is applied to every git read and to the `wingfoil`
  CLI processes started by the process runner. Verified: with `GIT_DIR`/`GIT_WORK_TREE` of another
  repository exported in the server's environment, git reads (state, markers, `user.email`) and a
  CLI read answer for the project folder (unit + integration tests on the fixtures).
e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-12.3, S-13.3, S-15.3; task-017-memory-list-and-live-refresh: S-26.1, S-26.3, S-25.1, S-25.2, S-25.3, S-26.2; task-019-dna-directives-and-team-views: S-27.2.

## Implementation Notes

- `adr-001` D6; `spec-004` §5–6; `adr-002` (event bus, repository watcher ports).
- `spec-001` §4.4 (hash-only reads; REQ-ARC-04 exception — the task-005 fs-spy test must stay green).

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

### red / green / refactor (2026-10-05)

- **bug-001 (own commits):** red `8c7cbf7` — `test/harness/temp-workspace.test.ts`: with the
  removal-only stub (what the TypeDoc test did) a process still writing into the folder recreated
  it, and the second removal failed `ENOTEMPTY`. Green `a402be6`: `TempWorkspace` (aborts its
  processes — `run()` gained `signal` — waits for them, then removes the folder); timing suite
  `test/timing/*.timing.test.ts` + `vitest.timing.config.ts` (files sequential, the load printed at
  start and with every measurement, `silent: false` added in `12f3016` because Vitest hides the
  console of passed tests), script `npm run test:timing`, excluded from `test`/`test:coverage`
  (`vitest.config.ts`); moved there: REQ-PERF-06 (from `test/launcher/launcher.test.ts`) and the
  TypeDoc full build (from `test/docs/api-docs.test.ts`; the undocumented-export check stays in
  the default suite with a 120 s timeout, it is a correctness test). Cleanup on timeout checked
  by hand: `--testTimeout=5000` on the build test → timed out, no new `/tmp/wfui-typedoc-*` (diff
  of the folder list before/after empty). `test/README.md` 0.7: *Timing suite* section.
- **Red** `23c8142`: every new file failed on the missing modules (`server/src/git/git.js`,
  `events/bus.js`, `snapshot/*.js`); the bin's `GET /api/events` answered 404 where 200 was
  expected (task-003's X-02.1 line now checks the stream opens with the cookie).
- **Green** `ec23305`: as designed. `server/src/git/git.ts`, `server/src/snapshot/{state,snapshot,
  snapshots,watcher}.ts`, `server/src/events/bus.ts`, `server/src/http/events.ts`,
  `contracts/src/events.ts`; `runLauncher` creates the bus, `Snapshots` (its runner, its logger) and
  the stream, and closes streams and watchers in a stop hook before the processes are terminated.
  `ProjectReads.directive` now uses the exported `directiveInForce`, shared with the view.
  Test bugs fixed during green (not code changes to pass): a racy subscriber count in
  `events.test.ts`; the discovery test found `wingfoil` on the `PATH` after `removeCli` — it now
  runs with `envWithoutWingfoil`; the REQ-PERF-03 email trials set the same address twice (no
  change, so no event: the "Infinity" trials of the first timing run), now alternating (`12f3016`).
- **AC → tests:**
  - TT-STATE-02 — `test/server/snapshot/snapshot.test.ts` "hits with no change, misses after a
    working-tree edit and after a commit, new identity after user.email" (counting runner, watcher
    off); plus concurrent views (one process per command), cached `element(id)`/`directive(id)`/
    `history(id)`, refusal kept per state (S-27.1/S-27.2 API side), CLI generation, `repo` events,
    coalesced checks; parser and commands in `test/server/git/git.test.ts`, keys in
    `state.test.ts`; detection in `watcher.test.ts` (edit, commit, repository and global
    `user.email`, new top-level folder, `node_modules/wingfoil`, closed → no process, the periodic
    check with watching off).
  - TT-STATE-01 / S-25.1–S-25.3 (API half) — `snapshot.test.ts` "the local-changes marker": the
    marker equals membership in `git status --porcelain` (computed independently by the test) for
    every element, on a clean copy, with a modified title (read as the working tree), a staged
    edit, an untracked new element, a rename; none after the commit.
  - TT-PERF-05 / S-26.3 — `test/server/snapshot/process-audit.test.ts` over the stand-in routes:
    cold Memory list **5 CLI processes** (`--version`, `dna show`, `memory search`, `paths`,
    `workflow list`; 5 git), reopened twice **0 processes** (git included), same `X-Repo-State`.
  - TT-INT-09 — same file: one stream open, 60 s idle → **0 CLI processes** (12 git: the periodic
    check, 2 per 10 s), no event; then a commit outside the UI → `repo` on the open stream, the
    refetch shows the new title, marker off, new `X-Repo-State`.
  - TT-PERF-03 — `test/timing/live-refresh.timing.test.ts` (timing suite): 20 trials (CLI approve
    in a terminal, working-tree edit, commit, `user.email`, DNA edit) → **20/20 ≤ 5 s, max
    2339 ms** (load average 41–47 on 12 cores: not a quiet machine — the coordinator re-runs it at
    low load).
  - bug-001 — see above; `npm run test:coverage` passed with external load > 40 (below).
- **Deviations (honest):**
  - TT-PERF-05 and TT-INT-09 stay in the default suite: they count processes and events, which
    load does not change; only TT-PERF-03 is timing-bound (the bug AC says "this task's TT-PERF
    measurements" go to the timing suite — TT-PERF-05 is a count). To be confirmed by the
    coordinator.
  - The ACs are "e2e (process audit)": no project route exists yet (task-012), so they are proved
    through stand-in routes registered by the tests on the real `buildApp` (guards included), the
    real snapshot, CLI, git and watcher, and the real stream — not through the bin. The screens
    close in task-017 (as listed).
  - The periodic check runs git (status + `user.email`) every 10 s per open project; "0 CLI
    processes" is read as 0 `wingfoil` processes (REQ-INT-09 "pages never poll the CLI"; REQ-STATE-02
    requires the periodic check). The git count is reported, not asserted.
  - A CLI change (`node_modules/wingfoil`, gitignored) publishes `repo` with the unchanged state:
    the page refetches though `X-Repo-State` did not move.
  - ~~Cold Memory list starts 5 git processes … a watcher event caused by the CLI's own git
    reads~~ — wrong diagnosis, corrected at review (F4): concurrent first views each started a
    first check; now shared, cold = 3 git (asserted).
- **Hand-overs:**
  - **task-012 (read routes):** `const snapshot = await snapshots.open(pid, entry.path)`, then
    `const view = await snapshot.view()` per request; read through the view (`version`, `dna`,
    `paths`, `workflows`, `directives`, `elements`/`archivedElements` with `localChanges`,
    `history`, `memoryTypes`, `element(id)`, `directive(id)`); set
    `reply.header(REPO_STATE_HEADER, repoStateHeader(view.state))` (`snapshot/state.ts`). Pass the
    launcher's `snapshots` (created in `runLauncher`, next to `bus`) to the routes' `register`.
    Never call `ProjectReads` directly from a route (no cache). Add the routes' 401/403 rows to
    `local-security.test.ts`. Re-run the TT-PERF-05 / TT-INT-09 audits
    (`test/server/snapshot/process-audit.test.ts`) against the real routes instead of the
    stand-ins (review F8).
  - **task-008 (project list):** `snapshots.open(pid, path)` when a project is first read,
    `snapshots.close(pid)` on `DELETE /api/projects/:pid`; a missing CLI is a `CliNotFoundError`
    from any CLI read of the view (cached per CLI generation, re-discovered when
    `node_modules/wingfoil` changes) → `availability: 'cli-not-found'`; publish `projects {}` on the
    same `bus` (`bus.publish({ event: 'projects', data: {} })`). `open()` of a folder that is not a
    git repository rejects with `GitReadError` (git's message). `GitReads`/`resolveGit`
    (`server/src/git/git.ts`) hold the read allow-list; the clone/transport commands of REQ-INT-06
    are task-008's to add there. `gitEnv` (applied by the process runner to every child) also
    strips `GIT_CONFIG_PARAMETERS`/`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>`
    (`git -c` and env-injected settings such as proxy or credential helpers), the legacy
    `GIT_CONFIG`, `GIT_CEILING_DIRECTORIES` and `GIT_DISCOVERY_ACROSS_FILESYSTEM`: a transport
    command that needs such a setting must pass it explicitly (`-c` arguments of an allow-listed
    command), never through the inherited environment (review round 2, R6).
  - **task-009 (identity):** the effective `user.email` is `view.state.email` (repository, else
    global; watched, a change publishes `repo`): match it against `dna.team` from `view.dna()`
    instead of running `git config` again.
  - **v0.2 writes:** spec-004 §4 rows 7–9 must read git fresh under the write lock
    (`snapshot.check()` returns a fresh state), never `current()`; after a write publish `write`.
  - **task-017 (web):** one `EventSource('/api/events')` per page; on `repo` with the page's `pid`,
    invalidate that project's queries; on reconnect, refetch all; compare `X-Repo-State`.
  - **Coordinator:** run `npm run test:timing` on a quiet machine before merging (REQ-PERF-06 and
    the TypeDoc build fail at load ≈ 55–65, as before).
- **Checks** (worktree, HEAD after this note): `npm run -s typecheck`, `lint` clean ·
  `format:check` "All matched files use Prettier code style!" · `docs:api` OK · `npm run -s
  test:coverage` **47 files passed, 1 skipped; 592 passed / 1 skipped**, 447 s, coverage **95.62 %**
  statements / **87.36 %** branches / 95.58 % functions / 97.96 % lines (`server/src/snapshot`
  91.37 %, `git.ts` 98.66 %, `http/events.ts` 100 % statements) — at load average **70.00** at start,
  71.74 at the end, samples 48.9–78.4 (31 samples, `/proc/loadavg`), external load (other
  project's builds) ≈ 60–65 before the run · `test:e2e` 3/3 · `check_tasks.py` OK ·
  `npm run test:timing` at load 55–65: REQ-PERF-03 (before the email fix) and REQ-PERF-06 (max
  3986 ms) and the TypeDoc build (30 s timeout) failed — load; REQ-PERF-03 re-run alone after the fix
  at load 41–47: passed, max 2339 ms.

### review round 1 fixes (2026-10-06)

- Review of `769ab22`: **FAIL** (1 blocker, 2 major, minors, nits). The user decided (coordinator,
  options a): TT-PERF-05/TT-INT-09 stay in the default suite; the deviations above are accepted;
  the state key = porcelain hash + a content fingerprint computed in Node (REQ-STATE-02 /
  spec-004 §5 amended on `main`); the `GIT_*` inheritance is **bug-002**, absorbed here.
- **Red** `b590da0` (failing for the expected reasons): F1 — a second edit of a modified tracked
  file and of an untracked file gave the same key (`a386e92…` twice), no `repo`, title still
  "First"; F2 — `gitEnv` missing, `GIT_DIR`/`GIT_WORK_TREE`/`GIT_CONFIG_KEY_0` redirected
  `GitReads` (status `[]`, injected email); F3 — `memoryTrees`/injectable watch/`degraded` missing;
  F4 — concurrent first views 5 git instead of 3; F9 — a missing CLI never looked for again.
- **Green** `5b74678`:
  - F1 `server/src/snapshot/fingerprint.ts`: for every status entry, SHA-256 of the file content
    (≤ 1 MiB, the first 1000 entries), size + mtime (ns) beyond, the link target for a symlink
    (never followed), `missing`; 16 files read at once; combined with the porcelain hash into the
    same 16 hex digits — `X-Repo-State` format unchanged, no git command added. **Cost** (quiet
    machine, load ≈ 3, 4 KiB files, median of 5): 1 entry 0.3 ms · 10 entries 0.3 ms · 100 entries
    2.8 ms · 1000 entries 26.6 ms · 2000 entries 38.2 ms (max 42.7 ms). Note: these reads go
    beyond the REQ-ARC-04 direct-read allow-list (hash only, nothing kept or exposed) — the
    user's decision (18); the fs-spy test covers the read facade, not the check.
  - F2 `gitEnv(env)` in `server/src/git/git.ts` (case-insensitive; keeps `HOME`,
    `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`), applied by `GitReads`; test with `GIT_DIR`,
    `GIT_WORK_TREE` and a `GIT_CONFIG_KEY_0` injection on a real repository.
  - F3 watch scope: recursive watches only on `.wingfoil/` and the element folders of
    `memory.yaml` (`memoryTrees`: static part of each type's path pattern, nested ones dropped,
    re-evaluated on `.wingfoil/` and root events), the nearest existing parent of a missing one
    (not recursive); root, `node_modules`, `node_modules/wingfoil`, git dirs, global config folders
    as before. A failed watch other than ENOENT/ENOTDIR (ENOSPC, EMFILE, an error event) calls
    `degraded(reason)`: warn log, periodic check at `DEGRADED_FALLBACK_MS` = 2 s. `open()` awaits
    `watcher.ready` (the folders are found asynchronously; an edit right after open was missed).
    Edits under `dist/` start no process (test). `closed` renamed `stopped` (task-011 lint).
  - F4 `state()` returns the in-flight first check; cold Memory list = 3 git (asserted).
  - F5 the TT-PERF-05 warm half runs with the periodic check at 1 h (watcher on).
  - F6 (bug-001 part) no tight timing bound left in the default suite: `adapter.test.ts` TT-INT-04
    — `CliTimeoutError` with elapsed ≥ 29 s and < 39 s (the stub sleeps 40 s; `CLI_TIMEOUT_MS` =
    30 s asserted separately); `runner.test.ts` — kills bounded by `KILLED_WELL_BEFORE_MS` = 20 s
    (the children sleep 60 s); `start.test.ts` — the stop hook before the drain by relation
    (`stoppedAt − hookAt ≥ 250 ms`, total < 10 s) instead of < 100 ms.
  - F7 `/api/events` on the bin: foreign Host without Origin (403), duplicate Host (403), wrong
    token (401), previous start's token and session (401).
  - F8 hand-over added (task-012 above). F9 at each check, when the current CLI generation found no
    CLI, discovery runs again (files only); found → new generation and a `repo` event.
  - Nits fixed: a failed `resolveGit` is not cached; `close(pid)` during an in-flight `open`
    waits for it and closes what it registered; the check-failure warn logs `{ pid, kind, ended,
    exitCode }` only; an SSE stream with more than 1 MiB unflushed is ended (the page reconnects);
    the harness `run()` sends SIGKILL 2 s after SIGTERM on abort (`TempWorkspace` test with a
    SIGTERM-ignoring child); TypeDoc run timeouts below the test timeouts (100 s < 120 s, 28 s <
    30 s). **Left (listed):** no cap on the number of open streams (spec-004 has no refusal code
    for it); the periodic check runs while no stream is subscribed; a re-rooting `open()` racing an
    outside `close()` can still register the new root.
- **bug-002** (own commits): red `36ec2e8` — the runner passed `GIT_DIR`, `GIT_WORK_TREE`,
  `GIT_CONFIG_KEY_0` through (request env and the server's own); `memory history
  task-001-login-form` on kanban with `GIT_DIR` set to another repository: 0 entries. Green
  `5e7714a` — `LocalProcessRunner` spawns every child with `gitEnv(request.env ?? process.env)`:
  the CLI answers for its own project (history entries, `memory search` lists its elements).
  `GitReads` keeps applying it too (a fake runner). task-009's local helper to be unified at merge.
- **Checks** (quiet machine, load 2.4–6.6 on 12 cores): typecheck, lint clean · format:check clean
  · `docs:api` OK · `npm run -s test:coverage` **50 files passed, 1 skipped; 612 passed / 1
  skipped**, 85.6 s, coverage 94.98 % statements / 86.15 % branches / 95.07 % functions /
  97.44 % lines (load 3.29 → 6.64) · `test:e2e` 3/3 · `check_tasks.py` OK · **`npm run test:timing`
  3/3 at load 6.27–5.52**: REQ-PERF-06 187–287 ms; TypeDoc build 3963 ms; REQ-PERF-03 20/20, max
  367 ms. Process audits: cold Memory list 5 CLI + 3 git, warm 0; 60 s idle 0 CLI, 12 git.

### review round 2 follow-ups (2026-10-06)

- Review round 2: **PASS with follow-ups**, fixed here (load 25–57 on 12 cores during this pass,
  other projects' builds):
  - R1 (own commit `8c7db17`, red first: `GitReads.email()` answered `legacy@example.test`): the
    legacy `GIT_CONFIG` is also dropped by `gitEnv`; `hostileEnv()` of `git-env.test.ts` sets it,
    with an assertion on `GitReads.email()` and on the runner's child environment.
  - R2 `Fingerprinter` (one per snapshot): a file's mark is cached by path with its `lstat` (size,
    mtime ns, inode) and re-read only when that changes — a mark that fell back to size+time keeps
    it while the stat holds (no `stat:` → `sha:` promotion, hence no spurious `repo` event: found
    while measuring); at most `MAX_FINGERPRINT_BYTES_PER_CHECK` = 8 MiB of new content read per
    check; only entries under the project prefix. Tests: re-read on change only, budget, stable
    fingerprint with nothing read on the next check, prefix. **Measured** (load ≈ 53–57, so
    inflated; 1st check / next unchanged checks, median of 5): 100 × 4 KiB 123 ms / 8 ms (0 read);
    1000 × 4 KiB 1531 ms / 297 ms (0 read, 1000 `lstat`); 1000 × 1 MiB 120 ms (8 files read) /
    119 ms (0 read). Round 1's quiet-machine figure for 1000 × 4 KiB was 27 ms.
  - R3 `memoryWatchPlan(root)` → `{ trees, unwatched }`: a type whose path pattern has no static
    folder (`{release}/{id}.md`, `{id}.md`) is listed and the watcher reports itself degraded
    (`no static folder in the path pattern of: …`, once per distinct list) → 2 s periodic check.
    `memoryTrees` stays (the trees only). Test on a `memory.yaml` with two such types.
  - R4 `watchTrees` takes a generation; all awaits come first, and a call superseded by a later
    one neither adds nor drops a watch. Test: a slow stale plan overtaken by a root event's fresh
    plan leaves only the fresh watches.
  - R5 test: a fake `watchRepository` calling `degraded` with the periodic check off → the change is
    seen by the 2 s check (bound `DEGRADED_FALLBACK_MS` + 6 s for load).
  - R6 task-008 hand-over above. `/tmp/wfui-rev-oCHAvP` removed.
- Checks: typecheck, lint clean · format:check clean · `docs:api` OK · affected tests
  (`test/server/snapshot`, `test/server/git`, `test/server/process/git-env.test.ts`) 59/59 at load
  ≈ 50. `test:timing` not run (load).

### review round 3 follow-up (2026-10-06)

- Review round 3: **PASS**, one follow-up. N1 — the fingerprint cache reused a mark whenever
  size + mtime ns + inode were unchanged, so a same-size rewrite within one mtime tick (FAT 2 s,
  HFS+ 1 s, network mounts, `touch -r`, `cp -p`) was missed. Red (its own commit): a rewrite with
  the mtime restored read 0 files. Fix: git's "racy git" rule — a mark taken less than
  `RACY_WINDOW_MS` = 3 s after the file's mtime is flagged racy and not trusted: the entry is read
  again at each check until a mark is taken past the window, then reused. Clock injectable
  (`Fingerprinter(topLevel, prefix, { now })`); test with a fake clock: mark taken 1 s and 1.5 s
  after mtime → re-read, the rewrite seen; mark taken past the window → reused (0 reads). The
  R2 tests use a clock past the window (they write their files just before). Cost: a freshly
  edited file is re-read by the checks of its first 3 s only.
- Checks: typecheck, lint clean · format:check clean · `docs:api` OK · `test/server/snapshot`
  42/42 at load ≈ 31–42.

### integration (2026-10-06)

- `main` merged into the branch (authorized by the coordinator for this step): merge `cd5dc2a`
  (tasks 006, 009, 011, Wave 2 spec amendments; the task's front part — bug-002 AC and `bug:`
  entry, wording — taken from `main`, the Execution Notes kept).
- **Conflicts:** `contracts/src/index.ts` — every export block kept (api, capabilities,
  descriptor, events); `server/src/launcher/start.ts` — one `register` callback registering the
  role-view route (task-009) and the event stream, the stop hook for streams and watchers kept;
  `test/README.md` — version 0.10 (2026-10-06), changelog "0.10: timing suite, `TempWorkspace`,
  snapshot audits and stand-ins — task-010 / bug-001", every task's layout section and the
  *Timing suite* section kept; `test/launcher/local-security.test.ts` — header of both, every row
  of task-009 and of this task. `server/src/process/runner.ts` merged cleanly: task-011's
  `settled` and the `gitEnv` call both present.
- **Decisions (one helper each, bug-002):** `server/src/identity/` now uses `resolveGit`,
  `gitEnv` and `GitNotFoundError` of `server/src/git/git.ts`; task-009's `findGit`,
  `gitConfigEnv`, `REPOSITORY_LOCATING_VARIABLES` and its own `GitNotFoundError` removed
  (`project-identity.ts` re-exports the shared error); its tests moved to the shared helpers with
  the same cases (absolute PATH entries only, non-executable skipped, `git.exe` with a `Path` key on
  Windows, GIT_DIR/GIT_WORK_TREE/GIT_COMMON_DIR/GIT_CEILING_DIRECTORIES ignored by
  `readGitEmail`). `resolveGit` now splits the `PATH` by the platform's delimiter (`;` on
  Windows), as task-009's resolver did. The identity is not switched to `view.state.email`
  (task-012). REQ-ARC-05 lint (task-011): `snapshot.ts` uses `ARCHIVED_STATES`; the watcher's
  `ready` promise renamed `started` (a fixture state name).
- **Checks** (load 10–18 on 12 cores): `npm install` up to date · typecheck, `eslint .` clean ·
  format:check clean · `npm run -s test:coverage` **65 files passed, 1 skipped; 917 passed / 1
  skipped**, 110.9 s, coverage **96.29 %** statements / **89.66 %** branches / 96.07 % functions /
  98.39 % lines · `docs:api` OK · `test:e2e` 3/3 · `check_tasks.py` OK · **`npm run test:timing`
  3/3** at load 16.7 → 12.3: REQ-PERF-03 20/20, max 527 ms; REQ-PERF-06 333–677 ms; TypeDoc build
  4789 ms.
