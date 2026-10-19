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
value is written with `git config` (git itself, no hand-made file format). No branch on the git
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
