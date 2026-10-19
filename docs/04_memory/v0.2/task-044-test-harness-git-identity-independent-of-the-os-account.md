---
id: task-044-test-harness-git-identity-independent-of-the-os-account
type: task
title: "Test harness git identity independent of the OS account"
status: in-progress
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","ci"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-020-test-harness-takes-the-git-author-name-from-the-os-account-and-commits-fail-on-a-runner-without-a-full-name", "bug-021-commit-provenance-checker-flags-the-origin-head-ref-that-git-2.48-and-later-create-on-fetch"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention", "task-029-npm-publishing-pipeline-and-registry-setup-checklist"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2 (pre-step of `release-submit-rel-v0.2-plan`): the first CI run
of this repository — the `workflow_dispatch` dry run of `.github/workflows/publish.yml` on `main`
`08a84db` (RV2-5) — failed in *Tests with coverage*: 61 tests in 7 files could not commit because the
test harness's git configuration has no `user.name` and the runner's OS account has no full name
(bug-020, absorbed here); the same run showed that git ≥ 2.48's `origin/HEAD` ref trips task-043's
commit-provenance checker (bug-021, absorbed here as AC-5). The suite must not depend on the machine's user account. Test-only
governance task (`module: governance`, `ref: GOV`); no product change.

**Backlog items:** GOV (governance — bug-020, release-validation dry run of minor-v0.2)

## Acceptance Criteria

- **AC-1 (bug-020)** Every commit a test makes gets its author from the harness configuration:
  `harnessEnv` (`test/harness/fixtures/builder.ts`) writes a `user.name` into its `.gitconfig` (no
  `user.email`: tests of unidentified users rely on none being set). A test (red first) fails when
  the harness configuration has no `user.name`, and shows that a commit in a fresh clone made with the
  harness environment succeeds with `user.useConfigOnly=true` style strictness (git refusing to guess
  the name from the OS account) — the closest local reproduction of the runner.
- **AC-2** Every other place where a test or test-support helper runs `git commit` (or a CLI verb that
  commits) outside the fixture environment is found and either moved onto the harness environment or
  given an explicit identity: unit, launcher, harness, smoke and e2e support (`test/e2e/support/`
  included). The search and its result are recorded in the Execution Notes.
- **AC-3** The whole suite passes with git unable to take a name from the OS account. Locally this is
  shown by running the affected files (or `test:coverage`) with an identity-strict setting the harness
  cannot bypass (decided at design: e.g. a wrapper or the `GIT_*`-stripping kept, plus a check), and
  in CI by the next `workflow_dispatch` dry run (run by the coordinator on the approver's OK after
  the merge).
- **AC-5 (bug-021)** The commit-provenance checker (`test/harness/commit-provenance.ts`, task-043)
  ignores a remote-tracking `HEAD` symref (`refs/remotes/<remote>/HEAD`) that git creates or
  updates by itself on fetch (git ≥ 2.48, `remote.<name>.followRemoteHEAD`), and still reports every
  other added or moved ref; a self-test case reproduces it with git 2.43 (`git remote set-head
  origin main` in the session copy) and fails before the fix; no `followRemoteHEAD` setting is added
  to the harness configuration.
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e:chromium` (the e2e
  support changes), `docs:api` green, every heavy gate through the machine-free slot;
  `check_tasks.py v0.2` OK; `test/README.md` (the harness environment and the identity rule) and its
  version line updated; bug-020 follows this task's state (bug.sync_state).

## Implementation Notes

- `harnessEnv` strips every `GIT_*` and `XDG_*` variable and points `GIT_CONFIG_GLOBAL` at its own
  file with `GIT_CONFIG_NOSYSTEM=1`; git then falls back to the account's GECOS name for `user.name`.
- Tests that set `GIT_AUTHOR_NAME` themselves (`test/harness/commit-provenance.test.ts`,
  `test/harness/repo-state.test.ts`) keep working; e2e identities set only `user.email` (ES2-3).
- `.github/workflows/publish.yml` is not changed: the fix belongs in the tests
  (`test/package/publish-workflow.test.ts` freezes the workflow).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-19)

Read: this task, bug-020, the Execution Notes of task-026 (depends_on: the run's temporary root,
`TempWorkspace`, the clone hooks path) and task-029 (depends_on: the pipeline, `publish.yml`
frozen by `test/package/publish-workflow.test.ts`, gate = `typecheck`, `lint`, `format:check`,
`test:coverage`, `test:smoke`; no Playwright in CI), `test/README.md` 0.44 (*Fixtures*, *Local
state*, *Temporary folders*), `test/harness/fixtures/builder.ts` (`harnessEnv`), `project.ts`,
`variants.ts` (`copyFixture`), `test/harness/run.ts`, `server/src/git/git.ts` (`resolveGit`),
`server/src/process/runner.ts` (`gitEnv`), the failed job's log of run 39315562583
(`gh run view --log-failed`).

**What the runner log says (61 failures).** 58 tests in 6 files fail on "Author identity unknown"
(121 lines), every one on a commit `outside: <file>` (or `outside <n>`) made in a fresh clone of
the fixture's remote with only `user.email` set: `remoteCommit` of
`test/server/http/git-console.ts` (auto-sync, git-routes, repository-status, auto-push, projects)
and of `test/launcher/auto-sync.test.ts`. The 3 failures of `test/harness/commit-provenance.test.ts`
are **not** identity failures: that file sets `GIT_AUTHOR_*`/`GIT_COMMITTER_*`; the checker reports
`ref added or moved: refs/remotes/origin/HEAD …`. The runner has git **2.55.0** (checkout step
log), this machine 2.43.0: since git 2.48 `git fetch` creates `refs/remotes/<remote>/HEAD`
(`remote.<name>.followRemoteHEAD`, default `create`), so the checker's ref comparison sees a new
ref. A git-version dependence, outside bug-020 (D44-6). Tests that stopped on the identity error
may hide further 2.55-only differences (D44-7).

**Probes (git 2.43, scratch repositories in the session scratchpad).**

| setting | `git var GIT_AUTHOR_IDENT` / `git commit` in a repo with only `user.email` |
|---------|------------------------------------------------------------------------------|
| harness-like config (`GIT_CONFIG_GLOBAL` = own file, `GIT_CONFIG_NOSYSTEM=1`, no `user.name`) | name taken from the account's GECOS field — passes here, fails on the runner |
| `-c user.useConfigOnly=true` (or the same via `GIT_CONFIG_COUNT`/`KEY_0`/`VALUE_0`) | `fatal: no name was given and auto-detection is disabled` (exit 128): `useConfigOnly` disables the passwd/GECOS fallback for the **name**, not only for the email |
| `-c user.name=` (empty) | `fatal: empty ident name (for <…>) not allowed` — the runner's exact message |
| `user.name` + `user.useConfigOnly = true` in the harness file | commit passes, author `<harness name> <email>` |
| `useConfigOnly` and no email anywhere | `fatal: no email was given and auto-detection is disabled` (stricter than the runner, which guesses an email from the host name) |
| `GIT_AUTHOR_NAME` in the environment + `useConfigOnly` | passes (the environment counts as given) |

`harnessEnv` strips every `GIT_*` variable and the server's runner strips the redirecting ones
(`gitEnv`), so an environment switch reaches neither the harness processes nor the product's git;
`PATH` is kept by both and the server resolves `git` on it (`resolveGit`). A wrapper first on the
`PATH`, `exec <real git> -c user.useConfigOnly=true "$@"`, therefore reaches every git process of a
run (tests, server, the WingFoil CLI), and a command-line `-c` beats any repository or global
setting. Red probe with that wrapper (no code change, `vitest run
test/server/http/repository-status.test.ts test/launcher/auto-sync.test.ts`): **6 failed, 6
passed** — exactly the runner's 4 + 2 for these files, with "no name was given and auto-detection
is disabled".

**AC-2 search** (`grep -rnE "['commit'|commit -|commitAll|--amend"` and the CLI verbs over
`test/**/*.ts`, then the environment of each call):

| commit site | identity today | on a runner |
|-------------|----------------|-------------|
| fixture builds (`FixtureProject.init/commitAll/addInState`, CLI verbs via `wingfoil`/`wingfoilAs`), commits in `fixture.dir` or `copyFixture` copies (`events.ts` `commitFile`, `memory-list.spec`, `performance.spec`, snapshot/watcher/memory-events/process-audit/element-writes/project-routes/git-routes/auto-push/auto-sync on `fx.dir`, `launcher/git-routes`, `timing/live-refresh`), the console's governed writes on those copies | repository `user.name` set by `as()` (copied with `.git/config`) | ok |
| clones with only `user.email`: `git-console.ts` `remoteCommit`, `launcher/auto-sync.test.ts` `remoteCommit`, `e2e/support/remote.ts` `remoteCommit` (task-039/040 specs, `commit-provenance.spec.ts`), `timing/auto-sync.timing.test.ts` `remoteCommit` | GECOS name | **fails** (the first three seen in CI; e2e and timing do not run there) |
| explicit `-c user.name=… -c user.email=…`: `clone-hooks`, `process/git-env`, `e2e/support/git-http.ts`, `projects/clone`, `http/projects` (3), `git/git.test` 177, `git-routes` 614, `smoke/launch.smoke` | explicit | ok |
| repository `user.name`/`user.email` on a `harnessEnv` env: `scripts/check-release-tag`, `scripts/action-log-ratio`, `git/transport-facts`, `git/git.test` 280–360 | explicit | ok |
| `GIT_AUTHOR_*`/`GIT_COMMITTER_*` on a `harnessEnv` env: `harness/commit-provenance`, `harness/repo-state` | explicit | ok (provenance fails for D44-6) |

Not yet known from reading alone: clones made by the console (`POST /api/projects/clone`) followed
by a governed write, and any CLI verb run in such a clone — the strict run of D44-4 is the check
(every remaining site found there is added to this table in *red / green / refactor*).

#### Plan (recommended options)

- **Red** — `test/harness/git-identity.test.ts` (new, light: no fixture build, no CLI): (1) the
  harness `.gitconfig` declares `user.name` and no `user.email` (`git config --global --get` with
  the harness env); (2) a bare repository, a fresh clone with only `user.email`, a commit with the
  harness env **and** `-c user.useConfigOnly=true` succeeds and its author name is the harness
  name. Both fail today (committed red first).
- **Green** — `harnessEnv` writes `[user] name = … ` (D44-2) and `useConfigOnly = true` (D44-1);
  helpers per D44-3.
- **AC-3** — the wrapper of D44-4 in the session scratchpad (never in the repository), the gates of
  D44-5 run under it; the recipe in `test/README.md`.
- **Docs** — `test/README.md`: *Fixtures* / *Local state* (the harness identity rule: the harness
  gives the name, a test acts as a member with `user.email`; never rely on the account), a *Git
  identity* paragraph with the strict-run recipe, `harness/git-identity.test.ts` in *Layout*,
  version line 0.45. No product doc, no `CHANGELOG` entry (test-only; D44-8).
- No `.github/workflows/publish.yml` change; no e2e scenario (`e2e closure`: none).

#### Open decisions

- **D44-1 — what the harness configuration declares.** (a) `user.name` only (AC-1 literal; email
  guessing left as on the runner); ★ (b) `user.name` + `user.useConfigOnly = true`: every local run
  is at least as strict as the runner for every harness-env process, so a new helper that commits
  without an identity fails on the developer's machine, not first in CI; cost: email guessing is
  off too — a test commit with no email anywhere fails (stricter than the runner; the product
  refuses unidentified writes before committing, RP-14), any such site found by the red/strict runs
  gets an explicit email; (c) (a) and only the AC-3 run strict (wrapper), no permanent guard beyond
  the AC-1 test.
- **D44-2 — the harness name.** ★ (a) a neutral name that is no team member (e.g. `Test Harness`):
  a commit without an explicit identity is recognisable in a log; (b) `Alex` (the fixtures' current
  identity): matches most `user.email` settings of the fixtures but hides a missing identity.
- **D44-3 — the four `remoteCommit` helpers (AC-2).** ★ (a) unchanged: they already run with the
  harness env and get the name from it (one rule, one place; author "Test Harness
  <jordan@example.test>"); (b) each also sets `user.name Jordan` next to `user.email` (author
  consistent with the member, four edits in shared files, `e2e/support/remote.ts` included);
  (c) (a) + (b).
- **D44-4 — how AC-3 is shown locally.** ★ (a) a `git` wrapper first on the `PATH`
  (`-c user.useConfigOnly=true`), outside the repository — reaches tests, server and CLI (probe
  above: reproduces the runner's 4 + 2 failures today); (b) an environment switch read by
  `harnessEnv` (`WFUI_STRICT_GIT_IDENT`): misses processes outside `harnessEnv`, and the server's
  `gitEnv` strips `GIT_CONFIG_*`; (c) `nss_wrapper` with a passwd entry of empty GECOS (the runner's
  exact condition): not installed here, needs a download.
- **D44-5 — which heavy gates run under the wrapper (slot each).** ★ (a) `test:coverage` and
  `test:e2e:chromium` once each under the wrapper — they are AC-3 and the AC-4 gates at once (the
  wrapper only removes the account fallback; after the fix the account plays no role); no
  three-engine run of own specs (under D44-3 (a) no e2e file changes; under (b) the specs using
  `remoteCommit` — `git-status`, `update-push`, `commit-provenance` — on three engines); (b) every
  gate twice (normal + wrapper); (c) the wrapper only for `test:coverage`.
- **D44-6 — the git ≥ 2.48 `refs/remotes/origin/HEAD` failures (3 tests, also
  `commit-provenance.spec.ts`).** Out of bug-020's scope. ★ (a) a bug-ingest by the coordinator
  (new bug, absorbed into task-044 with an added AC): the checker
  (`test/harness/commit-provenance.ts`) ignores `refs/remotes/<remote>/HEAD` (a symbolic ref git
  maintains itself); red locally by creating it with `git remote set-head origin main` between the
  snapshots, as git 2.55's fetch does; (b) `remote.origin.followRemoteHEAD = never` in the harness
  configuration (hides from the product's tests what real users' git 2.48+ does); (c) a separate
  task after task-044 (the CI dry run stays red until then).
- **D44-7 — other git 2.55 differences.** ★ (a) the next `workflow_dispatch` dry run is the check
  (AC-3, CI part); a new failure there goes through bug-ingest; (b) build git 2.55 from source into
  the scratchpad (a download, approver's OK) and run the strict gates with it too; (c) both.
- **D44-8 — `CHANGELOG.md`.** ★ (a) none (test-only, nothing a user sees); (b) a line under
  *Unreleased* › Fixed (bug-020).

#### Decisions answered 2026-10-19

Approver: all as recommended — D44-1 (b), D44-2 (a) with the name "Test Harness", D44-3 (a),
D44-4 (a), D44-5 (a), D44-6 (a), D44-7 (a), D44-8 (a). D44-6 (a): the coordinator ingested
bug-021 (the commit-provenance checker flags the `refs/remotes/origin/HEAD` that git 2.48 and
later create on fetch); after triage it is absorbed into this task (bug list, AC-5) and `main` is
merged into this branch by the coordinator before the AC-5 work starts.

### red / green / refactor (2026-10-19)

- **Red** — `16b998f`: `test/harness/git-identity.test.ts` (three tests: the harness file gives
  `user.name` = `HARNESS_GIT_NAME`, no `user.email`, `user.useConfigOnly`; a commit in a fresh
  clone with only `user.email` and `-c user.useConfigOnly=true` succeeds with the harness name; a
  commit with no email anywhere is refused with "no email was given and auto-detection is
  disabled"). `HARNESS_GIT_NAME` exported first so the red run fails on behaviour, not on a missing
  import: 3 failed — "expected undefined to be 'Test Harness'"; the clone commit "fatal: no name was
  given and auto-detection is disabled" (the runner's failure); the third "unable to auto-detect
  email address" (this machine's host name has no domain; with one, git would have guessed and
  committed).
- **Green**: `harnessEnv` writes `[user] name = Test Harness` and `useConfigOnly = true`; 3 passed.
  Targeted run under the strict `git` wrapper of D44-4 (scratchpad, `PATH` first; no slot needed for
  a targeted Vitest run): `vitest run` of the six identity-failing files of the runner plus
  `commit-provenance`, `element-writes`, `server/identity/`, `snapshot/watcher`, `git/git.test`,
  `git-identity` → 14 files, 358 tests passed (before the fix the same wrapper failed 6 of 12 in
  `repository-status` + `launcher/auto-sync`). The full strict gates (D44-5) run after AC-5.
- **AC-2**: no helper changed (D44-3 (a)); the four `remoteCommit` helpers now take the name from
  the harness. Sites not identifiable by reading (console clones followed by writes) are checked by
  the strict `test:coverage` and `test:e2e:chromium` runs.
- **Docs**: `test/README.md` 0.45 (*Layout* › `test/harness/`, *Fixtures* › *Git identity* with the
  strict-run recipe).
- **Merge** — `76ed62a`: the coordinator merged `main` (bug-021 absorbed, AC-5).
- **AC-5 red** — `51d2954`: three cases in `test/harness/commit-provenance.test.ts`
  (*the remote-tracking HEAD git maintains itself*): `git remote set-head origin main` after the
  session (as git ≥ 2.48's fetch does) → no problem; the symref present before the session and moved
  with `origin/main` → no problem; a plain ref `refs/remotes/origin/HEAD` (`update-ref`) and the
  HEAD symref of another remote (`mirror`) → still reported. Red run: the first two failed with
  `ref added or moved: refs/remotes/origin/HEAD <sha>` (the runner's message), the third passed
  (guard of the rule to come).
- **AC-5 green** — `f2a1812`: `provenanceProblems` ignores `refs/remotes/<remote>/HEAD` only while
  `git symbolic-ref -q` names a ref under `refs/remotes/<remote>/`; its removal, a plain ref of
  that name and other remotes' HEADs are reported; no `followRemoteHEAD` setting anywhere. 14/14.
  Guard removal: allowing the name unconditionally (and `mirror/HEAD`) fails the third case.
  `e2e/commit-provenance.spec.ts` expects `[]` and is unchanged: on git ≥ 2.48 the console's own
  fetch creates the symref, now ignored. `test/README.md` (*Layout*, the checker's rules; 0.45 line).
- **AC-2 result**: the strict runs below found no commit site beyond the design's table — no test
  output carries "auto-detection is disabled" or "Author identity unknown" (`grep -c` = 0 on both
  logs), so the console's clones and writes all take a configured identity.

#### Checks (2026-10-19)

| check | result |
|-------|--------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | green |
| `npm run docs:api` | green |
| `python3 docs/03_backlog/X_tools/check_tasks.py v0.2` | OK |
| `npm run test:coverage` under the strict `git` wrapper (D44-4/D44-5; slot granted at load 6.90) | 174 files passed, 1 skipped; 3219 tests passed, 1 skipped; statements 96.56 %, branches 91.4 %, functions 97.3 %, lines 98.35 %; 347.7 s |
| `npm run test:e2e:chromium` under the strict `git` wrapper (slot granted at load 11.84) | 319 passed, 16.3 min |
| `wfui-*` left in the temporary directory; consoles left (`pgrep -af bin/wingfoil-ui.cjs`) | 0; none |
| own specs on three engines | none changed (D44-5 (a)) |
| CI (AC-3, D44-7) | the next `workflow_dispatch` dry run, by the coordinator after the merge |
