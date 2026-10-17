---
id: dev-loop-rel-v0.2-plan
type: plan
title: "Dev-loop — rel-v0.2"
status: active
version: "0.7"         # optional — plan version
workflow: "dev-loop"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.7 · **Date:** 2026-10-17 (0.1: plan created, Wave 0 scope; 0.2: Wave 0 session log, e2e engine rule W0-9; 0.3: Wave 1 session log; 0.4: Wave 2 session log; 0.5: Wave 3 session log, frontmatter version aligned; 0.6: Wave 4 session log; 0.7: Wave 5 session log, machine-free slot for heavy gates)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`) phase `implementation` = `dev-loop` iterated over every task with status `backlog`
and `release: v0.2` (`.wingfoil/workflows/custom/release-cycle.yaml` v1.1, `dev-loop.yaml` v1.4)
**Roles:** developer (start, red, green, refactor, done), architect (design), reviewer (review),
approver (gates) — Roberto Pompermaier holds all of them; the agent develops, drafts and runs the
independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`in-development`, `24c2dbe`); tasks
`docs/04_memory/v0.2/task-026` … `task-042` (`backlog`); bug-008 (`planned`, absorbed into
task-026); tech-specs `spec-001` … `spec-004`, `spec-006` … `spec-010` (`approved`, spec-010 new in
v0.2, the others amended in place at `release-planning`); ADRs `adr-001`, `adr-002`; BDD
conventions `docs/02_requirements/02_bdd/00_conventions.md`
**Evidence:** `release-planning-rel-v0.2-plan` (`done`, merge `12182cd`; decisions RP-1 … RP-55);
dl-006 (retrospective v0.1, actions 1, 4, 6); directives `wingfoil-cli` v1.9 (W-01 … W-27),
`cli-only-writes` v1.6, `claim-evidence`

Why now: `minor-v0.2` is `in-development` and its 17 tasks are `backlog`; `release-cycle` phase
`implementation` runs `dev-loop` once per task. One plan covers the whole phase; each wave is run
by one session and logged below.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `release-planning-rel-v0.2-plan` is `done`; `check_tasks.py v0.2` → 17 tasks · 46 backlog items
  · 46 listed, OK (the checker defaults to v0.1: always pass `v0.2`).
- Before task-027: the approver has installed the WebKit system dependencies
  (`npx playwright install-deps`, RP-44) — done 2026-10-12.

Produces: the code of `server/`, `web/`, `contracts/` and the governance tooling with their tests;
every v0.2 task `done`, merged to `main`; each task's **Execution Notes** filled per phase; one row
per wave in the release's effort table (dl-006 action 6).

## Phases / Steps

Waves (RP-43, RP-55); critical path 026 → 030 → 032 → 033 → 034 → 038/039 → 040.

| Wave | Tasks | Theme |
|------|-------|-------|
| 0 | task-026, task-028, then task-027 | governance: load-independent tests and temp folders (bug-008), public-text check, e2e on Firefox and WebKit |
| 1 | task-030, task-031, task-035 | settings store and API, Today API and memory events feed, *How to join* |
| 2 | task-032, task-036 | governed writes and action log, Today screen |
| 3 | task-033, task-037 | git copy state and transport routes (spec-010), gate footer |
| 4 | task-034, task-042 | auto-sync scheduler and auto-push, notification bell |
| 5 | task-038, task-039, task-041 | submit footer and toasts, sidebar status and fetch, settings page |
| 6 | task-040 | update and push from the sidebar (closes G-13.2's sidebar step, RP-52) |
| any | task-029 | npm publishing pipeline (RP-54), before release validation; registry setup by the approver before `release-submit` (RP-46) |

Per task (`dev-loop` v1.4):

| Phase | What happens | Who |
|-------|--------------|-----|
| start | `backlog → in-progress` **by hand** (W-20): set `status:` and commit `wf(task): <id> [backlog → in-progress]` on `main`; a bug the task absorbs `planned → in-progress` by hand (`wf(bug): <id> [planned → in-progress] — <task> started`, W-26); branch `task/<task-id>`, worktree `.worktrees/<task-id>` | agent (coordinator) |
| design | classify each AC red-first / characterization and read the Execution Notes of every `depends_on` task (hard gate) — both recorded in the task's Execution Notes; a spec gap → numbered decisions with a recommended option, answered by the approver; an approved spec is amended in place with a dated Process Note | agent; approver for decisions |
| red / green / refactor | tests first; `refactor` gate: typecheck, lint, format, `test:coverage` ≥ 80 %, `docs:api`, `test:e2e:chromium` + the task's own e2e specs on three engines (W0-9), `check_tasks.py v0.2` | developer agent |
| review | independent fresh-context read-only review agent, repeated until PASS; adversarial security reviewer who runs the tools itself for task-032, task-033, task-034 and task-026's `clone.ts` change (RP-47); `main` merged into the task branch, then `memory submit` (`in-progress → in-review`) | coordinator; reviewer agents |
| done | `memory approve --reason …` (`in-review → approved`) run by the approver in the checkout holding the task; merge to `main` with `--no-ff` (within a wave in task-number order, each rebased/merged on `main` first, RP-55); push; remove the worktree; `approved → done` **by hand**, commit `wf(task): <id> [approved → done]`; push | approver, coordinator |

Rules for every wave:
- Parallel developer agents, one per worktree; the coordinator owns transitions, reviews, merges and
  pushes. Developer-agent rules are given to each agent at launch (updated for v0.2: folder
  `docs/04_memory/v0.2/`, `check_tasks.py v0.2`, the e2e engine rule W0-9, `test:smoke` gate,
  RP-53 fetch interval 15 s in `test:e2e` and real budgets only in `test:timing` on Chromium,
  append-only shared files of RP-43/RP-55).
- `test:timing` only at load < 12; otherwise at the end of the wave on `main`, otherwise deferred
  to release validation and recorded here. `npm test`/`test:coverage`, `test:e2e` and `test:smoke`
  never run concurrently in one checkout.
- Wave gate on `main` at the end of each wave: full suite, `test:e2e` (three engines, W0-9),
  `test:smoke` (task-026 AC-3).
- Out-of-scope defects: bug-ingest (add + submit by the agent, triage approve by the approver),
  then absorption into a task. A new task in `docs/04_memory/v0.2/` follows W-27 (placeholders so
  the number continues from task-042; no commit contains them).

## Handoff

- **Agent:** runs each task through `dev-loop` with developer agents, the independent and
  adversarial reviews, `memory add`/`submit`, the hand transitions, the merges and pushes; keeps
  the session log and the release's effort table.
- **Human (approver):** answers the numbered decisions; runs every `memory approve` (one command
  given by the agent); authorises merges to `main`.
- **Checkpoints:** design decisions; end of review (approve); before each merge; end of each wave.
- **Completion:** every v0.2 task `done` and merged; plan finalized by hand (`status: done`, commit
  `wf(plan): finalize dev-loop-rel-v0.2-plan [active → done]`, W-04).
- **Next:** Wave 6 — task-040 (closes G-13.2's sidebar step, RP-52); task-029 before release
  validation.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Wave 0: governance (2026-10-12)

- Start confirmed by the approver: Wave 0 as planned (task-026 and task-028 in parallel, then
  task-027); parallel developer agents in worktrees, as in v0.1.
- `npx playwright install-deps` first failed on an unrelated stale apt source of the machine
  (fixed by the approver); then it succeeded (RP-44 precondition met).
- **Done and merged** (`--no-ff`; each after an independent fresh-context review repeated until
  PASS and the approver's `memory approve`): task-026 (merge `b6c36d7`, done `5a2d55c`; review
  2 rounds, adversarial security review of the `clone.ts` change PASS, RP-47), task-028 (`e87f375`,
  `9fb5cd3`; 3 rounds), task-027 (`7fad0cc`, `8009e4a`; 2 rounds). `main` merged into each task
  branch before submit; within the wave merged in task-number order (RP-55).
- **Decisions** (the approver, "as recommended" unless noted; details in each task's Execution
  Notes):
  - **W0-1 (D26-1)** bug-008: `core.hooksPath` = the clone module's own regular file (git probes
    `<file>/<hook>` → `ENOTDIR`); no folder is created, so nothing outlives a killed console; the
    clone is refused before any git process when the file is not a regular file. Checked in every
    shipped form (sources, `server/dist` through the bin, the packed install in `test:smoke`).
  - **W0-2 (D26-2)** one temporary root `wfui-run-*` per test run, set by every runner's global
    setup (`TMPDIR`/`TMP`/`TEMP`), removed by its owner, swept at the next start only when its
    owner is gone; `TempWorkspace` stays the API for new tests.
  - **W0-3 (D26-3, D26-4, D26-5)** fresh-read preconditions on the three named files plus the
    `@live-refresh` tests; `test:smoke` as a wave gate in `test/README.md` and `CLAUDE.md`; the
    SIGKILL test is a bin test with a test-owned temporary folder.
  - **W0-4 (coordinator, task-026 review F1)** an unusable hooks path answers 500 `internal`
    (path only in the server log), not `git-refused` — within spec-004 §5, no amendment.
  - **W0-5 (D28-1 … D28-7)** the public-text check: standard top-level POSIX roots, drive paths,
    `~/` and home variables; global anchored allow-list entries, each with its reason and required
    to match; `/tmp` only for named fictitious folders and `/tmp/wfui-*`; UNC paths out of scope.
  - **W0-6 (D27-1, D27-2, D27-3)** the WebKit axe self-test page styles its own button; `@perf`
    runs on Chromium only; the clipboard helper reads the real clipboard with per-engine grants.
  - **W0-7** bug-009 (Memory list filter names read once, failed under load) ingested and
    absorbed into task-027 (AC-5).
  - **W0-8** bug-010 (a clone runs the user's own configured git commands; no minimum git
    version) ingested from the task-026 security review (pre-existing items P1, P2) and absorbed
    into task-033; its option is chosen at task-033's design. Item P3 (template hooks copied, not
    run) needs no change.
  - **W0-9 (D27-4, option C)** e2e engines: the inner loop of a task runs the whole suite on
    Chromium (`npm run test:e2e:chromium`) and the task's own spec files on the three engines
    (`npm run test:e2e -- <files>`); `npm run test:e2e` (three engines) is the gate of every wave
    and of release validation. Rationale: about 43 e2e runs remain in v0.2; three engines always
    ≈ 25 h of machine time and 6–7 h more on the critical path, option C ≈ 13–14 h. This makes
    RP-53's "in `test:e2e` on the three engines" hold at the wave gates.
  - **W0-10** bugs 008 and 009 (`resolved`) are closed at release validation.
- **Integration findings:** the public-text check flagged, on the merged tree, git's hook probe
  `/dev/null/post-checkout` and two `<placeholder>/…` forms in Execution Notes (allow-list entry
  and rewording); a placeholder written as `<x>/folder` is reported like a path.
- **Gate at the end of the wave** on `main` `8009e4a` (2026-10-13 14:35–15:17): `test:coverage`
  2033 passed, 1 skipped (statements 96.78 %, branches 91.14 %); `test:e2e` three engines 385
  passed (Chromium 133, Firefox 126, WebKit 126; 20.3 min of test time, 39 min wall-clock with the
  build) at load 22; `test:smoke` 4/4; 0 new `wfui-*` entries in the system temporary directory.
  `test:timing` skipped on `main` (load 17.8); it passed on task-026's branch after its merge of
  `main` (load 7–10: Vitest 3/3, Playwright 14/14) — to run on `main` at a later wave end or at
  release validation.
- **Effort:** 2026-10-12 23:30 – 2026-10-13 15:20 wall-clock with an overnight pause (about 9 h
  of working time, mostly waiting for agents and suites).
- **Hand-overs to Wave 1:** temporary folders follow `test/README.md` *Temporary folders*; new
  absolute example paths must be allow-listed or reworded (public-text check); copy buttons are
  tested with `test/e2e/support/clipboard.ts` (task-035, C-08.2); e2e per W0-9.

### Session 2 — Wave 1: settings, Today API, How to join (2026-10-13 – 2026-10-14)

- **Done and merged** in task-number order (RP-55), each after an independent fresh-context review
  repeated until PASS, `main` merged into the branch before submit and the approver's `memory
  approve`: task-030 (merge `1e95144`, done `76fab75`; 2 rounds), task-031 (`83149a1`, `87697b0`;
  2 rounds; `main` with task-030 merged before submit), task-035 (`bd19748`, `119bd60`; 2 rounds
  plus three round-2 nits fixed before submit; `main` with task-030 and task-031 merged before
  submit). Conflicts only on append-only lines: `contracts/src/index.ts` exports and the
  `test/README.md` version line (0.28 task-030, 0.29 task-031, 0.30 task-035).
- **Decisions** (the approver, "as recommended"; details in each task's Execution Notes):
  - **W1-1 (D30-1 … D30-5)** settings and action log: strict `actionLog` items `{sha, at}` in a
    file of this version (a newer build's file is read for `sha` and `at`, review F2); unknown or
    invalid settings keys dropped at the next changing write, a missing key stays missing (review
    F4); `GET /api/settings` re-reads the file; the store applies the `actionLogCap` on every write
    and task-032 only appends; a `PUT` on a read-only (newer) file answers 200 for this run.
    spec-006 §2/§4 amended (Process Note 2026-10-13).
  - **W1-2 (D31-1 … D31-6)** Today and the memory feed: `before` = an event sha, exclusive;
    `limit` 1–100, default 10; no partial Today on a failed input; Waiting on others in the
    Requires-you order; `?view=` from an unidentified user → 400, a member with no role → `view:
    null` and their own rows; web queries left to task-036/task-042. spec-004 §3 and spec-003 §5
    amended. A 400-before-404 on `GET …/elements?archived=<bad>` for an unknown pid is left as is
    (spec-004 §4's order table is for writes).
  - **W1-3 (D35-1 … D35-9)** How to join: a modal dialog with a shared opener
    (`HowToJoinProvider`, `useHowToJoin().show()`, for task-036 and task-037), opened from the
    badge and the not-in-team notice; the command built in code and accepted by X-09.1 only when it
    equals the rebuilt command (spec-008 §6 amended); `tech-lead` as a web constant pinned to the
    server preset; a third SCREENS project; declared roles listed; POSIX single-quote email
    quoting; the panel follows the data. The UX reference 1.1 gains the *How to join* row (journey
    6 step 3 GAP closed).
  - **W1-4 (D35-10)** the no-initials glyph `?` of the v0.1 avatar, first scanned by the new
    SCREENS entry: accepted by X-09.1 only inside the current user's avatar (test side, no product
    change).
- **Review highlights:** a reordered no-op settings `PUT` rewrote the file and a newer build's
  state file lost its projects (task-030, fixed); a spec-003 §5 comment contradicted the
  decision (task-031, fixed); an open How to join panel went empty on some identity changes and
  its change was not announced (task-035, fixed: status region, focus fallback to the main
  region). Probes of the join command through bash (quotes, `$( )`, backticks, newlines, `!!`)
  ran nothing.
- **`test:timing`** passed on `main` `e331692` (2026-10-13 15:56–16:04, load 4.7 → 8.8: Vitest
  3/3, Playwright 14/14) — closes the Wave 0 open point.
- **Gate at the end of the wave** on `main` `119bd60` (2026-10-14 09:21–09:54): `test:coverage`
  2249 passed, 1 skipped (statements 96.78 %, branches 91.16 %); `test:e2e` three engines 397
  passed (Chromium 137, Firefox 130, WebKit 130; 28.4 min) at load 22–24; `test:smoke` 4/4; no
  new `wfui-*` entry, no console left. `test:timing` skipped (load 20.4).
- **Effort:** 2026-10-13 15:56 – 2026-10-14 09:55 wall-clock with an overnight pause (about
  8 h of working time). Three agents in parallel pushed the load to 35–45 during their suites.
- **Hand-overs to Wave 2:** task-032 appends `{sha, at}` through `StateDraft.actionLog` in a
  transaction and reads `autoPush` with `StateStore.settings()`; task-036 adds `todayQuery`
  (`queryKeys.project(pid, 'today', { view })`), never shows a Today error as "Nothing requires
  you", knows that `memory search` warnings are not part of Today, and opens How to join with
  `useHowToJoin().show()`.

### Session 3 — Wave 2: governed writes, Today (2026-10-14)

- Start confirmed by the approver: task-032 and task-036 in parallel; task-029 later, before
  release validation (load: three agents pushed Wave 1 to 35–45). A `wfui-no-hooks-*` folder left
  from before task-026 (2026-10-12) was removed. The session was interrupted once (about
  14:42–16:34): agents resumed from their worktrees, an orphan review console killed, the dead
  run's temporary roots removed.
- **Done and merged** in task-number order (RP-55), each after its reviews, `main` merged into the
  branch before submit and the approver's `memory approve`: task-032 (merge `f03509e`, done
  `88d1bdf`; independent review 3 rounds, adversarial security review 3 rounds, RP-47), task-036
  (`f0e91d8`, `bf4ae2e`; 3 rounds, the third on bug-011; `main` with task-032 merged before
  submit). Conflict only on the `test/README.md` version line (0.31 task-032, 0.32 task-036).
- **Decisions** (the approver, "as recommended"; details in each task's Execution Notes):
  - **W2-0 (D32-1 … D32-10)** governed writes: row 7 compares the element's whole index entry —
    HEAD, index and working tree (later widened by review S2 from the blob alone); the write lock
    is keyed by the repository's git common directory (adr-001 D5 Process Note; task-033 and
    task-034 take it with `ProjectSnapshot.lockKey`); rows 5–6 and the `:eid` lookup from the
    snapshot's cache; only the write's own commit is reported and logged; a reason the CLI refuses
    with exit 2 → 422 `cli-refused`; bounds on `reason` (no NUL, ≤ 10 000 characters) and
    `expectedStatus`; a `WritePushPort` answering `off` until task-034; an action-log append
    failure still answers 200; `scripts/action-log-ratio.mjs`; unknown `:eid` → 404.
  - **W2-0 (D36-1 … D36-11)** Today: route `/p/$pid/today`, `/p/$pid` redirects there; a first
    sidebar group without heading; one action button per row opening the element panel (no write
    from Today); the empty state "Nothing requires you" built now (T-07 stays with task-042);
    "Role view: X"; who must act; reason and age; not-in-team → *How to join*; TT-PERF-01 in
    `performance.spec.ts`; TT-PERF-09 per fixture and role view; a polite status region.
  - **W2-1** a CLI failure that leaves the element file changed without its commit (stale
    `index.lock`, failing pre-commit hook) → 500 `write-incomplete` with the repo-relative
    `detail.file` and a fixed message; the CLI's message (it quotes the repository's absolute path
    and, on approve/reject, the reason) is never sent and never logged; no automatic restore.
  - **W2-2, W2-4** WingFoil feedback F-023 … F-026 and `wingfoil-cli` W-28 … W-31 (1.12): hidden
    edits committed by approve/submit; reason defects as usage errors; transitions not atomic;
    governed verbs pick the file of an id themselves.
  - **W2-3** bug-011 (X-06.4 and X-09.1 scan every screen in one test; Firefox timed out under
    load) ingested and absorbed into task-036: one test per screen with a shared console per worker
    (slowest per-screen test about 34 s, was 2–3.5 min).
  - **W2-4** the CLI answering for another path than the checked one → 500 `write-incomplete`
    with that path and the commit found there (replaces an accepted residual).
  - **W2-5** the CLI failing after its own commit → the commit is logged and announced (not
    pushed), 500 `write-incomplete` with `detail.commit`.
- **Review highlights:** task-032 — an untracked duplicate id committed through the watcher's lag
  (S1), a hidden mode change and a symlink passing a blob-only check (S2), forged-subject commits
  logged (S4), the ratio script counting first-parent commits only (6 of 32 decisions), the
  reason reaching the server log on the W2-1 path (N1); all fixed with tests, and the residual
  races reported to WingFoil. task-036 — false "Requires you updated" announcements on a project
  or role-view change (fixed, component keyed by pid). Probes: HTTP guards, CSRF, reason
  injection and 20 concurrent approves held (one commit).
- **Open points:** a CLI refusal on the v0.1 read routes and two residual 422 paths still carries
  the CLI's text verbatim, which may quote the repository's absolute path (loopback client only;
  candidate for a later bug-ingest); the error log level of a W-29 reason refusal (follow-up).
- **`test:timing`** passed on task-036's branch (TT-PERF-01 p95 110 ms, first open 414 ms, after
  one commit p95 539 ms); on `main` `bf4ae2e` (2026-10-14 22:40–22:47, load 7.5 → 6.9): Vitest 3/3, Playwright 18/18.
- **Gate at the end of the wave** on `main` `bf4ae2e` (2026-10-14 22:40–23:14): `test:coverage`
  2439 passed, 1 skipped (statements 96.61 %, branches 91.32 %); `test:e2e` three engines 564
  passed (Chromium 194, Firefox 185, WebKit 185; 23.4 min) at load 15–20; `test:smoke` 4/4; no
  new `wfui-*` entry, no console left.
- **Effort:** 2026-10-14 13:20 – 23:15 wall-clock (about 8 h of working time; an interruption of
  about 2 h).
- **Hand-overs to Wave 3:** task-033 adds row 8 `stale-copy` to `write.refusal.schema.json`, takes
  the write lock with `ProjectSnapshot.lockKey`, and edits `server/src/git/git.ts` (allow-list now
  includes `hash-object`, `ls-tree`, `ls-files`, `diff-tree`); task-037 and task-038 close G-04.1,
  G-11.x and X-07.3 against task-032's routes and add the catalogue text for `write-incomplete`;
  task-034 decides whether a commit left by a failed CLI is pushed by the next tick; screens are
  appended to `SCREENS` (one axe/strings test each now, bug-011).

### Session 4 — Wave 3: git copy state and transport routes, gate footer (2026-10-15)

- Start confirmed by the approver: task-033 and task-037 in parallel, shared shapes fixed by the
  coordinator after both designs (C3: merge order 033 → 037, `test/README.md` 0.33 / 0.34, each
  task appends only its own catalogue entries, only task-033 touches `contracts/`, task-037 owns
  `web/src/api/writes.ts`); task-029 still later, before release validation. The coordinator's
  session ended unexpectedly once (about 14:20–14:28) during task-037's pre-submit gates: the
  dead run's temporary roots were removed and the cut Chromium run was repeated whole.
- **Done and merged** in task-number order (RP-55), each after its reviews, `main` merged into the
  branch before submit and the approver's `memory approve`: task-033 (merge `be7bdfd`, done
  `83f58ac`; independent review 4 rounds, adversarial security review 3 rounds, RP-47),
  task-037 (`23a6d1e`, `ef227ec`; 3 rounds; `main` with task-033 merged before submit). Conflicts
  only on append-only lines: the `docs/user-guide.md` and `test/README.md` version lines, the
  `MESSAGES` entries of `web/src/api/error-message.ts` and its test.
- **Bugs:** bug-010 (absorbed at Wave 0) resolved by task-033; bug-012 (a CLI refusal can quote
  the repository's absolute path — the Wave 2 open point) and bug-013 (`GIT_ALLOW_PROTOCOL` in the
  server's environment lets a v0.1 clone run an `ext::` command; found by a probe at task-033's
  design) ingested, triaged by the approver, absorbed into task-033 and resolved. All three are
  closed at release validation (W0-10).
- **Decisions** (the approver, "as recommended" unless noted; details in each task's Execution
  Notes):
  - **W3-1 (D33-1 … D33-14)** git copy state and transport: bug-010 documented (what runs, a
    minimum git version) and a local remote or clone source of another user refused
    (`remote-not-owned`, POSIX only); `GIT_ALLOW_PROTOCOL` set to the allowed transports on clone
    and transport (bug-013); `-c maintenance.auto=false -c gc.auto=0` on fetch, pull, push; hooks
    on update and push per RP-23; one `redactLocalPaths` at the mapping points (bug-012);
    `RepoState.contentKey` keys the CLI memo (adr-001 D6 note); the spec's reads per check
    (3–4 git processes); a strict push target; no body or `{}`; sync state per pid in memory;
    `detail.files` relative to the project; row 5 re-checked under the lock; the transport
    catalogue keys; required header fields. spec-010, spec-004 §5, spec-006 §3 amended.
  - **W3-2 (C1, C2)** bug-013 ingested and absorbed into task-033; `cli-not-found`'s
    `detail.path` (the project's absolute root) dropped under bug-012 (spec-006 §3).
  - **W3-3 (D37-1 … D37-13)** gate footer: `gateFocus` history state from Today (dropped after
    use); reason, Approve, Rejects, Cancel in that order (a deviation from the prototype,
    UX reference 1.3); outcomes focusable while disabled; the default reason cleared on an
    untouched reject and restored on Approve, also on a click that does not focus; a read-only
    line for non-members (spec-003 §6 Process Note); the six `element.reason.*` keys; inline
    status and alert until task-038's toasts; `web/src/api/writes.ts` for submit, approve,
    reject; `error.writeIncomplete` added here (the Wave 2 hand-over gave it to task-038); three
    `SCREENS` entries; the X-09.1 checker accepts the References field names of an element read
    (D37-13, a v0.1 test-support gap).
  - **W3-4 (security round 1, R1–R3)** a local remote's absolute path redacted as `<remote>`;
    a local `receive-pack`'s `gc --auto` (git strips `GIT_CONFIG_PARAMETERS`) accepted as a
    residual (spec-010 §4); transport children get a `PATH` of absolute entries only.
  - **W3-5 (review round 2)** a local source with no readable candidate → new code
    `remote-unreadable` (not the misleading "another user" text); `~` and `~user` expanded as git
    does for fetch, update, push; `X::` is a helper only for a URL scheme; the clone's `PATH`
    filtered too; scheme-less userinfo redaction bounded by start, whitespace or a quote.
- **Review highlights:** task-033 — the owner check could be bypassed five ways because it did
  not resolve a local URL as git does (`file://<host>`, every push URL, git's `.git` suffix order
  and `gitdir:` files, the top-level base, lexical `..` before symlinks), then by `::` and `~`
  paths; the clone still ran a cloned repository's `git-lfs` through a relative `PATH` entry;
  git error text reached the server log from reads under the lock; redaction gaps in userinfo;
  all fixed with red tests (the first pass and some round fixes wrote code before tests; each
  guard was then removed in turn to see its test fail). task-037 — a reject click without focus
  (Safari, iOS) committed the default approval text as the rejection reason; the refusal alert
  vanished when the refetched state had no gate; outcomes stayed disabled after a decision.
  Probes that held: `ext::`/`fd::` through url, pushurl, `insteadOf`, `remote.<n>.vcs` and a
  hostile environment; option-like remote names; HTTP guards; 20 parallel pushes or updates (one
  git process); fetch cancel; row 8 on the fresh state.
- **Accepted residuals:** the check → open race when another user can write a remote's parent
  folder; a linked-worktree `commondir` into another user's repository; `~user` homes from
  `/etc/passwd` (NSS-only users fail closed); relative `PATH` entries for non-transport children
  (adr-001 D2); a local `receive-pack`'s `gc --auto` (W3-4).
- **Open points:** a cancelled fetch or push answers 500 `internal` to a client that has left and
  records nothing; sync status per pid (two projects of one repository: a fetch moves the other's
  copy state but not its `lastSuccessAt`, D33-10); push goes to the upstream's remote, never
  `pushRemote`; a mouse click on the untouched default reason places the caret instead of
  selecting it (G-06.1 covers keyboard and programmatic focus).
- **`test:timing`** passed on task-033's branch (load 9: Vitest 3/3, Playwright 18/18); on `main`
  `ef227ec` (2026-10-15 15:07–15:15, started at load 12.6, just above the threshold, it rose
  from 11.4 at launch): Vitest 3/3, Playwright 18/18.
- **Gate at the end of the wave** on `main` `ef227ec` (2026-10-15 15:07–15:59): `test:coverage`
  2708 passed, 1 skipped (statements 96.67 %, branches 91.44 %); `test:e2e` three engines 651
  passed (Chromium 223, Firefox 214, WebKit 214; 38.2 min) at load 15–29; `test:smoke` 4/4; no new `wfui-*`
  entry, no console left.
- **Effort:** 2026-10-15 08:50 – 16:05 wall-clock (about 7 h of working time; a crash of the
  coordinator's session of about 10 min).
- **Hand-overs to Wave 4:** task-034 reuses `SyncStatus` (`snapshots.sync`), the transport
  module (`TRANSPORT_SETTINGS`, `ALLOWED_PROTOCOLS`, `fetchArgs`/`pullArgs`/`pushArgs`,
  `transportEnv`), the locked part of `GitTransport`, `localRemoteProblem` and `redactLocalPaths`,
  and adds `merge` to `GIT_ALLOWED_SUBCOMMANDS`; task-038 reuses `useElementWrite` for Submit,
  the `element.reason.*` keys and `error.writeIncomplete`, closes G-11.x and X-07.3, and moves the
  footer's status and alert into its toasts (the alert has its own `element-footer-alert`
  class); task-039 reads `repository`, `sync` and `conditions` from `GET /api/p/:pid`; task-040
  appends "Update" to the copy-behind reason.

### Session 5 — Wave 4: auto-sync and auto-push, notification bell (2026-10-15 – 2026-10-16)

- Start confirmed by the approver: task-034 and task-042 in parallel; shared shapes fixed by the
  coordinator after both designs (C1 merge order 034 → 042; C2 `test/README.md` 0.35 / 0.36,
  `docs/user-guide.md` 0.10 / 0.11, UX reference 1.4 for task-042; C3 only task-034 touches
  `contracts/` and `MESSAGES`, only task-042 `web/src/api/queries.ts` and `ProjectHeader.tsx`;
  C4 catalogue and CHANGELOG append-only; C5 the e2e settings seed left to tasks 039–041);
  task-029 still later, before release validation. The machine rebooted once (2026-10-15 about
  20:54) while both agents waited for decisions: worktrees intact, nothing to repeat.
- **Done and merged** in task-number order (RP-55), each after its reviews, `main` merged into the
  branch before submit and the approver's `memory approve`: task-034 (merge `abd2ef2`, done
  `6801c57`; independent review 5 rounds, adversarial security review 5 rounds, RP-47), task-042
  (`dedd367`, `28edb56`; 4 rounds and a confirmation round; `main` with task-034 merged before
  submit). Conflicts only on the `docs/user-guide.md` and `test/README.md` version lines.
- **Bugs:** bug-014 (the manual Update could make a merge commit and the manual Fetch could prune
  local tags and branches — task-033's routes, found by task-034's design probes) and bug-015 (the
  X-09.1 strings check could miss an API answer under load; a pre-existing test-support race) ingested,
  triaged by the approver, absorbed into task-034 and task-042 and resolved. With bug-008 … bug-013
  they are closed at release validation (W0-10).
- **Decisions** (the approver, "as recommended" unless noted; details in each task's Execution
  Notes):
  - **W4-1 (D34-1 … D34-11)** auto-sync: no hook in unattended runs (`core.hooksPath` = the clone's
    no-hooks file; manual Update/Push and auto-push keep hooks, RP-23); the automatic merge
    hardened (`--no-squash --strategy=ort`, `--config-env=branch.<b>.mergeOptions=`, post-check);
    no askpass program and a skip while a git operation is in progress; one fetch per repository
    and target per tick; prune overrides and a refspec guard; no periodic push (the W2-5 commit
    leaves with the next push of HEAD); no timeout on the automatic merge; bug-014 absorbed (409
    `refspec-outside-remotes`); `fetch-timeout` and `push-timeout` codes; auto-push pushes HEAD as
    the manual Push does.
  - **W4-2 (D42-1 … D42-8)** bell and summary: the bell in the global header for every identity;
    *Updates* read only while the panel is open; all *Requires you* rows (spec-003 §5, not the
    prototype's 6); a badge only above 0 with the count in the accessible name; a "Your roles"
    card between the greeting and *Requires you*; switch from the card with focus on *Requires
    you*; "N more" switches the role view; one appended `SCREENS` entry. UX reference 1.4.
  - **D42-9** TT-PERF-01 starts on `/` and opens the project with the switcher (the bell warms
    Today's query on every project view); the "read after the key press" guard stays.
  - **RP-9 measured, no regression:** a first "after one commit" p95 of 1 357 ms (D42-9 path) and
    1 486 ms (comparable path) came from a noisy run; repeated runs at each merge point since
    task-036 gave 0.6–0.9 s server-side and 0.66 s p95 on task-036's path (task-036: 0.54 s);
    task-033 adds two short `git config` reads per state check. spec-002 §4 not reopened.
  - **W4-3 … W4-10 (security round 1, independent round 1)** the manual Update refuses
    `refspec-outside-remotes` too; `internal` listed for auto-push; configuration from the work
    tree skips the unattended fetch and merge, `core.fsmonitor=false` on unattended runs and every
    read; exactly one `branch.<b>.merge` value or `no-upstream` (manual Push too); legacy
    `remotes/`/`branches/` files fail closed; the runner settles at most 2 s after `exit`;
    `merge-not-fast-forward` recorded; hooks landed by an automatic merge run at the user's next
    write (declared residual), and the stop waits for a running automatic merge.
  - **W4-11 … W4-14 (security round 2)** include directives checked whether or not their file
    exists or their condition holds; a token guard on configuration values (W4-12, later
    removed); drained results refused by every reader; `config-in-worktree` recorded in
    `sync.fetch.lastError`.
  - **W4-15 (security round 3)** a broader value guard (any value naming the work tree; later
    removed); relative includes resolved from the path git opened.
  - **W4-16 (security round 4)** the value heuristics (W4-12, W4-15) are removed: shell expansion
    bypassed them (ten forms run to execution) and common configurations (`core.editor = code
    --wait` with a `code/` folder, aliases, `credential.helper = cache`) stopped the automatic
    update for good. Declared instead (spec-010 §6, user guide, CHANGELOG): `autoUpdate` is off by
    default and, turned on, does what `git pull` does on a timer — incoming commits can run
    commands the user's own configuration points at, without hooks of the repository and without
    configuration the repository brings. Kept: every structural guard above.
- **Review highlights:** task-034 — the manual Update's own fetch still pruned (R1); configuration
  brought by incoming commits ran `uploadpack`, `fsmonitor` and filters unattended (S1, then an
  include of a file not yet there, S2-1); the push destination read the last of several
  `branch.<b>.merge` values (S2); a legacy `remotes/` file bypassed the prune guard (S3); a filter
  child holding stderr hung the runner, the write lock and the stop (S4). task-042 — a stale focus
  request and a refusal alert lost on refetch (R1, R2), then a refusal alert that never cleared
  (R2-1); bug-015's fix reviewed twice more (a hung answer losing its cause, the old page's reads
  filed to the next screen).
- **For the retrospective (approver's request, W4-16):** decide whether to keep the declared risk
  of `autoUpdate` or invest in a structural fix. Options, not decided: keep the declared risk; run
  the automatic update with filters disabled through a temporary `info/attributes` override;
  fast-forward only when no incoming path is referenced by a `.gitattributes` filter, diff or merge
  driver; a sandboxed checkout; drop `autoUpdate`. Background: task-034's Execution Notes, *For the
  retrospective*.
- **Open points:** none new beyond the Wave 3 ones still standing (a cancelled fetch or push
  answers 500 `internal` with nothing recorded; push never to `pushRemote`); sync status per pid is
  now recorded on every project of one repository (D34-4).
- **Gate at the end of the wave** on `main` `28edb56` (2026-10-16 16:14–17:12, load 1.2 at
  start): `test:timing` Vitest 5/5 (TT-PERF-07 10/10 at 59.9–60.0 s) and Playwright 18/18;
  `test:coverage` 2883 passed, 1 skipped (statements 96.53 %, branches 91.15 %); `test:e2e` three
  engines 699 passed (Chromium 239, Firefox 230, WebKit 230; 36.6 min); `test:smoke` 4/4; no
  `wfui-*` entry, no console left.
- **Effort:** 2026-10-15 17:45 – 23:30 and 2026-10-16 07:00 – 17:15 with pauses (about 11 h of
  working time; a reboot of the machine).
- **Hand-overs to Wave 5:** task-041 shows the declared residual of `autoUpdate` next to the
  setting (user guide *Before you turn Auto-update on*) and seeds settings for its e2e through
  `ConsoleOptions.stateDir` (C5); task-039 renders `sync.fetch.lastError` / `sync.update.lastError`
  codes from the catalogue (`fetch-timeout`, `config-in-worktree`, `refspec-outside-remotes`,
  `merge-not-fast-forward`, …) and knows that every real-bin console now fetches every 60 s
  (`autoFetch` on by default; seed `autoFetch: false` for a test counting git processes);
  task-038 renders `push: failed` codes including `push-timeout` and `internal`; the shell header
  now holds the notification bell (task-042) — keyboard walks and `SCREENS` count it.

### Session 6 — Wave 5: submit footer and toasts, sidebar git status, UI settings (2026-10-16 – 2026-10-17)

- Start confirmed by the approver: task-038, task-039, task-041 in parallel, with a **machine-free check
  for heavy gates** added by the approver: every Playwright run, `test:coverage`, `test:smoke` and
  `test:timing` waits for a FIFO slot that is granted only when no heavy gate of this project or of
  another project's worktrees runs and the 1-minute load is ≤ 14 (re-checked after 5 s); the slot
  script lives outside the repository (approver's rule). Shared shapes fixed by the coordinator after the
  three designs (C1–C10): merge order 038 → 039 → 041; `ConsoleOptions.settings` owned by task-038;
  the sidebar column `.project-sidebar` / `.sidebar-foot` by task-039 and the pinned *Configuration*
  group by task-041; toasts by task-038; `settingsQuery` and `web/src/api/settings.ts` by task-041,
  `web/src/api/git.ts` by task-039; three declared catalogue edits; version lines `test/README.md`
  0.37 / 0.38 / 0.39, user guide 0.12 / 0.13 / 0.14, UX reference 1.5 / 1.6 / 1.7.
- **Done and merged** in task-number order (RP-55), each after its independent review, `main` merged
  into the branch before submit and the approver's `memory approve`: task-038 (merge `abb19cb`, done
  `a930ae3`; 4 rounds), task-039 (`b0c11a1`, `674a543`; 3 rounds; `main` with task-038 merged before
  submit), task-041 (`1959692`, `ea9ef76`; 2 rounds and a confirmation round; `main` with task-038 and
  task-039 merged before submit). Conflicts only on append-only lines and version lines (CHANGELOG,
  `test/README.md`, user guide, UX reference, `SCREENS`, the add/add of `test/e2e/support/remote.ts`)
  and on the two copies of `ConsoleOptions.settings` (task-038's kept).
- **Decisions** (the approver, "as recommended" unless noted; details in each task's Execution Notes):
  - **W5-1 (D38-1 … D38-13)** submit footer and toasts: a module toast store rendered once in the shell;
    a stack of at most three toasts that close by themselves (8 s, paused on hover and focus), refusals
    and failed pushes stay until closed; the commit's short hash and *pushed*; `push: failed` reasons
    from the catalogue; *Submit → <state>* offered to every identified member; toasts raised by
    `useElementWrite` itself; the footer keeps only the in-progress text; TT-PERF-02 in the `@perf` run.
  - **W5-2 (D38-1 deviation, confirmed by the approver)** the two always-present live regions are
    `aria-live` polite / assertive with no `status` / `alert` role, `aria-atomic` on each toast.
  - **W5-3 (D39-1 … D39-13)** git status in the sidebar: a *Git status* region below the views
    navigation; `useGitOperation` (an abort is *cancelled*, never an error); git's message on hover,
    focus or press; refusals of a manual fetch in an alert of the block; the last update error shown
    here (task-040 adds the buttons); `element.reason.copyDetached` → "Blocked: no branch checked out"
    (Y-01.3); a fourth `SCREENS` project with an unreachable remote.
  - **W5-4 (D41-1 … D41-13)** UI settings: `/p/$pid/configuration/ui-settings`, *Configuration* pinned at
    the bottom of the views navigation; every control saves on its own; the inline script stays the only
    writer of `data-theme` (spec-009 §1 Process Note); the approver's Auto-update warning text as the
    switch's description with a pointer to the user guide; C-07.3 at 15 s in e2e and at 60 s in
    `test:timing`.
  - **W5-5 (coordinator, review rounds)** toasts placed beside an open drawer, bounded by the main
    region and kept below the drawer's header, the stack scrolls when it overflows (task-038 R1, R2-1 …
    R2-3); a closed toast that held the focus hands it to the next toast's Close (R3-3); the sidebar's
    git status at most half the column (task-039 R5); git's message opened on press in a dismissable
    popover (R6, R2-1).
- **Review highlights:** task-038 — the bottom-centre stack covered the drawer's Submit at 1280×720,
  two e2e raced the 8 s timer under load, toasts were hidden from screen readers while a React Aria
  popover was open, then the placement fix left a narrow drawer's toasts off-screen and covered the
  sidebar foot, and the auto-scroll took the user's scroll position; task-039 — git's message could not
  be seen on touch, then could not be closed by a press; a tall git status pushed the views off the
  viewport; task-041 — a `settings` event during a save could lose a change and a refused Auto-update
  could be stored by the next save (security-relevant; fixed with a ledger of pending saves over the
  server's answers), then a save's answer could cancel a newer read.
- **Open points:** none new beyond the Wave 3 ones still standing (a cancelled fetch or push answers 500
  `internal` with nothing recorded; push never to `pushRemote`). A page opened in a tab that already
  shows the console does not read a token pasted later (fragment change only, no reload): seen by the
  approver, ingested as bug-016 (`open`, `low`, v0.1 code), to triage.
- **Gate at the end of the wave** on `main` `ea9ef76` (2026-10-17 13:29–14:22, load 1.4 at start: `test:timing` Vitest 6/6 (C-07.3: 0 `git fetch` in 120 s) and Playwright 22/22 (Y-02.1 59.7 s of 65 s; TT-PERF-02 p95 310 ms approve, 277 ms submit; TT-PERF-01 p95 87 ms, after one commit 502 ms); `test:coverage` 3045 passed, 1 skipped (statements 96.53 %, branches 91.24 %); `test:e2e` three engines 836 passed (Chromium 286, Firefox 275, WebKit 275; 28.3 min); `test:smoke` 4/4; no `wfui-*` entry, no console left; every step took the machine-free slot).
- **Effort:** 2026-10-16 19:25 – 2026-10-17 14:25 wall-clock with an overnight pause (about
  10 h of working time); heavy gates waited for the slot while the other project's gates ran.
- **Hand-overs to Wave 6:** task-040 reuses `useGitOperation` (`web/src/api/git.ts`), the toasts
  (`showToast`, keyed per element; the placement keeps the sidebar foot clear), `settingsQuery` for
  "Push when auto-push is off", the `.sidebar-foot` block and `test/e2e/support/remote.ts`
  (`remoteHead`, `remoteCommit`, `setRemoteUrl`); appends "Update" to the copy-behind reason; closes
  G-13.2's sidebar step (RP-52).
