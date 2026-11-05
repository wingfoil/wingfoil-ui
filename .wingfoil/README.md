# `.wingfoil/` — WingFoil configuration of WingFoil UI

**Version:** 0.11 · **Date:** 2026-11-05 (0.1: release v0.1, `user-docs` `align-agent-docs`; 0.2:
W-25, W-26 — dl-007; 0.3: `release-submit`, `release-publishing`, `retrospective` tailored — dl-008;
0.4: the packs `base@2.0.1`, `software@1.0.0`, `methodology/scrum@1.0.0` adopted —
governance-alignment-rel-v0.3-plan step 3; 0.5: the deviations from the packs — GA3-11; 0.6: their residuals, the accepted limits, `traceability-chain`, `release-conventions` on facilitator — the adoption's review round 1; 0.7: the deprecate rule for every role — round 2; 0.8: R-3 cites the `wingfoil-cli` deprecate rule
— review round 3 nit; 0.9: the accepted limits cite `wingfoil-cli` 1.15 (W-34, W-40) —
governance-alignment-rel-v0.3-plan step 4; 0.10: the five procedures folded into directives, the
directive `release-planning` — task-049; 0.11: a closed bug's `release` — task-051) ·
**Checked against:** `wingfoil@0.3.1` (the devDependency pin)

This folder makes the WingFoil UI repository a project **governed by WingFoil**: its DNA, its Memory
element types and their state machines, its workflows, and the directives bound to each role. It is
read and changed through the pinned CLI, `npm run -s wingfoil -- <command>` (directive
`wingfoil-cli`); hand edits only where that directive says so. The tables below are projections of
the YAML files named in each section — when they disagree, the YAML file is right and this README is
stale.

## Adopted packs

Composed by hand with the reference composer of `wingfoil/wingfoil-templates` (no WingFoil release
installs packs yet), with this repository's path and id values, so that no file moved; the
parameters, the file-by-file outcome and the old → new keys are in
`docs/wingfoil-adoption/rel-v0.3-packs-adoption-design.md`.

| Pack | Version | What it brings here |
|------|---------|---------------------|
| `base` | 2.0.1 | `decision-log`, `task`, `plan`; `decision-log-ingest`, `governance-evolution`, `retrospective`, `retrospective-periodic`; `claim-sources`, `doc-versioning`, `security-secrets`, `traceability` |
| `software` | 1.0.0 | `adr`, `tech-spec`, `bug`, `release`, `release-line`; `sw-life-cycle` and its slots `inception`, `specification`, `end-of-life`, `release` (`release-submit`, `release-publishing`); `adr-ingest`, `bug-ingest`; `determinism` |
| `methodology/scrum` | 1.0.0 | `sprint`, `sprint` on `task` and `release`; `delivery`, `sprint`, `backlog-item`; `scrum`, `definition-of-done` (overridden here) |

### Deviations from the packs

Decided by the approver on 2026-11-01 (GA3-11 of `governance-alignment-rel-v0.3-plan`), each in
`memory.yaml`, and proposed to WingFoil-Templates as feedback:

| # | Type | Pack's machine | Here | Why |
|---|------|----------------|------|-----|
| R-1 | `release` | no gate; `releasing → released` by `mark-released` (`element.set_state`) | gate `releasing` (reject → `in-development`): `released` only by the approver's `memory approve`, after the publication | without a gate any member, an agent acting as tech-lead included, can `memory submit` a release to `released`. **Residual:** the console and `workflow status` offer the gate's Approve as soon as the release is `releasing`; approved at `approve-release` it jumps to `released` and the publication steps vanish — so `approve-release` is `workflow finalize`, never `memory approve` (directive `release-conventions`) |
| R-2 | `release-line` | gate `planning` only; `active → done` by `submit` | also gate `active` (reject → `planning`): the approver closes the line | `submit` closed a line with no check on its releases. **Residual:** the line sits in the approver's queue for its whole life; it is approved only at its end, every release `released` (`release-conventions`) |
| R-3 | `bug` | gates `open`, `triaged`, `planned`, `in-review`, `resolved` | no gate on `planned`: `memory submit` moves it to `in-progress` | the start of a planned fix needs no approval, as the task's start; `triaged → planned` stays the approver's. **Trade-off:** any team identity can make the move (by rule the developer, when the fix starts), and `planned` loses its wontfix exit (reject → `closed`): a bug that will not be fixed is rejected to `closed` at `triaged`, before it is planned; once `planned`, only `memory deprecate` (with the approver's OK, directives `wingfoil-cli`, `cli-only-writes`) ends it without a fix |

**Accepted limits** (not deviations; the adoption design §11, the review round 1):

- `memory deprecate` needs no approval: any git identity, team member or not, deprecates any element
  in any state. Here it runs only in `end-of-life` › `deprecate` or with the approver's OK recorded
  in the active plan (directive `wingfoil-cli`, global, and `cli-only-writes`; `AGENTS.md`).
- WingFoil 0.3.1 accepts a hand-committed `status:` without the approver, and `memory history`
  reads such a commit's text as if a verb had made it: never set a state a verb owns by hand
  (directive `wingfoil-cli` W-34; W-04, the phase plan's close, is the one exception).
- The `base` pack's `security-secrets` forbids personal emails in files; `dna.yaml` holds the
  approver's email, which WingFoil matches to grant approval — the one exception.
- A release (or task) whose `sprint` names a Sprint that does not exist is accepted at `submit`:
  check the id against `docs/04_memory/sprints/` before submitting (directive `wingfoil-cli`
  W-40).
- The composer's region of `AGENTS.md` names four agent roles and the `bug` gates of the pack; its
  *This repository* section corrects both (the DNA's seven roles, R-3).

Also this repository's own, not a pack's change: its templates, the custom `definition-of-done`,
`release-conventions`, `release-planning` and `traceability-chain` directives (below).

## Files

| Path | Content |
|------|---------|
| `dna.yaml` | project identity, modules (`server/`, `web/`, `contracts/`), stack, methodologies, team (members, roles, agents), paths |
| `memory.yaml` | the Memory element types: path, id pattern, template, required fields, state machine |
| `memory/templates/` | this repository's templates (`adr`, `bug`, `decision-log`, `plan`, `release-line`, `release`, `service`, `task`, `tech-spec`); `built-in/` the packs' (only `sprint` is in use) |
| `workflows.yaml` | the main workflow configuration: the `include` list of the workflow files |
| `workflows/built-in/` | the 16 workflows of the packs, unchanged |
| `workflows/custom/` | this repository's one workflow, `service-ingest` |
| `roles.yaml` | role → directive bindings and the global directives |
| `directives/built-in/`, `directives/custom/` | the directive files (a custom directive with a built-in's id overrides it) |
| `README.md` | this file (a file the CLI does not own: ignored by its loaders, directive `wingfoil-cli` W-11) |

## Memory types (`memory.yaml`)

The Memory lives under `docs/04_memory/` (plans under `docs/05_plans/`). Each type has its own state
machine: `memory submit` moves an element one step along its `sequence` from a state that is neither
a gate nor waiting; `memory approve --reason` moves it from a **gate** state to the next state;
`memory reject --reason` moves it from a gate state to the gate's reject target; `memory park` takes
a started element back along its `returns` edge. A **waiting** state is left by a workflow, not by a
verb: `plan` `active → done` is `workflow end` for a run started by `workflow start`, and a
hand-written `wf(plan): finalize <id> [active → done]` commit for a phase plan (directive
`wingfoil-cli` W-04); `adr` and `tech-spec` leave theirs through a later element's `supersedes:`.

| Type | Path | `id_pattern` | States (`sequence`) | Gates (reject →) | Waiting | Returns |
|------|------|--------------|---------------------|------------------|---------|---------|
| `decision-log` | `docs/04_memory/design/dls/{id}.md` | `dl-{n}-{slug}` | draft → in-discussion → ready | `in-discussion` (→ `draft`) | — | — |
| `task` | `docs/04_memory/{release}/{id}.md` | `task-{n}-{slug}` | draft → pending → backlog → in-progress → in-review → approved → done | `pending` (→ `draft`); `in-review` (→ `in-progress`) | — | `in-progress` → `backlog` |
| `plan` | `docs/05_plans/{scope}/{id}.md` | `{workflow}-{phase}-plan` | draft → active → done | — | `active` | — |
| `adr` | `docs/04_memory/design/adrs/{id}.md` | `adr-{n}-{slug}` | draft → pending → accepted → superseded | `pending` (→ `draft`) | `accepted` | — |
| `tech-spec` | `docs/04_memory/design/specs/{id}.md` | `spec-{n}-{slug}` | draft → pending → approved → superseded | `pending` (→ `draft`) | `approved` | — |
| `bug` | `docs/04_memory/bugs/{id}.md` | `bug-{n}-{slug}` | draft → open → triaged → planned → in-progress → in-review → resolved → closed | `open`, `triaged` (→ `closed`); `in-review`, `resolved` (→ `in-progress`) | — | `in-progress` → `planned` |
| `release-line` | `docs/04_memory/planning/{id}.md` | `rl-{version}` | draft → planning → active → done | `planning` (→ `draft`); `active` (→ `planning`) | — | — |
| `release` | `docs/04_memory/planning/{release-line}/{id}.md` | `{kind}-{version}` | draft → planning → in-development → releasing → released | `releasing` (→ `in-development`) | — | — |
| `sprint` | `docs/04_memory/sprints/{id}.md` | `sprint-{n}` | draft → planned → active → done (one `active` at a time) | — | — | — |
| `service` | `docs/04_memory/services/{id}.md` | `svc-{n}-{slug}` | draft → pending → active | `pending` (→ `draft`) | — | — |

Required frontmatter fields (`template.frontmatter.required`):

| Type | Required fields |
|------|-----------------|
| `decision-log` | `title` |
| `task` | `title`, `sprint` (or `"n/a — <reason>"`), `release` |
| `plan` | `title`, `workflow`, `phase` |
| `adr` | `title`, `sard_ref` |
| `tech-spec` | `title`, `scope` |
| `bug` | `title`, `severity` |
| `release-line` | `title`, `version` |
| `release` | `title`, `version`, `release-line`, `sprint`, `kind`, `pillar`, `features` (a list), `requirements`; `sprint` exempt for `minor-v0.1`, `minor-v0.2` |
| `sprint` | `title`, `goal` |
| `service` | `title`, `provider`, `kind`, `owner_role`, `verify` |

A `closed` bug carries in `release` the release that fixed it (dl-009 action 7): set at triage for
a fix in a later release, stamped at the absorption into a task by a hand commit of that field
alone (`memory amend` refuses `release`, directive `wingfoil-cli` W-01); a bug closed by a reject
(a non-empty `rejection_reason`) is outside the rule. `test/governance/bug-releases.test.ts` checks
it; the plan-version and release-`sprint` checks are in directive `release-conventions` ›
*Governance checks*.

`defaults.states` (for a type without its own `states` block — every type above has one):
`draft → pending → approved`, gate `pending` (→ `draft`).

## Workflows (`workflows.yaml`)

`wingfoil@0.3.1` starts, follows and ends workflows (`workflow start`, `next`, `status`, `finalize`,
`adopt`, `end`); it executes no step. Seven workflows are startable (`kind: main`).

| Workflow | Source | Kind | Element | Phases |
|----------|--------|------|---------|--------|
| `decision-log-ingest` | base | main | — | capture · approve |
| `governance-evolution` | base | main | — | assess · propose · approve · apply |
| `retrospective` | base | sub | — | explore · additional-points · capture · approve |
| `retrospective-periodic` | base | main | — | retrospective |
| `sw-life-cycle` | software | main | — | inception · specification · delivery · end-of-life |
| `inception` | software (slot default) | sub | — | frame · approve |
| `specification` | software (slot default) | sub | — | specify · approve |
| `end-of-life` | software (slot default) | sub | — | announce · approve · deprecate · archive |
| `release` | software (slot default) | sub | release | submit · publishing |
| `release-submit` | software | sub | release | pre-release-checks · enter-releasing · approve-release |
| `release-publishing` | software | sub | release | release-commit · staging-rehearsal · tag · publish · mark-released |
| `adr-ingest` | software | main | — | capture · approve |
| `bug-ingest` | software | main | — | capture · triage |
| `delivery` | scrum | sub | — | plan-sprint · sprints |
| `sprint` | scrum | sub | sprint | sprint-planning · development · plan-release · release · sprint-review · retrospective · close |
| `backlog-item` | scrum | sub | task | start · build · review · approve · done |
| `service-ingest` | this repository | main | — | capture · approve |

This repository's former procedures (`initial-design`, `release-planning`, `dev-loop`, `user-docs`,
`e2e-smoke`, run by hand inside the packs' phases) were folded into directives and their files
removed (task-049, the adoption design §9 decision 2): how a release is planned inside `sprint` ›
`sprint-planning` and `plan-release` is directive `release-planning`; how a task is built inside
`backlog-item` (design → red → green → refactor, review, done) is the custom `definition-of-done`;
the release checks of `release-submit` › `pre-release-checks` (user docs, agent docs, the e2e smoke,
`test:timing`) and the seeding of a release line are `release-conventions`. `workflow next` prints
the directives of each step's role, so the packs' workflows and these directives are the whole way
of working.

## Roles and directives (`roles.yaml`)

Roles are declared in `dna.yaml` (`team.roles`): approver, facilitator, product-owner, architect,
developer, reviewer, qa, tech-lead. The DNA's agent executes as facilitator, product-owner,
developer, reviewer, qa, architect and tech-lead and has no approval authority; the member holds
every role, `approver` included.

**Global directives** (every role): `doc-versioning`, `security-secrets`, `claim-sources`,
`documentation`, `claim-evidence`, `wingfoil-cli`.

| Role | Directives bound in `roles.yaml` (besides the global ones) |
|------|-------------------------------------------------------------|
| facilitator | `traceability`, `traceability-chain`, `scrum`, `release-conventions` |
| developer | `code-quality`, `testing`, `determinism`, `cli-only-writes`, `accessibility`, `scrum`, `definition-of-done` |
| reviewer | `code-review`, `traceability`, `traceability-chain`, `determinism`, `cli-only-writes`, `accessibility`, `ux-consistency`, `definition-of-done` |
| qa | `testing`, `accessibility`, `definition-of-done`, `release-conventions` |
| architect | `architecture`, `determinism`, `traceability`, `traceability-chain`, `cli-only-writes`, `release-planning` |
| product-owner | `traceability`, `traceability-chain`, `ux-consistency`, `scrum`, `release-planning` |
| tech-lead | `architecture`, `code-review`, `release-conventions`, `release-planning` |
| approver | — (global ones only) |

## Directives

| Id | Folder | Source | Title | Bound to |
|----|--------|--------|-------|----------|
| `architecture` | built-in | WingFoil `init` | Architecture | architect, tech-lead |
| `code-quality` | built-in | WingFoil `init` | Code Quality | developer |
| `code-review` | built-in | WingFoil `init` | Code Review | reviewer, tech-lead |
| `documentation` | built-in | WingFoil `init` | Documentation | global |
| `security` | built-in | WingFoil `init` | Security | — (not bound) |
| `testing` | built-in | WingFoil `init` | Testing | developer, qa |
| `claim-sources` | built-in | base | Sources of claims | global |
| `doc-versioning` | built-in | base | Documentation versioning | global |
| `security-secrets` | built-in | base | Secrets | global |
| `traceability` | built-in | base | Traceability | facilitator, reviewer, architect, product-owner |
| `determinism` | built-in | software | Determinism | developer, reviewer, architect |
| `scrum` | built-in | scrum | Scrum | facilitator, developer, product-owner |
| `definition-of-done` | built-in | scrum | Definition of Done (overridden by the custom one) | — |
| `accessibility` | custom | this repository | Accessibility of the web UI | developer, reviewer, qa |
| `claim-evidence` | custom | this repository | A claim names the command that establishes it | global |
| `cli-only-writes` | custom | this repository | Every governed change goes through the WingFoil CLI | developer, reviewer, architect |
| `definition-of-done` | custom | this repository | Definition of Done of WingFoil UI | developer, reviewer, qa |
| `release-conventions` | custom | this repository | Release conventions of WingFoil UI (dl-008) | facilitator, qa, tech-lead |
| `release-planning` | custom | this repository | Release planning of WingFoil UI | architect, product-owner, tech-lead |
| `traceability-chain` | custom | this repository | The traceability chain of WingFoil UI (the chain the pack's `traceability` asks the project to name) | facilitator, reviewer, architect, product-owner |
| `ux-consistency` | custom | this repository | UX consistency with the reference and the prototype | reviewer, product-owner |
| `wingfoil-cli` | custom | this repository | Using the pinned WingFoil CLI | global |

`directives list` warns that `definition-of-done` has two files and uses the custom one (W-23): the
override is intended (`methodology/scrum` README). `wingfoil-cli` lists every known behaviour of the
pinned CLI (W-xx entries) and the way to work with it; read it before running any verb. WingFoil
defects and gaps found here are filed as notes in `docs/wingfoil-feedback/`.

## Keeping this file aligned

Re-check the tables when `memory.yaml`, `workflows.yaml`, a workflow file, `roles.yaml` or a
directive changes — at least at every `release-conventions` › `pre-release-checks` (the agent docs)
and at release-line close (dl-025 checks), and at every pack update (recompose, then compare).
