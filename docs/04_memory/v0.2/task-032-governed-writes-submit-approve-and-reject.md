---
id: task-032-governed-writes-submit-approve-and-reject
type: task
title: "Governed writes submit approve and reject"
status: in-progress
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-03"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-030-ui-settings-store-and-settings-api"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The first governed writes: `POST /api/p/:pid/elements/:eid/submit`, `/approve`, `/reject`
(spec-004 §3) through the CLI adapter (`memory submit`, `memory approve --reason`, `memory reject
--reason`), under the per-project write lock, with the preconditions of spec-004 §4 rows 1–7 and
9 (row 8 is added by task-033-git-copy-state-repository-status-and-transport-routes), the write response of §5 (`push` in its full shape, `status:
off` until task-034-auto-sync-scheduler-and-auto-push), the `write` event of §6, and the action log of spec-006 §2 (REQ-SEC-10).

**Backlog items:** TT-STATE-03, TT-SEC-10

## Acceptance Criteria

- **TT-STATE-03** (REQ-STATE-03 — Governed actions refused on local changes): [percentage] 100 % of governed-action requests on an element with local changes get HTTP 409 and start 0 CLI processes, including requests sent directly to the API. *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): G-11.1, G-11.2, G-11.3, X-07.3.
  Here: API tests on copies of the fixtures — an element file with local changes (modified, staged, untracked) → 409 `local-changes`, 0 `wingfoil` processes, evaluated from a fresh `git status` under the write lock; a change to another file does not refuse (G-11.3).
- **TT-SEC-10** (REQ-SEC-10 — Dogfooding): [percentage] Between the v0.2 and the v0.3 releases, ≥ 80 % of the approve/reject commits of this repository have their hash in the server's local action log (hash and time, no other data). (v0.2 scope: this repository.) *Verified by:* retrospective (`wf(…)` history).
  Scenarios (`@v0.2`): G-04.1.
  Here (RP-45): every commit of `commits[]` of a successful governed write is appended to `actionLog` as `{sha, at}`, capped by `actionLogCap`; a script (e.g. `scripts/action-log-ratio.mjs`) computes the ratio of this repository's `wf(…)` approve/reject commits in a range found in a given state file; the number itself is recorded at the retrospective after v0.2 (hand transitions are outside it, RP-13).

- Preconditions (spec-004 §4): rows 1–4 and 6 start no process; row 5 (user not identified) → 403
  `not-in-team`, 0 processes (RP-48: the record TT-SEC-08 is closed by task-033-git-copy-state-repository-status-and-transport-routes); row 9
  (`expectedStatus` differs) → 409 `element-changed`, no CLI process; a blank `reason` → 400
  `invalid-request` (G-07.2); a CLI refusal → 422 `cli-refused` with the CLI's message verbatim
  (REQ-INT-04); success → 200 `write.response.schema.json` and one `write` event.
- REQ-SEC-05: the reason (user input) reaches the CLI as one argument, never through a shell
  (`SHELL_PAYLOAD` probe of `test/README.md`); REQ-ARC-03: every commit is a CLI `wf(…)` commit.

e2e closure — G-11.1, G-11.2, G-11.3, X-07.3 close in task-038-submit-footer-action-toasts-and-blocked-actions; G-04.1 in task-037-gate-footer-with-every-outcome.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review.

## Implementation Notes

- `spec-004` §3 (element write routes, `element.submit.request`, `element.decision.request`,
  `write.response`), §4 rows 1–7, 9, §5, §6 (`write`); `spec-006` §2 (`actionLog`); `spec-003` §6
  (the server re-evaluates enablement on every write); `spec-001` §3 (`memory submit`/`approve`/
  `reject` already in `server/src/cli/commands.ts`); `adr-001` D5 (write lock), D7; directive
  `cli-only-writes`; dl-002 (permissions left to WingFoil: the role is not checked by the server).
- W-24: `memory submit` commits the target's uncommitted edits — hence the fresh row-7 check.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-14)

Read: this task; task-030's Execution Notes (the only `depends_on`, hard gate dl-015);
`release-planning-rel-v0.2-plan` RP-11, RP-12, RP-13, RP-14, RP-43, RP-45, RP-47, RP-48, RP-55;
`dev-loop-rel-v0.2-plan` Sessions 1–2 (W0-1 … W0-10, W1-1 … W1-4, hand-overs to Wave 2);
spec-004 §3–§7, spec-006 §2/§4, spec-003 §6, spec-001 §1–§3, spec-010 §6; adr-001 D5/D7;
directive `wingfoil-cli` (*Known behaviours* W-05, W-13, W-15, W-22, W-24, W-26), `cli-only-writes`;
`server/src/cli/` (`adapter.ts`, `commands.ts`), `server/src/process/write-lock.ts`,
`server/src/snapshot/` (`snapshots.ts`, `snapshot.ts`, `state.ts`), `server/src/git/git.ts`,
`server/src/reads/` (`element.ts`, `project-reads.ts`), `server/src/http/` (`project-routes.ts`,
`role-view.ts`, `app.ts`, `settings.ts`), `server/src/identity/snapshot-identity.ts`,
`server/src/launcher/start.ts`, `server/src/state/store.ts`, `contracts/src/events.ts`,
`test/server/snapshot/support.ts`, `test/server/http/read-console.ts`, `test/harness/security.ts`;
the pinned CLI's own write path (`wingfoil@0.2.2` `dist/storage/commit.js`,
`dist/core/memory-transition.js`, `dist/core/write-guard.js`, `dist/core/require-reason.js`).

**depends_on (task-030, dl-015).** The action log is appended through `StateDraft.actionLog`
inside one `store.transaction` (the store trims to `actionLogCap` at the write, W1-1 / D30-4);
`autoPush` is read with `StateStore.settings()` — here only through the push port (D32-7); a
mutation on a newer build's (read-only) state applies in memory only (D30-5); a no-op transaction
writes nothing. New suites use `TempWorkspace` (W0-2); fresh-read preconditions (W0-3).

**What the CLI and git actually do (probes, git 2.43, `wingfoil@0.2.2`).**

- Every transition writes the element and commits with `git add -- <path>` then
  `git commit --only --quiet -m <msg> -- <path>`: one commit, only that path, whatever else is
  staged (so G-11.3 — another file changed — cannot leak into the commit).
- `approve`/`reject` refuse a target that `git status --porcelain -- <path>` lists; `submit`
  commits the target's pending edits (W-24).
- **A change git status does not show is still committed**: with `git update-index
  --assume-unchanged` (or `core.ignoreStat`) on the element file, an edit leaves `git status`
  empty, and `git add` + `git commit --only` commit it (probed). `skip-worktree` makes `git add`
  fail instead. A check on `git status` alone — the spec's row 7 and the CLI's own guard — lets a
  UI action commit such an edit (D32-1).
- A `--reason` with a line starting `Approver:` or `Reason:`, or ending in a `Key: value`
  paragraph, is a CLI *usage error*: exit 2, which the adapter maps to 500 `internal` (D32-5).
- The CLI's JSON output carries no commit sha (`{id, path, from, to[, reason]}`); the commit is
  found from git (D32-4). Subjects: `wf(<type>): <verb> <id>` plus ` [<from> → <to>]` for approve
  and reject (W-15).

#### AC classification

| AC part | kind | test |
|---------|------|------|
| contracts first (RP-43): `element.submit.request`, `element.decision.request`, `write.response` | **red-first** | `test/contracts/api-writes-schema.test.ts` (new) |
| rows 1–2 (403/401) on the three routes, 0 processes | **red-first** | `test/launcher/local-security.test.ts` appended block (404 today) |
| row 3 unknown `:pid` → 404 before the body; row 4 body → 400 `invalid-request` (blank / whitespace-only reason G-07.2, missing / extra keys, wrong types, D32-6 bounds), 0 processes | **red-first** | `test/server/http/element-writes.test.ts` (new) table |
| row 5 not identified (`not-in-team`, `no-identity`, `ambiguous`) → 403 `not-in-team`, 0 processes (RP-48) | **red-first** | same file, over `AuditedRunner` on a warm state (D32-3) |
| row 6 version out of range → 409 `unsupported-version`, 0 processes | **red-first** | same file (fake CLI version, as v0.1's version tests) |
| unknown `:eid` (incl. `--version`, `..%2Fx`, an id of another type) → 404, 0 `wingfoil` processes (D32-10) | **red-first** | same file |
| row 7 TT-STATE-03 (G-11.1, G-11.2, X-07.3 API side): modified, staged, untracked, deleted, assume-unchanged, `core.ignoreStat`, skip-worktree → 409 `local-changes`, 0 `wingfoil` processes, fresh under the lock (a change made after the last observed state is seen) | **red-first** | same file, fixture copies |
| G-11.3: another file changed (also staged) → not refused; the commit holds only the element | **red-first** | same file (commit's file list read with git) |
| row 9 `expectedStatus` differs → 409 `element-changed`, no CLI process (RP-12); two concurrent approves → one 200, one 409, one commit | **red-first** | same file |
| CLI refusal (exit 1) → 422 `cli-refused`, message verbatim (REQ-INT-04): submit from a waiting state, approve without the `approver` role (W-13) | **red-first** | same file |
| a reason the CLI refuses as usage (D32-5) | **red-first** after the decision | same file |
| success → 200 `write.response.schema.json` (`push: {status: "off"}`), `commits` = the CLI's `wf(…)` commit (REQ-ARC-03), exactly one `write` event `{pid, eid, commit}` sent after the snapshot moved to the new state | **red-first** | same file + `InProcessEventBus` |
| REQ-SEC-05: `SHELL_PAYLOAD`, a leading `-`, newlines and quotes in the reason reach the commit message as one argument; `pwned()` false | **red-first** | same file |
| TT-SEC-10 (RP-45): each commit of `commits[]` appended as `{sha, at}`, cap applied; a failed state write never fails the write (D32-8) | **red-first** | same file + `test/server/state/store.test.ts` is not changed (the cap is task-030's) |
| the ratio script | **red-first** | `test/scripts/action-log-ratio.test.ts` (new) |
| CLI facts relied on (one scoped commit, W-24, exit 2 on reason defects, the subject form) | **characterisation** | `test/server/cli/governed-verbs.test.ts` (new), pinned CLI on fixture copies |
| process audit (allow-list incl. `hash-object`, D32-1) | **red-first** | `test/server/snapshot/process-audit.test.ts` stays green; the new test asserts every git process of a write is on `GIT_ALLOWED_SUBCOMMANDS` and that no `wingfoil` process starts before row 9 passed |

#### Request flow (one route handler for the three verbs)

1. Guards (rows 1–2, existing hooks). 2. `onRequest`: unknown `:pid` → 404 (as `role-view.ts`).
3. Body: strict Ajv on the request schema (no coercion) → 400. 4. Snapshot view of the last
observed state: identity (row 5), detected version (row 6), `:eid` in the state's cached
`memory search` → 404 (D32-3, D32-10). 5. `writeLock.run(<key>, …)` (D32-2): row 7 fresh
(`git status` + blob identity of the element file, D32-1) → 409 `local-changes`; (row 8: task-033
inserts here); row 9: fresh direct read of the element file at its listed path (confined, as
`reads/element.ts`), `id` = `:eid` and `status` = `expectedStatus`, else 409 `element-changed`
(missing / mismatch) or 502 `read-error` (shape / outside); then the CLI: `memory submit -- <id>`,
`memory approve --reason <r> -- <id>`, `memory reject --reason <r> -- <id>` (`optionArg` puts a
reason starting with `-` as `--reason=<r>`); commits read (D32-4); action log appended (one
transaction); `snapshot.check()` (git only) so a read after the `write` event sees the new state;
push port (D32-7). 6. 200 `{result, commits, push}`; `write` event. CLI errors through
`cliErrorEnvelope` (422 / 502 / 504 / 500).

#### File layout (planned)

- `contracts/api/element.submit.request.schema.json`, `element.decision.request.schema.json`,
  `write.response.schema.json` (new, committed first with their test).
- `contracts/src/writes.ts` (new): `ElementSubmitRequest`, `ElementDecisionRequest`,
  `WriteResponse`, `WriteCommit` `{sha, subject}`, `WritePush` `{status, code?, message?}`,
  `WritePushStatus`; one appended export line in `contracts/src/index.ts`.
- `server/src/writes/governed.ts` (new): the precondition pipeline and the write
  (`GovernedWrites`, `GovernedVerb` = `submit` | `approve` | `reject`), the commit attribution, the
  action-log append, the `WritePush` port with `PUSH_OFF` (D32-7).
- `server/src/http/element-writes.ts` (new): `ELEMENT_WRITE_PATHS`,
  `registerElementWriteRoutes(app, { store, snapshots, writeLock, bus, push? })`.
- `server/src/git/git.ts`: `hash-object` appended to `GIT_ALLOWED_SUBCOMMANDS` (read: no `-w`);
  `GIT_READ_ARGS` gains the blob read and the commit read; `GitReads.elementBlobs(path)` (HEAD,
  index and working-tree blob ids — `rev-parse HEAD:./<p> :0:./<p>` and `hash-object -- <p>`)
  and `GitReads.commitsSince(before)` (`log --first-parent --format=… <before>..HEAD`, bounded).
- `server/src/snapshot/snapshot.ts` / `snapshots.ts`: the snapshot exposes its `GitReads` for
  writes (`freshStatus()`, `elementBlobs()`, `commitsSince()`) and `lockKey` (D32-2: the git
  common directory from the layout already read at open).
- `server/src/launcher/start.ts`: the existing `new InProcessWriteLock()` hoisted into one
  `const writeLock` shared by `ProjectList` and the new routes; one appended `register` line.
- `scripts/action-log-ratio.mjs` (new, D32-9).
- Docs: spec-004 dated Process Note (D32-1, D32-2, D32-4, D32-5, D32-6, D32-10 as decided);
  adr-001 D5 Process Note if D32-2 (b); `test/README.md` version line (0.31) + one sentence per
  new suite; no `CHANGELOG.md` entry (no user-visible effect until task-037/038, as task-030), no
  catalogue string (the envelope message is never shown; the codes are task-038's).
  WingFoil findings (assume-unchanged edit committed by `approve`; reason defects as usage errors)
  reported to the coordinator for `wingfoil-cli` / `docs/wingfoil-feedback/` (dl-163).

#### Test plan

| Suite | File | What |
|-------|------|------|
| contract | `test/contracts/api-writes-schema.test.ts` (new) | spec examples accepted; blank / whitespace / NUL / too-long reason, missing and extra keys, every `push` shape (`off`, `pushed`, `failed` + `message` or `code`) |
| CLI characterisation | `test/server/cli/governed-verbs.test.ts` (new) | pinned CLI on kanban copies: one commit per verb with only the element; W-24; reason defects exit 2; subjects of W-15 |
| API | `test/server/http/element-writes.test.ts` (new) | real `Snapshots` over an `AuditedRunner`, fixture copies (`TempWorkspace`), memory store, `InProcessEventBus`: the §4 table with process counts, row 7 variants, G-11.3, row 9 + concurrency, 422 verbatim, success bodies validated by the schema, the `write` event, the action log and its cap, `SHELL_PAYLOAD`, eid injection, D32-2 (two pids in one repository queue), read-only state |
| git unit | `test/server/git/git.test.ts` (appended) | parsing of the blob and commit reads; `commitArg`-style refusal of a non-sha `before` |
| script | `test/scripts/action-log-ratio.test.ts` (new) | a temp repository with `wf(…)` approve / reject / submit / hand commits and a state file: the ratio, the missing list, the range |
| local security | `test/launcher/local-security.test.ts` (appended block) | the three routes × {no session 401, foreign origin 403, cross-site 403, past the guards: unknown pid 404} |

e2e: none in this task (no screen). Closure table:

| Scenario | Proved here by (API side) | Closes (e2e) in |
|----------|---------------------------|-----------------|
| G-11.1, G-11.2, X-07.3 | `element-writes.test.ts` › row 7 | task-038-submit-footer-action-toasts-and-blocked-actions |
| G-11.3 | `element-writes.test.ts` › another file changed | task-038-submit-footer-action-toasts-and-blocked-actions |
| G-04.1 | `element-writes.test.ts` › approve / reject success + action log | task-037-gate-footer-with-every-outcome |

#### Open decisions (approver)

- **D32-1 — row 7 "local changes" of the element file.** (a) spec literal: a fresh `git status`
  (the snapshot's read) lists the path; (b) ★ (a) plus the blob identity of the file: HEAD blob =
  index blob = `git hash-object -- <path>` (clean filters applied, nothing written) — fails closed
  on whatever hides an edit from status (assume-unchanged, `core.ignoreStat`, skip-worktree,
  an fsmonitor) while `git add` + `commit --only` would still commit it; `hash-object` joins the
  allow-list; 3 git processes under the lock; (c) (a) plus a refusal when `git ls-files -v` shows
  an assume-unchanged / skip-worktree flag (an enumeration: misses `core.ignoreStat` entries
  added later and fsmonitor answers).
- **D32-2 — key of the write lock.** (a) the `pid` (spec "per project"); (b) ★ the repository's
  git common directory (already read at open): two listed projects in one repository (sub-folders
  of a monorepo, linked worktrees) queue together, since index and refs are shared; the clone key
  is unaffected. Neither covers another console or a terminal (in-process lock, adr-001 D5).
- **D32-3 — rows 5–6 and the `:eid` lookup on a state no read has seen.** (a) ★ through the
  snapshot view (the page's cache): no process once the console has read the project in the
  current state — the page always has (its `repo` refetch); a direct request on an unseen state
  runs the reads a `GET` would (`dna show`, `memory search`, at most one `--version` per CLI
  resolution), never a write verb before row 9; "0 processes" is asserted on a warm state;
  (b) keep the last team and id→path map across states so rows 5–7 never start a CLI process once
  read (a stale team could let a just-removed member reach the CLI); (c) refuse 409
  `element-changed` when the state was never read (a refusal the page cannot explain).
- **D32-4 — which commits a write reports and logs.** (a) every first-parent commit of
  `<HEAD before>..HEAD`; (b) ★ those of that range whose subject is the CLI's for this write
  (`wf(<type>): <verb> <id>` then end or ` [`, W-15) — a commit another process made meanwhile is
  neither reported nor logged; CLI exit 0 with no such commit → 502 `cli-output`, nothing logged,
  no `write` event; (c) HEAD only, when its parent is the HEAD read before; else 502.
- **D32-5 — a reason the CLI refuses as a usage error (exit 2).** (a) as today: 500 `internal`;
  (b) ★ for `approve`/`reject`, an exit 2 whose CLI message names `--reason` → 422 `cli-refused`
  with the message verbatim (WingFoil stays the authority on the rule; spec-004 §5 note);
  (c) replicate WingFoil's rule in the request schema → 400 (re-implements and drifts).
- **D32-6 — bounds of `reason` and `expectedStatus`.** (a) only "one non-whitespace character"
  (a NUL or a reason over the argument limit, 128 KiB on Linux, fails the spawn → 500); (b) ★ also
  no NUL character and `maxLength` 10 000 for `reason`, `expectedStatus` 1–200 characters → 400
  `invalid-request`, no process; (c) `maxLength` 64 000.
- **D32-7 — the push part.** (a) ★ a `WritePush` port called inside the lock after the commit;
  this task wires `PUSH_OFF` (`{status: "off"}` always); task-034 supplies the implementation
  reading `settings().autoPush`; (b) read `autoPush` here and answer `off` anyway (no behaviour,
  a second place for task-034 to change).
- **D32-8 — the action-log append fails** (read-only newer state, unwritable folder). (a) ★ the
  write answers 200 (the commit exists); the failure is logged by kind; on a read-only store the
  entries stay in memory (D30-5); (b) 500 `internal` although the commit was made.
- **D32-9 — ratio script interface.** (a) ★ `node scripts/action-log-ratio.mjs --state <file>
  <rev-range>`: counts the `wf(<type>): approve|reject <id>` commits in the range (all of them, not
  only the first parent: review F1 — decisions made on task branches merged with `--no-ff`),
  prints `<logged>/<total> (<pct> %)` and the unlogged shas, `--json` for a machine form; (b) the
  state file resolved as the server does (imports `server/dist`, needs a build).
- **D32-10 — unknown `:eid`.** (a) ★ 404 `not-found` after row 6, looked up in the state's
  cached `memory search` (archived elements have no verb, spec-003); (b) also the two archived
  lists (2 more processes on a cold state; the CLI then refuses with 422).

**Accepted residual risks (stated, not decided):** an edit made by another program between the
fresh check and the CLI process (milliseconds; the CLI's own guard catches a status-visible one
for approve/reject); another console or a terminal writing at the same time (git's `index.lock`
makes one fail: a 422/500 with git's message); the repository's own commit hooks run inside
`git commit` (as for any commit the user makes; the clone-time hooks question is bug-010,
task-033).

#### Decisions (approver, 2026-10-14)

"All as recommended": D32-1 (b) fresh status plus the blob identity of the element file
(`hash-object`, never `-w`, joins `GIT_ALLOWED_SUBCOMMANDS`); D32-2 (b) the lock key is the
repository's git common directory (adr-001 D5 Process Note); D32-3 (a); D32-4 (b); D32-5 (b) 422
`cli-refused` (spec-004 Process Note); D32-6 (b); D32-7 (a) the `WritePush` port with `PUSH_OFF`;
D32-8 (a); D32-9 (a); D32-10 (a). Approved specs and ADRs are amended in place with a dated
Process Note (2026-10-14). The two WingFoil findings are written on this branch as
`docs/wingfoil-feedback/` notes and `wingfoil-cli` *Known behaviours* entries. The shared shapes are
fixed as listed above; shared files stay append-only.

### red / green / refactor (2026-10-14)

- **Contracts first (RP-43)** — `31a9ae2`: `element.submit.request`, `element.decision.request`,
  `write.response` schemas, `contracts/src/writes.ts` (one appended export line in
  `contracts/src/index.ts`), `test/contracts/api-writes-schema.test.ts`. A first draft of the reason
  pattern (`\S` between `[^\u0000]*`) accepted a NUL (`\S` matches it); the test caught it and
  the pattern now uses `[^\u0000\s]`.
- **Characterisation** — `92acf1d`: `test/server/cli/governed-verbs.test.ts`. One finding changed
  the design note: on an edit hidden by `assume-unchanged`, `memory approve` **commits it and then
  exits 1** (its post-commit scope check), leaving the commit; `memory submit` commits it with exit
  0. Both are W-28 / F-023; the reason defects are W-29 / F-024.
- **Red** — `ec8b83a`: `test/server/http/element-writes.test.ts` (did not load: no module).
- **Green** — `42e2ad6`: `server/src/writes/governed.ts` (`GovernedWrites`, `GOVERNED_VERBS`,
  `WritePushPort` + `PUSH_OFF`, `reasonRefusal`, `isWriteSubject`), `server/src/http/element-writes.ts`
  (`ELEMENT_WRITE_PATHS`, `registerElementWriteRoutes`), `GitReads.sameBlobEverywhere` /
  `commitsSince` and `hash-object` in `GIT_ALLOWED_SUBCOMMANDS` (`server/src/git/git.ts`),
  `ProjectSnapshot.lockKey` / `freshStatus` / `sameBlobEverywhere` / `commitsSince` / `cli()` and
  the realpath of the common directory passed by `Snapshots`; `start.ts`: the one `writeLock`
  shared by `ProjectList` and the routes, one appended registration. `test/launcher/element-writes.test.ts`
  (bin) and the appended `local-security.test.ts` block. Red checks: with the blob comparison
  removed, the three hidden-edit tests fail (assume-unchanged, skip-worktree, `core.ignoreStat`);
  with the registration line commented out, the bin test fails. The local-security rows pass
  without the routes too (guards before routing, 404 for an unknown route) — as in task-030.
- `3c9c3f9`: `test/server/git/git.test.ts` (appended), `test/server/writes/governed.test.ts`,
  `scripts/action-log-ratio.mjs` with `test/scripts/action-log-ratio.test.ts` (D32-9; git runs with
  `--end-of-options` before the range).
- `773ece2`: spec-004 (§3 bounds, §4 row 7 and the rows-1–6 / `:eid` / lock-key text, §5 commits
  and the `cli-refused` row) and adr-001 D5 amended in place with dated Process Notes; `wingfoil-cli`
  1.10 (W-28, W-29); `docs/wingfoil-feedback/` F-023, F-024 and their ledger rows; `test/README.md`
  0.31.
- Deviations from the design: the push port is named `WritePushPort` (the contract type
  `WritePush` is the `push` body shape — one name could not be both); the `write` event is published
  after the lock is released (the snapshot has already moved to the new state, checked by the
  tests). Row 5 with a failed `dna show` matches no member → 403 `not-in-team`, as the header
  shows it (`readOnly: not-in-team`).

### checks (2026-10-14, HEAD before this note `773ece2`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | 19.8 |
| `npm run docs:api` | OK | — |
| `check_tasks.py v0.2` | OK | — |
| `npm run test:coverage` (includes the public-text check) | 135 files passed, 1 skipped; **2374 passed / 1 skipped**; statements 96.64 %, branches 91.09 %, functions 97.29 %, lines 98.30 % (`governed.ts` 89.5 % statements) | 19.8 → 24.4 |
| `npm run test:e2e:chromium` (regression; this task has no e2e spec, W0-9) | **137 passed** (12.8 min) | 23.8 → 25.8 |
| `npm run test:smoke` (`start.ts` changed) | **4/4 passed** | 25.8 → 21.5 |
| `npm run test:timing` | **skipped**: load ≥ 12 | 21.5 |

No console of this worktree left running; no `wfui-task-032-*` entry left in the system temporary
directory.

### review (round 1, 2026-10-14)

Independent review **FAIL** (1 major, 2 minor, 4 nits); adversarial security review **FAIL**
(S1 medium, S2–S4 low, I1 info). Changes:

- **F1 (major)** — the ratio script counted first-parent commits only, missing the decisions made on
  task branches merged with `--no-ff`. `scripts/action-log-ratio.mjs` reads the whole range; D32-9
  wording and the script header amended. Red first: `test/scripts/action-log-ratio.test.ts` › "a
  task branch merged with --no-ff" fails with `--first-parent` put back, passes without.
- **F2 (minor)** — spec-004 §3 and spec-010 §4 read "the repository's write lock (its git common
  directory)"; Process Notes (spec-010 new, spec-004 extended).
  **Hand-over:** the git routes and the scheduler (task-033, task-034) take the write lock with
  `ProjectSnapshot.lockKey`, never the pid.
- **F3 (minor)** — the `write` event is published inside the lock, after the push, before the 200.
- **F4 (minor) + S3 part A** — any CLI error under the lock (exit ≠ 0, timeout, unreadable output)
  re-reads the commits since the fresh HEAD with the S4 matcher; the one found is logged,
  `snapshot.check()` runs, the event goes out, then the error is answered. Tests: exit 1 after the
  commit → 422 with the commit in `actionLog` and the event; killed after the commit → 504 with the
  commit logged; a refusal with no commit logs nothing. **S3 part B** (an element file left
  rewritten without a commit) waits for the approver; F-025 / W-30 drafted, not committed.
- **F5 (nit)** — the dead `Refusal` class removed.
- **F6 (nit)** — D32-2 also tested with a real `git worktree add` (another root, the same common
  directory): equal keys, the two writes never overlap. Both answer 200: a linked worktree has its
  own branch, so each decision is made on its branch — the "one 200, one 409" outcome holds for two
  entries on one folder (the existing twin test).
- **F7 / I1** — the adapter logs only the kind of an exit-2 message (the text before its first
  colon: `invalid flag value`, `error`, …), never a value (`usageKind`, `adapter.test.ts`). Still
  at error level for a W-29 reason refusal (`CLI invocation rejected as malformed`): follow-up
  candidate (a lower level for a refusal the route maps to 422).
- **S1 (medium)** — the `:eid` lookup used the watcher's last state while the CLI acts on the
  fresh one (an untracked copy with the same id, made within the watcher lag, was committed).
  Under the lock the state is read fresh (`snapshot.check()`); row 7 runs first on the path the
  page's state listed (no `wingfoil` process for a plain local change); when the state moved, the
  element is listed again on it (a `memory search`, a read); an id listed at more than one path →
  409 `local-changes` when one of those paths has local changes, else 409 `element-changed` (the
  CLI's choice would depend on its order; no new code); an element moved by a commit is written at
  its new path; the CLI's answer must name the checked path, else 502 `cli-output`. Tests: the
  untracked copy (409 `local-changes`, nothing committed), a committed duplicate (409
  `element-changed`), a moved element (200 on the new path), the CLI answering another path (502).
- **S2 (low)** — row 7 compares the whole entry: `ls-tree` at HEAD and `ls-files --stage` (one
  stage-0 entry, regular file, same mode and blob), `lstat` of the working file (regular file, not a
  symlink, the executable bit of the mode when `core.fileMode` holds) and `hash-object`, all with
  `--literal-pathspecs`. `ls-tree`, `ls-files`, `diff-tree` join `GIT_ALLOWED_SUBCOMMANDS` (reads).
  `GitReads.sameBlobEverywhere` is replaced by `sameEntryEverywhere`, `fileAt`, `worktreeBlob`,
  `changedPaths`; `ProjectSnapshot.freshStatus` is gone (the fresh read is `check()`). Tests: a
  hidden mode change and a symlink to an identical copy → 409 (API and `git.test.ts`).
- **S4 (low)** — the write's commit is the only one since the fresh HEAD whose subject is exactly
  the CLI's (`wf(<type>): <verb> <id>`, plus ` [<from> → <to>]` from the CLI's answer for approve
  and reject), that changes the element's path only (`diff-tree`) and holds there the blob the
  working tree holds (`ProjectSnapshot.isWriteCommit`); none or several → 502 `cli-output`. Test: a
  concurrent commit forging the subject (another file) is neither reported, logged nor announced.

#### Decisions after review round 1 (approver, 2026-10-14)

- **W2-1 (S3 part B) = (a)** — a CLI that fails leaving the element file changed (modified or
  staged) without the write's commit → 500 `write-incomplete`, `detail: { file }` (relative to the
  project); the CLI's message (it quotes local absolute paths) is logged, truncated to 200
  characters, never sent; nothing is restored. Implemented in `governed.ts` (`leftChanged`: a fresh
  check and the entry comparison after a failed CLI with no commit of its own). The bodies of every
  write refusal are now in `contracts/api/write.refusal.schema.json` (`WriteRefusalCode` in
  `contracts/src/writes.ts`), checked on every non-200 answer of `element-writes.test.ts`. Tests: a
  stale `.git/index.lock` and a failing `pre-commit` hook → 500 `write-incomplete` with
  `detail.file`, no absolute path in the body, nothing logged, no event, the file left changed.
  spec-004 §5 row added (Process Note extended).
- **W2-2 = (a)** — F-025 ("transitions are not atomic") and W-30 committed (`wingfoil-cli` 1.11).
- **Hand-overs:** task-038 adds the catalogue string of `write-incomplete` (`error.writeIncomplete`,
  argument `file`) to `web/src/api/error-message.ts` and `en.json`; task-033 adds `stale-copy` (row 8)
  to `write.refusal.schema.json`.
- **Other `cli-refused` answers that can carry a local absolute path** (reported, not changed): the
  CLI's message is sent verbatim (REQ-INT-04), and the pinned CLI wraps a failed git command as
  `Command failed: git -C <the repository's path> …` and a Node.js file error with its path. In a
  governed write this reaches the client when the CLI fails on a git command **after** its commit
  (part A: the commit is logged, the error answered as it is), or when the element file disappears
  between the fresh check and the CLI's own read. The v0.1 read routes (`dna show`, `memory search`,
  `memory history`, …) map any CLI refusal the same way.

### checks after review round 1 (2026-10-14, `8f29ab5` + `d840d91`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck` | failed on `8f29ab5` (a missing `WriteRefusalCode` import in `api-writes-schema.test.ts`), clean on `d840d91` | 11.8 |
| `npm run lint`, `npm run format:check` | clean | 11.8 |
| `npm run docs:api`, `check_tasks.py v0.2` | OK | 11.8 |
| `npm run test:coverage` (on `8f29ab5`; `d840d91` changes one test import only, its file passes) | 135 files passed, 1 skipped; **2410 passed / 1 skipped**; statements 96.55 %, branches 91.07 %, functions 97.31 %, lines 98.26 % | 12.5 → 27.9 |
| `npm run test:e2e:chromium` | **137 passed** (17.0 min) | 27.9 → 34.0 |
| `npm run test:smoke` | **4/4 passed** | 34.0 → 29.6 |
| `npm run test:timing` | skipped (load ≥ 12) | 29.6 |

No `wfui-task-032-*` entry left in the system temporary directory.
