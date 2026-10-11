# `.wingfoil/` — WingFoil configuration of WingFoil UI

**Version:** 0.1 · **Date:** 2026-10-11 (0.1: release v0.1, `user-docs` `align-agent-docs`) ·
**Checked against:** `wingfoil@0.2.2` (the devDependency pin)

This folder makes the WingFoil UI repository a project **governed by WingFoil**: its DNA, its Memory
element types and their state machines, its workflows, and the directives bound to each role. It is
read and changed through the pinned CLI, `npm run -s wingfoil -- <command>` (directive
`wingfoil-cli`); hand edits only where that directive says so. The tables below are projections of
the YAML files named in each section — when they disagree, the YAML file is right and this README is
stale.

## Files

| Path | Content |
|------|---------|
| `dna.yaml` | project identity, modules (`server/`, `web/`, `contracts/`), stack, methodologies, team (members, roles, agents), paths |
| `memory.yaml` | the Memory element types: path, id pattern, template, required fields, state machine |
| `memory/templates/` | one Markdown template per type (`adr`, `bug`, `decision-log`, `plan`, `release-line`, `release`, `service`, `task`, `tech-spec`) |
| `workflows.yaml` | the main workflow configuration: the `include` list of the workflow files |
| `workflows/custom/` | the 23 workflow files (`workflows/built-in/` is empty) |
| `roles.yaml` | role → directive bindings and the global directives |
| `directives/built-in/`, `directives/custom/` | the directive files (a custom directive with a built-in's id overrides it) |
| `README.md` | this file (a file the CLI does not own: ignored by its loaders, directive `wingfoil-cli` W-11) |

## Memory types (`memory.yaml`)

The Memory lives under `docs/04_memory/` (plans under `docs/05_plans/`). Each type has its own state
machine: `memory submit` moves an element out of `draft` to the next state of its `sequence`
(and a task `in-progress → in-review`); `memory approve --reason` moves it from a **gate** state to
the next state of the sequence;
`memory reject --reason` moves it from a gate state to the gate's reject target. A **waiting**
state is left by a workflow phase, not by a verb: with `wingfoil@0.2.2` those transitions are hand
edits committed as `wf(<type>): <id> [<from> → <to>]` (directive `wingfoil-cli`, W-04, W-20).

| Type | Path | `id_pattern` | States (`sequence`) | Gates (reject →) | Waiting |
|------|------|--------------|---------------------|------------------|---------|
| `release-line` | `docs/04_memory/planning/{id}.md` | `rl-{version}` | draft → planning → active → done | `planning` (→ `draft`) | `active` |
| `release` | `docs/04_memory/planning/{release-line}/{id}.md` | `{kind}-{version}` | draft → planning → in-development → releasing → released | — | `planning`, `in-development`, `releasing` |
| `task` | `docs/04_memory/{release}/{id}.md` | `task-{n}-{slug}` | draft → pending → backlog → in-progress → in-review → approved → done | `pending` (→ `draft`); `in-review` (→ `in-progress`) | `backlog`, `approved` |
| `adr` | `docs/04_memory/design/adrs/{id}.md` | `adr-{n}-{slug}` | draft → pending → accepted → superseded | `pending` (→ `draft`) | `accepted` |
| `decision-log` | `docs/04_memory/design/dls/{id}.md` | `dl-{n}-{slug}` | draft → in-discussion → ready | `in-discussion` (→ `draft`) | — |
| `tech-spec` | `docs/04_memory/design/specs/{id}.md` | `spec-{n}-{slug}` | draft → pending → approved → superseded | `pending` (→ `draft`) | `approved` |
| `bug` | `docs/04_memory/bugs/{id}.md` | `bug-{n}-{slug}` | draft → open → triaged → planned → in-progress → in-review → resolved → closed | `open` (→ `closed`); `triaged` (→ `closed`); `planned` (→ `closed`); `in-review` (→ `in-progress`); `resolved` (→ `in-progress`) | `triaged`, `planned` |
| `plan` | `docs/05_plans/{scope}/{id}.md` | `{workflow}-{phase}-plan` | draft → active → done | — | `active` |
| `service` | `docs/04_memory/services/{id}.md` | `svc-{n}-{slug}` | draft → pending → active | `pending` (→ `draft`) | — |

Required frontmatter fields (`template.frontmatter.required`):

| Type | Required fields |
|------|-----------------|
| `release-line` | `title`, `version` |
| `release` | `title`, `kind`, `version`, `pillar`, `features`, `requirements`, `release-line` |
| `task` | `title`, `release` |
| `adr` | `title`, `sard_ref` |
| `decision-log` | `title` |
| `tech-spec` | `title`, `scope` |
| `bug` | `title`, `severity` |
| `plan` | `title`, `workflow`, `phase` |
| `service` | `title`, `provider`, `kind`, `owner_role`, `verify` |

`defaults.states` (for a type without its own `states` block — every type above has one):
`draft → pending → approved`, gate `pending` (→ `draft`).

## Workflows (`workflows.yaml`)

`wingfoil@0.2.2` has no workflow engine: each phase is run by hand against its `plan` element
(`docs/05_plans/`). Five workflows are startable (`kind: main`); the others are sub-workflows
composed by `sw-life-cycle` (`kind: sub`, include-only). Listed in the `include` order of
`workflows.yaml`; every file is in `workflows/custom/`.

| Workflow | Kind | Version | Element | Phases |
|----------|------|---------|---------|--------|
| `sw-life-cycle` | main | 1.0 | — | init · inception · specification · seed-first-release-line · release-line-cycle · sunset |
| `bug-ingest` | main | 1.0 | — | capture · triage |
| `decision-log-ingest` | main | 1.0 | — | capture · approve |
| `adr-ingest` | main | 1.0 | — | capture · approve |
| `service-ingest` | main | 1.0 | — | capture · approve |
| `wingfoil-init` | sub | 1.0 | — | init-config |
| `lean-inception` | sub | 1.0 | — | vision · personas · journeys · features · sequencer |
| `specification-downcast` | sub | 1.0 | — | user-story-mapping · specification-by-examples · volere-requirements · backlog-export |
| `user-story-mapping` | sub | 1.0 | — | backbone · vertical-explosion · mvp-cut |
| `specification-by-examples` | sub | 1.0 | — | isolate-mvp · write-scenarios |
| `volere-requirements` | sub | 1.0 | — | extract-requirements · apply-volere-shell · group-by-macro-area |
| `backlog-export` | sub | 1.0 | — | generate-records · map-dependencies · validate |
| `initial-design` | sub | 1.0 | release-line | seed-releases · seed-adrs · seed-dls · seed-specs |
| `release-line-cycle` | sub | 1.0 | release-line | approve · initial-design · delivery · plan-next-release-line |
| `release-cycle` | sub | 1.1 | release | planning · implementation · user-docs · e2e-smoke · submit · publishing · retrospective |
| `release-planning` | sub | 1.4 | release | advance-pinned-build · define-scope · triage-bugs · reconcile-governance · record-adrs · identify-specs · build-backlog · commit-backlog |
| `dev-loop` | sub | 1.4 | task | start · design · red · green · refactor · review · done |
| `user-docs` | sub | 1.1 | release | check-implementation-complete · align-user-docs · align-agent-docs |
| `e2e-smoke` | sub | 1.0 | release | fixture-project · drive-browser · local-security · accessibility · contract · launch · gate |
| `release-submit` | sub | 1.0 | release | pre-release-checks · enter-releasing · approve-release |
| `release-publishing` | sub | 1.1 | release | tag · publish · mark-released |
| `retrospective` | sub | 1.1 | release | explore · additional-points · capture · approve |
| `end-of-life` | sub | 1.0 | — | announce · deprecate · archive |

## Roles and directives (`roles.yaml`)

Roles are declared in `dna.yaml` (`team.roles`): developer, reviewer, qa, architect,
product-owner, tech-lead, approver, facilitator. The DNA's agent executes as developer, reviewer,
qa and architect and has no approval authority.

**Global directives** (every role): `doc-versioning`, `documentation`, `security-secrets`,
`claim-evidence`, `wingfoil-cli`.

| Role | Directives bound in `roles.yaml` (besides the global ones) |
|------|-------------------------------------------------------------|
| developer | `code-quality`, `testing`, `determinism`, `cli-only-writes`, `accessibility` |
| reviewer | `code-review`, `traceability`, `cli-only-writes`, `accessibility`, `ux-consistency` |
| qa | `testing`, `accessibility` |
| architect | `architecture`, `determinism`, `traceability`, `cli-only-writes` |
| product-owner | `traceability`, `ux-consistency` |
| tech-lead | `architecture`, `code-review` |
| approver | — (global ones only) |
| facilitator | — (global ones only) |

## Directives

| Id | Kind | Title | Bound to |
|----|------|-------|----------|
| `architecture` | built-in | Architecture | architect, tech-lead |
| `code-quality` | built-in | Code Quality | developer |
| `code-review` | built-in | Code Review | reviewer, tech-lead |
| `documentation` | built-in | Documentation | global |
| `security` | built-in | Security | — (not bound) |
| `testing` | built-in | Testing | developer, qa |
| `accessibility` | custom | Accessibility of the web UI | developer, reviewer, qa |
| `claim-evidence` | custom | A claim names the command that establishes it | global |
| `cli-only-writes` | custom | Every governed change goes through the WingFoil CLI | developer, reviewer, architect |
| `determinism` | custom | Determinism | developer, architect |
| `doc-versioning` | custom | Documentation versioning | global |
| `security-secrets` | custom | Secret hygiene | global |
| `traceability` | custom | Traceability | reviewer, architect, product-owner |
| `ux-consistency` | custom | UX consistency with the reference and the prototype | reviewer, product-owner |
| `wingfoil-cli` | custom | Using the pinned WingFoil CLI | global |

`wingfoil-cli` lists every known behaviour of the pinned CLI (W-xx entries) and the way to work with
it; read it before running any verb. WingFoil defects and gaps found here are filed as notes in
`docs/wingfoil-feedback/`.

## Keeping this file aligned

Re-check the tables when `memory.yaml`, `workflows.yaml`, a workflow file, `roles.yaml` or a
directive changes — at least at every `user-docs` `align-agent-docs` step and at release-line close
(dl-025 checks).
