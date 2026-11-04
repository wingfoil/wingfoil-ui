---
id: definition-of-done
name: definition-of-done
type: directive
kind: custom
title: "Definition of Done of WingFoil UI"
tags: [custom, scrum, testing, review]
---

# Directive — Definition of Done of WingFoil UI

**Version:** 1.3 · **Date:** 2026-11-04 (1.0: replaces `methodology/scrum`'s generic
`definition-of-done` with this repository's, at the packs' adoption —
governance-alignment-rel-v0.3-plan step 3; 1.1: the bugs' moves after GA3-11 R-3, the source of
`docs:api` — the adoption's review round 1, m2; 1.2: the gates of the former `dev-loop` procedure,
one section per `backlog-item` phase, its file removed — task-049; 1.3: review round 1 of task-049:
the `memory add --type tech-spec --title` form)

A Sprint Backlog item (a task, run through `backlog-item`: start · build · review · approve · done)
is done only when every rule below holds; until then it is not part of the Increment. The phases'
verbs move the task (`backlog-item`, `.wingfoil/memory.yaml`); this directive says how each phase is
done here. Inside `build` the work runs **design → red → green → refactor**; each phase is logged
in the task's Execution Notes (`### design (date)`, `### red / green / refactor`, `### review`).

## start (developer)

- `memory submit <task>` (`backlog → in-progress`). Each bug the task names in `bug:` moves `planned
  → in-progress` with `memory submit <bug>` when the task starts (GA3-11 R-3).
- A branch `task/<task-id>` from the phase branch the stage's plan names, in its own worktree
  `.worktrees/<task-id>` (dl-014 G1, G2) — parallel tasks never share a checkout.

## build › design

No code before this phase is closed; the developer works as architect here:

- **Read first** (dl-015, a hard gate): the task, the Execution Notes of every `depends_on` task,
  the specs, ADRs and decision-logs it cites, the UX reference and the prototype for a screen, the
  directives of the step (`workflow next` prints them).
- **Specs before code:** an `approved` tech-spec for every file format, schema, constant set and
  module API the task implements. A missing one is a safety net for what `release-planning` ›
  *identify-specs* missed: `memory add --type tech-spec --title "…"`, its draft, `memory submit`,
  and the approver's approve before red (a rejected spec is revised and verified again). An
  architectural decision found here goes through `adr-ingest`.
- **Classify each acceptance criterion** red-first (new behaviour) or characterization (the
  behaviour exists) in the Execution Notes, with the test plan (scenario → spec file).
- **Security probes** for a task that changes what the console runs on projects, or its git reads
  and writes: `GIT_TRACE` of every verb it runs, a snapshot of `.git` before and after, the
  children's environment (task-046) — on scratch repositories, before the code.
- **Strict identity:** a git-touching task also runs the strict-identity recipe of
  `test/README.md` *Fixtures* › *Git identity* (dl-011).
- **Size:** a task larger than about one active day is proposed for a split — options and one
  recommendation — and waits for the approver (RP3-20 G2); so does any gap or contradiction
  between the task and its specs.
- The design is committed (`docs(<task>): design`) before red.

## build › red

A failing test for each red-first criterion, committed before the code (`tests.exist`,
`tests.failing`). A characterization criterion needs no red — no fabricated failure, no dead code to
force one; a test written after the code shows its guard-removal failure, recorded in the notes.

## build › green

The minimum code that makes the tests pass (`tests.passing`).

## build › refactor

With the tests green, on the task's branch:

- `npm run typecheck`, `npm run lint` (`lint.clean`, dl-034: ESLint, `test/lint/lint-clean.test.ts`
  — the author clears it before a reviewer is engaged), `npm run format:check`;
- `npm run test:coverage`, statements at least 80 % (`tests.coverage`);
- `npm run docs:api` (`docs.api.public-complete`, `docs.api.build`, dl-013, dl-014 G5: TypeDoc with
  `notDocumented` and `treatWarningsAsErrors`, `typedoc.json`, `test/docs/api-docs.test.ts`);
- when the UI changes, `npm run test:e2e:chromium` and the task's own specs on the three engines;
  the launch and publish smokes when packaging, the launcher, the bin or the publish workflow
  change (`CLAUDE.md` *Checks before handing work back*).

Heavy gates (Playwright, `test:coverage`, the smokes, `test:timing`) run through the machine-free
slot, the load and the wait for the slot written in each log (dl-009 action 4).

## review (reviewer)

- The task's acceptance scenarios pass (`tests.bdd`): each scenario it closes maps to a spec file
  and a test (its e2e closure table), asserting what the user sees.
- An **independent reviewer**, not the author, reviews against this directive until PASS — an
  adversarial one, who runs the tools, for a security-relevant task. Findings are fixed test first.
- Then `memory submit <task>` (`in-progress → in-review`).

## approve (the approver)

The approver's `memory approve <task>` (`in-review → approved`). A reject (`memory reject`, back to
`in-progress`) returns to `build`: the rework starts with a failing test for the finding.

## done (developer)

- **Integrated:** merged into the phase branch with `git merge --no-ff` (dl-014 G3; the phase
  branch reaches `main` at the wave gate); then the worktree removed, then the branch (G2). The
  phase branch is merged into the task branch before `review`, so this merge is clean; if it still
  fails, `git merge --abort`, the conflict resolved on the task branch, the gates re-run and the
  reviewer re-checks, the approver told before the merge — the task stays `approved` (no verb takes
  it back).
- `memory submit <task>` (`approved → done`). The bugs it names move with it by their own verbs
  (`.wingfoil/memory.yaml`): `submit`, and the approver's `approve` along the bug's machine.
- **The wave gate**, on `main` after the wave's merge: `npm run test:e2e` (Chromium, Firefox,
  WebKit), `npm run test:smoke`, and `npm run test:timing` run alone through the machine-free slot
  whatever the diff since its last run (dl-009 action 6).

## Documented

The user-facing and agent-facing docs the task changes are updated in the same change (directive
`documentation`); its Execution Notes record the gates' results with their commands.
