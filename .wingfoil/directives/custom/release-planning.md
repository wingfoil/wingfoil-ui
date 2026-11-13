---
id: release-planning
name: release-planning
type: directive
kind: custom
title: "Release planning of WingFoil UI"
tags: [custom, release, planning, scrum]
---

# Directive — Release planning of WingFoil UI

**Version:** 1.2 · **Date:** 2026-11-13 (1.0: this repository's `release-planning` procedure folded
into a directive, its file removed — task-049, adoption decision 2, RP3-13; 1.1: review round 1 of
task-049: the release's submits are `plan-release`'s (product-owner), `plan-sprint` adds only the
first Sprint, the stage plan names a sub workflow, the `memory add --type … --title` forms; 1.2:
*Review*: the phase branch and `PHASE_BRANCH` — `governance-evolution-5-plan`, dl-018)

Applies to the product-owner, the tech-lead and the architect when a release is planned. It says
how each step is done in this repository; the packs' phases and the verbs own every transition
(`.wingfoil/memory.yaml`), and this directive never moves a state another way. Planning confirms
the pillar and the scope, triages the bugs, reconciles the accumulated governance, specifies the
shared artefacts up front, builds the release's tasks and stamps `release` on every element it
includes.

## Where it runs

- **The Sprint** the release belongs to: the first Sprint of the delivery is `delivery` ›
  `plan-sprint` (product-owner); every later one is added outside a step, the same way, and joins
  the iteration (`delivery.yaml`; `memory.yaml` `sprint`) — `memory add --type sprint --title "…"`,
  its `goal` written by editing the draft, `memory submit` (`draft → planned`), when no Sprint is
  `planned`.
- **`sprint` › `sprint-planning`** (product-owner): the steps below, from *advance-pinned-build* to
  *commit-backlog*; the tasks get the Sprint's id in `sprint`. It closes with `memory submit
  <sprint>` (`planned → active`), after the *Review*.
- **`sprint` › `plan-release`** (product-owner): the release's two `memory submit` (`draft →
  planning → in-development`, run at *commit-backlog*), recorded by a `workflow adopt` of the
  release at the end of `development` (RP3-4).
- **The plan of the stage** is a phase plan whose `workflow:` names a loaded **sub** workflow,
  e.g. `sprint-planning-rel-v0.4-plan` (`workflow: sprint`, `phase: planning-rel-v0.4`): a plan
  naming a workflow that is not loaded is an open instance and adds `W_INSTANCE_WORKFLOW_UNKNOWN`
  (directive `wingfoil-cli` W-38), and one naming the main `sw-life-cycle` — even in `draft` —
  opens a second run that `workflow next` answers first (probe of task-049, W0-6). The release's
  later stages use `release-submit-…` and `release-publishing-…` plans. One commit per step, after
  the approver's OK on its draft.

## Selection filter

Every step that considers accumulated elements picks those whose `release` is **empty or equal to
the release in planning** (dl-016 §1): approved but unassigned elements are offered again, elements
assigned to another release are never pulled. Elements not selected are left untouched. `release` is
assigned only in *build-backlog*.

## The verbs

| Step | Move | Verb | Who |
|------|------|------|-----|
| `plan-sprint` (the first Sprint; a later one outside a step) | sprint `draft → planned` | `memory submit` | product-owner |
| triage-bugs | bug `open → triaged` / `→ closed` | `memory approve` / `memory reject` | the approver |
| reconcile-governance | decision-log `in-discussion → ready`, ADR `pending → accepted` / `→ draft` | `memory approve` / `memory reject` | the approver |
| record-adrs, identify-specs | ADR, tech-spec `draft → pending` | `memory submit` | architect |
| record-adrs, identify-specs | `pending → accepted` / `approved` / `→ draft` | `memory approve` / `memory reject` | the approver |
| build-backlog | task `draft → pending` | `memory submit` | product-owner |
| build-backlog | bug `triaged → planned` | `memory approve` | the approver (W-26) |
| commit-backlog | task `pending → backlog` | `memory approve` | the approver |
| commit-backlog (`plan-release`'s moves) | release `draft → planning → in-development` | `memory submit` ×2 | product-owner |
| `sprint-planning` | sprint `planned → active` | `memory submit` | product-owner |

An agent never approves or rejects: it hands the approver the exact command (`AGENTS.md`).

## Spec review

Before an ADR or a tech-spec draft is submitted (here, and when a line is seeded:
`release-conventions` › *The release line*), an **independent, read-only review** of the drafts
(dl-022): internal consistency, consistency across the specs, no contradiction with the BDD
scenarios, the Vision Package or the write classes, traceability to the REQ-* it serves. Its
findings are fixed and re-verified by the same reviewer; the result is logged in the stage's plan.

## advance-pinned-build (tech-lead)

The WingFoil build that governs this repository is the `wingfoil` devDependency, pinned exactly in
`package.json`. Before the release is planned:

- **Pre-check:** `npm run -s wingfoil -- --version` prints the version `package.json` pins.
- **Rule** (dl-095 Q3): the pin moves **forward only**, only to a **published** build (`npm view
  wingfoil versions` lists it) and only to one the packs' catalog declares
  (`release-planning-rel-v0.3-plan` step 1); no move when the pin already is that build.
- **The switch** is its own commit changing only `package.json` and `package-lock.json` (`npm
  install --save-dev --save-exact wingfoil@X.Y.Z`), noted in the stage's plan. Then: the CLI
  contract tests (`npm run test:contract`), the samples and the matrix as task-046 did, and the
  re-check of every `wingfoil-cli` entry (its rules 5 and 9); `npm run -s wingfoil -- directives
  list` reports only the intended `definition-of-done` override warning (W-23).
- **The feedback sync** of `wingfoil-cli` rule 7 runs at this step, pin moved or not (RP3-6).
- **A defect that blocks a step:** move to a published fix; if none exists, work by hand and record
  it in the plan and in `wingfoil-cli` (its rules 3, 4).
- The pin is the governance CLI only: the WingFoil versions the UI supports for the projects it
  observes are the contract matrix (`contracts/matrix.json`, adr-001 D3/D4), advanced separately.

## define-scope (product-owner)

The pillar and the features of the release, from its element (`docs/04_memory/planning/{line}/`),
confirmed with the approver (the approver's OK on the scope, in the plan); the budget in active
days, release validation included (2–3 active days, dl-009 action 9). The release's required fields
are `memory.yaml`'s (`sprint` among them); its `submit` waits for *commit-backlog*.

## triage-bugs (tech-lead)

The `open` bugs of the selection filter: for each, a proposal — triage (`open → triaged`) or reject
(`→ closed`: incomplete, wontfix, duplicate) — handed to the approver. A bug whose fix lands in a
later release gets that `release` at the triage (dl-009 action 7).

## reconcile-governance (product-owner)

The decision-logs `in-discussion` and the ADRs `pending` of the selection filter are brought to
their gate, so that *build-backlog* and *identify-specs* never skip them silently; idempotent, it
acts only on elements before their gate. Each action of a `ready` decision-log is mapped, in the
plan, to a task or a rule.

## record-adrs / identify-specs (architect)

- **record-adrs** (optional): `memory add --type adr --title "…"`, the draft filled, the
  *Spec review*, `memory submit`, the approver's approve. A task never cites an ADR that is not
  `accepted` (dl-016).
- **identify-specs:** survey the release's scope for the file formats, schemas, constant sets and
  module APIs its tasks will implement; for each one not yet covered by an approved spec, `memory
  add --type tech-spec --title "…"`, the draft filled, the *Spec review*, `memory submit`. The
  approver approves a spec before a task citing it reaches `backlog`; a rejected spec is reworked
  and reviewed again.
- An erratum of an approved spec is a dated *Process Note* in the spec (approved specs carry no
  Version line).

## build-backlog (product-owner)

- **Tasks:** `memory add --type task --title "…" --set release=vX.Y` for each deliverable; the other
  fields by editing the draft (`wingfoil-cli` W-01): `tags: ["vX.Y", …]`, `sprint` (the Sprint's id,
  or `"n/a — <reason>"`), `module`, `priority`, `ref`, the `**Backlog items:**` line, the Acceptance
  Criteria citing the scenarios; ids continue the numbering of the type. Then `memory submit`
  (`draft → pending`). Stop-check: `python3 docs/03_backlog/X_tools/check_tasks.py vX.Y`.
- **From decision-logs:** the task(s) each in-scope `ready` decision-log implies; the decision-log
  stays `ready` (dl-017).
- **From bugs:** one or more fix tasks for each selected `triaged` bug (`bug:` is a list, dl-045),
  or the bug absorbed into an existing task's Acceptance Criteria; then the approver's `triaged →
  planned`.
- **Security probes:** a task that changes what the console runs on projects, or its git reads and
  writes, says so in its Implementation Notes: its design runs the probes of
  `definition-of-done` › *design*.
- **`release` stamped** on every included decision-log, bug, tech-spec, ADR and task (dl-016 §4):
  a task at `add`; any other committed element by a hand commit of that field alone, `docs(memory):
  <id> release <version> (…)` — the `wingfoil-cli` W-01 workaround, never a `status:` (W-34).

## commit-backlog (tech-lead)

In this order (RP3-4): the approver approves the tasks to `backlog`; the release gets its `sprint`
and two `memory submit` (`draft → planning → in-development`), run by the product-owner as `sprint`
› `plan-release`'s moves; the waves and the order of the tasks are written in the plan (RP3-19); the
Sprint's `planned → active` comes last, after the *Review*.

## Review

An independent, fresh-context review of the whole planning (scope, bugs, specs, backlog,
`check_tasks.py`) until PASS; then the approver's OK, `memory submit <sprint>`, the plan closed by
hand (`wingfoil-cli` W-04), the merge into `main` with `--no-ff`. Then the tech-lead creates the
release's phase branch `design/dev-loop_vX.Y` from `main`; its first commit sets `PHASE_BRANCH` in
`.github/workflows/gates.yml` to that branch, which the own-specs job diffs against (dl-018).

## A new release line

Seeding a line (its roadmap, ADRs, decision-logs and specs) is `release-conventions` › *The
release line* › *Seeding a line*.
