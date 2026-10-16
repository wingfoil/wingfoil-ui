---
id: task-034-auto-sync-scheduler-and-auto-push
type: task
title: "Auto sync scheduler and auto-push"
status: in-progress
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-PERF-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-030-ui-settings-store-and-settings-api", "task-032-governed-writes-submit-approve-and-reject", "task-033-git-copy-state-repository-status-and-transport-routes"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The auto-sync scheduler and auto-push of spec-010 §6: one timer ticking every
`fetchIntervalSeconds`, automatic fetch (killed after 60 s), the automatic update `merge --ff-only
… @{u}` right after a successful fetch (RP-41), and auto-push after each successful governed
write from the UI, reported in the write response's `push` field (spec-004 §5).

**Backlog items:** TT-PERF-07

## Acceptance Criteria

- **TT-PERF-07** (REQ-PERF-07 — Remote freshness): [numeric] Remote commit → "1 behind" (or fast-forward) within 65 s in 10 out of 10 trials; with auto-fetch off, 0 `git fetch` processes in 120 s. *Verified by:* e2e.
  Scenarios (`@v0.2`): Y-02.1, Y-05.2, C-07.3.
  Here: with the default interval, a commit pushed to the fixture's bare remote shows as `behind: 1` in `GET /api/p/:pid` (or is fast-forwarded with `autoUpdate` on) within 65 s in 10 of 10 trials; with `autoFetch` off the process audit counts 0 `git fetch` in 120 s. Both are elapsed-time runs: `test:timing` on Chromium (RP-44); the default suite and the e2e closures run with `fetchIntervalSeconds` = 15 (RP-53).

- Scheduler (spec-010 §6, RP-18, RP-40): scope = projects with an open snapshot, `has-remote` and
  a fetch target; one project at a time; an overlapping tick is skipped; a project whose write
  lock is busy is skipped (RP-41); a change of `autoFetch` or `fetchIntervalSeconds` re-arms the
  timer with one immediate tick (C-07.3 within 120 s), any other change is read at the next tick.
- Automatic fetch and auto-push killed after 60 s of process time (RP-20, RP-33) → `sync.fetch.lastError`
  / `push: {status: failed, code: push-timeout}`; the automatic update runs the §5 checks on a
  fresh status, only for an identified user (RP-14), and keeps a refusal in `sync.update.lastError`.
- Auto-push (RP-22): `push` = `off` | `pushed` | `failed` with git's `message` or a §5 `code`; a
  failed push never fails the write; there is no periodic push.
- Round-3 note of spec review: `server/src/git/git.ts` `GIT_ALLOWED_SUBCOMMANDS` gains `merge`
  (SARD REQ-INT-06 v0.10, always with `--ff-only`) and its "Never merge…" comment is corrected to
  "never a merge commit"; a unit test proves no merge commit even with `merge.ff=false`.

RP-53: Y-02.1, Y-02.3, Y-05.2 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44).

e2e closure — Y-02.1 closes in task-039-repository-status-and-fetch-in-the-sidebar; Y-05.2 in task-040-update-and-push-from-the-sidebar; C-07.3 in task-041-ui-settings-page-and-theme-setting; the
"pushed" toast (G-13.1) in task-038-submit-footer-action-toasts-and-blocked-actions; Y-07.3 in task-040-update-and-push-from-the-sidebar.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope: unattended processes (timeouts, process-group kills, nothing left running at stop),
auto-push target (never forced, upstream only).

## Implementation Notes

- `spec-010` §4 (automatic update row), §6, §9; `spec-004` §5 (`push` outcome, `push-timeout`);
  `spec-006` §2 (settings read at each tick); `adr-001` D5 and its 2026-10-12 note; SARD
  REQ-INT-06, REQ-ARC-03 class (c); directive `cli-only-writes` 1.6.
- RP-18, RP-19, RP-20, RP-22, RP-33, RP-40, RP-41.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-15)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (hard rules, v0.2 additions, e2e
engines W0-9, lessons of Waves 0–3); the Execution Notes of the three `depends_on` tasks (task-030,
task-032, task-033: design, decisions, red/green/refactor, every review round); `dev-loop-rel-v0.2-plan`
Sessions 1–4 (W0-n … W3-n, the hand-overs to Wave 4); `release-planning-rel-v0.2-plan` RP-14, RP-18 …
RP-23, RP-33, RP-35 … RP-37, RP-40, RP-41, RP-44, RP-47, RP-53; spec-010 (all), spec-004 §4–§6,
spec-006 §2, adr-001 D5/D7 and their notes; `fetch.feature` (Y-02.x), `update.feature` (Y-05.2),
`push.feature` (Y-07.3, Y-08.1), `ui-settings.feature` (C-07.3); directives (`directives list`) —
no *Known behaviours* row concerns git transport; code: `server/src/git/` (`git.ts`, `transport.ts`,
`sync-status.ts`, `copy.ts`, `local-remote.ts`, `redact.ts`), `server/src/writes/` (`transport.ts`,
`governed.ts`), `server/src/process/` (`runner.ts`, `write-lock.ts`), `server/src/snapshot/`
(`snapshots.ts`, `snapshot.ts`, `state.ts`), `server/src/projects/clone.ts` (`NO_HOOKS_PATH`),
`server/src/state/store.ts`, `server/src/events/bus.ts`, `server/src/http/element-writes.ts`,
`server/src/launcher/start.ts`, `contracts/api/` (`repository`, `write.response`, `settings`),
`web/src/api/error-message.ts`, `web/src/i18n/en.json`; tests `test/server/http/git-console.ts`,
`test/server/snapshot/support.ts`, `test/timing/`, `test/README.md` (*Timing suite*, *Temporary folders*).

**depends_on (dl-015 hard gate) — task-030, task-032, task-033, acknowledged.**

- task-030: settings are read with `StateStore.settings()` after `store.reload()` (another
  console's `PUT` is seen at the next tick, D30-3); the in-process bus event
  `{ event: 'settings', data: {} }` has an empty payload, so the scheduler compares `autoFetch` and
  `fetchIntervalSeconds` itself (RP-40); a newer build's read-only state still gives effective
  settings (D30-5); ranges 15–3600 s are the schema's.
- task-032: the write lock is taken with `ProjectSnapshot.lockKey` (W2-0 / D32-2); the auto-push is
  the `WritePushPort` called inside the lock after the commit, before the `write` event (review F3),
  and never throws; the W2-5 commit (CLI failed after its commit) is logged and announced, **not
  pushed** — whether a later push carries it is D34-6; no CLI or git text is logged (N1: kinds,
  codes, exit status), tested with a marker on every error path.
- task-033: reuse `snapshots.sync` (`fetched`, `fetchFailed`, `updateFailed`, `updated`; per pid,
  D33-10), `TRANSPORT_SETTINGS` / `fetchArgs` / `pushArgs` / `transportEnv` / `sshInEnvironment`,
  `localRemoteProblem` and `redactLocalPaths` (and the `<remote>` redaction, R1), the locked plan of
  `GitTransport` (refactored so its plan and run steps are callable by the scheduler and the
  auto-push without the HTTP shape); `merge` joins `GIT_ALLOWED_SUBCOMMANDS` here. Open points
  taken over: a cancelled fetch/push answers 500 `internal` with nothing recorded (unchanged: the
  automatic processes are never cancelled, a `terminated` one at stop records nothing); sync status
  per pid (D34-4); push to the upstream's remote only, never `pushRemote` (kept: "upstream only" is
  the task's security scope).
- All: `TempWorkspace` and the run's temporary root (W0-2); fresh-read preconditions (W0-3); red
  tests first, each guard removed once to see its test fail (lesson of Wave 3).

#### What git actually does (probes on git 2.43.0, scratch repositories with a bare remote, `GIT_TRACE`; removed)

All with `TRANSPORT_SETTINGS` unless stated.

1. **Hooks run in unattended commands.** `fetch` runs `reference-transaction` (prepared,
   committed); `merge --ff-only` runs `reference-transaction` twice and `post-merge`. With a
   relative `core.hooksPath` (husky's form), the hook files that the **incoming commits** add run
   right after the automatic merge (marker files written by `post-merge` and
   `reference-transaction` from the remote's commit) — and from then on at every scheduler fetch.
   `-c core.hooksPath=<a regular file>` (the clone's `NO_HOOKS_PATH`) runs no hook in either.
2. **Maintenance.** `merge` without the settings starts `git maintenance run --auto`; with
   `maintenance.auto=false` / `gc.auto=0` no child. A push to a **local** remote still starts
   `gc --auto` in the remote (`receive-pack`, `GIT_CONFIG_PARAMETERS` unset): the accepted residual
   R2 of task-033, also for the auto-push.
3. **`--ff-only` does not prevent a merge commit.** With `branch.<b>.mergeOptions = -s ours` or
   `pull.twohead = ours`, `merge --ff-only … -- @{u}` exits 0 with a **two-parent merge commit**
   that keeps the local tree (the incoming changes dropped); with `branch.<b>.mergeOptions =
   --squash` it exits 0, HEAD unchanged, the incoming change **staged**. `merge.ff=false`,
   `merge.autoStash=true`, `mergeOptions = --no-ff` / `--no-commit` / `-X ours`, `pull.rebase=true`:
   a fast-forward, one parent. `merge.verifySignatures=true`: exit 128, HEAD unchanged. The manual
   update's `pull --ff-only` (task-033) behaves the same: merge commit with `-s ours` /
   `pull.twohead=ours`, staged squash with `--squash` (an out-of-scope defect, D34-8). Hardened
   arguments hold for both (every config above → one parent, HEAD = upstream, nothing staged;
   diverged still exit 128): `--no-squash --strategy=ort` plus
   `--config-env=branch.<b>.mergeOptions=<an empty variable>`. `-c branch.<b>.mergeOptions=` does
   **not** override for a branch whose name contains `=` (git splits `-c` at the first `=` and
   ignores it silently); `--config-env` splits at the last `=` and works.
4. **Operations in progress.** Git's own merge refuses during a conflicted or resolved
   cherry-pick, merge and revert (exit 128). It does **not** refuse during a stopped `git am`
   (`rebase-apply/`, HEAD on the branch, no unmerged entry): the automatic merge fast-forwards the
   branch under the user's `am` ("You seem to have moved HEAD since the last 'am' failure").
   Rebase and bisect detach HEAD (copy `detached` → no update).
5. **Killed merge.** SIGTERM to the process group during a slow smudge filter: git removes
   `index.lock`, the filter child dies with the group, HEAD does not move — but the working tree is
   **half updated** (a file deleted, new files written untracked), and the next merge refuses
   ("untracked working tree files would be overwritten"). Killing an automatic merge damages the
   working tree (D34-7).
6. **Credential prompts without a terminal.** With `GIT_TERMINAL_PROMPT=0`, an HTTP remote answering
   401 still runs the askpass program of `GIT_ASKPASS`, `core.askPass` and `SSH_ASKPASS` (one call
   each, a GUI dialog in a desktop session) and the credential helper (`get`). An **empty**
   `GIT_ASKPASS` disables all three askpass sources (0 calls; git then fails "terminal prompts
   disabled"); the credential helper still runs (stored credentials keep working).
7. **Concurrency with the user's own git.** A held `index.lock` makes our merge fail (exit 1, git's
   message names the repository's absolute path → redacted `<repository>`) and, the other way, a
   user's `git commit` during our merge fails (exit 128); a held ref lock makes the fetch fail
   ("cannot lock ref", exit 1); `fetch` and the `--no-optional-locks` status do not take
   `index.lock`. git removes its lock files on SIGTERM (probe 5).
8. **`--prune` deletes more than tracking refs.** With `fetch.pruneTags=true` (or
   `remote.<r>.pruneTags`), the fetch's `--prune` deletes **local tags** the remote lacks — a plain
   `git fetch` of the user would not (no prune by default). With a configured refspec into
   `refs/heads/*` (mirror style) and a **detached HEAD** (rebase, bisect), `fetch --prune` exits 0
   and **deletes local branches and their reflogs** (an unpushed commit left only as a dangling
   object); with a branch checked out git refuses the whole fetch. `-c fetch.pruneTags=false` and
   `--config-env=remote.<r>.pruneTags=<empty>` keep the tags.
9. **Timeouts.** The runner's timeout starts at `spawn` (process time, not lock wait — RP-40) and
   kills the group (SIGTERM, SIGKILL after 2 s): a filter or hook child dies with it.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| TT-PERF-07 numeric: 10/10 within 65 s at 60 s; `autoFetch` off → 0 `git fetch` in 120 s | **red-first** (elapsed time) | `test/timing/auto-sync.timing.test.ts` (new; real bin, `GIT_TRACE` file of the bin counted for `fetch`), Chromium-free (API), RP-44 |
| the same at `fetchIntervalSeconds` = 15 in the default suite (RP-53) | **red-first** | `test/launcher/auto-sync.test.ts` (new; real bin, seeded settings, behind 1 seen within `COLD_READ`-style budget, no strict time) |
| scheduler: scope, one at a time, overlapping tick skipped, busy lock skipped, re-arm with one immediate tick only on `autoFetch` / `fetchIntervalSeconds`, other settings at the next tick | **red-first** | `test/server/sync/scheduler.test.ts` (new; fake timers, recording work port) |
| automatic fetch killed after 60 s → `sync.fetch.lastError`; retried next tick | **red-first** | `scheduler`/`auto-sync` unit (fake runner: `timeoutMs === 60_000`, `ended: 'timeout'` mapped) + `test/server/sync/auto-sync.test.ts` (real git, held git-http remote, lowered limit: group killed, lock released, nothing left) |
| automatic update: §5 checks on a fresh status, identified user only (RP-14), refusal kept in `sync.update.lastError` | **red-first** | `auto-sync.test.ts` (fixture copies + a second clone moving the remote) |
| auto-push `off` / `pushed` / `failed` + `message` / §5 `code` / `push-timeout`; a failed push never fails the write; no periodic push | **red-first** | `test/server/http/auto-push.test.ts` (new; `write.response.schema.json` on every 200) |
| `merge` in `GIT_ALLOWED_SUBCOMMANDS`, comment "never a merge commit"; no merge commit even with `merge.ff=false` | **red-first** (allow-list, args) + **characterization** (git) | `test/server/git/git.test.ts`, `transport.test.ts` (appended rows); `transport-facts.test.ts` (appended: probes 3, 4, 8 reproduced, then our args hold) |
| guards of D34-1 … D34-3, D34-5 (hooks, askpass, hardened merge, in-progress, prune) | **characterization** of git + **red-first** of the guard | `transport-facts.test.ts`, `auto-sync.test.ts` (markers never written) |
| unattended processes end at stop | **red-first** | `test/launcher/auto-sync.test.ts` (a fetch held by the git-http remote at stop: no child of the console left) |
| REQ-INT-06 process audit of the scheduler and the auto-push | **red-first** | `auto-sync.test.ts`, `auto-push.test.ts` (every git process `gitSubcommand` ∈ the allow-list; 0 `wingfoil` processes for a fetch on a warm state) |
| contracts first (RP-43), if D34-9 (b) | **red-first** | `test/contracts/api-git-schema.test.ts` (appended rows) |

#### Flow

**Scheduler** (`SyncScheduler`, one per server): `start()` reads the settings and arms a timer of
`fetchIntervalSeconds`; it subscribes to the bus's `settings` event and re-arms only when `autoFetch`
or `fetchIntervalSeconds` changed (one tick at once, then every interval; when a tick is running the
immediate tick is remembered and runs as soon as it ends, so a re-arm is never lost). A tick:
skipped when the previous one still runs; `store.reload()`; an interval changed by another console
re-arms (no extra tick); `autoFetch` off → nothing (0 processes). Otherwise the listed projects with
an open snapshot (`store.projects()` ∩ `snapshots`), grouped per repository and fetch target
(D34-4), one group at a time; before each group `autoFetch` is read again (C-07.3: turning it off
stops the tick's remaining fetches); a group whose `lockKey` is busy is skipped (checked and taken in
one synchronous step, `isBusy` + `run`). `stop()` clears the timer, refuses new ticks and lets the
running process be terminated by the stop sequence (`terminated` → nothing recorded).

**Automatic sync of a group** (under `writeLock.run(lockKey)`): `snapshot.check()` (fresh); no
remote, no fetch target (RP-36), a local remote of another user or unreadable, or a refspec outside
`refs/remotes/` (D34-5) → skipped, logged by code only; else `fetch` (D34-1 … D34-3, D34-5 arguments
and environment, `timeoutMs` 60 000); exit 0 → `sync.fetched` for every pid of the group, then
`snapshot.check()` (the key moves → `repo`); timeout → `sync.fetchFailed` (D34-9); other failure →
`fetchFailed` with git's redacted message. Then, per pid of the group: `autoUpdate` on, copy
`behind`, identified on the fresh view (RP-14; the CLI read is cached on `contentKey`, so no CLI
process after a fetch), no operation in progress (D34-3) → the §5 checks in task-033's order
(`detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way`) → refusal kept with
`updateFailed`; else the hardened `merge` (no timeout, D34-7) → exit 0: `updated`, `check()`, and a
post-condition (the fresh copy is `in-sync`; otherwise logged at error level as `merge-not-ff`);
failure → `updateFailed(git-refused, redacted message)`.

**Auto-push** (`AutoPush implements WritePushPort`, inside the governed write's lock):
`store.reload()` then `settings().autoPush` off → `{status: "off"}`; `check()`; no remote →
`off`; the push plan of task-033 (refusal → `{failed, code}`: `detached-head`, `no-upstream`,
`remote-not-owned`, `remote-unreadable`; ahead 0 → `{pushed}`, nothing to send); `pushArgs` with
`timeoutMs` 60 000, no cancel signal, the manual push's environment (hooks per RP-23: the user just
acted); exit 0 → `pushed`; `timeout` → `{failed, code: "push-timeout"}`; other → `{failed,
message}` (redacted). Then `check()` (copy in-sync → `repo`). Log `{project, op: 'auto-push',
ended, exitCode}` only. Never throws: an unexpected error (a git read under the lock) is logged by
kind and answered `{failed, message}` with task-033's fallback text (`git ended: …`).

#### File layout (planned)

- `server/src/git/git.ts`: `merge` appended to `GIT_ALLOWED_SUBCOMMANDS`; the header comment
  "Never merge, …" → "never a merge commit (`merge` only with `--ff-only`, spec-010 §4), never
  rebase, reset, stash or checkout".
- `server/src/git/transport.ts`: `UNATTENDED_TIMEOUT_MS = 60_000`; `mergeArgs(branch, noHooks)`
  (D34-2); `NO_MERGE_OPTIONS_VARIABLE` and the `--config-env` argument; `unattendedArgs(noHooks)` (the
  hooks path, D34-1); fetch overrides of D34-5 (`fetchArgs(remote, options?)` keeps its manual form
  unchanged unless D34-8 absorbs the manual fix); `unattendedEnv(sshConfigured, env)` =
  `transportEnv` + D34-3.
- `server/src/writes/transport.ts`: `GitTransport` split into `plan(snapshot, state, op)` /
  `execute(…)` callable from the scheduler and the auto-push (behaviour of the routes unchanged).
- `server/src/sync/scheduler.ts` (new): `SyncScheduler` (timer, settings, re-arm, skip rules,
  `tick()`, `stop()`); `server/src/sync/auto-sync.ts` (new): the group's fetch and update.
- `server/src/writes/auto-push.ts` (new): `AutoPush`.
- `server/src/snapshot/snapshots.ts`: `openProjects()` (pid → snapshot of the open entries);
  `snapshot.ts`: `operationInProgress()` (file checks in the worktree's git directory, no process).
- `server/src/launcher/start.ts`: `push: new AutoPush(…)` in the element-write registration; one
  `SyncScheduler` started after `projects.start()`, stopped by a stop hook registered before the
  process termination.
- Contracts (D34-9 (b) only): `repository.schema.json` `sync.fetch.lastError.code` optional
  (`fetch-timeout`), `SyncError.code?` in `contracts/src/git.ts`.
- Web catalogue: `error.pushTimeout` (spec-010 §6 text) and, with D34-9 (b), `error.fetchTimeout`;
  their `MESSAGES` rows in `web/src/api/error-message.ts` and `test/web/api/error-message.test.ts`
  (D34-10).
- Docs: spec-010 §4, §6, §9 (and §3 with D34-9) Process Note 2026-10-15; adr-001 D5 note if D34-7
  changes it; `docs/user-guide.md` (what the console does by itself: fetch every 60 s by default,
  automatic update and push off by default, no hooks and no askpass in unattended runs — D34-11);
  `CHANGELOG.md` *Unreleased* › *Added*; `test/README.md` 0.35 and the *Timing suite* paragraph.
  No new route (no `local-security` rows), no new SSE event type, `GET /api/p/:pid` unchanged except
  D34-9 (b).

#### Test plan (scenario → file)

| Suite | File | What |
|-------|------|------|
| unit | `test/server/sync/scheduler.test.ts` (new) | fake timers + a recording work port: interval from settings; re-arm only on `autoFetch` / interval (one immediate tick), not on `autoUpdate` / `autoPush` / `theme`; overlapping tick skipped; a re-arm during a tick runs after it; busy lock skipped (never waits); one group at a time; `autoFetch` off → no work; turned off mid-tick → no further group; another console's interval seen at the next tick; `stop()` |
| unit | `test/server/git/transport.test.ts`, `git.test.ts` (appended) | `mergeArgs` exact array (`--ff-only`, `--no-squash`, `--strategy=ort`, `--config-env`, no `+`), unattended settings and environment (D34-1, D34-3), `merge` allowed |
| characterization | `test/server/git/transport-facts.test.ts` (appended) | probes 1, 3, 4, 6, 8 reproduced with git's defaults, then held by our arguments (one parent with `merge.ff=false`, `pull.twohead=ours`, `mergeOptions` `-s ours` / `--squash` / `--no-ff`, a branch named `a=b`) |
| API / domain | `test/server/sync/auto-sync.test.ts` (new) | real `Snapshots` on `AuditedRunner`, fixture copies with their bare `origin`, a second clone pushing: Y-02.1 / Y-02.3 / Y-05.2 / C-07.3 API side (ticks driven by `tick()`), refusals and `lastError`, `repo` events (fresh-read preconditions), hooks and askpass markers never written, in-progress `am`, prune guards, two pids of one repository (one fetch), timeout on a held remote (lowered limit), REQ-INT-06 audit, marker in git's message never logged |
| API | `test/server/http/auto-push.test.ts` (new) | Y-07.3 / Y-08.1 / G-13.1 API side: every `push` outcome, `write.response` schema, the write is 200 whatever the push, D34-6 (the W2-5 commit not pushed by itself, carried by the next push), `push-timeout`, no push process with `autoPush` off |
| bin | `test/launcher/auto-sync.test.ts` (new) | seeded `fetchIntervalSeconds` 15: behind 1 by itself; `autoUpdate` → HEAD moved; stop with a held fetch → no child left |
| timing | `test/timing/auto-sync.timing.test.ts` (new) | TT-PERF-07: 10 trials at 60 s (≤ 65 s each, printed with the load), `autoFetch` off 120 s → 0 `fetch` in the bin's `GIT_TRACE` file |
| contract | `test/contracts/api-git-schema.test.ts` (appended, D34-9 (b)) | `fetch.lastError.code` |
| web unit | `test/web/api/error-message.test.ts` (appended rows, D34-10) | `push-timeout` (and `fetch-timeout`) |

e2e: none in this task (no screen). Closure table:

| Scenario | Proved here by (API / bin side) | Closes (e2e) in |
|----------|-------------------------------|-----------------|
| Y-02.1, Y-02.3 | `auto-sync.test.ts`, `launcher/auto-sync.test.ts`, timing | task-039-repository-status-and-fetch-in-the-sidebar |
| Y-05.2 | `auto-sync.test.ts`, `launcher/auto-sync.test.ts` | task-040-update-and-push-from-the-sidebar |
| Y-07.3, Y-08.1 | `auto-push.test.ts` | task-040-update-and-push-from-the-sidebar |
| C-07.3 | `scheduler.test.ts`, `auto-sync.test.ts` | task-041-ui-settings-page-and-theme-setting |
| G-13.1 ("pushed") | `auto-push.test.ts` | task-038-submit-footer-action-toasts-and-blocked-actions |

Hand-over for those tasks: the e2e console needs seeded settings (`fetchIntervalSeconds` 15) —
`ConsoleOptions.stateDir` with a `state.json` written by the spec; a shared helper is theirs.

#### Spec amendments needed (after the decisions)

spec-010 §4 (unattended runs: hooks path, askpass, merge arguments, fetch prune overrides; the
manual `pull` if D34-8 absorbs it), §6 (grouping per repository, in-progress skip, refspec guard,
`autoFetch` re-read per group, re-arm during a tick, W2-5 commit), §3 (D34-9 (b)), §9; adr-001 D5
(only if D34-7 is not (a)). Dated Process Notes (approved specs have no Version line).

#### Open decisions (approver) — listed in the report to the coordinator as D34-1 … D34-11

Accepted residual risks (stated, not decided): a credential helper's own GUI (e.g. a credential
manager) may still show a dialog during an unattended fetch until the 60 s kill; a local remote's
`receive-pack` `gc --auto` (R2) also for the auto-push; another console or the user's terminal using
the repository at the same moment (lock files make one fail; the next tick retries, a failed merge
is shown as `git-refused` until the next success); a configuration change between the fresh reads
and git's own (milliseconds; git re-checks fast-forward and local changes itself); filter drivers
(e.g. git-lfs smudge) may use the network during the "local" automatic merge.

#### Decisions (approver, 2026-10-15; plan ref W4-1)

"All as recommended":

- **D34-1 (b)** — the scheduler's fetch and the automatic merge run with `core.hooksPath` =
  `NO_HOOKS_PATH` (no hook runs without a user action); the manual Update and Push and the
  auto-push keep the repository's hooks (RP-23).
- **D34-2 (b)** — the automatic merge is `merge --ff-only --no-squash --strategy=ort --no-edit
  --no-stat --no-autostash --quiet -- @{u}` with `--config-env=branch.<b>.mergeOptions=<an empty
  variable>`; after it, the fresh copy must be in sync, otherwise an error-level log by code
  (`merge-not-fast-forward`); characterization rows `merge.ff=false`, `pull.twohead=ours`,
  `mergeOptions` `-s ours` / `--squash` / `--no-ff`, a branch named `a=b`.
- **D34-3 (b)** — scheduler processes get `GIT_ASKPASS` empty and `SSH_ASKPASS_REQUIRE=never`; the
  automatic update is skipped silently (logged by code, nothing recorded) while the worktree's git
  directory holds `rebase-apply`, `rebase-merge`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`,
  `sequencer` or `BISECT_LOG`.
- **D34-4 (b)** — one fetch per repository (`lockKey`) and fetch target per tick, its outcome
  recorded on every listed project of the group; the automatic update per project.
- **D34-5 (b)** — every fetch adds `-c fetch.pruneTags=false` and
  `--config-env=remote.<r>.pruneTags=<empty>`; the automatic fetch runs only when every configured
  `remote.<r>.fetch` destination is under `refs/remotes/` (negative refspecs allowed), else it is
  skipped and logged by code.
- **D34-6 (a)** — no periodic push: the W2-5 commit leaves with the next push of HEAD (the next
  successful write's auto-push or a manual Push).
- **D34-7 (a)** — no timeout on the automatic merge (spec-010 §4 as written).
- **D34-8 (b)** — bug-014-manual-update-can-make-a-merge-commit-and-manual-fetch-can-prune-local-tags-and-branches
  (ingested on `main` by the coordinator) is absorbed here: the manual `pull` gets the D34-2
  arguments, the manual fetch the D34-5 `pruneTags` overrides, and a manual fetch whose configured
  refspecs write outside `refs/remotes/` is refused with a 409 code of its own,
  `refspec-outside-remotes` (schema, catalogue, `MESSAGES` rows). Red tests first reproduce each
  bug-014 case (probes 3 and 8). The bug's state and the task's `bug:` list are the coordinator's.
- **D34-9 (b)** — `sync.fetch.lastError` gains an optional `code: "fetch-timeout"` (schema,
  `SyncError`, `error.fetchTimeout`); `message` stays (git's standard error so far, redacted, may
  be empty).
- **D34-10 (a)** — this task adds `error.pushTimeout` with its `MESSAGES` and test rows.
- **D34-11 (a)** — the auto-push pushes HEAD (the user's own unpushed commits too), as the manual
  Push; stated in the user guide and `CHANGELOG.md`.

Coordinator rules: merge order task-034 → task-042; `test/README.md` 0.35, `docs/user-guide.md`
0.10; only this task touches `web/src/api/error-message.ts` `MESSAGES` and `contracts/`; `en.json`
and `CHANGELOG.md` *Unreleased*: own entries only, inserted in sorted place; the e2e settings seed
helper is left to task-039/040/041.

**bug-014 acceptance (proposed AC text):** "bug-014: the manual update (`POST …/git/update`) and the
automatic update never create a merge commit nor stage a squash, whatever `branch.<b>.mergeOptions`
(`-s ours`, `--squash`, `--no-ff`, also for a branch name containing `=`), `pull.twohead` or
`merge.ff` say — HEAD is the upstream's commit, one parent; a fetch (manual or automatic) never
deletes a local tag (`fetch.pruneTags`, `remote.<r>.pruneTags`) or a local branch: a manual fetch
whose configured refspecs write outside `refs/remotes/` → 409 `refspec-outside-remotes`, 0
transport processes; the automatic fetch skips it. *Verified by:* `test/server/git/transport-facts.test.ts`
(the bug reproduced with git's defaults), `test/server/http/git-routes.test.ts`,
`test/server/sync/auto-sync.test.ts`."

### red / green / refactor (2026-10-15)

- **Contracts first (RP-43)** — `f25f307`: `repository.schema.json` `sync.fetch.lastError.code`
  (`fetch-timeout`, D34-9), `git.refusal.schema.json` `refspec-outside-remotes` (D34-8),
  `SyncError.code?`, `GitTransportRefusalCode` + `refspec-outside-remotes` (excluded from
  `UpdateSyncError`); rows of `test/contracts/api-git-schema.test.ts`, seen failing (2) against the
  previous schemas before the schema change, committed together.
- **Catalogue** — red `75cb249` (`push-timeout`, `fetch-timeout`, `refspec-outside-remotes` rows of
  `test/web/api/error-message.test.ts`: 4 failures), green `ffb1988` (`MESSAGES` rows,
  `error.fetchTimeout`, `error.pushTimeout`, `error.refspecOutsideRemotes` inserted in sorted place).
- **bug-014 and the D34 arguments** — red `7bc9fd9`: `transport.test.ts` (argument arrays,
  `trackingRefspecs`, `unattendedEnv`), `transport-facts.test.ts` (probes 1, 3, 4, 6, 8 reproduced
  with git's defaults, then held by the arguments), `git-routes.test.ts` › bug-014 (8 failures on
  the routes: merge commit with `-s ours` / `pull.twohead=ours`, a staged squash, a pruned tag, the
  refspec refusals). Green `0195f60`: `fetchArgs` / `pullArgs(branch)` / `mergeArgs(branch)` /
  `noHooksArgs` / `trackingRefspecs` / `unattendedEnv` / `EMPTY_VARIABLE` /
  `UNATTENDED_TIMEOUT_MS` (`server/src/git/transport.ts`), `merge` in `GIT_ALLOWED_SUBCOMMANDS` (the
  comment now "never a merge commit"), `GitReads.configValues`, `GitTransport.plan` public (the
  fetch refuses `refspec-outside-remotes`; `automatic` selects `mergeArgs`).
- **Scheduler, automatic sync, auto-push** — red `8f107eb` (`test/server/sync/scheduler.test.ts`,
  `test/server/sync/auto-sync.test.ts`, `test/server/http/auto-push.test.ts`; files did not load),
  green `56bf45d`: `server/src/sync/scheduler.ts` (`SyncScheduler`), `server/src/sync/auto-sync.ts`
  (`AutoSync`), `server/src/writes/auto-push.ts` (`AutoPush`), `Snapshots.openProjects()`,
  `ProjectSnapshot.operationInProgress()` / `OPERATION_MARKERS`, `SyncStatus.fetchFailed(…, code?)`;
  `git-console.ts` gains `autoPush`, `bus`, `env`. The tests passed on their first run after the
  module existed, so each guard was removed in turn and its test seen failing, then restored:
  scheduler — the busy-lock skip, the overlapping-tick skip (the test then also asserts the skipped
  ticks read no settings: without it the lock skip hid the missing guard), `autoFetch` read per
  group, the re-arm during a tick, the `settings` subscription; auto-sync — `noHooksArgs` on the
  fetch and on the merge, `unattendedEnv`, the identity check (RP-14), the in-progress check, the
  one-fetch-per-group reuse; auto-push — `autoPush` off, the `push-timeout` mapping.
- **Launcher** — red `8d7e307` (`test/launcher/auto-sync.test.ts`: the auto-push test failed on the
  bin), green `97bfe0f` (`start.ts`: one `GitTransport`, `AutoPush` passed to the element-write
  routes, `SyncScheduler` + `AutoSync` started after `projects.start()`, a stop hook registered
  before the process termination). A first green run showed a race in the test (it polled HEAD,
  then read the header before the console's own check): it now polls the header.
- **Timing** — `eafbca2`: `test/timing/auto-sync.timing.test.ts` (TT-PERF-07; the `GIT_TRACE` file
  must hold the header's `git status`, so 0 fetches is not vacuous).
- **Docs** — `93457d1`: spec-010 §3–§6, §8, §9 and spec-004 §5 amended with dated Process Notes;
  `docs/user-guide.md` 0.10 (*Automatic sync with the remote*); `CHANGELOG.md` *Unreleased* (Added:
  automatic sync; Fixed: bug-014); `test/README.md` 0.35.
- **Deviations from the design:** the automatic update runs when the copy is behind its upstream
  (`behind > 0`), so a diverged copy records `diverged` (as the manual update does) instead of
  being ignored; a `GitTransport` getter `environment` and method `sshConfigured` were added for the
  unattended runs; the scheduler takes the lock as `{ isBusy, run }` (no port change). No existing
  suite counts git processes over time on the real bin (the process audits build their own app
  without a scheduler); `test/README.md` says how a new one must seed `autoFetch: false`.

### checks (2026-10-15, HEAD before this note `7d6c18b`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2` | OK | — |
| `npm run test:coverage` (includes the public-text check) | 153 files passed, 1 skipped; **2801 passed / 1 skipped**; statements 96.43 %, branches 91.25 %, functions 97.31 %, lines 98.19 % (`sync/scheduler.ts` 95.1 %, `sync/auto-sync.ts` 87.5 %, `writes/auto-push.ts` 77.8 % statements) | ~74 → 85 |
| `npm run test:e2e:chromium` (regression; no e2e spec of this task, W0-9) | **223 passed** (17.1 min) | → 100 |
| `npm run test:smoke` (`start.ts` changed) | **4/4 passed** | 92 |
| `test/timing/auto-sync.timing.test.ts` (run once as a functional check, load ≥ 12 — the verdict is not a quiet-machine measurement) | **2/2 passed**: TT-PERF-07 10/10 trials 58.4–60.0 s (each remote commit lands right after a tick, so every trial waits almost a full interval: the worst case); Y-02.3 0 `git fetch` in 120 s | 42 → 74 |
| `npm run test:timing` (whole) | **skipped**: load ≥ 12 | — |

No console of this worktree left running; no `wfui-task-034-*` entry in the system temporary
directory.

e2e closure — none of this task's own; scenarios close in task-038, task-039, task-040 and
task-041 (closure table of the design).

### review (round 1, 2026-10-15)

Independent review round 1: **CHANGES REQUIRED** (R1 major, R2–R5 minor, R6–R10 nits); the
adversarial security review runs separately. Red tests first (each red commit before its fix).

| Id | Change | Test |
|----|--------|------|
| R1 | the manual update's own fetch followed `fetch.prune` / `fetch.pruneTags`: `pullArgs(branch, remote)` now carries `--no-prune`, `-c fetch.pruneTags=false` and `--config-env=remote.<r>.pruneTags=<empty>` (probed: tag and local-only branch kept); spec-010 §4 | `git-routes.test.ts` › review R1 (2 red, then green) |
| R1 (WAIT) | probe: with `+refs/heads/*:refs/heads/*` the update's own fetch **force-overwrites** a local branch the remote has with another history (reflog `forced-update`), `--no-prune` or not; without `+` the branch is kept; the checked-out branch itself is fetched into and fast-forwarded ("fetch updated the current branch head") | `git-routes.test.ts` › `it.fails` "review R1 (WAIT)" (fails today for that reason, checked) — pending the approver |
| R2 | `docs/user-guide.md` Version 0.10 | — |
| R3 | — (behaviour kept: `{failed, code: "internal"}`, the form is the approver's — WAIT) | `auto-push.test.ts` › R3 (a failing push-URL read: write 200, push failed, the log holds the kind only); guard-removal: rethrowing in the catch fails it |
| R4 | the post-condition runs before `sync.updated`: a merge that exits 0 without fast-forwarding logs `merge-not-fast-forward` and keeps the previous update error (no update code fits; logged only) | `auto-sync.test.ts` › R4 ×2 (hooks path a directory: 0 processes, error by code — passed first, guard removal fails it; the stubbed merge — red) |
| R5 | `AutoSync.stop()` (called by `SyncScheduler.stop()` through `SyncWork.stop?`): checked before each project, before the fetch and before spawning the merge | `auto-sync.test.ts` › R5 ×2, `scheduler.test.ts` › R5 (red) |
| R6 | spec-010 Process Note states the `behind > 0` deviation | — |
| R7 | `refspec-outside-remotes` text "this remote has no fetch refspec, or one writes outside refs/remotes/…" (catalogue, spec-010 §5, CHANGELOG, guide) | — |
| R8 | CHANGELOG "an automatic fetch or an auto-push"; guide's Auto-update row "only when you are identified in the team" | — |
| R9 | `SyncScheduler.run` catches everything (kind logged) | `scheduler.test.ts` › R9 (red) |
| R10 | `PUSH_OFF` comment | — |

Checks (HEAD before this note `f0cdaad`): `typecheck`, `lint`, `format:check` clean; `docs:api`,
`check_tasks.py v0.2` OK; `test:coverage` 153 files passed, 1 skipped, **2810 passed, 1
expected fail, 1 skipped** (statements 96.54 %, branches 91.31 %; `auto-push.ts` 88.9 %,
`auto-sync.ts` 91.6 %), load 120 → 148; `test:smoke` 4/4 and `launcher/auto-sync.test.ts`
3/3 at load 134. No web or e2e-visible change beyond one catalogue text, so no e2e run. No console
or `wfui-task-034-*` entry left.

#### Adversarial security review round 1 and decisions (approver, 2026-10-15; plan refs W4-3 … W4-10)

Findings: **S1** (medium) incoming commits change the configuration through `include.path` /
`includeIf` to a tracked file, and the next tick runs `remote.<r>.uploadpack`, `core.fsmonitor`,
`filter.<x>.smudge`, `core.sshCommand`, a `!` credential helper or `core.gitProxy` unattended;
**S2** (medium) the push destination read with `config --get branch.<b>.merge` takes the LAST
value while `@{u}` takes the first; **S3** (low/medium) a remote without `url` in the
configuration reads `remotes/<r>` (or `branches/<r>`) whose refspecs the prune guard did not see;
**S4** (low) the runner settles on `close`: a child that keeps stderr open in a new session holds
the write lock and the stop sequence forever; **S5** = review R4.

All as recommended:

- **W4-3** (R1 WAIT) — the manual update also refuses `refspec-outside-remotes` (spec-010 §5/§8,
  `UpdateSyncError`); the automatic update skips it, as the fetch does.
- **W4-4** (R3 WAIT) — `push.code: "internal"` stays; spec-010 §6, the `write.response` schema
  description and `WritePush.code` list it.
- **W4-5** (S1) — before an unattended fetch or merge, under the lock, `git config --list
  --show-origin --show-scope`; any `file:` origin that resolves (realpath) inside the working tree —
  not the git directory, the common directory, `config.worktree` in the git directory, the global
  or the system files — skips the run, logged by code `config-in-worktree`; `-c core.fsmonitor=false`
  on unattended runs and on the server's own status and reads.
- **W4-6** (S2) — `--get-all branch.<b>.merge`: exactly one value, else `no-upstream`, for the
  auto-push and the manual push.
- **W4-7** (S3) — `refspec-outside-remotes` also when `remote.<r>.url` is not set in the
  configuration, or `remotes/<r>` / `branches/<r>` exists in the common directory (manual and
  automatic fetch, and the update per W4-3).
- **W4-8** (S4) — the runner settles on `exit` (or after a kill) plus a drain grace of about 2 s,
  then destroys the pipes and resolves with what it collected.
- **W4-9** (S5 / R4) — a merge that exits 0 without fast-forwarding is recorded as an update error
  with the new code `merge-not-fast-forward` (schema, type, `error.mergeNotFastForward`).
- **W4-10** — (a) accepted residual, stated in the user guide and spec-010: hooks an automatic
  merge brought in (relative `core.hooksPath`) run at the user's next governed write or auto-push;
  (b) at stop no new automatic merge (R5) and the stop sequence awaits a running automatic merge
  before `terminateAll` (a second signal still forces).

### security review round 1 — changes (2026-10-15)

| Id | Red | Fix | What |
|----|-----|-----|------|
| contracts (RP-43) | — | `47b2498` | `update.lastError.code` + `refspec-outside-remotes`, `merge-not-fast-forward`; `push.code` `internal` documented (schema description, `WritePush.code`) |
| catalogue | `748ff61` | `3efc576` | `error.mergeNotFastForward`, `MESSAGES` row |
| W4-8 (S4) | `b0b03d1`, corrected in `074ca78` (still red on the old runner) | `301b22e` | the runner settles on `close` or 2 s after `exit` (pipes destroyed); tests: a child exiting with, killed with, or terminated with a grandchild in a new session holding the pipes; 8 MiB + 1 MiB output still exact |
| W4-6 (S2) | `19fb759` | `22ec205` | `--get-all branch.<b>.merge`, exactly one, else `no-upstream` (manual push and auto-push) |
| W4-3, W4-7 (S3) | `2413daa` | `d57acd0` | the update refuses `refspec-outside-remotes` (recorded); a remote without configured URL, or with `remotes/<r>` / `branches/<r>` in the common directory, is refused (fetch, update) or skipped (scheduler); the R1 `it.fails` became a normal test |
| W4-9 (S5) | `215da07` | `114e6d5` | `merge-not-fast-forward` recorded as the update error |
| W4-5 (S1) | `97a263f` | `bf572bd` | `configInWorktree` (`git config --list --show-origin --show-scope -z`, realpaths) before the unattended fetch and before the merge → skipped, logged `config-in-worktree` (**log only**: no fetch `lastError` code fits); `-c core.fsmonitor=false` in `noHooksArgs` and every `GitReads` read |
| W4-10 (b) | `de58c62` | `4d4a1a8` | `SyncScheduler.stop()` → `AutoSync.stop()` awaits a running merge; the stop hook awaits it before `terminateAll` |
| docs | — | `a894eb4` | spec-010, spec-004, adr-001 D5 Process Notes; user guide (0.10, its history note extended), CHANGELOG, test README |

- **S1 rule as implemented:** a `file:` origin of scope `local` or `worktree` must be the
  repository's own `config` (git directory or common directory) or `config.worktree`; any file
  origin resolving inside the working tree outside the git directories, or not resolvable, also
  skips. This is the decision's allow-list for the repository's scopes: a repository include to a
  file outside the working tree skips too (fail closed; a linked worktree including the main
  worktree's tracked file is caught by it); includes of the global configuration are the user's
  own and are allowed. Every S1 variant was reproduced red first (the configured program ran):
  `remote.<r>.uploadpack` through `include.path`, `includeIf.gitdir:`, `includeIf.onbranch:`;
  `core.fsmonitor` (merge and the server's status read); `filter.<x>.smudge`;
  `core.sshCommand` (an `ssh://` URL without port: git's "simple" variant refuses a port
  before running the command); `core.gitProxy` (a program: git execs it without a shell); a
  `!` credential helper (an HTTP remote answering 401).
- **Residual noted:** `filter.<x>.clean` of an included tracked configuration still runs in the
  server's status reads when the index is stat-dirty, as in the user's own `git status` (S1 asked
  for fsmonitor only there).
- Guard-removal: the tests that passed on their first run were the S3 scheduler row (same
  `trackingOnly` as the route tests, which were red) and the allow-list companion tests.

Checks (HEAD before this note `a894eb4`): `typecheck`, `lint`, `format:check` clean; `docs:api`,
`check_tasks.py v0.2` OK; `test:coverage` 153 files passed, 1 skipped, **2835 passed, 1
skipped** (statements 96.5 %, branches 91.22 %), load 6.7 → 35; `test:smoke` 4/4 (load 33);
`test:e2e:chromium` **223 passed** (13.0 min, load → 27); `test:timing` **skipped** (load 21–35
after the suites, ≥ 12). No console and no `wfui-task-034-*` entry left.

#### Review round 2 and decisions (approver, 2026-10-15; plan refs W4-11 … W4-14)

Independent review round 2: **PASS** with R2-1 … R2-4. Adversarial security review round 2:
**CHANGES REQUIRED** — S2-1 (medium) an include directive whose target does not exist yet or
whose condition is false now has no origin, so W4-5 passes, then the automatic merge lands the
file and the server's own status reads run its `filter.<x>.clean`; S2-2 (medium/low) a relative
command path of the user's own configuration runs a tracked script the incoming commits changed;
S2-3 (low) a drained result answers `ended: 'exit'` with possibly truncated output; low: empty
`branch.<b>.merge` values not counted; a stuck merge holds the stop until a second signal.

All as recommended:

- **W4-11** (S2-1) — the guard also reads the include directives (`include.path`,
  `includeif.<cond>.path`) of the same listing, resolved as git does (relative to the directory of
  the file holding them, `~/` and `~user/`), any scope: a target inside the working tree outside the
  git directories is `config-in-worktree`. The `filter.<x>.clean` of an included tracked file in
  the server's status reads becomes an accepted residual (configuration only arrives through the
  user's own pull or Update), stated in spec-010 and the user guide.
- **W4-12 (a)** (S2-2) — the automatic update is skipped when an incoming path occurs as a path
  token of any value of the effective configuration (normalised), logged by code.
- **W4-13** (S2-3, R2-3) — a drained result is marked `drained: true`; `GitReads` fails closed on
  it; the drain logs `{op, kind: 'pipes-held'}`. Empty `branch.<b>.merge` values are counted.
  The stop log line and the user guide say a second signal forces the stop.
- **W4-14** (R2-2) — the fail-closed rule stays and becomes visible: `config-in-worktree` is
  recorded as `sync.fetch.lastError.code` (and the update's skip likewise as
  `sync.update.lastError` where it fits), catalogue `error.configInWorktree`.
- **R2-1** — the `refspec-outside-remotes` text is neutral (fetch or update); **R2-4** — CHANGELOG
  re-wrap.

### review round 2 — changes (2026-10-15)

| Id | Red | Fix | What |
|----|-----|-----|------|
| contracts (RP-43) | `1e854df` | `c3a285f` | `sync.fetch.lastError.code` + `config-in-worktree`; `update.lastError.code` + `config-in-worktree`, `config-uses-incoming-path` |
| catalogue, R2-1, R2-4 | `f8fea68` | `c4b3bca` | `error.configInWorktree`, `error.configUsesIncomingPath`, `MESSAGES` rows; `refspec-outside-remotes` text "Not fetched or updated: … — use git in a terminal" (catalogue, spec-010 §5, CHANGELOG); CHANGELOG bug-014 entry re-wrapped |
| W4-13 (S2-3, R2-3) | `1a84b79` | `dc00050` | `ProcessResult.drained`; the runner logs `{op, kind: 'pipes-held'}` (launcher passes its logger); `GitReads`, the CLI adapter (`CliProcessError`) and `readGitEmail` refuse a drained result; clone and transport read only the exit status and stderr |
| empty merge values | `2250a9c` | `98d310e` | `config -z --get-all`: empty values counted (an empty second `branch.<b>.merge` → `no-upstream`) |
| W4-14 (R2-2) | `f141fbb` | `531a73b` | `config-in-worktree` recorded as `sync.fetch.lastError` (empty message) and, when it shows before the merge, `sync.update.lastError` |
| W4-11 (S2-1) | `5a9013a` | `7e52c17` | `include.path` / `includeif.<cond>.path` directives of any scope resolved as git does (folder of the holding file, `~/`, `~user/` via `expandUser`, the nearest existing ancestor realpath'd) → inside the working tree outside the git directories = `config-in-worktree`; tests: a missing file, `onbranch:` of another branch, `hasconfig:` not met, a global include of a missing file of the working tree |
| W4-12 (a) (S2-2) | `0a3e9ec` | `2080dc0` | `configUsesPaths`: tokens of every configuration value vs `incomingPaths()` → `config-uses-incoming-path`, **recorded** as `sync.update.lastError` and logged; tests: `filter.<x>.smudge = ./x`, `credential.helper = !x --store`, `core.sshCommand = sh "x" -v`, and a non-incoming path still updates |
| stop | `d43ef2e` | `21bb83e` | the stop logs `{op: 'stop', code: 'waiting-for-update'}` "send the signal again to stop at once"; user guide says so |
| docs | — | `b45d7e9` | spec-010 (§3, §6, Process Note), adr-001 D5 note, user guide (0.10 history kept) |

Checks (HEAD before this note `b45d7e9`): `typecheck`, `lint`, `format:check` clean; `docs:api`,
`check_tasks.py v0.2` OK; `test:coverage` 153 files passed, 1 skipped, **2854 passed / 1
skipped** (statements 96.42 %, branches 91.02 %), load 5 → 13; `test:smoke` 4/4 (load 10);
`test:timing` **passed** (load 9.5 → 4.5): Vitest 5/5 — TT-PERF-07 10/10 trials 59.8–60.0 s
(each remote commit lands right after a tick: the worst case, within 65 s), Y-02.3 0 `git fetch`
in 120 s — and Playwright 18/18; `test:e2e:chromium` **223 passed** (7.9 min, load → 16.5). No
console and no `wfui-task-034-*` entry left.

#### Review round 3 and decision (approver, 2026-10-16; plan ref W4-15)

Independent review round 3: **PASS** with nits R3-1 … R3-3. Adversarial security review round 3:
**CHANGES REQUIRED** — S3-1 (medium) the W4-12 token matcher is bypassed (a script sourcing an
incoming file, `$PWD/…`, `${PWD}/…`, `$(git rev-parse --show-toplevel)/…`, a path with a space or
a backslash escape, `~/…`, a tracked symlink, `make -C tools`); S3-2 (low/medium) W4-11 resolves a
relative include from the holder's realpath and collapses `..` lexically, while git resolves from
the path it opened and follows the file system.

- **W4-15 (a)** (S3-1) — the automatic update is skipped whenever any configuration value (any
  scope) names something inside the working tree, incoming or not: a token resolving (after `~`,
  `~user`, `$PWD`, `${PWD}`, `$(git rev-parse --show-toplevel)`; relative tokens from the top level)
  to an existing path inside the top level outside the git directories; or the raw value holding
  the top level's path or its realpath; or a boundary-aware occurrence of an incoming path in the
  raw value. Code `config-uses-incoming-path` kept, its text broadened. Accepted residual: commands
  found through `PATH` or non-path forms (`python -m pkg.mod`) that load repository files.
- **S3-2** — a relative include resolves from the folder of the holder as git opened it; a `..`
  after a non-`..` component fails closed.
- **R3-1 … R3-3** — the new codes' catalogue texts in spec-010; the user guide says any configured
  value naming a working-tree file counts; `error.configInWorktree` neutral wording.

### review round 3 — changes (2026-10-16)

| Id | Red | Fix | What |
|----|-----|-----|------|
| W4-15 (a) (S3-1), S3-2 | `51cf33c` | `b79a53c` | `configUsesWorktree` replaces `configUsesPaths`: any configured value (any scope) naming the working tree skips the automatic update, recorded `config-uses-incoming-path` (code kept, text widened); `shellTokens` (quotes, backslash escapes, parts around `=`, `:`, `,`); `~`, `~user`, `$PWD`, `${PWD}`, `$(git rev-parse --show-toplevel)` expanded; existing paths (the link itself and its realpath) inside the top level outside the git directories; the top level's path or realpath in the value; an incoming path as a token (normalised) or bounded substring. Include paths resolved from the holder as git opened it and by the file system (`physicalPath`), a `..` or `.` in a part that does not exist yet failing closed |
| R3-1 … R3-3 | — | `ac3ef49` | spec-010 §5: a table of the sync-status codes with their catalogue texts; §6 the widened rule, exemptions and the `PATH` residual; user guide: any configured value naming a working-tree file counts; `error.configInWorktree` "includes another file", `error.configUsesIncomingPath` "uses a file of the working tree" |

- **Run to execution:** a smudge filter `sh tools/run.sh` whose script sources `tools/lib.sh`,
  an incoming `lib.sh` writing a marker and an incoming `zz-incoming.md` checked out after it: red
  before the fix (the marker was written; the incoming `.md` must sort after `tools/lib.sh`, else
  the smudge sources the old file), no marker after. The other S3-1 cases assert no merge and the
  recorded code (red before: the merge ran).
- **`.` / top-level tokens — chosen: fail closed.** A token resolving to the top level itself
  counts (`make -C .`, tested). Not counted, each with a test and a guard-removal proof (the test
  fails without the exemption): the keys an unattended run sets itself (`core.hooksPath` — e.g.
  husky's `.husky` —, `core.fsmonitor`, `fetch.pruneTags`, `remote.<r>.pruneTags`,
  `branch.<b>.mergeOptions`), `safe.directory` (git compares it, never opens it) and
  `branch.<b>.remote = .` (the remote name of a local upstream, which would otherwise stop every
  repository with a local tracking branch).
- **Accepted residual:** commands found through `PATH` or non-path forms (`python -m pkg.mod`)
  that load repository files (spec-010 §6, user guide).
- The public-text check refused the `~/` test's run-time path: the test names the copy literally
  (`~/kanban/…`, a name the allow-list accepts).

Checks (HEAD before this note `d5882b0`): `typecheck`, `lint`, `format:check` clean; `docs:api`,
`check_tasks.py v0.2` OK; `test:coverage` 153 files passed, 1 skipped, **2872 passed / 1
skipped** (statements 96.37 %, branches 90.9 %), load 5 → 10.7; `test:smoke` 4/4 (load 9);
`test:timing` **passed** (load 8.5 → 11): Vitest 5/5 (TT-PERF-07 10/10 at 59.9–60.1 s, Y-02.3 0
fetches) and Playwright 18/18. `test:e2e:chromium` not run: the only console-visible change is
catalogue text. No console and no `wfui-task-034-*` entry left.

#### Review round 4 and decision (approver, 2026-10-16; plan ref W4-16)

Independent review round 4 and adversarial security review round 4: **CHANGES REQUIRED**. S4-1:
ten shell spellings bypass `configUsesWorktree` to execution (`$HOME/…`, `${HOME}`, `"$(pwd)/…"`,
backticks, `$(git rev-parse --show-cdup)`, `--show-toplevel )` with a space, `${PWD%/}`, globs
`t*/`, `tool?/`, …); S4-2 / R4-2: noise — `core.editor = code --wait` with a `code/` folder,
`credential.helper = cache` with `cache/`, `alias.t = !npm test` with `test/`, git-lfs `%f` with a
one-letter file each skip forever with a message that does not say why; R4-1: the top-level
substring without a boundary makes a sibling `<top>.git` remote skip; R4-3: the CHANGELOG says
nothing of the risk.

- **W4-16 (A)** — stop the heuristic arms race: remove the W4-12 / W4-15 value heuristics
  (`configUsesWorktree`, the skip, the code `config-uses-incoming-path` from the schema, the type,
  the catalogue, spec-010, the user guide and the CHANGELOG — the task is unreleased); keep every
  structural guard (no hooks, no fsmonitor, `config-in-worktree` with the include directives and
  the S3-2 resolution, the hardened merge, the refspec and legacy-remote guards, the in-progress
  skip, the drained refusal, the stop behaviour); declare the residual: with `autoUpdate` on
  (off by default) the console does what `git pull` does on a timer, so incoming commits can run
  commands the user's own git configuration points at. The `config-in-worktree` log names the
  triggering key's section and name only (R4-2); the CHANGELOG states the risk (R4-3).
