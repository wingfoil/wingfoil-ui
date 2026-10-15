---
id: task-033-git-copy-state-repository-status-and-transport-routes
type: task
title: "Git copy state repository status and transport routes"
status: in-progress
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-04"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-010-clone-runs-the-user-s-own-git-commands-and-needs-no-minimum-git-version"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-031-today-api-and-memory-updates-feed", "task-032-governed-writes-submit-approve-and-reject"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Git sync on the server side, without the scheduler: the copy state (spec-010 §1) from the
existing status read, the repository-state key and `repo` event (§2), the repository status of
`GET /api/p/:pid` (§3), the manual transport routes `POST …/git/fetch`, `/git/update`, `/git/push`
(§4) with their refusals (§5) and preconditions (§8), the condition `has-remote` (§7, spec-001
§6), the copy-state reasons of the descriptor (spec-003 §6 rule 4) and row 8 of spec-004 §4 added
to the governed writes of task-032-governed-writes-submit-approve-and-reject. Also closes the server enforcement of REQ-SEC-08 across
governed writes, update and push (RP-48).

**Backlog items:** TT-STATE-04, TT-SEC-08

## Acceptance Criteria

- **TT-STATE-04** (REQ-STATE-04 — Governed actions refused on a stale or ambiguous copy): [percentage] 100 % of governed-action requests with the copy behind, diverged or on a detached HEAD get HTTP 409; after a successful fast-forward the same requests succeed. (v0.2 scope: the `ui.yaml` writes are v0.3.) *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2, Y-01.3.
  Here: copy state per row of spec-010 §1 from recorded porcelain outputs (local upstream, upstream without tracking ref = `no-upstream`, RP-32); row 8 → 409 `stale-copy` under the write lock; update refusals of §5 (`detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way` with `detail.files` relative) → 409, 0 transport processes; a manual update is `pull --ff-only` and is not cancellable (RP-37).
- **TT-SEC-08** (REQ-SEC-08 — Read-only for unidentified users, enforced by the server): [percentage] 100 % of governed-write, update and push requests from such users get HTTP 403 and start 0 processes; a fetch (it changes only remote-tracking refs) and the per-user local settings are not in scope; every listed scenario passes. *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): S-13.2, S-15.2, T-01.2, C-08.1, C-08.2, C-09.1, C-09.2.
  Here (RP-48, RP-14, RP-34): for each identity kind `not-in-team`, `no-identity`, `ambiguous`, every governed write, update and push → 403 `not-in-team` with 0 processes; a fetch is allowed.

- Transport (spec-010 §4): argument arrays exactly as the table (no `+`, `--ff-only`, `--prune`,
  `--no-recurse-submodules`, `CLONE_SETTINGS`, `--no-optional-locks`), environment with
  `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when no ssh command is
  configured (RP-24); fetch target per RP-36 (`no-fetch-target` otherwise); fetch and push
  cancellable (process group killed on abort, RP-37); git failure → 422 `git-refused`, message
  kept in `sync.*.lastError`, never logged or stored; nothing to do → 200, no process.
- Key and events (spec-010 §2, RP-40): the key changes on `branch.ab`, upstream and remote-list
  changes, not on a re-read of the same state; `repo` is sent when the copy state or a last error
  changes, never for a new `lastSuccessAt` alone.
- REQ-INT-06 process audit: every git process uses an allowed subcommand.

e2e closure — G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2 close in task-040-update-and-push-from-the-sidebar; Y-01.3 in
task-039-repository-status-and-fetch-in-the-sidebar; S-13.2, S-15.2 in task-037-gate-footer-with-every-outcome; T-01.2 in task-036-today-requires-you-and-waiting-on-others; C-08.1, C-08.2, C-09.1, C-09.2 in
task-035-how-to-join-panel (those screens rely on the v0.1 identity and row 5 of task-032-governed-writes-submit-approve-and-reject; this task adds the API
proof over all five routes).

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

- **bug-010 (clone: the user's own git commands, minimum git version)** The documentation of the
  clone (`docs/user-guide.md` *Add a project*, spec-006 §3) states exactly what runs during a
  clone and a transport: nothing of the cloned repository; the user's own configured tools
  (filter drivers, `core.sshCommand`, config-defined hooks) may run. A minimum git version is
  documented (CVE-2024-32004, CVE-2024-32465) and, per the option the approver picks at this
  task's design among bug-010 *Notes* (a), (b), (c), enforced or hardened, with tests. The same
  statement covers fetch, update and push of this task.

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope: argument and ref injection through remote and branch names, `ext::`/`fd::`
transports, `GIT_SSH_COMMAND` handling, credentials in errors and logs, hooks during pull/push
(RP-23).

## Implementation Notes

- `spec-010` §1–5, §7, §8, §9; `spec-004` §3 (`repository.schema.json`, `project.schema.json`
  `conditions`, `git.response.schema.json`), §4 row 8 and v0.2 note, §5 git codes, §6 `repo`;
  `spec-001` §6 project conditions; `spec-003` §6 rule 4; `adr-001` D5, D7.
- RP-14, RP-21 (fetch under the write lock), RP-23, RP-24, RP-25, RP-32, RP-34, RP-35, RP-36,
  RP-37. The `merge` subcommand and the `git.ts` comment belong to task-034-auto-sync-scheduler-and-auto-push.
- Every new refusal code gets its `error.<code>` key in the web catalogue (spec-008 §4).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-15)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (v0.2 additions, e2e engines
W0-9, lessons of Waves 0–2); the Execution Notes of `depends_on` task-031 and task-032 (design,
decisions, red/green/refactor, every review round); `release-planning-rel-v0.2-plan` RP-14, RP-21,
RP-23, RP-24, RP-25, RP-32, RP-34, RP-35, RP-36, RP-37, RP-40, RP-41, RP-43, RP-47, RP-48, RP-55;
`dev-loop-rel-v0.2-plan` Sessions 1–3 (W0-1 … W0-10, W1-1 … W1-4, W2-0 … W2-5, hand-overs to
Wave 3); spec-010 (all), spec-004 §3–§6, spec-003 §6, spec-001 §6, spec-006 §3, spec-008 §4;
adr-001 D2, D5, D6, D7; bug-010, bug-012; directives (`directives list`: `wingfoil-cli`,
`cli-only-writes`, `security-secrets`, `claim-evidence`, `documentation`, `doc-versioning`) — no
*Known behaviours* row concerns git transport (they are the CLI's); code: `server/src/git/git.ts`,
`server/src/snapshot/` (`snapshot.ts`, `snapshots.ts`, `state.ts`, `watcher.ts`),
`server/src/writes/governed.ts`, `server/src/http/` (`element-writes.ts`, `project-routes.ts`,
`projects.ts`, `app.ts`), `server/src/process/` (`runner.ts`, `write-lock.ts`),
`server/src/projects/clone.ts`, `server/src/cli/adapter.ts`, `server/src/launcher/start.ts`,
`server/src/descriptor/descriptor.ts`, `contracts/api/` (`project`, `descriptor`,
`write.refusal`), `contracts/src/` (`api.ts`, `writes.ts`), `web/src/api/error-message.ts`,
`web/src/i18n/en.json`; tests `test/server/snapshot/support.ts`, `process-audit.test.ts`,
`test/harness/fixtures/` (every fixture has a bare `origin` it tracks), `test/e2e/support/git-http.ts`
(`hold`), `test/launcher/local-security.test.ts`, `test/web/api/error-message.test.ts`.

**depends_on (dl-015 hard gate) — task-031, task-032, acknowledged.**

- task-032: the write lock is taken with `ProjectSnapshot.lockKey` (the realpath of the git common
  directory, W2-0 / D32-2), never the pid; row 8 goes where `governed.ts` says "Row 8 (task-033)
  goes here", i.e. **after** row 7 and the S1 re-listing, **before** row 9, on the state of the
  `snapshot.check()` made at the start of `locked()` (the FRESH state, review S1); `stale-copy` is
  added to `write.refusal.schema.json` and `WriteRefusalCode`; rows 5–6 read the snapshot view
  (D32-3) and are evaluated again on the fresh view when the state moved; no CLI or git error text is
  logged (N1: kinds, codes, exit status only) — tested with a marker on every error path; the
  `GIT_ALLOWED_SUBCOMMANDS` list already holds `fetch`, `pull`, `push`, `remote`, `config`, `log`:
  this task adds **no** subcommand (`merge` is task-034's, with the "Never merge" comment).
- task-031: no partial answer on a failed input; the descriptor inputs are memoised per state
  (`descriptorInputs()`, `derived(...)`), which this task feeds with the copy (spec-003 §6 rule 4);
  the Today and element routes inherit the copy reasons through it.
- Both: new suites use `TempWorkspace` and the run's temporary root (W0-2); fresh-read
  preconditions (W0-3): every "after a change" assertion first asserts that the state key moved
  (or did not).

**What git actually does (probes on git 2.43.0, scratch repositories, removed).**

- `GIT_ALLOW_PROTOCOL=ext` in the server's environment **overrides** `-c protocol.allow=never`: a
  clone of `ext::sh -c touch% <marker>` with `CLONE_SETTINGS` wrote the marker. `gitEnv` keeps that
  variable, so the v0.1 clone's "`ext::` refused whatever the user's configuration says" does not
  hold against the environment (D33-2). `remote.<n>.vcs` (a remote helper) and an `ext::` URL in the
  repository's configuration are refused by the protocol settings (`transport '…' not allowed`).
- `fetch`, `pull` (and the `merge` that `pull` runs) each start `git maintenance run --auto`
  (GIT_TRACE); `gc --auto` may detach into the background and outlive the killed process group and
  the server (D33-3). `-c maintenance.auto=false` removes every such child (probed: 0).
- A **local** upstream (`branch.<b>.remote = .`) prints `# branch.upstream <b>` **and**
  `# branch.ab +0 -0`: the `branch.<b>.remote` read of spec-010 §1 is required, the headers alone
  cannot tell it from a remote upstream.
- `git log --no-renames --name-only -z --format= <range>` gives NUL-separated paths relative to the
  repository's top level (no headers).
- `pull` runs the repository's hooks (post-merge, reference-transaction), its fsmonitor, the user's
  filter drivers and credential helpers / askpass programs; `GIT_TERMINAL_PROMPT=0` does not stop an
  askpass program (git's prompt asks it first) — D33-4 and the accepted residuals.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| contracts first (RP-43): `repository.schema.json`, `git.response.schema.json`, `git.refusal.schema.json` (new); `project.schema.json` (`repository` → `$ref`, top-level `conditions`); `write.refusal.schema.json` + `stale-copy` | **red-first** | `test/contracts/api-git-schema.test.ts` (new): spec examples accepted, every `copy` value, `sync` shapes, `detail.files` absolute path refused by pattern, unknown keys refused |
| copy state per row of spec-010 §1 from recorded porcelain outputs (detached, no remote, local upstream, upstream without tracking ref = `no-upstream` RP-32, diverged, behind, ahead, in sync, initial); fetch target per RP-36; merge-ref validation (D33-8) | **red-first** | `test/server/git/copy-state.test.ts` (new, pure) |
| the git facts relied on (above; prune → `no-upstream`, RP-35; `pull --ff-only` on diverged / in-the-way refuses and leaves HEAD and the edit; protocol settings refuse `ext::` and `vcs`; `GIT_ALLOW_PROTOCOL` overrides them; maintenance children) | **characterization** | `test/server/git/transport-facts.test.ts` (new), real git on fixture copies with their bare `origin` |
| argument arrays exactly as spec-010 §4 (+ D33-3 settings), environment (`GIT_TERMINAL_PROMPT=0`; `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when neither `GIT_SSH_COMMAND`, `GIT_SSH` nor `core.sshCommand` is set; D33-2 `GIT_ALLOW_PROTOCOL`) | **red-first** | `test/server/git/transport.test.ts` (new, unit over a recording runner) |
| key and events (§2, RP-40): the key moves on `branch.ab`, upstream, branch switch, `git remote add`/`remove`, not on a re-read; `repo` on a copy-state or last-error change, never for `lastSuccessAt` alone; D33-6 (CLI reads not re-run when only the copy part moved) | **red-first** | `test/server/snapshot/copy-key.test.ts` (new) |
| `GET /api/p/:pid` `repository` (§3) and `conditions: ["has-remote"]` (§7, RP-25); descriptor reasons `copy-behind {commits}`, `copy-diverged`, `copy-detached` (spec-003 §6 rule 4) on `/elements`, `/elements/:eid`, `/today` | **red-first** | `test/server/http/repository-status.test.ts` (new; not appended to the hot `project-routes.test.ts`) |
| §5 and §8 on the three routes: each refusal 409 with its `code`, 0 transport processes; nothing to do → 200, 0 transport processes (D33-9); 422 `git-refused` with the message (redacted, D33-5) kept in `sync.*.lastError`, never logged (marker in the remote path and in git's message); manual update = `pull --ff-only`, not cancellable (RP-37); fetch and push cancelled by the client leaving: process group killed (git-http remote with `hold`), no `lastError`; REQ-INT-06: every git process of the routes has an allowed subcommand | **red-first** | `test/server/http/git-routes.test.ts` (new): real `Snapshots` over `AuditedRunner`, fixture copies, a second clone pushing to the same bare remote (behind / diverged), `InProcessEventBus`, every non-200 body validated by `git.refusal.schema.json` and every 200 by `git.response.schema.json` |
| TT-SEC-08 (RP-34, RP-48, RP-14): for `not-in-team`, `no-identity`, `ambiguous`: update, push and the three governed writes → 403 `not-in-team`, 0 processes on a warm state; fetch → 200 | **red-first** for the git routes; **characterization** for the governed writes (task-032 row 5) | `git-routes.test.ts` › TT-SEC-08 table over the five routes |
| TT-STATE-04 row 8: copy behind, diverged, detached → 409 `stale-copy`, 0 `wingfoil` processes; the copy moved after the last observed state is seen (fresh, under the lock); after a successful `POST …/git/update` the same write → 200 | **red-first** | `test/server/http/element-writes.test.ts` (appended `describe`) |
| local-security rows of the three routes (REQ-SEC-02/03) | **characterization** (pass before the routes exist, as in task-031/032) | `test/launcher/local-security.test.ts` (appended block) |
| the routes registered in the bin | **red-first** | `test/launcher/git-routes.test.ts` (new; fails with the registration line removed) |
| process audit: the check's git processes (D33-7) | **characterization** (counts updated with the reason) | `test/server/snapshot/process-audit.test.ts`, `snapshot.test.ts`, `memory-events.test.ts` |
| bug-010 statement (user guide, spec-006 §3, spec-010 §4, minimum git version in the README) | documentation (public-text check) | — |
| bug-010 guard per D33-1 (local remote not owned by the user refused) and D33-2 (`GIT_ALLOW_PROTOCOL`) on the clone | **red-first** | `test/server/projects/clone.test.ts` (appended: the `ext::` marker reproduced with `GIT_ALLOW_PROTOCOL=ext`, then refused); `git-routes.test.ts` for transport |
| bug-012 (**pending triage**): no local absolute path in a `cli-refused` / `git-refused` body or a `lastError` | **red-first** | `test/server/cli/adapter.test.ts` (appended, unit) + one test per route family with a marker root: a read route (`project-routes`), a governed write (`element-writes`), the project list (`projects.test.ts`), a git route |
| `error.<code>` keys of the new codes (spec-008 §4) | **red-first** | `test/web/api/error-message.test.ts` (`SPEC_004` rows appended) |

#### Request flow (one `GitTransport` for the three routes)

1. Guards (rows 1–2). 2. `onRequest`: unknown `:pid` → 404 before the body (as task-032). 3. Body:
none or `{}`, anything else → 400 `invalid-request` (D33-9). 4. Update and push only — row 5 on
the snapshot view (D32-3: no process on a warm state) → 403 `not-in-team`. 5.
`writeLock.run(snapshot.lockKey, …)`: `snapshot.check()` (fresh: status, `user.email`,
`git remote`, `branch.<b>.remote`); update/push: row 5 again when the fresh identity moved; §5
refusals in their order from the fresh copy (fetch: `no-remote`, `no-fetch-target`; update:
`no-remote`, `detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way` — the `log`
read `HEAD..@{u}` ∩ the fresh status; push: `no-remote`, `detached-head`, `no-upstream`, merge ref
valid D33-8); D33-1 owner check of a local remote (`git remote get-url [--push] -- <remote>`);
nothing to do → step 7. 6. `core.sshCommand` read, then the transport process (argument array,
`timeoutMs: null`; fetch and push get the client-gone signal, update none). 7. `snapshot.check()`;
the sync record updated (`lastSuccessAt`, `lastError` set or cleared; `repo` with the same state
when only a last error changed); 200 `{repository}` or 422 `git-refused`. Logs: `{pid, op,
exitCode, ended}` only.

Row 8 of the governed writes: in `GovernedWrites.locked()`, from the `state` of its first
`snapshot.check()` (or of the re-listed view's state when it moved): `copy` ∈ {`behind`,
`diverged`, `detached`} → 409 `stale-copy`, before row 9 and any `wingfoil` process.

#### File layout (planned)

- `contracts/api/repository.schema.json`, `git.response.schema.json`, `git.refusal.schema.json`
  (new, committed first with their test); `project.schema.json` (`repository` → `$ref`,
  `conditions`); `write.refusal.schema.json` (`stale-copy` in the no-detail enum).
- `contracts/src/git.ts` (new): `RepositoryCopy`, `RepositoryStatus`, `RepositorySync`,
  `SyncError`, `UpdateSyncError`, `ProjectCondition`, `GitOperation`, `GitResponse`,
  `GitTransportRefusalCode`, `GitRefusalCode`; one appended export line in `contracts/src/index.ts`;
  `contracts/src/api.ts` `ProjectHeader.repository: RepositoryStatus`, `ProjectHeader.conditions`;
  `contracts/src/writes.ts` `WriteRefusalCode` + `'stale-copy'`.
- `server/src/git/git.ts`: `parseStatus` also returns `branch` (`head` name or `null`),
  `upstream`, `ab` and hashes those header lines; `GIT_READ_ARGS` + `remotes` (`remote`),
  `branchConfig` (`config --get`), `sshCommand`, `remoteUrl` (`remote get-url`), `incoming`
  (`log --no-renames --name-only -z --format=`); `GitReads.remotes()`, `branchRemote(b)`,
  `branchMerge(b)`, `sshCommand()`, `remoteUrl(name, push)`, `incomingPaths()`; the module header
  table gains these reads (the "Never merge" comment stays for task-034).
- `server/src/git/copy.ts` (new, pure): `copyOf(status, remotes, branchRemote)`,
  `fetchTarget(...)`, `isMergeRef(ref)`.
- `server/src/git/transport.ts` (new): `TRANSPORT_SETTINGS` (`CLONE_SETTINGS` + D33-3),
  `ALLOWED_PROTOCOLS` (one list for `CLONE_SETTINGS` and `GIT_ALLOW_PROTOCOL`), `fetchArgs(remote)`,
  `pullArgs()`, `pushArgs(remote, mergeRef)`, `transportEnv(env, sshConfigured)`.
- `server/src/git/redact.ts` (new): `redactLocalPaths(text, roots)` (D33-5), used by the adapter
  and the transport.
- `server/src/git/sync-status.ts` (new): `SyncStatus` (per pid, in memory, D33-10).
- `server/src/writes/transport.ts` (new): `GitTransport` (the flow above; `fetch`, `update`,
  `push`; the locked part exported for task-034's scheduler and auto-push).
- `server/src/http/git-routes.ts` (new): `GIT_PATHS`, `registerGitRoutes(app, { store, snapshots,
  writeLock, bus, sync })`; `clientGone` exported from `server/src/http/projects.ts` (reused).
- `server/src/snapshot/state.ts`: `RepoState` + `branch`, `upstream`, `copy`, `ahead`, `behind`,
  `remotes`, `contentKey` (D33-6); `snapshot.ts`: the check reads the remotes and the branch's remote;
  the CLI memo on `contentKey`, `derived` on `key`; `snapshots.ts`: `SyncStatus` forgotten on close.
- `server/src/writes/governed.ts`: row 8.
- `server/src/http/project-routes.ts`: header `repository` + `sync` + `conditions`; `copy` in the
  descriptor enablement (`registerProjectRoutes` options gain `sync`).
- `server/src/cli/adapter.ts`: the refusal message redacted (D33-5, pending triage).
- `server/src/projects/clone.ts`: D33-2 environment, D33-1 owner check.
- `server/src/launcher/start.ts`: one `SyncStatus`, passed to the project routes; one appended
  `registerGitRoutes(...)` line.
- `web/src/i18n/en.json`, `web/src/api/error-message.ts`: the new `error.*` keys (D33-13).
- Docs: spec-010, spec-004, spec-006 (and adr-001 D6 if D33-6) amended in place with dated Process
  Notes; `docs/user-guide.md` *Add a project* (bug-010; version bump); `README.md` minimum git
  version; `test/README.md` 0.33; `CHANGELOG.md` *Unreleased* (Security: the `GIT_ALLOW_PROTOCOL`
  hole, D33-1; Changed: no absolute path in tool messages — if bug-012 is absorbed).

#### Test plan (scenario → file)

| Suite | File | What |
|-------|------|------|
| contract | `test/contracts/api-git-schema.test.ts` (new) | the three new schemas, `project.schema.json` additions, `stale-copy` |
| unit | `test/server/git/copy-state.test.ts` (new) | §1 rows, RP-32, RP-36, D33-8 |
| unit | `test/server/git/transport.test.ts` (new) | §4 arrays, environment, D33-2, D33-3 |
| unit | `test/server/git/redact.test.ts` (new) | D33-5: given and real roots, longest first, home, URL userinfo, cap |
| characterization | `test/server/git/transport-facts.test.ts` (new) | the git facts above |
| snapshot | `test/server/snapshot/copy-key.test.ts` (new) | §2 key, RP-40 events, D33-6 |
| API | `test/server/http/repository-status.test.ts` (new) | §3, §7, spec-003 §6 rule 4 (Y-01.3 API side) |
| API | `test/server/http/git-routes.test.ts` (new) | §5, §8, TT-SEC-08 (S-13.2, S-15.2, T-01.2, C-08.x, C-09.x API side), Y-05.1, Y-06.1, Y-06.2 API side, cancel, git-refused, REQ-INT-06 audit, bug-012 marker |
| API | `test/server/http/element-writes.test.ts` (appended) | row 8 (G-12.1, G-12.2, G-12.3 API side) |
| bin | `test/launcher/git-routes.test.ts` (new), `local-security.test.ts` (appended) | registration; rows 1–3 |
| web unit | `test/web/api/error-message.test.ts` (appended rows) | the new codes |
| audits | `process-audit.test.ts`, `snapshot.test.ts`, `memory-events.test.ts` | updated git counts (D33-7) |

e2e: none in this task (no screen). Closure table:

| Scenario | Proved here by (API side) | Closes (e2e) in |
|----------|---------------------------|-----------------|
| G-12.1, G-12.2, G-12.3 | `element-writes.test.ts` › row 8; `git-routes.test.ts` › update then write | task-040-update-and-push-from-the-sidebar |
| Y-05.1, Y-06.1, Y-06.2 | `git-routes.test.ts` › update (behind, diverged, in the way) | task-040-update-and-push-from-the-sidebar |
| Y-01.3 | `repository-status.test.ts` › detached; `git-routes.test.ts` › `detached-head` | task-039-repository-status-and-fetch-in-the-sidebar |
| S-13.2, S-15.2 | `git-routes.test.ts` › TT-SEC-08 | task-037-gate-footer-with-every-outcome |
| T-01.2 | `git-routes.test.ts` › TT-SEC-08 | task-036-today-requires-you-and-waiting-on-others |
| C-08.1, C-08.2, C-09.1, C-09.2 | `git-routes.test.ts` › TT-SEC-08 | task-035-how-to-join-panel |

#### Spec amendments needed (after the decisions)

spec-010 §2 (the key covers the resolved upstream remote; D33-6), §4 (D33-2, D33-3, D33-8, D33-9,
D33-4 wording, the bug-010 statement, `git remote get-url` for D33-1), §5 (D33-11, D33-1 code);
spec-004 §5 (D33-5 for `cli-refused` and `git-refused`, the D33-1 code in the code tables);
spec-006 §3 (bug-010: what runs during a clone, D33-1, D33-2); adr-001 D6 (D33-6) — dated Process
Notes (2026-10-15).

#### Open decisions (approver)

- **D33-1 — bug-010 option.** (a) document only: the user guide *Add a project*, spec-006 §3 and
  spec-010 §4 say exactly what runs (nothing of the cloned or fetched repository's own code at
  clone time; the user's configured tools — filter drivers such as git-lfs, `core.sshCommand`,
  credential helpers, config-defined hooks — may run; during update and push the repository's
  hooks run, D33-4), and the README names a minimum git version (2.43.4 / 2.45.1 or later, or a
  distribution build carrying the fixes of CVE-2024-32004 and CVE-2024-32465), not checked
  (a distribution's "2.43.0" may carry the backports); (b) (a) plus `GIT_LFS_SKIP_SMUDGE=1` and
  emptied `filter.lfs.*` on the clone (an enumeration of one tool; leaves LFS working trees with
  pointer files); (c) ★ (a) plus, on POSIX, refusing a **local** remote (a `file://` URL or a path)
  whose repository folder (and its `.git`, when not bare) is not owned by the server's user — the
  clone (422, new spec-006 §3 code `remote-not-owned`) and fetch, update and push (409, same code
  in spec-010 §5; the URL from `git remote get-url`, `insteadOf` applied) — before any transport
  process; the CVE class is "a repository owned by another local user", which this checks whatever
  the git version; Windows documented as unchecked.
- **D33-2 — `GIT_ALLOW_PROTOCOL` in the server's environment** (probed: it re-enables `ext::`
  against `CLONE_SETTINGS`). (a) ★ the clone and the transport set `GIT_ALLOW_PROTOCOL` to exactly
  the allowed list (`https:http:ssh:git:file`), built from the same constant as `CLONE_SETTINGS`;
  (b) `gitEnv` drops `GIT_ALLOW_PROTOCOL` for every child (the `-c` settings then hold; the CLI's
  own git calls are local); (c) leave it (the user's environment) and document.
- **D33-3 — git's own background work during transport.** (a) ★ `-c maintenance.auto=false
  -c gc.auto=0` on fetch, pull and push (after `CLONE_SETTINGS`): no `maintenance`/`gc` child, so
  nothing outlives the process group a cancel or the stop sequence kills, and a cancel never lands
  in a repack (spec-010 §4 amended); (b) as the spec: git maintains as configured (a detached
  `gc --auto` may outlive a cancelled fetch and the server).
- **D33-4 — hooks and the user's tools during update and push** (RP-23, confirmation of the
  wording). (a) ★ as RP-23: hooks run as the repository configures them — stated precisely: with a
  relative `core.hooksPath` (e.g. husky's) the hook files the incoming commits bring run after the
  fast-forward, exactly as in the user's own `git pull`; the project's CLI from `node_modules`
  already runs the repository's code (adr-001 D2), so no trust boundary is crossed; (b) the manual
  update runs with `core.hooksPath` = the clone's `NO_HOOKS_PATH` (no post-merge/post-checkout hook
  from the UI's pull), push keeps `pre-push` (changes RP-23); (c) no hook on update nor push.
- **D33-5 — bug-012 (pending triage), the redaction.** (a) ★ one `redactLocalPaths` applied at
  the two mapping points — the adapter's exit-1 refusal (`cli-refused`, every route family) and the
  transport's failure (`git-refused`, `lastError`): every occurrence of the project root (as listed
  and as its realpath), the repository's top level, git directory and common directory, longest
  first, replaced by `<project>` (inside the project) or `<repository>` (the top level and the git
  directories outside it), the home directory by `~`, userinfo removed from URLs, the text capped
  at 4 000 characters; the CLI's and git's wording otherwise verbatim (REQ-INT-04, REQ-INT-06);
  (b) only the project root (the bug's minimal fix); (c) not here: bug-012 stays for its own task.
- **D33-6 — the CLI read cache and the copy part of the key.** (a) ★ `RepoState.contentKey` =
  HEAD + working-tree hash: the CLI reads (and `--version`) are memoised on it, the descriptors and
  every `derived` value on the full key — a fetch that moves only a tracking ref starts 0 CLI
  processes on the next refetch (REQ-PERF-05: the CLI cannot see the tracking refs); adr-001 D6
  Process Note; (b) one key for everything: each such fetch re-runs up to 3 CLI reads per page
  refetch.
- **D33-7 — the reads of each check.** (a) ★ spec literal: `git remote` with the status (in
  parallel with the status and `user.email`), then `git config --get branch.<b>.remote` when an
  upstream is printed: 3–4 git processes per check (2 today), process-audit counts updated; the
  merge ref, `core.sshCommand` and the remote URL are read only under the lock, at transport time;
  (b) one `git config -z --get-regexp` for remotes and the branch's remote (misses remotes defined
  in `.git/remotes/` files; a regular expression over a branch name).
- **D33-8 — the push target.** (a) ★ the remote must be one `git remote` lists (spec) and the merge
  ref `refs/heads/<name>` with no `:`, `+`, `*`, `?`, `[`, `\`, `^`, `~`, space or control
  character, no `..` or `@{`, not ending in `/` or `.lock`; otherwise push → 409 `no-upstream`
  (never a refspec git could read as forced or as two refs); (b) whatever the configuration holds,
  after `--` (git refuses most malformed refspecs itself).
- **D33-9 — "no body" and "nothing to do → no process".** (a) ★ the routes accept no body or `{}`,
  anything else 400 `invalid-request` (row 4); "no process" = no transport process — the fresh
  reads under the lock run (status, remotes, branch config), else "nothing to do" could be answered
  from a stale state; (b) ignore any body; answer "nothing to do" from the watcher's state with 0
  processes.
- **D33-10 — scope of `sync`.** (a) ★ per pid, in memory since the start, dropped when the project
  leaves the list (spec "per project"); a fetch from one of two listed projects of one repository
  moves the other's copy (refs are shared) but not its `lastSuccessAt`; (b) per repository
  (`lockKey`) for fetch, per pid for update.
- **D33-11 — `detail.files` outside the project folder** (a project in a sub-folder of its
  repository). (a) ★ every in-the-way path relative to the project, `../` included (POSIX
  separators), never absolute; (b) relative to the repository's top level; (c) only the files inside
  the project, the others counted in `detail.others`.
- **D33-12 — row 5 of update and push.** (a) ★ as D32-3: from the snapshot view before the lock
  (0 processes once the page has read the state), and again under the lock when the fresh state's
  identity moved; (b) only under the lock (a check process for every refused request).
- **D33-13 — catalogue of the new codes** (spec-008 §4). (a) ★ this task adds `error.noRemote`,
  `error.noFetchTarget`, `error.detachedHead`, `error.noUpstream`, `error.diverged`,
  `error.localChangesInTheWay` (`{files}`) — and `error.remoteNotOwned` with D33-1 (c) — with the
  spec-010 §5 English texts, their `MESSAGES` rows, and `errorMessage(error, options?)` rendering an
  array `detail.files` as one `{files}` argument (base names joined by an optional
  `options.formatList`, default `Intl.ListFormat` of `en`); (b) keys and rows only; the list
  rendering is task-040's (until then `{files}` is the raw ", " join).
- **D33-14 — new header fields.** (a) ★ `repository`'s new fields and `conditions` required in the
  schema and the type (the server always sends them); the two web test mocks
  (`test/web/project/header-data.ts`, `test/web/dna/data.ts`) gain them; (b) optional.

**Accepted residual risks (stated, not decided):** a credential helper or askpass program that
shows a dialog holds an update, which no one can cancel (RP-37; it is the user's authentication,
REQ-SEC-09); a configuration change between the server's reads and git's own (milliseconds); another
console or a terminal using the repository at the same time (git's lock files make one fail with
git's message); push goes to the upstream's remote, never `branch.<b>.pushRemote` (spec-010 §4
explicit refspec); the user's environment (`GIT_TRACE*`, `GIT_SSH`, `GIT_EXEC_PATH`) is used as
is. Observation outside bug-012's wording: `cli-not-found` sends `detail.path` = the project's
absolute root (spec-006 §3 shape; the catalogue does not use it).

#### Decisions (approver, 2026-10-15)

"All as recommended": D33-1 (c) — documentation plus a local remote whose repository is not owned
by the server's user refused with the new code `remote-not-owned` (422 on the clone, 409 on fetch,
update and push); D33-2 (a); D33-3 (a); D33-4 (a); D33-5 (a); D33-6 (a) with an adr-001 D6
Process Note; D33-7 (a); D33-8 (a); D33-9 (a); D33-10 (a); D33-11 (a); D33-12 (a); D33-13 (a);
D33-14 (a). Approved specs and ADRs are amended in place with dated Process Notes (2026-10-15).

Coordinator (2026-10-15):

- **C1** — the `GIT_ALLOW_PROTOCOL` finding is bug-013-clone-runs-ext-transport-commands-when-git-allow-protocol-allows-them
  (`open`, awaiting triage, proposed absorption here); its fix is D33-2. bug-012 and bug-013 are
  cited by the tests and the closure rows; the `bug:` list and the AC are the coordinator's.
- **C2** — bug-012's scope includes `cli-not-found`'s `detail.path` (the project's absolute root):
  no local absolute path in that body either; spec-006 §3 amended with a dated Process Note.
- **C3** — merge order task-033 then task-037; `test/README.md` 0.33 here (0.34 task-037). In the
  web catalogue, `error-message.ts` and its test this task adds only its own entries (the transport
  `error.*` keys, `error.remoteNotOwned`, the `{files}` list rendering); `element.reason.*` keys
  (copy reasons included) and `write-incomplete` are task-037's. Only this task touches
  `contracts/` and the schemas.

### red / green / refactor (2026-10-15)

- **Contracts first (RP-43)** — `9d06e55`: `repository.schema.json`, `git.response.schema.json`,
  `git.refusal.schema.json` (new); `project.schema.json` (`repository` → `$ref`, required
  `conditions`, D33-14); `write.refusal.schema.json` (`stale-copy`; `cli-not-found` with
  `{command}` only, C2); `projects.refusal.schema.json` (`remote-not-owned`, `cli-not-found`
  `{command}`); `contracts/src/git.ts` and one appended export block in `contracts/src/index.ts`;
  `ProjectHeader.repository` / `conditions`; `WriteRefusalCode` + `stale-copy`;
  `ProjectRefusalCode` + `remote-not-owned`. Red: `test/contracts/api-git-schema.test.ts` and the
  server build (the header did not send the new fields).
- **Green** — `b7a1508`: `server/src/git/copy.ts`, `sync-status.ts`, `transport.ts`,
  `local-remote.ts`, `redact.ts`; `GitReads` (`remotes`, `configValue`, `remoteUrl`,
  `incomingPaths`, `transport`), `parseStatus` reads the branch headers; `RepoState` gains the
  copy, `paths`, `contentKey`; the snapshot's check reads `git remote` and `branch.<b>.remote`
  (D33-7), the CLI memo keyed on `contentKey`, `derived` on the full key (D33-6);
  `writes/transport.ts` (`GitTransport`), `http/git-routes.ts` (`GIT_PATHS`, `registerGitRoutes`),
  one appended registration in `start.ts`; row 8 in `governed.ts`; header `repository`,
  `conditions` and the descriptor copy in `project-routes.ts`; the adapter's refusal redacted
  (default roots, or the snapshot's via the new `redact` option); `cli-not-found` without a path
  (adapter and project list); the clone's `GIT_ALLOW_PROTOCOL` and owner check; the web
  catalogue keys, `MESSAGES` rows and the `{files}` list (`errorMessage(error, options?)`).
- **Tests** — `2699d5a`, `a09acaa`: see the test plan; the copy-key cases planned for
  `test/server/snapshot/copy-key.test.ts` live in `test/server/http/repository-status.test.ts`
  (one console helper for both, `test/server/http/git-console.ts`); row 8 is proved there (fresh
  state) and in `git-routes.test.ts` (G-12.x), not appended to the hot `element-writes.test.ts`.
  Characterization updates (D33-7, with the reason in each comment): the check's git processes
  (`snapshot.test.ts` 3 → 5 for the first state, ≤ 4 → ≤ 8 for coalesced checks;
  `process-audit.test.ts` cold Memory list 6 → 8 git); the key's status hash now covers the copy
  (`state.test.ts`, `snapshot.test.ts` compare `contentKey`); `cli-not-found` details
  (`adapter.test.ts`, `projects.test.ts`, the two contract tests).
- **Red checks** (the code was written before most of its tests in this pass, so each guard was
  removed in turn and its test seen failing, then restored): the `registerGitRoutes` line
  (`launcher/git-routes.test.ts` fails); row 8 (`repository-status.test.ts` › row 8 fails);
  `GIT_ALLOW_PROTOCOL` in `transportEnv` (`git-routes.test.ts` › bug-013 fails); the adapter's
  redaction (`adapter.test.ts` › bug-012 fails); the owner check (`git-routes.test.ts` › D33-1
  fails); `maintenance.auto=false` (`transport-facts.test.ts` › maintenance fails).
- **Deviations from the design:** the `SyncStatus` is owned by `Snapshots` (`snapshots.sync`, so
  it is dropped when a project closes and needs no `start.ts` wiring); `registerProjectRoutes`
  options are unchanged. A refused update (409) is also kept as `sync.update.lastError` (spec-010
  §5, manual or automatic); a refused or failed fetch keeps only git failures. A cancelled fetch
  or push answers 500 `internal` to a client that has left; nothing is recorded.
- **bug-012 scope (C2):** `cli-not-found` drops `detail.path` (not redacted): the web reads only
  `detail.command` (`web/src/api/error-message.ts` passes every string detail; the catalogue text
  `error.cliNotFound` uses `{command}` only; the add-project and switcher code read the list item's
  `command`).
- Docs: spec-010, spec-004, spec-006 and adr-001 D6 amended in place (Process Notes 2026-10-15);
  `docs/user-guide.md` 0.7 (what runs during a clone, a local repository of another user, the
  transports with `GIT_ALLOW_PROTOCOL`); `README.md` minimum git version; `test/README.md` 0.33;
  `CHANGELOG.md` *Unreleased* › *Fixed* (bug-010, bug-012, bug-013). The user guide states the clone
  only: the transport statement is in spec-010 §4 until the sidebar tasks (039, 040) ship the
  controls and document them.

#### AC closure

| AC | Proved by |
|----|-----------|
| TT-STATE-04 | `test/server/git/copy-state.test.ts` (§1 rows); `test/server/http/repository-status.test.ts` › row 8 on the FRESH state; `test/server/http/git-routes.test.ts` › update (G-12.1 / Y-05.1, Y-06.1, Y-06.2, Y-01.3, not cancellable) |
| TT-SEC-08 | `git-routes.test.ts` › TT-SEC-08 (three identity kinds × update, push, submit, approve, reject → 403, 0 processes; fetch 200; identity again under the lock) |
| Transport | `test/server/git/transport.test.ts` (arguments, environment); `git-routes.test.ts` › fetch (RP-36, `git-refused` + `lastError`, never logged, cancel), push (never forced, D33-8), nothing to do |
| Key and events | `repository-status.test.ts` › the key and the CLI cache; `git-routes.test.ts` › repo events on a last-error change only |
| REQ-INT-06 | `git-routes.test.ts` › REQ-INT-06; `process-audit.test.ts` (updated counts) |
| bug-010 | docs above; `test/server/git/local-remote.test.ts`; `test/server/http/projects.test.ts` › bug-010 (clone 422); `git-routes.test.ts` › D33-1 (fetch 409) |
| bug-012 | the project list is proven by `cli-not-found` (no path, `projects.test.ts`): its `dna show` refusal never reaches a body, the name falls back to the folder's (`project-list.ts`, S-27.1); `test/server/git/redact.test.ts`; `adapter.test.ts` › bug-012; `git-routes.test.ts` › bug-012 route families (a read route, a governed write) and the fetch `git-refused` message; `cli-not-found` without a path: `adapter.test.ts`, `projects.test.ts`, `api-writes-schema.test.ts` |
| bug-013 | `test/server/git/transport-facts.test.ts` › bug-013 (the override reproduced, then refused); `clone.test.ts` › `GIT_ALLOW_PROTOCOL`; `git-routes.test.ts` › D33-2 (`ext::` remote with `GIT_ALLOW_PROTOCOL=ext`) |
| Catalogue | `test/web/api/error-message.test.ts` (the new codes, the `{files}` list) |

### checks (2026-10-15, HEAD before this note `8cd1f2e`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api` | OK (0 warnings after a TypeDoc link was made plain text) | — |
| `check_tasks.py v0.2` | OK | — |
| `npm run test:coverage` (on `8e043fe`; includes the public-text check) | 146 files passed, 1 skipped; **2613 passed / 1 skipped**; statements 96.62 %, branches 91.40 %, functions 97.29 %, lines 98.27 % (`writes/transport.ts` 92.9 %, `git/sync-status.ts` 95.1 %) | 5.9 → 38.6 |
| `npm run test:e2e:chromium` (on `8e043fe`) | **193 passed, 1 failed** (16.6 min): S-27.1 expected the CLI's message with the absolute project path, which bug-012 now redacts — the test changed to expect `<project>` (`test/e2e/dna.spec.ts`), then `dna.spec.ts` passed on Chromium (4/4) and on the three engines (12/12) | 36.8 |
| `npm run test:smoke` (`clone.ts`, `start.ts` changed) | **4/4 passed** | 27.1 |
| `npm run test:timing` | **skipped**: load ≥ 12 | 27.1 |

A first `test:coverage` run on `a09acaa` failed 2 tests, fixed in `8e043fe`: the public-text check
read a Windows path and a home-folder form in two new tests (built from parts now), and the pack
guard read a refusal message ending in "fetch from" followed by a quoted string as an import (the
message reworded). No console of this worktree left running; no `wfui-task-033-*` entry in the
system temporary directory.

e2e closure — none of this task's own (see the closure table of the design); the one e2e change
is S-27.1's expectation (bug-012).

### review round 1 (2026-10-15)

Independent review **CHANGES REQUESTED** (F1–F8), adversarial security review **CHANGES
REQUESTED** (S1–S9). Red tests first: the red commits are the two
`test(server): red — …` commits before `c945c50`; the route cases of S1–S5, F4 and F5 passed on
first run (the helper had been rewritten against its unit tests first), so each was checked by
removing its guard (S1 clone, S2 `--all`, S4 top level: each test fails, then restored).

| Id | Change | Test |
|----|--------|------|
| F1, S1–S5 | one helper `foreignLocalRemote(urls, base)` (`server/src/git/local-remote.ts`) for the clone and the three routes: every `file://` URL whatever its host (S1); every URL of `git remote get-url --all [--push]` (`GitReads.remoteUrls`, S2; a remote without URL = the path of its name); git's suffixes and `gitdir:` files (S3); relative paths joined to the repository's top level (`ProjectSnapshot.topLevel`, S4), the clone's base unchanged; resolved by `realpath`, never `path.resolve` first (S5); no readable folder → refused (fail closed) | `test/server/git/local-remote.test.ts` (rewritten); `git-routes.test.ts` › review round 1 (S1 fetch, S2 push, S3/S5, S4 sub-folder project); `projects.test.ts` › S1 clone |
| F2 | `GitTransport.run` catches any unexpected error (a git read under the lock, the layout): 500 `internal`, logged `{project, op, kind, exitCode}` only | `git-routes.test.ts` › F2 (marker in git's stderr and the root never logged) |
| F3 | — (row 8 already ran before any `wingfoil` process on a warm state: the CLI cache is keyed on `contentKey`, D33-6) | `git-routes.test.ts` › F3 table (behind / diverged / detached × submit / approve / reject); `repository-status.test.ts` › row 8 asserts `p.wingfoil === 0` |
| F4 | — | `git-routes.test.ts` › F4 (push cancelled against the held remote); both cancel tests assert the process group is gone (`process.kill(-pid, 0)`) |
| F5 | — | `clone.test.ts` › F5 (real `runClone` of `ext::sh -c touch% <marker>` with `GIT_ALLOW_PROTOCOL=ext`: refused, no marker) |
| F6 | the `--reason` usage error answered as `cli-refused` goes through `redactLocalPaths` (`governed.ts`) | `git-routes.test.ts` › F6 |
| F7 | spec-010 §8 rows name `remote-not-owned`; README "POSIX only, not checked on Windows" | — |
| F8 | the bug-012 row of the AC closure names how the project list is proven | — |
| S7 | userinfo removed up to the last `@` before the host and with quotes; `user:password@host` without a scheme; wider punctuation after a root | `redact.test.ts` › S7 |
| S9 | a JSON `null` body → 400; the transport logs `project` (pino's `pid` is the process id); `sshInEnvironment` case-sensitive on POSIX | `git-routes.test.ts` › S9; `transport.test.ts` |
| S6 | accepted residual (R2) | — |
| S8 | R3 | below |

Decisions of the approver (2026-10-15):

- **R1 = (a)** — a local remote's path (every path its URLs resolve to, inside the home folder or
  the project or not) is shown as `<remote>` in `git-refused` and `lastError`. Test:
  `git-routes.test.ts` › git refuses (marker in the remote's path), `redact.test.ts` › R1. spec-004
  §5 and spec-010 §4 Process Notes.
- **R2 = (a)** — S6 accepted residual: a push to a local remote runs `git-receive-pack` there
  without the `-c` settings (git drops `GIT_CONFIG_PARAMETERS`), so the remote repository may run
  `gc --auto`, which can outlive a cancel or the stop sequence. Stated in spec-010 §4 next to D33-3;
  no code change.
- **R3 = (a)** — transport children get the absolute entries of `PATH` only (`absolutePath`,
  `transportEnv(sshConfigured, env)`). Test: `git-routes.test.ts` › R3 (a relative `.` entry and an
  `ssh` script in the repository: no marker), `transport.test.ts` › R3.

Docs: spec-010 (§4, §8, Process Note), spec-004 §5, spec-006 §3 (Process Notes 2026-10-15),
README.

### checks after review round 1 (2026-10-15, HEAD before this note `8ca635c`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2` | OK (0 warnings) | — |
| `npm run test:coverage` | 146 files passed, 1 skipped; **2638 passed / 1 skipped**; statements 96.60 %, branches 91.22 %, functions 97.30 %, lines 98.26 % | 6.0 → 21.2 |
| `npm run test:e2e:chromium` | **194 passed** (8.6 min) | 16.8 → 21.9 |
| own e2e spec on three engines | `test/e2e/dna.spec.ts` unchanged since its 12/12 run above | — |
| `npm run test:smoke` | **4/4 passed** | 15.1 |
| `npm run test:timing` | skipped (load ≥ 12) | 15.1 |

No console left running; no `wfui-task-033-*` entry in the system temporary directory.

### review round 2 (2026-10-15)

Independent and adversarial reviews round 2 **CHANGES REQUESTED** (every round-1 fix verified).
Decided by the approver (2026-10-15), each fixed with a red test first (the `test(server): red —
review round 2` commit):

| Id | Decision and change | Test |
|----|---------------------|------|
| F9 | a local remote or clone source no folder of which git could read is refused with the new code `remote-unreadable` (409 on fetch, update, push; 422 on a clone; catalogue `error.remoteUnreadable`), not `remote-not-owned`; `localRemoteProblem` replaces `foreignLocalRemote` and answers which (another user's folder wins over an unreadable URL); schemas `git.refusal`, `projects.refusal`, `repository` (`update.lastError.code`), `GitTransportRefusalCode`, `ProjectRefusalCode`. The git-refused test keeps an existing folder that is not a repository (git refuses it); a missing local path now answers `remote-unreadable` | `local-remote.test.ts` › F9; `git-routes.test.ts` › F9 (no "another user" text); `projects.test.ts` › F9 |
| F10, S11 | `~` (the git environment's `HOME`) and `~user` (the user database: `os.userInfo()` for the server's own user, `/etc/passwd` for another — a user known only through NSS/LDAP is not expandable) expanded as git's `enter_repo` for fetch, update, push; not expandable → `remote-unreadable`; the clone does not expand (`git clone` takes the path as written) | `local-remote.test.ts` › F10, S11, clone; `git-routes.test.ts` › F10 (own `~/…` → 200), S11 (`~root` → 409 `remote-not-owned`; a committed `~root/x.git` folder does not bypass) |
| S10 | `X::` is a remote helper only when `X` matches `^[A-Za-z][A-Za-z0-9+.-]*` from the start; anything else follows git's local rule | `local-remote.test.ts` › `own/u::sr`; `git-routes.test.ts` › S10 (R1 redaction covers its path) |
| S12 | the clone's environment keeps the absolute `PATH` entries only (`cloneEnv`, `absolutePath`) | `clone.test.ts` › S12 (a relative `.` in `PATH`, the user's LFS filter, a committed executable `git-lfs`: no marker after the clone; red: the marker was written) |
| F11, S13 | the scheme-less `user:password@` is removed only after the start, a space or a quote, with a user part of `[A-Za-z0-9._~%+-]`: `unable to look up u:tok@host` → `host`; `x,u:tok@host` and `[u:tok@host]` kept; `Author: a:b@c.d` → `Author: c.d` | `redact.test.ts` › F11/S13 |

Docs: spec-010 §4, §5, §8, spec-006 §3, spec-004 §5 (Process Notes 2026-10-15).


### checks after review round 2 (2026-10-15, HEAD before this note `22fbd92`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2` | OK (0 warnings) | — |
| `npm run test:coverage` | 146 files passed, 1 skipped; **2657 passed / 1 skipped**; statements 96.58 %, branches 91.20 %, functions 97.31 %, lines 98.27 % (a first run failed the public-text check on literal `~/…` test strings, now built at run time) | 6.4 → 20.4 |
| `npm run test:e2e:chromium` | **194 passed** (6.7 min) | 16.0 → 16.9 |
| own e2e spec on three engines | none touched in this round | — |
| `npm run test:smoke` | **4/4 passed** | 10.4 |
| `npm run test:timing` | **passed**: Vitest 3/3, Playwright 18/18 | 9.1 → 5.5 |

No console left running; no `wfui-task-033-*` entry in the system temporary directory.
