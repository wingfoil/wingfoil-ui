---
id: dev-loop-rel-v0.1-plan
type: plan
title: "Implementation rel-v0.1"
status: active
version: "0.5"         # optional — plan version
workflow: "dev-loop"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.5 · **Date:** 2026-10-09 (0.1: plan created, Wave 1 scope; 0.2: Wave 1 session log; 0.3: Wave 2 session log; 0.4: Wave 3 session log; 0.5: between-waves feedback-loop tasks 022, 023)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`) phase `implementation` = `dev-loop` iterated over every task with status `backlog`
and tag `v0.1` (`.wingfoil/workflows/custom/release-cycle.yaml` v1.1, `dev-loop.yaml` v1.4)
**Roles:** developer (start, red, green, refactor, done), architect (design), reviewer (review),
approver (gates) — Roberto Pompermaier holds all of them; the agent develops, drafts and runs the
independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`in-development`); tasks
`docs/04_memory/v0.1/task-001` … `task-021` (`backlog`); tech-specs `spec-001` … `spec-004`,
`spec-006` … `spec-009` (`approved`); ADRs `adr-001`, `adr-002` (`accepted`); BDD conventions
`docs/02_requirements/02_bdd/00_conventions.md`
**Evidence:** handoff of `release-planning-rel-v0.1-plan` (`done`, merge `7ccafde`); directives
`wingfoil-cli` v1.2 (W-01 … W-20), `cli-only-writes` v1.4, `claim-evidence`

Why now: `minor-v0.1` is `in-development` and its 21 tasks are `backlog`; `release-cycle` phase
`implementation` runs `dev-loop` once per task. One plan covers the whole phase; each wave is run
by one session and logged below.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `release-planning-rel-v0.1-plan` is `done`; `directives list` → `"warnings": []`;
  `check_tasks.py` passes.

Produces: the code of `server/`, `web/`, `contracts/` with its tests; every v0.1 task `done`, merged
to `main`; the task's **Execution Notes** filled per phase.

## Phases / Steps

Tasks are picked by `depends_on`, **not by number**. Dependency levels: L0 001 · L1 002 · L2 003,
004, 007 · L3 005 · L4 006, 009, 010, 011 · L5 008, 012 · L6 013 · L7 018 · L8 017, 020 · L9 015,
019 · L10 014 · L11 016 · L12 021.

| Wave | Tasks (in order) | Theme |
|------|------------------|-------|
| 1 | 001, 002, 003, 004, 007, 005 | server foundations: workspace and e2e harness, launcher, session, CLI adapter, local state, CLI contracts |
| 2 | 006, 009, 010, 011, 008, 012 | server: version range, identity, snapshot and live updates, descriptor, project APIs |
| 3 | 013, 018, 017, 020, 019 | web core: shell, element panel, memory list, docs, DNA views |
| 4 | 015, 014, 016 | project flows: switcher, add modal, header |
| 5 | 021 | closing pass: accessibility, page title, performance |

Per task (`dev-loop` v1.4):

| Phase | What happens | Who |
|-------|--------------|-----|
| start | branch and worktree `task/<task.id>`; `backlog → in-progress` **by hand** (no verb, W-20): set `status:` and commit `wf(task): <id> [backlog → in-progress]` on `main` before branching | agent |
| design | classify each AC red-first / characterization and read the Execution Notes of every `depends_on` task (hard gate) — both recorded in the task's Execution Notes; a spec gap → `memory add` + `submit` a tech-spec, approved before `red` | agent; approver for new specs |
| red / green / refactor | tests first; `refactor` gate: tests green, coverage ≥ 80 %, TypeDoc complete (server/contracts), lint clean | agent |
| review | BDD/e2e suite for the task's scenarios; independent fresh-context read-only review agent (ACs, tests, spec coherence), re-verified by it after fixes; `memory submit` (`in-progress → in-review`) | agent; reviewer |
| done | `memory approve --reason …` (`in-review → approved`) run by the user; merge to `main` with `--no-ff` after the user's OK; remove the worktree; `approved → done` **by hand**, commit `wf(task): <id> [approved → done]` | approver (user), agent |

### Decisions taken at the start (2026-10-05)

- One plan for the whole `implementation` phase (`workflow: dev-loop`, the `id_pattern` example
  `dev-loop-rel-v0.1-plan`); one session per wave, logged below.
- Wave 1 = 001, 002, 003, 004, 007, 005 (confirmed); later waves as in the table, confirmed by the
  session that runs them.
- Task transitions checked on a scratch clone with `wingfoil@0.2.2`: `submit` from `backlog` and
  from `approved` is refused (`illegal transition … -> pending`, W-20); `submit` moves
  `in-progress → in-review`; `approve` moves `in-review → approved`. `backlog → in-progress` and
  `approved → done` are hand edits with a `wf(task): <id> [from → to]` commit (like W-04).
- Commits: the CLI `wf(…)` commits, the task commits on its branch, one `--no-ff` merge per task
  (asked before merging), plus one plan commit per session (`docs(plan): session N — …`).
- Every task's review is done by an independent fresh-context read-only agent, re-verified by it
  after fixes.
- `main` stays local (not pushed) during Wave 1.

## Handoff

- **Agent:** implements each task through `dev-loop`, fills its Execution Notes, runs the scripted
  checks and the independent review, runs `add`/`submit`, makes the hand transitions, keeps the
  session log, commits.
- **Human (approver):** runs every `memory approve` (W-13), authorises each merge to `main`.
- **Checkpoints:** end of `design` (only if a new tech-spec is needed); end of `review` (approve);
  before each merge; end of each wave.
- **Completion:** every v0.1 task `done` and merged; plan finalized by hand (`status: done`, commit
  `wf(plan): finalize dev-loop-rel-v0.1-plan [active → done]`, W-04).
- **Next:** wave 4 (015, 014, 016) — see Session 3 and its addendum; M2 applied, waiting for the
  approver's go.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Wave 1: server foundations (2026-10-05)

- **Done and merged** (`--no-ff`, each after an independent fresh-context review, re-verified by
  the same agent after fixes, and the user's `memory approve`): task-001 (`cef8085`), task-002
  (`cfc7d87`), task-007 (`5708b16`), task-003 (`f534738`), task-004 (`dc6baf6`), task-005
  (`d8960f5`). Review rounds: 001 ×2, 002 ×2, 003 ×3, 004 ×4, 007 ×3, 005 ×2.
- **Process decisions:**
  - Task transitions checked on a scratch clone: `backlog → in-progress` and `approved → done` are
    hand edits with a `wf(task): <id> [from → to]` commit on `main` (W-20, directive 1.3).
  - **Parallel dev-loops** (user request): after task-002, tasks 003, 004, 007 ran in parallel,
    one background agent per worktree (design → refactor only); the coordinator kept every
    transition, review, submit and merge on `main`. Wave statistics are shown at every agent
    update (user preference). Merges one at a time; from task-004 on, `main` is merged into the
    task branch **before** submit, so the approval covers the integrated code.
  - Plan `workflow: dev-loop` (the `id_pattern` example) instead of `release-cycle`.
- **Spec amendments decided by the user** (approved specs edited in place, Process Notes dated):
  spec-004 §1 `Sec-Fetch-Site` check and duplicate `Host` refused, §5 `502 read-error`; spec-006 §4
  lock protocol between consoles (`state.json.lock`, heartbeat, 10 s staleness), temporary file
  `tmp-<pid>-<n>`, `reload`; spec-007 §6 `SIGHUP` like `SIGTERM`, synchronous kill of child
  process groups on forced stop/exit; spec-001 errata — shapes follow WingFoil 0.2.2's own
  schemas (optional fields, `\r?\n` delimiters, merge keys) (`429aab3`, `aba1464`).
- **WingFoil 0.2.2 facts** (directive `wingfoil-cli` 1.3 → 1.5): W-21 `memory add` always writes
  `draft`; W-22 exit 2 may be JSON on stderr, positionals after `--`; W-23 duplicate directive ids;
  W-09 qualified (dangling binding warned only with `--role`). A claimed W-22 "search hides
  undeclared states" was **withdrawn** at review (flawed probe). adr-001 Process Note: the root
  `devDependencies` pin of `wingfoil` is not a runtime dependency. Local requests: R-12.
- **Deviations:** the fixture builder (001) and two coverage tests (002) were written after the
  code; the task-004 agent session was interrupted and the coordinator completed its notes.
- **Environment:** another project's parallel builds pushed the load average to 50–70 on 12
  cores; the REQ-PERF-06 start test (≤ 3.0 s) and the TypeDoc-build test (30 s) then fail and pass
  alone. Every merge was preceded by a full run at low load. **Proposal for Wave 2:** isolate the
  timing tests (sequential Vitest project) and run them only on a quiet machine.
- **Checks on `main` after the wave** (`4d3e6cb`, load ≈ 6): `npm run test:coverage` **547 passed,
  1 skipped** (on-demand sample capture), coverage 96.32 % statements / 90.04 % branches · e2e 3/3
  (Chromium) · lint, format, typecheck clean · `docs:api` OK · `check_tasks.py` OK (21 tasks, 72
  items) · `directives list` → `"warnings": []`.
- **Hand-overs to Wave 2** (in each task's Execution Notes): 006 — `matrix.json`, versioned
  schemas; 008 — clone through the runner with the REQ-SEC-05 probe (`test/harness/security.ts`),
  `store.transaction` short and side-effect-free (may run twice, not re-entrant), `reload()` for
  the list, write-lock key = opaque project id, `GIT_TERMINAL_PROMPT=0`, `dna.project.name`
  optional; 010 — cache `memory search`, re-discover the CLI when `node_modules/wingfoil` changes;
  012 — routes through `buildApp({ register })` (guarded automatically), `read-error` mapping,
  never log `DirectReadError.message`; 013 — `POST /api/session` (Bearer, 204), same-origin
  fetches only, catalogue keys `state.*`; 015 — Playwright needs its own `tsc -b server` step.
- **Bug ingest** (user decision: isolating the timing tests needs a bug, not an ad-hoc change):
  `bug-001-timing-tests-fail-under-external-machine-load` captured through `bug-ingest`
  (`add`/`submit` by the agent, triage `approve` by the user, severity low), **absorbed into
  task-010** (dl-045; it owns TT-PERF-03/05): `bug:` field and an Acceptance Criterion added
  (`443fb08`), bug `triaged → planned` by hand (`eeb7b9e`).
- **`.wingfoil/` alignment** with the WingFoil-Templates `base` pack: between releases, not
  between waves (user decision).
- **Next:** Wave 2 — 006, 009, 010, 011, 008, 012 (by `depends_on`; parallel where independent).

### Session 2 — Wave 2: server APIs (2026-10-05 → 2026-10-06)

- **Done and merged** (`--no-ff`, one at a time, each after an independent fresh-context review
  re-verified by the same agent, `main` merged into the branch before submit, and the user's
  `memory approve`), in this order: task-011 (`5a87c98`), task-006 (`19e89d2`), task-009
  (`c28f60b`), task-010 (`5f3c663`), task-008 (`9465fd6`), task-012 (`da0e6a4`). Review rounds:
  011 ×4, 006 ×4 (+ decision check), 009 ×2, 010 ×3 (+ integration review), 008 ×3 (+ decision
  check), 012 ×3 (+ decision check). Parallelism: level A (006, 009, 010, 011) four agents, then
  008 and 012 together after 010.
- **Decisions of the user (1–30, all option a except 21 → b)**, applied as amendments of the
  approved documents with dated Process Notes (`90d4f81`, audit follow-up `d4338a9`, `5aedca8`,
  `08dd680`); an independent coherence audit of the first set found 18 follow-ups, all fixed:
  - 006: range = declared `min` (`matrix.json`) to the caret line of the highest contract-tested
    version, labels `0.Y.x`/`X.x` (REQ-INT-02, adr-001 D3); `minVersion: null` = not released
    (REQ-INT-03); `capabilities.json` format (spec-001 §5/§6).
  - 009: role not held → 400 (spec-004 §4 row 5a); identity addendum and PUT 204 (§3); the
    role-view PUT is a local-state write (rows 1–5, 5a); cached identity moved to task-012.
  - 010: state key = porcelain hash + content fingerprint (REQ-STATE-02, spec-004 §5, adr-001 D6)
    with a hash-only read exception (REQ-ARC-04, adr-001 D1a, spec-001 §4.4, directive
    `cli-only-writes` 1.5); TT-PERF-05/TT-INT-09 stay in the default suite.
  - 011: gate-waiting actor = workflow engine, reject reserved to `approver` (spec-003 §4);
    `bucket` in the output (§8, `memory-list.feature`); reason codes; tables in
    `server/src/presets/` (spec-005, REQ-ARC-05); §9 erratum.
  - 008: `git-refused` for a non-git folder; a clone without CLI is kept as `cli-not-found`; clone
    queue on the lock key `clone`; response shapes; new refusals `directory-inside-project` and
    `inside-state-dir`; no CLI of the cloned repository runs at clone time (spec-006 §3, adr-001
    D2/D5).
  - 012: bodies defined by `contracts/api/` schemas (spec-004 §3); refused paths 404 with
    `detail.kind` (§5); range label "0.2.2 to 0.2.x" (spec-003 §6); spec-002 §3 NUL framing with a
    header-only sha read (two git processes per HEAD).
  - Process: submits allowed under external load with the two known timing failures accepted
    (before task-010 moved them to `test:timing`).
- **Coordinator decisions:** REQ-ARC-05 lint exempts method/getter/setter names (behaviour, not
  data) — sibling APIs (`open()`, `get resolved()`) were otherwise reported; descriptor reason
  `version-unsupported` and the capability/API code `unsupported-version` are distinct catalogue
  keys (spec-008 §4); task-005's ACs left historical; the integrations of 010 and 012 were
  delegated to their developer agents (merge of `main` authorised for that step only).
- **Bugs** (`bug-ingest`, absorbed per dl-045, `bug.sync_state` by hand/CLI): bug-001 (timing
  tests under load) and bug-002 (inherited `GIT_*` variables redirect git and CLI reads, medium)
  absorbed into task-010, **closed**; bug-003 (confined reads swapped after the check, low)
  absorbed into task-012, **closed**.
- **Facts learned:** a commit message can forge `%x1e`-framed `git log` records — NUL framing as
  WingFoil bug-050/task-086; git decides "binary" on the first 8000 bytes, so a NUL can reach a
  patch; legacy `GIT_CONFIG` still redirects `git config` (git 2.43); a relative `core.hooksPath`
  in the user's config runs the remote's committed hooks during `git clone` (neutralised with
  `-c core.hooksPath=<empty dir>`); WingFoil 0.2.2's `--reason` accepts control characters.
- **Deviations:** spec-002 §4 incremental `old..HEAD` parse not implemented (whole walk per HEAD;
  needed for v0.2 Updates/Timeline); e2e ACs proved through the API and the bin, screens close in
  the web tasks; agent sessions interrupted twice by API limits and resumed without loss; the
  task-009 identity source is superseded by the watched identity (kept with its tests).
- **Environment:** external load 25–80 for most of the wave; after task-010 the default suite is
  load-independent (`test:coverage` green at load 70) and only `test:timing` needs a quiet machine.
- **Checks on `main` after the wave** (`9bbf70b`): `test:coverage` **1236 passed, 1 skipped**,
  coverage 95.66 % statements / 88.68 % branches · `test:e2e` 3/3 · typecheck, lint (REQ-ARC-05
  rule), format clean · `docs:api` OK · `check_tasks.py`, `check_releases.py` OK · `directives
  list` → `"warnings": []` · `test:timing` **3/3** at load ≈ 9–12 (REQ-PERF-03 20/20 ≤ 1.5 s,
  REQ-PERF-06 546–1377 ms, TypeDoc 9.0 s). Process audit on the real routes: cold Memory list 5
  CLI + 6 git, reopened 0, 60 s idle 0 CLI.
- **Hand-overs to Wave 3** (details in each task's Execution Notes): web code must not use data
  keys/props equal to fixture type or state names (REQ-ARC-05 rule; method names exempt) — use
  `tone`/`bucket` from the descriptor as data; one `EventSource` per page, invalidate on `repo`,
  refetch the list on `projects`; response shapes from `contracts/api/` (incl. refusal codes and
  `detail`); catalogue keys for the new codes (`error.directoryInsideProject`,
  `error.insideStateDir`, `capability.<id>`, reason codes per spec-008 §4); selector only when
  `roleViews.length > 1`; Playwright suites that start the bin need their own `tsc -b server`.
- **Next:** Wave 3 — 013, 018, 017, 020, 019 (web core). To confirm at its start: the rule for
  external load (quiet machine only for `test:timing`, as in this wave).

### Session 3 — Wave 3: web core (2026-10-06 → 2026-10-09)

- **Done and merged** (`--no-ff`, one at a time, each after an independent fresh-context review
  re-verified by the same agent, `main` merged into the branch before submit, and the user's
  `memory approve`), in this order: task-013 (`6ad0c7d`), task-018 (`db4055a`), task-020
  (`2d1802f`), task-017 (`90b03ce`), task-019 (`9c8eb3d`). Review rounds: 013 ×3, 018 ×2, 020 ×2
  (round 1 FAIL on focus loss), 017 ×3, 019 ×2. Parallelism: 013 → 018 sequential (the user
  declined an early design of 018), then 017 ∥ 020, then 019. Handoff from the Wave 2 session
  requested and received at start.
- **Decisions of the user (W3-1 … W3-47, all option a)**, numbered per task with a recommended
  option, applied as amendments with dated Process Notes (`a605969`, `785ccaf`, `10d3759`,
  `3aa0433`, `b44f999`, `76ef2b3`, `6a34345`, `05d8876`; backlog regenerated with
  `build_backlog.py`):
  - 013 (W3-1 … W3-13): start page with no project open, empty Add-project dialog for 014, own lint
    rule `wfui/catalogue-placeholders` (spec-008 §6), key build in `web/dist-keys` served by
    Playwright route interception, every `error.*` key, project layout, full-page lost-session
    notice (spec-004 §2), tokens `--shadow-popover` and `--color-backdrop` (spec-009 §2), modal
    dismissal by Close/Escape only (ux-reference §5), unreachable-console banner after 10 s
    (spec-004 §6); React Aria "Dismiss" string and the static `<title>` left to task-021 (X-09.1);
    Vite chunk size measured in 021.
  - 018 (W3-14 … W3-21): `states` in the element response (spec-004 §3 addendum + erratum),
    off-sequence chip, first-paragraph summary, frontmatter references, route drawer, no Edit in
    v0.1 (ux-reference §4.2), history wording without state names (spec-008).
  - 017 (W3-22 … W3-27): `/p/$pid/memory` with `/p/$pid` redirect, panel replaces the list, lazy
    archived read (TT-PERF-05 kept at 5 CLI), undeclared states/types shown, §4.4 items deferred,
    bucket labels as closed UI vocabulary (spec-008 §3).
  - 020 (W3-28 … W3-37): index by folder, `html:false`, per-target server checks capped at 100,
    images never loaded, only http(s) followed, root-relative links, "Open on GitHub" deferred
    (ux-reference §4.9); R-08.2 amended (lists on `02_product-vision.md`, BDD conventions 0.8).
  - 019 (W3-38 … W3-47): panel directives of the current role view, pending gates aggregated
    from descriptors (spec-003 note), `projectHeaderQuery`, directive pages, only mine/all in the
    URL, team filters, DNA sections (ux-reference 0.6); W3-47: live-refresh "within 5 s" proved
    strictly in `test:timing` (Playwright part, measured from the mutation), default e2e asserts
    behaviour only.
- **Coordinator decisions:** shared `elementsQuery(pid, archived)` settled on task-017's shape
  after the review found 017 and 020 had diverged; task-020 merged first, task-017 resolved the
  shared-file conflicts; small catalogue rewordings accepted inside their tasks; a rule added to
  the agents' rules file: "when told to wait, wait" (task-018's agent built on its own recommended
  options before the user answered).
- **Bugs:** bug-004 (tests time out under extreme machine load, low) — `bug-ingest` by the agent,
  triaged by the user, absorbed into task-019 (dl-045), fixed (shared cold-read helpers, prebuilt
  fixtures, 10 s async waits, sized heavy tests, guaranteed console teardown with a reaper) and
  **resolved**; left in `resolved` on purpose, to be closed after real runs under load in Wave 4
  or at release validation.
- **Facts learned:** under load 25–100 the first cold CLI read behind a screen outlasts
  Playwright's 5 s and jsdom's 1 s defaults; e2e consoles could outlive their worktree (three found
  after ~10 h) until the reaper; the load average sampled at worker start is not a reliable switch
  for timing assertions; React Aria popovers add an English "Dismiss" string outside the catalogue.
- **Deviations:** several e2e specs (and some component tests) were written after the code, each
  recorded in its task's Execution Notes and checked for vacuity by the reviewer; agent sessions
  were interrupted by API limits four times and resumed without loss; the entry bundle grew to
  ≈ 618 kB (≈ 190 kB gzip), Markdown renderer lazy-loaded.
- **Environment:** external load 3–110; the user accepted reviews and submits under load with
  `test:timing` run only below load 12; task-019's evidence used self-started CPU burners
  (coverage green at load 31–63, e2e 60/60 at load 71–98).
- **Checks on `main` after the wave** (`d433812`): `test:coverage` **1640 passed, 1 skipped**,
  coverage 96.48 % statements / 90.37 % branches · `test:e2e` **60/60** · typecheck, lint (incl.
  catalogue check), format clean · `docs:api` OK · `check_tasks.py`, `check_releases.py` OK ·
  `test:timing` green at load ≈ 14–16 (REQ-PERF-03 20/20 ≤ 1.9 s, REQ-PERF-06 1080–1490 ms,
  TypeDoc 13.4 s, strict live refresh 4/4 from the mutation: S-27.2 995 ms, S-25.2 968 ms, S-26.1
  1379 ms, S-26.2 2297 ms); no e2e console left running.
- **Open points for later waves:** X-09.1 treatment of React Aria's "Dismiss" and the static
  `<title>` (021); REQ-PERF-04 bundle size (021); full commit hash only in a tooltip (v0.2);
  bug-004 to close; the task-017 closure rows' "within 5 s" superseded by W3-47 (notes kept
  historical); spec-002 §4 incremental parse still deferred (v0.2).
- **Hand-overs to Wave 4** (details in each task's Execution Notes): view recipe of task-013
  (`staticData.nav`, one line in `PROJECT_ROUTES`, query keys under `['p', pid]`,
  `useServerEvent`); reuse `projectHeaderQuery` (016), `elementsQuery`/`projectConfigQuery`;
  React Aria hrefs accept concrete paths (015 switcher); an unanswered request renders as
  `error.unreachable` (014); every new e2e spec declares `prebuild` and uses `expectFirstLoad`;
  Playwright test timeout 180 s.
- **Next:** Wave 4 — 015, 014, 016. Not started: the user asked to apply the WingFoil feedback
  mechanism (session "Meccanismo feedback wingfoil", changes M2) between waves first.

#### Session 3 addendum — between Wave 3 and Wave 4: WingFoil feedback loop (2026-10-09)

- **Request:** step M2 of the WingFoil feedback loop (WingFoil dl-163 applied strictly, approver ruling
  R9), relayed by the session "Meccanismo feedback wingfoil" and confirmed by the approver; applied
  between waves, one task per change.
- **Tasks** (`docs/04_memory/v0.1/`, `module: governance`, `ref: GOV`, tags `v0.1`, `governance`,
  `feedback-loop`; `check_tasks.py` accepts a governance task only as that pair with `**Backlog
  items:** GOV`, `1d55674`), each through dev-loop with an independent review and the approver's
  `approve`:
  - task-022 (S1): inbox versioned byte-identical in `docs/wingfoil-feedback/`, local `.notes/` copy
    removed — done `8c96fa2`.
  - task-023 (S4a + S4b): 19 notes F-001 … F-019 (R-01 … R-12 → F-001 … F-012, W-03/07/08/09/12/13 →
    F-013 … F-018, working-tree/HEAD row → F-019, ingestion row folded into F-003), README with ledger,
    `wingfoil-cli` 1.6 (rules 1–7 as WingFoil-Templates `53090c2`, own rules 8–9, *Note* column, new
    W-24, W-12 corrected), `test/wingfoil-feedback.test.ts`; live references updated (BOOTSTRAP §3,
    SARD `04` 0.7 and `05` 0.5, backlog regenerated) — merge `a7ccdc7`, done `1d9348d`.
- **Decisions of the user (48–59):** governance tasks in v0.1 with `module: governance` / `ref: GOV`
  (48); dev-loop per task (49); push before and after (50); ingestion row folded into F-003 (51);
  product brief and plans historical (52); test added (53); BOOTSTRAP §3 and SARD references updated
  (54, 55); F-019 first-line form (56); WingFoil elements only as sentences until the first sync
  (57); W-12 corrected (58); W-24 added (59).
- **Push:** `main` pushed for the first time (`851ef46..0349e08`), then `..8c96fa2` and
  `..1d9348d`; the remote now carries the whole history of Waves 1–3. Reported to the coordinating
  session with task ids and commits.
- **Open:** `Source key` waits for WingFoil's svc id (its task-269); rule 7's `wingfoil-sync`
  procedure is not defined yet (WingFoil v0.3 user-docs); no sync due before WingFoil's v0.3
  retrospective.
