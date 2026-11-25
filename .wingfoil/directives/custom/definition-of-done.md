---
id: definition-of-done
name: definition-of-done
type: directive
kind: custom
title: "Definition of Done of WingFoil UI"
tags: [custom, scrum, testing, review]
---

# Directive — Definition of Done of WingFoil UI

**Version:** 1.10 · **Date:** 2026-11-25 (1.0: replaces `methodology/scrum`'s generic
`definition-of-done` with this repository's, at the packs' adoption —
governance-alignment-rel-v0.3-plan step 3; 1.1: the bugs' moves after GA3-11 R-3, the source of
`docs:api` — the adoption's review round 1, m2; 1.2: the gates of the former `dev-loop` procedure,
one section per `backlog-item` phase, its file removed — task-049; 1.3: review round 1 of task-049:
the `memory add --type tech-spec --title` form; 1.4: the heavy gates on `.github/workflows/gates.yml`
where it exists on the branch, the local checks, a run as a gate's evidence, the wave gate on the
phase branch's tip — `governance-evolution-3-plan`, dl-016; 1.5: the wave scope's engine × shard
jobs — `governance-evolution-5-plan`, dl-018; 1.6: the parser cost probe, deferrals, the audit and the wave record at the wave gate, the UX reference alone — dl-022, dl-020 actions 1 … 5; 1.7: a task's bugs moved by `bug.sync_state` at start and review, the approver's moves of the bugs, the wave gate and the phase branch as tasks under the script runner — `governance-evolution-10-plan`, dl-025; 1.8: targeted runs through `npm test -- <files>`, a finding in the task's own change recorded in the park's reason — `governance-evolution-11-plan`, dl-026; 1.9: the Execution Notes committed in the step that writes them — `governance-evolution-12-plan`, dl-027; 1.10: design, red, green and refactor as steps of `backlog-item` version 2, the `direct` path, the runner's submit after the review — `governance-evolution-13-plan`, dl-028)

A Sprint Backlog item (a task, run through `backlog-item` version 2: start · design · red · green ·
refactor · review · approve · done, deviation R-11) is done only when every rule below holds; until
then it is not part of the Increment. The phases' verbs move the task (`backlog-item`,
`.wingfoil/memory.yaml`); this directive says how each phase is done here. **Design, red, green and
refactor are steps of their own** (dl-028): the same agent, in distinct fresh sessions — red's
session never writes the code, green's never wrote red's tests (`distinct_from`, enforced by the
script runner). Each step is logged in the task's Execution Notes (`### design (date)`, `### red`,
`### green`, `### refactor`, `### review`), committed in the step that writes them — by the verb that
moves the task, otherwise in a `docs(<task>): …` commit of its own (a body commit is not a hand
transition, `wingfoil-cli` rule 11). Each step's bound checks (`.wingfoil/workflows/bindings.yaml`)
run after it: `commit-trailers` everywhere; `tests-red` after red; `tests-green` and
`red-tests-untouched` after green and refactor.

**The `direct` path.** A task with no red-first criterion — a gate task, a characterization-only
task — carries `flow: "direct — <reason>"`, set at `release-planning` › *build-backlog* and approved
with the task (or later by the approver's `memory amend`), never by the agent that would benefit
from it. Its pre check `flow-tdd` fails, so the runner (1.2.6) skips the optional red for it, signs a
`skip` entry and shows it in the gate packet; the task goes from design to green, where its work
runs, and `red-tests-untouched` passes with "red skipped". Every other task runs red: a task with no
`flow` reads as test-first.

## start (developer)

- `memory submit <task>` (`backlog → in-progress`). Then the step's `bug.sync_state(for_each:
  task.bug)` (deviation R-10): `memory submit <bug>` (`planned → in-progress`, GA3-11 R-3) for each
  bug `workflow next` names under that action — the bugs the task lists in `bug:`. WingFoil has no
  `sync` verb: the commit reads `submit` (`wingfoil-cli` W-55).
- A branch `task/<task-id>` from the phase branch the stage's plan names, in its own worktree
  `.worktrees/<task-id>` (dl-014 G1, G2) — parallel tasks never share a checkout.

## design (developer, as architect)

No code before this phase is closed; the developer works as architect here:

- **Read first** (dl-015, a hard gate): the task, the Execution Notes of every `depends_on` task,
  the specs, ADRs and decision-logs it cites, the UX reference for a screen, the
  directives of the step (`workflow next` prints them).
- **Specs before code:** an `approved` tech-spec for every file format, schema, constant set and
  module API the task implements. A missing one is a safety net for what `release-planning` ›
  *identify-specs* missed: `memory add --type tech-spec --title "…"`, its draft, `memory submit`,
  and the approver's approve before red (a rejected spec is revised and verified again): the step
  ends with `RESULT: blocked decision`. An
  architectural decision found here goes through `adr-ingest`.
- **Classify each acceptance criterion** red-first (new behaviour) or characterization (the
  behaviour exists) in the Execution Notes, with the test plan (scenario → spec file) that red's
  session follows. A task with `flow: direct` that turns out to have a red-first criterion, or a
  task with none and no `flow`, ends the step with `RESULT: blocked decision`: the approver amends
  the task's `flow`; the design never decides it.
- **Security probes** for a task that changes what the console runs on projects, or its git reads
  and writes: `GIT_TRACE` of every verb it runs, a snapshot of `.git` before and after, the
  children's environment (task-046) — on scratch repositories, before the code.
- **Parsers of repository text** (dl-020 action 2): the design of a task that parses or renders
  repository text includes a hostile-input cost probe over every path of the parser, and its tests
  assert the growth between an input of size N and one of size 2N.
- **Strict identity:** a git-touching task also runs the strict-identity recipe of
  `test/README.md` *Fixtures* › *Git identity* (dl-011).
- **Size:** a task larger than about one active day is proposed for a split — options and one
  recommendation — and waits for the approver (RP3-20 G2); so does any gap or contradiction
  between the task and its specs.
- The design is committed (`docs(<task>): design`) before red.

## red (qa, a fresh session)

A failing test for each red-first criterion of the design's plan, and nothing else, committed before
the code (`tests.exist`, `tests.failing`); no product code (the runner's `sources_read_only` denies
`server/`, `web/`, `contracts/` to `qa`). `tests-red` runs red's own files — vitest files through
`npm test -- <files>`, specs through `npm run -s test:e2e:chromium -- <files>` — and passes when each
tool's run fails. A characterization criterion needs no red — no fabricated failure, no dead code to
force one; a test written after the code shows its guard-removal failure, recorded in the notes. A
red test that contradicts an accepted decision is changed only by a red amendment the approver
orders (`run.mjs --red-amend`), never by green or refactor.

## green (developer, a fresh session)

The minimum code that makes red's tests pass (`tests.passing`), red's test files untouched
(`red-tests-untouched`). `tests-green` runs `npm test` and red's specs on Chromium. For a `direct`
task this is the step that does its work.

## refactor (developer)

With the tests green, on the task's branch, the characterization tests of the design's plan, and:

- `npm run typecheck`, `npm run lint` (`lint.clean`, dl-034: ESLint, `test/lint/lint-clean.test.ts`
  — the author clears it before a reviewer is engaged), `npm run format:check`;
- `npm run test:coverage`, statements at least 80 % (`tests.coverage`);
- `npm run docs:api` (`docs.api.public-complete`, `docs.api.build`, dl-013, dl-014 G5: TypeDoc with
  `notDocumented` and `treatWarningsAsErrors`, `typedoc.json`, `test/docs/api-docs.test.ts`);
- when the UI changes, `npm run test:e2e:chromium` and the task's own specs on the three engines;
  the launch and publish smokes when packaging, the launcher, the bin or the publish workflow
  change (`CLAUDE.md` *Checks before handing work back*).

**Where the gates run** (dl-016). Where `.github/workflows/gates.yml` exists on the branch, the
heavy gates — `test:coverage`, `test:contract`, `test:e2e:chromium`, the task's own specs on Firefox
and WebKit, `test:smoke`, `test:publish-smoke` — run there, on the run a push of the branch starts
(or a `workflow_dispatch` on a `task/*` or `design/*` ref); followed with `gh run watch <id>` and
`gh run view <id> --log-failed`, its artifacts read with `gh run download <id>`; a gate's evidence
is the run id, its commit and its result. Before the push: the suites that touch git green under
the strict-identity recipe of `test/README.md` (dl-011), and the public-text check (`npm test --
test/docs/public-text.test.ts`). Local, always: `typecheck`, `lint`, `format:check`, `docs:api`,
targeted `npm test -- <files>` (the same `vitest run <files>`; under the script runner `npx`
and the tools called directly are refused, dl-026). Where the workflow does not exist on the branch, the heavy gates
(Playwright, `test:coverage`, the smokes) run through the machine-free slot, one at a time; there,
and for `test:timing` everywhere, the load and the wait for the slot are written in each log
(dl-009 action 4).

## review (reviewer)

- The task's acceptance scenarios pass (`tests.bdd`): each scenario it closes maps to a spec file
  and a test (its e2e closure table), asserting what the user sees.
- An **independent reviewer**, not the author, reviews against this directive until PASS — an
  adversarial one, who runs the tools, for a security-relevant task. Findings are fixed test first.
  A finding inside the task's own change is recorded in the `memory park --reason`, whose commit is
  its record, and needs no bug; a bug is raised only for a defect outside the change (dl-026).
  A finding deferred follows `release-planning` › *Deferrals* (dl-020 action 5).
- The reviewer is a fresh session distinct from red's, green's and refactor's (`distinct_from`). It
  accepts by answering `completed`: the script runner (1.2.4) then runs `memory submit <task>`
  (`in-progress → in-review`) itself; the reviewer runs no `memory submit` of the task. Then the
  step's `bug.sync_state` (R-10): `memory submit <bug>` (`in-progress → in-review`) for each bug
  `workflow next` names. A review that rejects (`memory park`) moves no bug, and the task goes back
  to green.

## approve (the approver)

The approver's `memory approve <task>` (`in-review → approved`), and of each of its bugs
(`in-review → resolved`; under the script runner `gate.mjs --element`, `wingfoil-cli` rule 14). A
reject (`memory reject`, back to `in-progress`) returns to `green`: the rework starts with a failing
test for the finding (a red amendment when it changes red's tests); its bugs are rejected with it
(`in-review → in-progress`).

## done (developer)

- **Integrated:** merged into the phase branch with `git merge --no-ff` (dl-014 G3; the phase
  branch reaches `main` at the wave gate); then the worktree removed, then the branch (G2). The
  phase branch is merged into the task branch before `review`, so this merge is clean; if it still
  fails, `git merge --abort`, the conflict resolved on the task branch, the gates re-run and the
  reviewer re-checks, the approver told before the merge — the task stays `approved` (no verb takes
  it back).
- `memory submit <task>` (`approved → done`). Its bugs are `resolved` by now (*approve*); each gets
  its close note, then the approver's `resolved → closed`.
- **The wave gate.** Under the script runner it is the wave's gate task (`release-planning` ›
  *build-backlog*, dl-025): its Acceptance Criteria are the checks below and its green runs them;
  what its agent may not do — a push, `gh`, the machine-free slot — it asks for with `RESULT: blocked
  decision`, and the approver, or a session outside the runner, does it and names the results in
  the ruling. A gate task (the wave's, or the phase branch's) carries `flow: direct`: no red, its
  checks run in green, and its Execution Notes record each check with its evidence. Where `gates.yml` exists: its `wave` scope (the three-engine `test:e2e`, engine
  × shard jobs (dl-016), with the task scope's gates) by `workflow_dispatch` on the phase branch's tip,
  before the merge into `main`; the merge then checked to change no file against that tip (`git
  diff <tip> <merge>` empty). Otherwise, on `main` after the wave's merge: `npm run test:e2e`
  (Chromium, Firefox, WebKit) and `npm run test:smoke` through the machine-free slot. In both cases
  `npm run test:timing` runs alone, locally, through the slot, whatever the diff since its last run
  (dl-009 action 6); then the push of `main` with the approver's OK and dl-011's
  `workflow_dispatch` of `publish.yml` on `main`.
- **At every wave gate:** `npm audit --omit=dev` runs and the phase plan records its result (dl-020
  action 3), so a task can still absorb a finding: the audit must report 0 at release validation
  (`release-conventions`). A finding of the development dependencies outside the accepted list of
  `docs/publishing.md` is the approver's decision at release validation, as that document says. The
  phase plan also records the active days the wave used, its start and end dates, the tasks closed
  and the review rounds (dl-020 action 4).

## Documented

The user-facing and agent-facing docs the task changes are updated in the same change (directive
`documentation`); its Execution Notes record the gates' results with their commands.
