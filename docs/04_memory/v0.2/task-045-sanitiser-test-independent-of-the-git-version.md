---
id: task-045-sanitiser-test-independent-of-the-git-version
type: task
title: "Sanitiser test independent of the git version"
status: in-progress
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","ci"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-022-project-list-sanitiser-test-depends-on-git-quoting-the-gitdir-path-and-git-2.55-prints-null"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-040-update-and-push-from-the-sidebar", "task-044-test-harness-git-identity-independent-of-the-os-account"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2 (pre-step of `release-submit-rel-v0.2-plan`): the second
`workflow_dispatch` dry run (run `39328350689`, `main` `f73294e`) failed on one test only — the bug-017
case "add: git quoting a gitdir with control and bidi characters" in
`test/server/http/projects.test.ts`, which relies on git quoting the `gitdir:` path in its refusal;
git 2.55 prints `fatal: not a git repository: (null)` (bug-022, absorbed here). Test-only governance
task (`module: governance`, `ref: GOV`); compact dev-loop (design and implementation in one pass, one
independent review), as decided by the approver.

**Backlog items:** GOV (governance — bug-022, release-validation dry run of minor-v0.2)

## Acceptance Criteria

- **AC-1 (bug-022)** The project-list sanitiser test still proves, through a real git refusal of an
  add (or clone) route, that control and bidi characters of git's text reach the body only as visible
  escapes — with a refusal whose text quotes data the test chose on every supported git version (2.43
  here, 2.55 on the runner), without branching on the git version and without weakening the
  no-raw-character assertion. The choice of refusal is recorded with a probe of git's text.
- **AC-2** Red first where possible (the new case fails on a sanitiser that passes raw characters:
  guard removal shown and recorded); the other bug-017 tests that depend on git's wording are checked
  for the same fragility (`grep` for assertions on git's messages in `test/server/http/` and
  `test/launcher/`), and any found is fixed the same way or recorded as safe with its reason.
- **AC-3** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %; through the slot, under the
  strict-identity and `followRemoteHEAD`-emulating wrapper of `test/README.md` *Git identity*) green;
  `check_tasks.py v0.2` OK; `test/README.md` version line if it changes; bug-022 follows this task's
  state. The CI evidence is the next `workflow_dispatch` dry run (coordinator, on the approver's OK).

## Implementation Notes

- The sanitiser is `redactLocalPaths` (server, task-040, bug-017); the e2e and server tests of bug-017
  live in `test/server/http/projects.test.ts` (*bug-017 — git-refused of the project list through the
  sanitiser*) and around the transport routes.
- Candidate refusals that quote test-chosen text: a clone of a URL with a bidi override in its path
  (the next test already does that over HTTP), a branch or remote name git quotes, a `gitdir:` that
  git 2.55 still reports; probe both behaviours, e.g. with a git-2.55-like message assumption avoided.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-19)

Read: this task, bug-022, the Execution Notes of task-040 (bug-017, review round 2 S2-1: the add
and clone producer tests, proved by removing the sanitiser call) and of task-044 (the strict-run
recipe, the `followRemoteHEAD` emulation); `server/src/projects/project-list.ts` (the add route's
only git call is `git remote get-url origin` in the folder, `GitReads.origin()`; exit 2 — no
`origin` — reads as "no remote", any other failure is `git-refused` through `redactLocalPaths`).

**D45-1 — probes of git 2.43 (this machine; the runner has 2.55).** A folder with `.wingfoil/` and
each candidate, then `git remote get-url origin` in it (`<v>` = `x` U+202E ESC `[31m`):

| Candidate | git 2.43 text | Verdict |
|-----------|---------------|---------|
| A — `.git` file `gitdir: <missing path with <v>>` (the test of bug-017) | `fatal: not a git repository: <path>` with U+202E, ESC as `?` | git 2.55 prints `(null)` (bug-022): the path argument of that message comes from the gitfile discovery, whose code changed — rejected |
| E — `gitdir:` to an existing folder that is not a repository | same message and path | the same message and code path as A — rejected |
| B — `git init`, then `core.repositoryformatversion = <v>` | `fatal: bad numeric config value 'x‮?[31m' for 'core.repositoryformatversion' in file .git/config: invalid unit` | **chosen** |
| C — `core.filemode = <v>` | `error: No such remote 'origin'` (exit 2: read as no remote, the add goes on) | no refusal — rejected |
| D — `core.bare = <v>` | `fatal: bad boolean config value 'x‮?[31m' for 'core.bare'` | works, but which command reads `core.bare` strictly is less central than B |

**D45-2 — why B holds on git 2.55.** The repository-format check runs in the discovery of every
command inside a repository, before the command's own code (`check_repository_format_gently` →
`read_repository_format`, `check_repo_format` reads `core.repositoryformatversion` with
`git_config_int`); a non-numeric value dies in `die_bad_number`, and every variant of that message
(no file, `in blob`, `in file`, `in standard input`, `in submodule-blob`, `in command line`) formats
the value with `'%s'` — the value is the data, not a variable a refactor of the discovery can lose.
The check guards git's own repository format and the message is the same family since git 2.x; a
git that accepted a non-numeric format version would open a repository it cannot interpret. The
value is written with `git config` (git itself, no hand-made file format). Checked against git's
public source (`master` of github.com/git/git, read 2026-10-20): `setup.c` `check_repo_format`
still reads the value with `git_config_int`, and `config.c` `die_bad_number` quotes the value in all
seven branches; the same `setup.c` now reports a bad gitfile as "gitfile does not point to a valid
repository: %s" — the gitfile wording did change, which is what bug-022 hit. No branch on the git
version; the no-raw-character assertion is kept as the first assertion; the `‮` assertion
stays (U+202E is passed on by git's `vreportf`, which writes ESC as `?` — any other control would
be turned to `?` by git first, so the bidi override is the character that proves the sanitiser).
An `expect(await list(w)).toEqual([])` is added (nothing listed). The test is renamed "add: git
quoting a config value with control and bidi characters". Alternatives not chosen: covering the
add producer only through the clone route (the clone producer is another call site,
`project-list.ts` `runClone`; the add site would lose its real-git test); a stubbed runner
(AC-1 asks for a real git refusal).

**D45-3 — AC-2: assertions on git's wording in `test/server/http/` and `test/launcher/`**
(`grep -rnE "fatal|not a git repository|does not appear|toContain\('|toMatch\(/"` over both
folders, then `grep -rn "git-refused\|lastError"` in `test/launcher/` — none there; `grep -rn
gitdir: test/` for the same construct elsewhere). Every one below passed on git 2.55 in the dry run
`39328350689` (1 failure in the run: the bug-022 test), and none depends on a path argument that
git computes:

| Test | Assertion | Verdict |
|------|-----------|---------|
| `projects.test.ts` › refuses a folder with .wingfoil/ that is not a git repository | `/not a git repository/` | safe: the no-repository die of discovery ("not a git repository (or any of the parent directories): .git"), a literal `.git`, no computed argument |
| `projects.test.ts` › S-07.1 unreachable remote | `/git\.invalid/` | safe: the URL the test chose, echoed by the HTTP transport ("unable to access '<url>'") |
| `projects.test.ts` › S-07.3 refused authentication | `/Authentication failed\|could not read Username/` | safe: two wordings accepted; `Authentication failed for '<url>'` is the credential code's long-stable text |
| `projects.test.ts` › refuses the ext:: / fd:: transport | `/not allowed/` | safe: `transport '%s' not allowed` (protocol.allow, git ≥ 2.12) |
| `projects.test.ts` › bug-017 clone: git quoting a URL | `/\\u202e\|%E2%80%AE/i` | safe: the URL the test chose ("repository '<url>' not found"), raw or percent-encoded both accepted |
| `git-routes.test.ts` › git refuses → 422 git-refused | `toContain('<remote>')` | safe: the remote path is the test's (`'<path>' does not appear to be a git repository`) |
| `git-routes.test.ts` › D33-2 GIT_ALLOW_PROTOCOL | `/transport 'ext' not allowed/` | safe: as above |
| `auto-push.test.ts` › Y-08.1 | `/rejected\|fetch first\|non-fast-forward/` | safe: three wordings of the push rejection |
| `git-routes.test.ts` 525–562, 644; `auto-push.test.ts` 206 | redaction of messages | safe: stubbed runner output, no git text |
| `test/server/git/local-remote.test.ts` › S3 (`gitdir:`) | code `remote-not-owned` | safe: our own resolution of the `gitdir:` file, no git message |
| `test/launcher/` | `state.test.ts`, `launcher.test.ts`: the launcher's own stderr | safe: no git text |

Test plan: the renamed case in `projects.test.ts` (bug-017 describe); red by guard removal (the
sanitiser call of the add route removed: the case must fail on the raw U+202E); green under the
plain git and under the strict `useConfigOnly` + `followRemoteHEAD` wrapper; `test:coverage`
through the slot under that wrapper. No product change, no README change (the test name is not
cited there), no e2e change.

### red / green / refactor (2026-10-20)

- **Change** — `4f03867`: the bug-017 add case in `test/server/http/projects.test.ts` is now "add:
  git quoting a config value with control and bidi characters" (D45-1 B): `git init` in a folder
  with `.wingfoil/`, `git config core.repositoryformatversion 'x<U+202E><ESC>[31m'`, add →
  `git-refused`; the no-raw-character assertion stays first, then `‮`, then nothing listed.
  No product change; `test/README.md` unchanged (it does not cite the test).
- **Red (AC-2)** — the new case passed on its first run (the sanitiser is in place), so its guard
  was removed: with `project-list.ts`'s add producer changed to pass `error.message` without
  `redactLocalPaths`, the case fails with "expected [ '‮' ] to deeply equal []" (1 failed, the
  clone case passed); restored, 2/2 passed. The same 2/2 under the strict wrapper (below).
- **Git 2.55** cannot be run here; the old case's failure is the runner's (bug-022), the new
  case's stability rests on D45-2 (git's source, read 2026-10-20).
- **AC-2** — D45-3: no other assertion in `test/server/http/` or `test/launcher/` depends on a path
  argument that git computes; nothing else changed.

#### Checks (2026-10-20)

Strict wrapper: a `git` script in the session scratchpad (copy of task-044's reviewer wrapper:
`-c user.useConfigOnly=true`, and after a successful `fetch`/`pull` `git remote set-head <r> -a`
for each remote without `<r>/HEAD`), first on the `PATH`.

| check | result |
|-------|--------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | green |
| `python3 docs/03_backlog/X_tools/check_tasks.py v0.2` | OK |
| `vitest run test/server/http/projects.test.ts -t bug-017`, plain git and strict wrapper | 2 passed each |
| `npm run test:coverage` under the strict wrapper, through the slot — run 1 (granted at load 8.23) | 3219 passed, **1 failed**, 1 skipped; 835 s; the failure: `test/server/sync/auto-sync.test.ts` › *RP-36 / D34-5* "Test timed out in 30000ms" (load 22 after the run) |
| run 2 (granted at load 10.22) | 3217 passed, **3 failed** (timeouts under load: the same RP-36 case, `element-writes.test.ts` › W2-5, `snapshot/watcher.test.ts` › review F3 "Matcher did not succeed in time"); 810 s; load 25.9 (5-min) after the run |
| run 3 | 3219 passed, **1 failed** (the same RP-36 timeout); 737 s; load 26 (5-min) after the run |
| the failing files alone, strict wrapper | `auto-sync.test.ts` 40/40 (217 s, load 13); `element-writes` + `watcher` + `auto-sync` 111/111 (282 s, load 14 → 8) |
| "auto-detection is disabled" / "Author identity unknown" in the three logs | 0 |
| `wfui-*` left in the temporary directory; consoles left | 0; none |

The coverage gate is **not green** on this machine today: every failure is a timeout in a file
this task does not touch, under a 1-min load of 20–26 (12 cores, swap full) that rises during the
run; the files pass alone; Vitest prints no coverage figures for a failed run. The bug-022 case
passed in all three runs. RP-36 runs four consoles in sequence inside one 30 s test — reported to
the coordinator as a load-sensitivity candidate (bug-004 class), not fixed here.

### review (2026-10-20, coordinator)

- Independent fresh-context review: **PASS** (two nits). The add route's only git call
  (`remote get-url origin`) dies with exit 128 on the non-numeric `core.repositoryformatversion`, so
  the case reaches the same `git-refused` producer through `redactLocalPaths`; the reviewer checked
  git's `master` source (`check_repo_format` → `git_config_int` → `die_bad_number` quoting the value).
  R1 (nit, recorded here): outside AC-2's two folders, `test/server/projects/clone.test.ts` and
  `test/server/git/transport-facts.test.ts` (`transport 'ext' not allowed`) passed on git 2.55 in run
  `39328350689`; `test/e2e/add-project.spec.ts` (`Authentication failed`) and
  `test/e2e/git-status.spec.ts` (`unable to access`) assert git's wording but do not run in CI —
  safe for v0.2, a candidate for the same treatment later. R2 (nit): the table is broader than AC-2
  asks — no change.
- The coverage timeouts (`auto-sync.test.ts` RP-36, `element-writes.test.ts` W2-5,
  `snapshot/watcher.test.ts` F3, load 20–26) are unrelated to this diff (reviewer); RP-36's 30 s
  budget with four consoles is a load-sensitivity candidate for a separate bug.
