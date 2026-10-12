---
id: task-026-load-independent-tests-and-one-temp-folder-convention
type: task
title: "Load-independent tests and one temp folder convention"
status: in-progress
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2","governance","tests"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-008-clone-hooks-temp-folder-left-behind-when-the-console-is-killed"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

dl-006 action 1 (load-independent tests, themes T2 and T3 of the v0.1 retrospective), planned at
`release-planning` (RP-3 (a), RP-42): one temp-folder convention that leaves nothing behind, perf
and fingerprint assertions that prove a fresh read, and the package smoke as a gate of every wave.
It absorbs bug-008 (the clone hooks folder `/tmp/wfui-no-hooks-*` left behind when the console is
killed). Governance task (`module: governance`, `ref: GOV`): no backlog record; run through the
full dev-loop.

**Backlog items:** GOV (governance — dl-006 action 1; absorbs bug-008)

## Acceptance Criteria

- **AC-1 (temp folders, bug-008)** Every temporary folder the console or the tests create follows
  one convention, documented in `test/README.md`: tests under `TempWorkspace`
  (`test/harness/temp-workspace.ts`), the console's own folders (the clone hooks folder of
  `server/src/projects/clone.ts` `noHooksDir`) where a stale one is removed at the next start or
  not created at all. A test kills a console with SIGKILL after a clone and shows that no
  `wfui-no-hooks-*` folder of it survives the next start (or none was created); at most one exists
  per running console. The e2e support's `wfui-e2e-fx-*` and `wfui-e2e-large-*` folders
  (created in `test/e2e/support/fixtures.ts` and `test/e2e/performance.spec.ts`) are removed by the worker
  teardown or the global teardown (`test/e2e/support/global-teardown.ts`); a full `npm test` + `npm run test:e2e` run leaves 0 new
  `wfui-*` entries in the temporary directory (counted before and after).
- **AC-2 (fresh reads)** The perf and fingerprint assertions prove that the read they measure is a
  fresh one, not cached data (bug-005; R-05.1 of task-021-accessibility-page-title-and-performance-pass, v0.1): each of `test/e2e/performance.spec.ts`,
  the timing suite's measurements and `test/server/snapshot/fingerprint.test.ts` asserts the cache
  miss or the changed repository state it depends on before it measures or compares.
- **AC-3 (smoke gate)** `npm run test:smoke` is documented in `test/README.md` as a gate run at the
  end of every wave (with the wave's integration), not only at release validation (bug-007).
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e`, `test:smoke`
  green; `check_tasks.py v0.2` OK; bug-008 follows this task's state (`bug.sync_state`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope of that review: the `clone.ts` change (the hooks path git runs a clone with must never
point at a folder another user or process can write).

## Implementation Notes

- dl-006 *Decision* action 1 and *Rationale*; bug-008 *Notes* options (a) a folder under the
  console's run directory with stale ones removed at start, (b) a fixed per-user path, (c)
  `core.hooksPath` to a path git accepts as empty — to be checked with git itself.
- `test/README.md` *Timing suite* and *Local state*; the e2e reaper of bug-004
  (`test/e2e/support/reaper.ts`, `test/e2e/support/global-teardown.ts`) already kills leftover consoles: reuse it.
- Do not run `npm test`, `test:e2e` and `test:smoke` together in one checkout (`test/README.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-12)

Read: this task, bug-008, bug-005, dl-006 (*Decision* action 1, *Rationale*), plan
`release-planning-rel-v0.2-plan` RP-3 (a), RP-42, RP-47, `retrospective-rel-v0.1-plan` T2/T3 and
RT-7, task-021 (v0.1) *review round 1* F2, `test/README.md`, `server/src/projects/clone.ts`,
`server/src/git/git.ts` (`cloneArgs`), `test/harness/temp-workspace.ts`, `test/e2e/support/`
(`fixtures.ts`, `console.ts`, `reaper.ts`, `global-setup.ts`, `global-teardown.ts`, `perf.ts`,
`cold-read.ts`, `events.ts`), `test/e2e/performance.spec.ts`, the `@live-refresh` tests
(`memory-list.spec.ts`, `dna.spec.ts`, `project-header.spec.ts`),
`test/server/snapshot/fingerprint.test.ts`, `test/timing/*.timing.test.ts`, the Vitest and
Playwright configs. No `depends_on`. No spec describes the hooks folder: only
`docs/user-guide.md` *Known limitations* (bug-008 bullet) and the `cloneArgs` comment.

**State found.** 57 test files call `mkdtemp` with a `wfui-` prefix (base `f3f214d`) and remove them in
`afterAll` / a worker-fixture teardown; 2 suites use `TempWorkspace` (plus its self-test). Leaks come from teardowns that
never run: a killed Vitest/Playwright run or worker (`wfui-e2e-fx-*`, `wfui-e2e-large-*`, the
console's `wfui-e2e-*`), and the console's `process.once('exit')` that SIGKILL skips
(`wfui-no-hooks-*`, bug-008).

#### bug-008 — the hooks path of a clone, checked with git 2.43

A source repository with a committed, executable `.githooks/post-checkout`, a user configuration
`core.hooksPath = .githooks` (the attack of `projects.test.ts`), cloned with `GIT_TRACE=1` and
`strace -e access,…` for each candidate `-c core.hooksPath=<value>`:

| `<value>` | what git probes (strace) | hook ran | verdict |
|-----------|--------------------------|----------|---------|
| (none) | `.githooks/post-checkout` in the new tree (`run_command: .githooks/post-checkout`) | **yes** | the defect the flag prevents |
| `/dev/null` | `access("/dev/null/post-checkout")` → `ENOTDIR`, same for `reference-transaction` | no | safe on Linux/macOS; on Windows git resolves it to `<drive>:\dev\null\…`, a folder any authenticated user can create at the drive root — rejected |
| empty (`core.hooksPath=`) | `access("/post-checkout")` → `ENOENT`: the filesystem root | no | depends on who can write `/` (on Windows the drive root) and on the git version's reading of an empty path — rejected |
| a missing path | `access("<missing>/post-checkout")` → `ENOENT` | no | whoever can create that path later can plant a hook (a predictable name under the shared temporary directory) — rejected |
| an existing **regular file** | `access("<file>/post-checkout")` → `ENOTDIR` | no | nothing can exist below a file; turning it into a folder needs write access to its parent |

Options of bug-008 *Notes*:

- (a) a folder per console under the state directory (e.g. `<state>/run/no-hooks-<pid>`), stale
  ones (owner pid gone) removed at start: private (the state directory is 0700), but adds a run
  folder to spec-006 §1's state directory, pid-reuse handling and a sweep; at most one per console.
- (b) a fixed per-user folder: safe only under the state directory (a fixed name under the shared
  temporary directory can be created first by another user — the attack the review looks for);
  never removed, checked before each clone (a real folder, not a link, empty, owned, 0700).
- (c) `core.hooksPath` to a path git accepts as empty: per the table, only "a regular file" holds
  on every platform; `/dev/null` and the empty value do not.

Recommended (D26-1): (c) with a file of the console's own installation — the compiled clone module
itself (`fileURLToPath(import.meta.url)`), checked with `stat` to be a regular file before each
clone (refused otherwise: fail closed). No folder is created at all, so nothing can be left behind
and there is nothing to sweep; whoever can turn that file into a folder can already rewrite the
console's code. The adversarial review can re-run the table above with `GIT_TRACE`/`strace`.
Windows is not run here (spec-007 §7 Windows check stays open, RP-4): the `ENOTDIR`/`ENOENT` of a
path below a file is a property of the filesystem, not of git.

#### AC classification

| AC | kind | red-first test |
|----|------|----------------|
| AC-1 console (bug-008) | **red-first** | `test/launcher/clone-hooks.test.ts`: the real bin with `TMPDIR`/`TMP`/`TEMP` set to a test-owned folder; a clone of the fixture's bare remote (`file://`) through `POST /api/projects/clone`; SIGKILL to the bin; a second start; the test-owned temporary folder holds no `wfui-no-hooks-*` (fails today: one survives). Unit rows in `test/server/projects/clone.test.ts`: the hooks path is a regular file and `<path>/post-checkout` cannot exist (`ENOTDIR`); a hooks path that is not a regular file refuses the clone with no git process. The relative-`core.hooksPath` attack of `projects.test.ts` stays green. |
| AC-1 tests | **red-first** | `test/harness/temp-root.test.ts`: inside a run, `os.tmpdir()` is below the run's temporary root (fails today); the sweep removes a root whose owner is gone and keeps one whose owner runs (as `e2e-reaper.test.ts` does for run directories). Plus the before/after count of `wfui-*` entries in the system temporary directory around a full `npm test` + `npm run test:e2e` (recorded here, not a test: other checkouts may run concurrently). |
| AC-2 | **characterization + red-first where a guard is missing** | each measured/compared read gets a precondition assertion; the missing ones are written first and must fail when the precondition is removed (negative check, noted below). |
| AC-3 | documentation | `test/README.md` (+ D26-4). |
| AC-4 | gates | — |

#### File layout (planned)

- `server/src/projects/clone.ts`: `noHooksDir()` (mkdtemp + `exit` handler) replaced by
  `noHooksPath()` — the module's own file, `stat`-checked; when the check fails `runClone`
  rejects before any git process (mapped like any other failed clone; no new reason code).
  `server/src/git/git.ts` `cloneArgs` comment updated.
- Test temp root (D26-2 ★): `test/harness/temp-root.ts` — `createTempRoot(kind)` (owner file +
  atomic rename, the pattern of `reaper.ts` `createRunDir`), `useTempRoot(root)` (sets `TMPDIR`,
  `TMP`, `TEMP` for the runner and the workers it starts), `removeTempRoot`,
  `sweepStaleTempRoots()` (owner gone → removed). Wired in `test/global-setup.ts` (Vitest default
  and timing; teardown returned from the setup), a new `test/smoke/global-setup.ts` for
  `vitest.smoke.config.ts`, and `test/e2e/support/global-setup.ts` / `global-teardown.ts`
  (Playwright default and timing; the root is the existing run directory's `tmp/`, so
  `reapRun`/`sweepStaleRuns` already remove it). `TempWorkspace` stays the per-file API and the
  documented convention for new tests; existing `mkdtemp` + `afterAll` callers are left as they
  are — they now land under the root.
- `test/e2e/support/fixtures.ts`, `test/e2e/performance.spec.ts`: worker teardown in
  `try/finally`, so a failed `use` still removes the folder; the global teardown removes the rest.
- AC-2: `test/server/snapshot/fingerprint.test.ts` (each comparison preceded by the `lstat` change
  or sameness it relies on — a small `expectStat(file, before, 'changed' | 'same')` helper in the
  file — and `lastReads` where a `Fingerprinter` is used); `test/timing/live-refresh.timing.test.ts`
  (`trial` asserts `updated()` is false before the change); `test/e2e/support/perf.ts` /
  `performance.spec.ts` (the view's read counted on `requestfinished` with a 2xx status after the
  key press, not on `request`); the `@live-refresh` tests assert the new state absent before the
  mutation where they do not yet (S-26.2 "signed off by Alex").
- Docs: `test/README.md` (*Temporary folders* section: the run root, `TempWorkspace`, the console's
  hooks path, the count; `test:smoke` as a wave gate; version line), `docs/user-guide.md` (bug-008
  bullet removed), `CHANGELOG.md` *Unreleased* › Fixed (bug-008), D26-4.

#### Test plan

Vitest: `clone.test.ts` (unit), `clone-hooks.test.ts` (bin, SIGKILL), `temp-root.test.ts`
(harness), `fingerprint.test.ts`, `projects.test.ts` (unchanged hook attack). Playwright: no new
scenario (no user-visible change); `performance.spec.ts` and the `@live-refresh` tests tightened.
Timing: `live-refresh.timing.test.ts` tightened (run only at load < 12). e2e closure: this task
closes no BDD scenario. Negative checks: each new precondition removed/inverted once to see the
test fail (recorded in *red / green / refactor*).

#### Open decisions

- **D26-1 — bug-008 mechanism.** (a) per-console folder under the state directory, stale ones
  swept at start; (b) fixed per-user folder under the state directory, checked before each clone;
  ★ (c) `core.hooksPath` = a regular file of the console's installation (the clone module), no
  folder at all.
- **D26-2 — scope of the test temp convention.** (a) migrate all 57 `mkdtemp` callers to
  `TempWorkspace`; ★ (b) one temporary root per run (`TMPDIR`/`TMP`/`TEMP` set by every runner's
  global setup, removed by its teardown, stale roots of dead owners swept at the next start) +
  `TempWorkspace` as the per-file API for new tests, existing callers unchanged; (c) fix only the
  named leaks (`fixtures.ts`, `performance.spec.ts`) and document the rule.
- **D26-3 — AC-2 reach.** ★ (a) the three files named in AC-2 plus the Playwright `@live-refresh`
  tests (they are "the timing suite's measurements" under `test:timing`): preconditions only;
  (b) (a) plus waiting for each refetch response before the screen assertion; (c) only the three
  named files.
- **D26-4 — where the smoke gate is written.** (a) `test/README.md` only (AC-3); ★ (b)
  `test/README.md` + the *Checks before handing work back* line of `CLAUDE.md` ("`test:smoke` at
  the end of every wave"); (c) also the `dev-loop` workflow YAML (governance configuration, not
  this task's).
- **D26-5 — where the SIGKILL test runs.** ★ (a) a bin test with the console's temporary
  directory pointed at a test-owned folder (isolated from concurrent runs in other checkouts);
  (b) an e2e test counting the system temporary directory (racy with concurrent runs).

#### Decisions (approver, 2026-10-12)

"All as recommended": D26-1 (c), D26-2 (b), D26-3 (a), D26-4 (b), D26-5 (a). Added by the
coordinator:

- D26-1: the hooks-path file resolves to an existing regular file in every shipped form (the
  Vitest/tsx run of `server/src`, the compiled `server/dist`, the bin `bin/wingfoil-ui.cjs` — not
  a bundle: it imports `server/dist/main.js`, so `import.meta.url` of the compiled module holds —
  and the npm-packed install of `test:smoke`), covered by a bin test (the SIGKILL test) and by
  the smoke if it has a clone path; fail closed (no git process) when the file is missing or not
  a regular file, with a unit test.
- D26-2: the global teardown removes only the root its own run owns (owner file check); the start
  sweep removes only roots whose owner process is gone — both shown in `temp-root.test.ts`. When
  task-028 merges (it uses `TempWorkspace` with the `wfui-` prefix), whichever merges second
  aligns.

### red / green / refactor (2026-10-12 → 2026-10-13)

- **bug-008 (D26-1, D26-5)** — `52ecd54`. Red first: `test/launcher/clone-hooks.test.ts` run
  against the previous `clone.ts` failed twice — the hooks path git received was a
  `wfui-no-hooks-*` folder in the console's temporary directory, not a file of `server/dist`; and
  (with that assertion removed for the check) one `wfui-no-hooks-*` folder survived the SIGKILL.
  Green: `NO_HOOKS_PATH` = the clone module's own file (`fileURLToPath(import.meta.url)`);
  `noHooksPath()` checks it with `stat` (links followed) and rejects with `HooksPathError` before any
  git process (first a `GitCloneError` answered as `git-refused`; changed in review round 1, F1). The `exit` handler and `mkdtemp` are gone. Every shipped form resolves to a
  regular file: `server/src/projects/clone.ts` under Vitest (`clone.test.ts`), the compiled
  `server/dist/projects/clone.js` through the bin (`clone-hooks.test.ts` asserts the recorded
  `core.hooksPath=` argument lies under `server/dist`, is a file, and `<it>/post-checkout` gives
  `ENOTDIR`) — `bin/wingfoil-ui.cjs` is not a bundle, it imports `server/dist/main.js`, so the
  compiled module's `import.meta.url` holds — and the npm-packed install: the smoke had no clone
  path, so one was added (`launch.smoke.test.ts`: a repository with a committed hook and a
  relative `core.hooksPath` in the user's configuration, cloned through `npx wingfoil-ui`: 201,
  the hook did not run; the fail-closed check would have answered 422). Fail closed:
  `clone.test.ts` — missing file, a folder, a link to a folder → `HooksPathError`, no process.
- **Temporary root (D26-2)** — `5f6a363`. Red first: `temp-root.test.ts` › "has its temporary
  directory under the run root" failed with the previous `test/global-setup.ts` (no root set);
  green after wiring. The owner rules are shown there: `removeTempRoot` removes only the root of
  its own process (not one owned by the parent process, a dead pid, or nobody);
  `sweepStaleTempRoots` removes a dead owner's root and an owner-less one older than the grace,
  keeps the roots of running owners, young owner-less roots, staging folders and unrelated
  `wfui-*` entries. Wired in `test/global-setup.ts` (now returns the teardown; `build()` split
  out), `test/timing/global-setup.ts`, the new `test/smoke/global-setup.ts`
  (`vitest.smoke.config.ts`), and the Playwright `global-setup.ts` / `global-teardown.ts` (the
  teardown removes the root in `finally`, after the console reap). Deviation from the design:
  Playwright uses its own `wfui-run-*` root rather than the run directory's `tmp/`, so every runner
  follows the same owner/sweep rules; the run directory stays as it was. Vitest workers and child
  processes inherit `TMPDIR` (checked in `temp-root.test.ts`). Worker fixtures of `fixtures.ts`
  and `performance.spec.ts` remove their folder in `finally`.
- **Fresh reads (D26-3)** — `5f6a363`. `fingerprint.test.ts`: a `mark()` of the `lstat`
  (inode, size, mtime and ctime in ns) asserted changed or same before each comparison; the prefix
  test now makes a change the `lstat` sees (another size and an explicit mtime) — negative check:
  with the prefix filter of `Fingerprinter` broken, the test fails. `live-refresh.timing.test.ts`:
  `trial` asserts `updated()` is false before the change. `performance.spec.ts`: the view's read
  must also finish with a 2xx answer after the key press (`requestfinished`). `@live-refresh`:
  S-26.2 asserts "signed off by Alex" absent and S-27.2 the *Modules* section absent before the
  mutation (the other five already asserted the prior state).
- **Docs (D26-4)**: `test/README.md` 0.25 (*Temporary folders*, fresh reads, `test:smoke` as a
  wave gate, the smoke clone), `CLAUDE.md` 0.3 (checks line), `docs/user-guide.md` 0.4 (bug-008
  limitation removed), `CHANGELOG.md` *Unreleased* › Fixed.
- Note: an early coverage log was overwritten by a concurrent run in another checkout; the run
  was repeated with its own log.

### checks (2026-10-13, HEAD before this note `5f6a363`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run test:coverage` | 120 files passed, 1 skipped; **1961 passed / 1 skipped**; statements 96.76 %, branches 91.1 %, functions 97.39 %, lines 98.35 % | 31.3 → 30.3 |
| `npm run docs:api` | OK | — |
| `npm run test:e2e` (Chromium) | 128 passed, 1 failed: `memory-list.spec.ts` S-28.1 kanban (the type filter read 2 of 7 types — `filterNames` reads the list once, without retrying); the file re-run alone: **21/21 passed** | 24.8 → 20.9; re-run 16.7 → 19.2 |
| `npm run test:smoke` | **4/4 passed**, clone through the installed console 102 ms (pack 20.9 s, install 4.2 s, start 1.6 s) | 18.3 → 13.9 |
| `check_tasks.py v0.2` | OK | — |
| `npm run test:timing` | **skipped**: load 13.2 (≥ 12) | 13.2 |

AC-1 count of `wfui-*` entries in the system temporary directory: 1 before (the pre-existing
`wfui-no-hooks-*` of an earlier run), 1 after `test:coverage` + `test:e2e` + `test:smoke` — **0
new**; no `wfui-run-*` root left. During the coverage run, entries of a concurrent `test:coverage`
in another checkout (main's code, no root) appeared and were removed by that run.

### review (round 1, 2026-10-13)

Independent review: **FAIL** (2 minor, 6 nits). Adversarial security review: **PASS** (1 nit,
the same as F1); its pre-existing items P1–P3 are reported to the approver, outside this task.

- **F1 (minor, = security S1)** — `HooksPathError` answered `git-refused` with a console-written
  message holding the absolute install path; `git-refused` carries git's own message only
  (spec-004 §5, spec-006 §3, spec-008). Change (coordinator's decision, within the specs):
  `HooksPathError` is no longer a `GitCloneError`, so it reaches the application's error handler —
  spec-004 §5 `internal`, 500, `Internal error`, the details (path included) in the server log
  only. Red first: `projects.test.ts` › "answers internal (500) with no path and runs no git when
  the hooks path is unusable" failed on the previous class (422 `git-refused` with the path),
  passes now (no `clone` process, no folder, the path only in the log). `ProjectListOptions`
  gets a test-only `hooksPath`; `clone.test.ts` asserts the error is not a `GitCloneError`.
- **F2 (minor)** — `test/harness/temp-root.ts` header: Playwright's global setup/teardown listed
  as a runner with its own root; name pattern `wfui-run-<pid>-<time>-<random>`.
- **F3** — `docs/user-guide.md`: the bug-008 limitation stays in the v0.1 list, worded "fixed after
  0.1.0 (see `CHANGELOG.md`, *Unreleased*)".
- **F4** — `processRuns` kept as a copy of the reaper's `isRunning`, with a comment: it differs on
  purpose (`EPERM` counts as running, so the sweep never removes a root whose owner may run);
  sharing one function would change the reaper's behaviour.
- **F5** — `performance.spec.ts`: the `requestfinished` handler catches a rejected `response()`.
- **F6** — the count corrected: 57 test files call `mkdtemp` with a `wfui-` prefix (base
  `f3f214d`).
- **F7** — the log note reworded.
- **F8** — `createTempRoot`: a comment on the staging-folder window (a killed setup leaves an
  empty staging folder, never swept).
- Checks after the fixes (`8137362`): `typecheck`, `lint`, `format:check` clean; `check_tasks.py
  v0.2` OK; targeted `clone.test.ts`, `temp-root.test.ts`, `clone-hooks.test.ts`,
  `projects.test.ts`: 95 passed; `test:coverage` **1962 passed / 1 skipped** (120 files),
  statements 96.78 %, branches 91.14 %, functions 97.39 %, lines 98.41 % (load 6.8 → 23.7);
  `performance.spec.ts` alone (F5): 7 passed (load 22.1 → 18.9). `wfui-*` entries in the system
  temporary directory after the runs: the 1 pre-existing one; no console left.
