# Packs adoption — design (governance-alignment-rel-v0.3, step 3)

**Version:** 0.5 · **Date:** 2026-11-02 (0.1: the design of GA3-10, with the proposed `.wingfoil/`
change on `design/ga3-adoption`; 0.2: the 16 decisions confirmed, the risk mitigations GA3-11, the
implementation and its gates — §11 … §13; 0.3: the open items' decisions 1-A and 2-A, the pre-packs
variant — §13; 0.4: review round 1 — §14, its fixes in §3 … §5, §11 … §13; 0.5: review round 2 —
§15, the nits n2 … n4 listed in §11. The plan (step 3, GA3-11)
cites this document as the detailed source of its decisions)

The adoption design that decision GA3-10 of `governance-alignment-rel-v0.3-plan` asks for before any
`.wingfoil/` change: the composition parameters, the file-by-file outcome, the old → new keys, dl-008
re-applied and dl-007 checked, the state migrations, roles and directives, the design probes on the
pinned CLI, and the decisions for the approver. The proposed change is one commit on
`design/ga3-adoption` (`chore(wingfoil): adopt base 2.0.1, software 1.0.0, methodology/scrum 1.0.0
(PROPOSED)`), shown by `git diff 93d2933..design/ga3-adoption -- .wingfoil`. No Memory element is
changed and no `memory` verb was run on this repository; the probes ran on throwaway copies.

This document lives outside the Memory paths: under `docs/05_plans/` (the `plan` type's path) a file
without frontmatter is `W_MEMORY_UNREADABLE` in `workflow list` on 0.3.1, and on 0.2.2 it is bug-024's
case. The coordinator may paste it into the plan instead.

Sources: the packs' READMEs at the tags `base@2.0.1`, `software@1.0.0`, `methodology/scrum@1.0.0`
of `wingfoil/wingfoil-templates` (*Install and update*, *What it adds*, *Parameters*, *Sources and
adaptations*, the `release-folders-lean` examples) and their charters (`pack-foundation-base`,
`pack-foundation-software` *Adoption* — the UI row and WingFoil's step keys, `pack-methodology-scrum`
*Adoption* — UI's step keys and open point 1); this repository's `.wingfoil/` at `93d2933`, dl-007,
dl-008, dl-010, directive `wingfoil-cli` 1.12, `docs/publishing.md`.

## 1. Composition parameters

Composed with the reference composer of `wingfoil/wingfoil-templates` at the three tags
(`npm run compose -- --tree . --out <dir> --param k=v … base@2.0.1 software@1.0.0
methodology/scrum@1.0.0`, exit 0). Every path and id keeps this repository's current value: no
file moves.

| Pack | Parameter | Value | Why |
|------|-----------|-------|-----|
| base | `project_name` | `WingFoil UI` | `dna.yaml` `project.name` |
| base | `approver_name` | `Roberto Pompermaier` | the DNA's member with `approver` |
| base | `approver_email` | the member's email in `dna.yaml` | WingFoil grants approval by it |
| base | `agent_name` | `AI agent (Claude/Cursor/etc.)` | the DNA's agent name, unchanged (a new name would be a new agent) |
| base | `decision_log_path` | `docs/04_memory/design/dls/{id}.md` | current path |
| base | `task_path` | `docs/04_memory/{release}/{id}.md` | current path (`{release}` is the task's field) |
| base | `plan_path` | `docs/05_plans/{scope}/{id}.md` | current path |
| base | `plan_id` | `{workflow}-{phase}-plan` | current pattern (the pack's default since 2.0.0) |
| base | `retrospective_path` | **open** — proposed `docs/05_plans/` | decision 4 |
| software | `adr_path` | `docs/04_memory/design/adrs/{id}.md` | current path |
| software | `tech_spec_path` | `docs/04_memory/design/specs/{id}.md` | current path |
| software | `bug_path` | `docs/04_memory/bugs/{id}.md` | current path |
| software | `release_line_path` | `docs/04_memory/planning/{id}.md` | current path |
| software | `release_path` | `docs/04_memory/planning/{release-line}/{id}.md` | current path (`{release-line}` = `v1`, W-07) |
| software | `release_line_id` | `rl-{version}` | current pattern (the default) |
| software | `release_id` | `{kind}-{version}` | current pattern (`minor-v0.3`) |
| software | `inception_path` | **open** — proposed `docs/01_vision/00_index.md` | decision 3 |
| scrum | `sprint_length` | **open** — proposed `2 weeks` | decision 5 |
| scrum | `sprint_path` | **open** — proposed `docs/04_memory/sprints/{id}.md` | decision 6 |
| scrum | `sprint_id` | **open** — proposed `sprint-{n}` | decision 6 |

The composer has no parameter for the other ids (`dl-{n}-{slug}`, `task-{n}-{slug}`,
`adr-{n}-{slug}`, `spec-{n}-{slug}`, `bug-{n}-{slug}`): the packs' fixed patterns equal this
repository's.

## 2. File-by-file outcome (`.wingfoil/`)

Outcomes: **(a)** from the pack as composed; **(b)** from the pack + this repository's entries
re-added; **(c)** kept as this repository's own under `custom/`, with a name no pack uses
(`E_WORKFLOW_DUPLICATE_NAME`); **(d)** removed.

### Top-level files

| File | Outcome | This repository's entries re-added |
|------|---------|------------------------------------|
| `dna.yaml` | (b) | `project.description`, `license`, `repository`, `methodology` (`custom` → `scrum`); `modules`; `stacks` (WingFoil CLI `0.2.2` → `0.3.1`, stale since task-046; `Scrum` added to the methodologies); the member keeps all eight roles; the agent gets `tech-lead` (GA3-7) on top of the packs' six roles; `paths` (`config` gains the packs' `.wingfoil`; `governance` stays `.wingfoil/`, decision 12) |
| `memory.yaml` | (b) | per type: `name`, `description`, `tags`, the template file (this repository's templates), the required fields the packs leave to the project (release `kind`, `pillar`, `features`, `requirements`; task `release`; adr `sard_ref`; tech-spec `scope`; bug `severity`), `lists: [features]` on release (task-046 a1), `exempt.sprint` on release (decision 7), the `service` type. The types keep this repository's order (the packs' order would reorder the UI's type list: contract S-28.1) |
| `roles.yaml` | (b) | every current binding; `release-conventions` (new) on qa and tech-lead; globals `documentation`, `claim-evidence`, `wingfoil-cli` |
| `workflows.yaml` | (b) | `include` of `custom/service-ingest.yaml` and of the five procedures (decision 2) |
| `README.md` | own, rewritten | the projection of the new files; the adopted packs and versions (base README step 7 — *the adopted version recorded*) |

### `workflows/`

| File | Outcome | Why |
|------|---------|-----|
| `built-in/decision-log-ingest.yaml`, `governance-evolution.yaml`, `retrospective.yaml`, `retrospective-periodic.yaml` | (a) base | — |
| `built-in/sw-life-cycle.yaml`, `inception.yaml`, `specification.yaml`, `end-of-life.yaml`, `release.yaml`, `release-submit.yaml`, `release-publishing.yaml`, `adr-ingest.yaml`, `bug-ingest.yaml` | (a) software | `inception`, `specification`: decision 3 |
| `built-in/delivery.yaml`, `sprint.yaml`, `backlog-item.yaml` | (a) scrum | decision 1 |
| `custom/sw-life-cycle.yaml`, `adr-ingest.yaml`, `bug-ingest.yaml`, `decision-log-ingest.yaml`, `end-of-life.yaml`, `release-submit.yaml`, `release-publishing.yaml`, `retrospective.yaml` | (d) | named as a pack's workflow: kept, every `workflow` command fails (base and software README step 4); dl-008's tailoring moves to directive `release-conventions` (§4) |
| `custom/release-cycle.yaml` | (d) | replaced by `sprint` (scrum charter, UI's step keys) |
| `custom/release-line-cycle.yaml` | (d) | its `delivery` phase is scrum's `delivery`; the line is managed outside it (scrum charter): approval `memory approve rl-vN`, close `memory submit rl-vN`, roadmap the `initial-design` procedure |
| `custom/wingfoil-init.yaml` | (d) | run once, at the bootstrap (`BOOTSTRAP.md`), never again; scrum charter: "none" |
| `custom/lean-inception.yaml`, `specification-downcast.yaml`, `user-story-mapping.yaml`, `specification-by-examples.yaml`, `volere-requirements.yaml`, `backlog-export.yaml` | (d) | the slots `inception` and `specification` take the packs' defaults, whose evidence is this repository's artefacts (decision 3); the runs stay recorded in `lean-inception-inception-plan` and `specification-downcast-specification-plan` |
| `custom/service-ingest.yaml` | (c) | this repository's own `service` type; unchanged |
| `custom/initial-design.yaml`, `release-planning.yaml`, `dev-loop.yaml`, `user-docs.yaml`, `e2e-smoke.yaml` | (c) procedures | no pack name; included by no workflow, each run by hand inside the pack phase its new header names (decision 2); header note and version bump only (1.1, 1.5, 1.5, 1.2, 1.1) |
| `built-in/.gitkeep` | (d) | the folder is no longer empty |

### `directives/`

| File | Outcome | Why |
|------|---------|-----|
| `built-in/claim-sources.md`, `doc-versioning.md`, `security-secrets.md`, `traceability.md` | (a) base | — |
| `built-in/determinism.md` | (a) software | — |
| `built-in/scrum.md`, `definition-of-done.md` | (a) scrum | `definition-of-done` overridden by the custom one |
| `built-in/architecture.md`, `code-quality.md`, `code-review.md`, `documentation.md`, `security.md`, `testing.md` | kept | WingFoil `init`'s built-ins; no pack id |
| `custom/determinism.md`, `doc-versioning.md`, `security-secrets.md`, `traceability.md` | (d) | WingFoil `init` stubs (one line and "Tailor this rule to your project's needs"); a custom file wins over the pack's richer text (base README step 4, software step 4); decision 8 |
| `custom/accessibility.md`, `claim-evidence.md`, `cli-only-writes.md`, `ux-consistency.md`, `wingfoil-cli.md` | (c) | this repository's own; `claim-evidence` tightens `claim-sources` (base charter) |
| `custom/definition-of-done.md` | (c) new | this repository's Definition of Done: the `dev-loop` gates and the *Checks* of `CLAUDE.md` (scrum charter: "a project overrides in `custom/` with the same id"; open point 1) |
| `custom/release-conventions.md` | (c) new | dl-008's tailoring on the packs' release and retrospective workflows (§4) |

Directives with a pack id — content compared: this repository's four are `init` stubs of one line;
the packs' are written rules covering them (`determinism`: the clock, ordering, pins, flaky tests;
`doc-versioning`: the same rule plus "no version → git"; `security-secrets`: the same rule plus
revocation; `traceability`: the chain must exist, the project names it). The stub of `traceability`
named a chain (feature → story → acceptance → requirement → task) that the pack's text leaves to the
project: decision 8.

### `memory/templates/`

| File | Outcome |
|------|---------|
| `adr.md`, `bug.md`, `decision-log.md`, `release-line.md`, `service.md`, `tech-spec.md` | kept (this repository's, unchanged; `memory.yaml` points to them) |
| `task.md`, `release.md` | kept + `sprint:` (scrum) |
| `plan.md` | kept + `parent:` (base: a phase plan carries it) |
| `built-in/adr.md` … `built-in/tech-spec.md` (8) | (a), composed, unused but `built-in/sprint.md` — kept so that a recomposition diffs clean (decision 13) |
| `built-in/sprint.md` | (a), the `sprint` type's template |

## 3. Old → new keys

Source: the scrum charter's UI table and the software charter's WingFoil table. Plan ids never change
(base commitment 3): the 19 existing plans keep their ids and their `workflow`/`phase` fields, which
name the old workflows; they are all `done` but `governance-alignment-rel-v0.3-plan`.

| Old key (`93d2933`) | New key |
|---------------------|---------|
| `sw-life-cycle.init` (`wingfoil-init.init-config`) | none — run once, removed |
| `sw-life-cycle.inception` (`lean-inception.{vision, personas, journeys, features, sequencer}`) | `sw-life-cycle.inception` → `inception.{frame, approve}` (evidence `docs/01_vision/00_index.md`) |
| `sw-life-cycle.specification` (`specification-downcast.*` and its four subs) | `sw-life-cycle.specification` → `specification.{specify, approve}` (evidence: the approved tech-specs, adopted by `workflow adopt`) |
| `sw-life-cycle.{seed-first-release-line, release-line-cycle}` | `sw-life-cycle.delivery` (`delivery.{plan-sprint, sprints}`) |
| `release-line-cycle.approve` | none — `memory approve rl-vN` (planning → active) |
| `release-line-cycle.initial-design` | the `initial-design` procedure (keys unchanged), outside `delivery` |
| `release-line-cycle.delivery` | `delivery.sprints` → `sprint` |
| `release-line-cycle.plan-next-release-line` | none — the approver's `memory approve rl-vN` (active → done; a gate since GA3-11 R-2, only once every release of the line is `released`), `memory add` of the next line |
| `release-cycle.planning` (`release-planning.*`) | `sprint.sprint-planning` and `sprint.plan-release`, with the `release-planning` procedure inside them |
| `release-cycle.implementation` (`dev-loop.*`) | `sprint.development` → `backlog-item` |
| `dev-loop.{start, design, red, green, refactor, review, done}` | `backlog-item.{start, build, review, approve, done}` (`design`, `red`, `green`, `refactor` → `build`; `review` → `review` + `approve`) |
| `release-cycle.{user-docs, e2e-smoke}` | `release-submit.pre-release-checks` (the procedures inside it) |
| `release-cycle.submit` | `sprint.release` → `release.submit` → `release-submit` |
| `release-cycle.publishing` | `release.publishing` → `release-publishing` |
| `release-cycle.retrospective` | `sprint.retrospective` → `retrospective` |
| `release-submit.release-commit` | `release-publishing.release-commit` (moved, software charter UI row) |
| `release-submit.{pre-release-checks, enter-releasing, approve-release}` | unchanged |
| — | `release-publishing.staging-rehearsal` (new) |
| `release-publishing.{tag, publish, mark-released}` | unchanged |
| `retrospective.{explore, additional-points, capture, approve}` | unchanged |
| `sw-life-cycle.sunset` | `sw-life-cycle.end-of-life` |
| `end-of-life.{announce, deprecate, archive}` | unchanged; `end-of-life.approve` new |
| `adr-ingest.*`, `bug-ingest.*`, `decision-log-ingest.*`, `service-ingest.*` | unchanged |
| `governance-alignment` (ad-hoc plan token, no workflow) | `governance-evolution` for the next ones (decision 15) |

New plans: a run started by `workflow start` gets `<main>-<n>-plan` (probe: `sw-life-cycle-1-plan`,
`phase: "1"`, written under `docs/05_plans/sw-life-cycle/`); a phase plan keeps this repository's
`{workflow}-{phase}-plan` form (e.g. `sprint-sprint-001-plan`) and fills `parent`.

## 4. dl-008 re-applied, dl-007 checked

The packs' `built-in/` workflows stay unchanged (a recomposition overwrites them, and
`workflows/bindings.yaml` cannot rebind `agent.execute`, a built-in token: `E_BINDING_BUILTIN_TOKEN`).
dl-008's tailoring becomes directive `release-conventions` (custom, bound to qa and tech-lead, the
roles of the phases it covers), which `workflow next` lists with each step:

| dl-008 point | Where now |
|--------------|-----------|
| release commit `chore(release): v{package.version}` (versions, lockfile, CHANGELOG, `CLAUDE.md` status) | `release-publishing` › `release-commit` — moved there by `software` (after `approve-release`); RS-3's reason (the checks run on the release commit) is kept by `staging-rehearsal`, which runs on it |
| tag `v{package.version}` on `main` (RV-7, RS-7) | `release-publishing` › `tag` |
| bug check by `release` / `release-origin`, not tags | `release-submit` › `pre-release-checks` |
| no WingFoil-only references; this repository's publish pipeline | `publish`: the tag run, `promote` approved, `npm stage approve` (`docs/publishing.md`) — also closes step 6 of the plan (the stale header goes with the removed file) |
| `retrospective` › `capture` produces a `dl-{n}-{slug}` decision-log | the pack already does (`{ type: decision-log, path }`); the directive adds `--tags retrospective` and the title |

`staging-rehearsal` fits the pipeline: `npm run test:publish-smoke` is the pipeline's `stage` run
locally (`docs/publishing.md` *Local staging smoke*), and the `workflow_dispatch` dry run (`gate` +
`stage`, never `promote`) is the rehearsal on a runner; neither makes anything public.

dl-007's W-entries against the composed machines (probed on 0.3.1, §7):

| Entry | Composed machine | Consequence (directive `wingfoil-cli`, step 4) |
|-------|------------------|-------------------------------------------------|
| W-04 plan `active → done` by hand | `plan` keeps `waiting: [active]`; `submit` refused ("a `waiting` state") | stays for phase plans; a run started by `workflow start` is closed by `workflow end` |
| W-20 task `backlog → in-progress`, `approved → done` by hand | no `waiting` on `task` | obsolete: both are `memory submit` (probe) |
| W-25 release `planning → in-development → releasing → released` by hand; approve-release in chat | no `waiting`, no gate on `release` | obsolete: each is `memory submit` (probe); `approve-release` is the approver's `workflow finalize --step … --reason` when the run is on the engine, else the OK in chat |
| W-26 bug `triaged → planned`, `planned → in-progress` by hand; close note before `resolved → closed` | `triaged`, `planned` are gates, no `waiting` | as composed, both are the **approver's** `memory approve` (probe; `submit` refused); since GA3-11 R-3 `planned` has no gate here, so `planned → in-progress` is `memory submit` (§11); the close note stays (W-28) |

Also: W-27 fixed on 0.3.1 (probe: the first `memory add` of a task in `docs/04_memory/v0.3/`, which
holds task-046 only, gives `task-047`); W-21 fixed on 0.3.1 (step 2, r3).

## 5. State migrations

Every element's current state exists, with the same name, in its composed machine (`memory search`
on `93d2933`: 120 elements — adr `accepted` 2; bug `closed` 21, `triaged` 3; decision-log `ready`
12; plan `done` 18, `active` 1; release `released` 2, `draft` 3; release-line `active` 1; tech-spec
`approved` 10; service `active` 1; task `done` 46). **No state migration commit is needed.**

What changes for existing elements (none executed):

| Element(s) | Change | Commit (later, by whom) |
|------------|--------|-------------------------|
| `minor-v0.1`, `minor-v0.2` (`released`) | `sprint` required by scrum: listed in `memory.yaml` `exempt.sprint` (in the proposed diff) | none |
| `minor-v0.3`, `minor-v0.4`, `minor-v1.0` (`draft`) | `sprint` required before their `memory submit` (probe: `missing required field on submit: sprint`); release has no `n/a` form | at `release-planning` of v0.3: `minor-v0.3` gets the first Sprint's id in its draft, carried by its submit (W-01); the other two when their Sprint is planned |
| open tasks | none open (46 `done`) | none; a `done` task amended later needs `sprint: "n/a — added before the Sprints"` in the same amendment |
| bug-019, bug-023, bug-024 (`triaged`) | forward edges now the approver's `memory approve` | at `release-planning` of v0.3, by the approver |
| `rl-v1` (`active`) | as composed `active → done` is `memory submit`; since GA3-11 R-2 it is the approver's `memory approve` (§11) | at the line's close, every release of `v1` `released` |
| `governance-alignment-rel-v0.3-plan` (`active`) | unchanged; on 0.3.1 an open plan is a workflow instance (`W_INSTANCE_WORKFLOW_UNKNOWN`, as before the adoption) | closed by hand (W-04) at step 8 |
| the 18 `done` plans | no `parent` (base) | none: `done` and never resubmitted |

GA3-8 said `sprint: "n/a — <reason>"` on existing releases: `release` does not accept it (no
`not_applicable_allowed`, scrum charter: "there is no n/a form"); decision 7 amends it.

## 6. Roles, directives, AGENTS.md

- `tech-lead` (GA3-7): in the agent's `executes_as`. The packs also give the agent `facilitator` and
  `product-owner`; the member keeps every role, `approver` included. `approval_authority: false`.
- `roles.yaml`: every current binding kept; the packs add `traceability` and `scrum` to facilitator,
  `scrum` and `definition-of-done` to developer, `determinism` and `definition-of-done` to reviewer,
  `definition-of-done` to qa, `scrum` to product-owner, `claim-sources` global. `directives list
  --role <r>` for every role: no dangling binding (W-09); the only warning is the intended
  `definition-of-done` override (W-23); `approver` has none bound.
- AGENTS.md: this repository has none; the composer's region (`wingfoil:generated` markers) names
  the workflows to start, the life cycle, Scrum. Decision 11.

## 7. Design probes (WingFoil 0.3.1)

On a throwaway clone of `93d2933` with the proposed `.wingfoil/` committed (WingFoil reads workflows
at HEAD), with `GIT_TRACE` per command and a `.git` snapshot (every file's size and mtime, plus
`git status --porcelain=v2` with `GIT_OPTIONAL_LOCKS=0`) before and after:

| Command | Before (`93d2933`) | After (proposed) |
|---------|--------------------|------------------|
| `workflow list` | exit 0, 5 startable, 115 diagnostics (98 unbound tokens) | exit 0, 7 startable, **75 diagnostics, 0 errors**: 66 `W_WORKFLOW_UNBOUND_TOKEN`, 8 `W_PHASE_PRODUCES_OWNER_IMPLICIT` — all in the five procedures and `service-ingest` — and 1 `W_INSTANCE_WORKFLOW_UNKNOWN` (the open ad-hoc plan); the packs' 16 workflows: none |
| `memory search` | 120 elements, each once | 120 elements, each once |
| `directives list` | 15 directives | 20; one warning (`definition-of-done` override, intended) |
| `dna show`, `paths` | exit 0 | exit 0 (`methodology: scrum`; `config` adds `.wingfoil`) |
| `workflow status` | — | exit 0; the three `triaged` bugs routed to the approver |

Git trace: `memory search`, `directives list`, `dna show`, `paths` and `--version` run no git
command; `workflow list` and `workflow status` run `rev-parse`, `show`, `cat-file --batch`, `ls-tree`,
`log`, `merge-base` and one `git status` (no transport command, no `fetch`). Snapshot: nothing
written, HEAD unchanged — **except** that `git status`, run by `workflow list` and `workflow status`
without `GIT_OPTIONAL_LOCKS=0`, refreshes `.git/index` when its stat data is stale (reproduced
before the adoption too, on `93d2933`; the UI server sets the variable, task-046 D46-5).

Behaviour of the composed machines (on a second throwaway copy, with writes): `memory submit` moves a
release `draft → planning → in-development → releasing → released` and a task `backlog →
in-progress`, `approved → done`; a task or release without `sprint` is refused at submit; the
approver's `memory approve` moves a bug `triaged → planned → in-progress`; `memory submit` of the
active plan is refused; `memory submit rl-v1` moves it to `done` with no check; `workflow start
sw-life-cycle` creates `sw-life-cycle-1-plan` with `inception.approve` as next step (`frame`'s
evidence, `docs/01_vision/00_index.md`, exists), and after the approver's `workflow finalize` of it,
`workflow adopt --plan` proposes the ten approved tech-specs for `specification.specify`; one adoption
completes `specification`, and `delivery.plan-sprint` (product-owner) is next.

Default-suite gates that read `.wingfoil/` — `npx vitest run test/contracts` on the proposed change
(the `custom` contract fixture copies this repository's `.wingfoil/`, `test/harness/fixtures/builder.ts`):

1. As is: the `custom` fixture cannot be built on either version — its tasks have no `sprint`
   (`missing required field on submit: sprint`): 2 suites failed, 274 passed, 39 skipped.
2. With the builder giving its tasks `sprint: "n/a — …"` and its release a `sprint` (a test change,
   not in the proposed commit): 5 failed, 307 passed, 1 skipped (313):
   - WingFoil **0.2.2 refuses the packs' workflows**: `workflow list` → `E_VALIDATION
     phases.0.produces.0 (…/decision-log-ingest.yaml): expected string, received object` (the
     `{ type, path }` form of `produces`; the packs' range is `>=0.3.0`); 0.2.2 also ignores
     `exempt` and warns `unknown field(s) ignored: format`;
   - the descriptor oracle (TT-ARC-06), both versions: `minor-v0.1` (`planning`), `task-003`,
     `task-004` (`backlog`) are no longer `waiting` but `work` with a `submit` verb;
   - S-28.1, both versions: the type list gains `sprint`.
   So the adoption needs, in the same change as the `.wingfoil/` commit: the builder edit; a
   `custom` fixture for 0.2.2 that no longer imports the live `.wingfoil/` (decision 16); the oracle
   and the type list; the `custom` samples re-captured on both versions
   (`WFUI_CAPTURE_SAMPLES=1`: `workflow-list.json`, `memory-search*.json`, `dna-show.json`,
   `directives-list.json`, `paths.json`, `memory-add/approve/reject.json`, `memory-history/`,
   `files/`).

The other default-suite tests reading the repository's `.wingfoil/` (`test/wingfoil-feedback.test.ts`
reads `wingfoil-cli.md`, unchanged) and the docs tests run on the design branch (§9 *Checks*).

## 8. The proposed change

On `design/ga3-adoption`, one commit for `.wingfoil/` (`chore(wingfoil): adopt base 2.0.1, software
1.0.0, methodology/scrum 1.0.0 (PROPOSED)`) and one for this document. Not in it, and to be made in
the same step once the decisions are taken: the test changes of §7; `CLAUDE.md` (*Working with the
WingFoil CLI*: W-20 no longer a hand transition, the agent's roles, the globals) and AGENTS.md
(decision 11); directive `wingfoil-cli` (step 4); the `minor-v0.3` sprint field (at
`release-planning`).

## 9. Decisions for the approver

Confirmed by the approver on 2026-11-01: all sixteen as recommended (chat; recorded in the plan as
GA3-11 with the mitigations of §11).

1. **Delivery.** (A) scrum's `delivery` → `sprint` → `backlog-item` replaces `release-line-cycle` /
   `release-cycle` (as GA3-2 chose the pack); (B) keep this repository's loop as delivery — not
   possible without dropping scrum's `delivery` (same name). **Recommended: A.**
2. **This repository's procedures** (scrum charter open point 1: `release-planning`, `dev-loop`,
   `user-docs`, `e2e-smoke`, `initial-design`). (A) kept under `custom/`, included, run by hand
   inside the named pack phase, the pack owning the transitions — 75 warnings; (B) folded into
   directives now, files removed; (C) kept as files but not included (3 warnings; `workflow show`
   cannot show them). **Recommended: A** now, (B) as a governance-evolution of v0.3 once a Sprint
   has run them.
3. **Inception and specification slots.** (A) the packs' defaults, `inception_path:
   docs/01_vision/00_index.md`, the six UI workflows removed; (B) `lean-inception` and
   `specification-downcast` renamed `inception` / `specification` under `custom/`, the defaults left
   out of `include`. **Recommended: A** (both phases are complete; B departs from the composed
   `workflows.yaml`).
4. **`retrospective_path`** (a directory, trailing `/`, weak evidence). (A) `docs/05_plans/` — the
   inventory stays in the retrospective's plan, as today; the evidence is always satisfied; (B) a
   new `docs/06_retrospectives/`, one inventory file per retrospective; (C) the default
   `docs/retrospectives/`. **Recommended: A.**
5. **`sprint_length`.** (A) `2 weeks` — `minor-v0.2` went from `release-planning` (its plan added on
   2026-10-12) to `released` (2026-10-21) in nine days (`git log`), so one Sprint per release (scrum
   charter) fits; (B) `1 week` — releases would span
   Sprints (their `sprint` rewritten before each Sprint Review). **Recommended: A.**
6. **`sprint_path` / `sprint_id`.** (A) `docs/04_memory/sprints/{id}.md`, `sprint-{n}` (padded:
   `sprint-001`); (B) under `docs/04_memory/planning/sprints/`. **Recommended: A.**
7. **GA3-8 amended.** (A) `exempt.sprint: [minor-v0.1, minor-v0.2]`; `minor-v0.3` gets the first
   Sprint's id at `release-planning`, the later drafts at their Sprint; (B) allow `n/a` on release
   in this repository's `memory.yaml` (a release with `n/a` never enters a Sprint's `release`
   phase). **Recommended: A.**
8. **Directives with a pack id.** (A) remove the four `init` stubs, take the packs'; the
   `traceability` chain of this repository is named by its bindings and docs; (B) as A plus a custom
   `traceability` (the pack's text + the chain). **Recommended: A.**
9. **dl-008's home.** (A) directive `release-conventions`; (B) edit the packs' files in place
   (lost at the next recomposition). **Recommended: A.**
10. **The release commit.** (A) the pack's order: checks, `releasing`, approval, then the release
    commit, rehearsed by `staging-rehearsal` (`test:publish-smoke`); (B) keep RS-3 (commit before
    the checks) as a deviation. **Recommended: A.**
11. **AGENTS.md.** (A) create `AGENTS.md` with the composer's region, `CLAUDE.md` pointing to it;
    (B) paste the region into `CLAUDE.md`; (C) none. **Recommended: A.**
12. **`paths.governance`.** (A) stays `.wingfoil/` (the UI server reads it to keep governance
    folders out of the file tree); (B) `docs/04_memory/`, `docs/05_plans/` (base charter's meaning,
    dl-015 C11) — a product behaviour change on this repository. **Recommended: A.**
13. **Templates.** (A) this repository's templates (+ `sprint`, `parent`), the packs' copied to
    `built-in/` unused but `sprint`; (B) copy only `built-in/sprint.md`. **Recommended: A.**
14. **Engine bootstrap** (`workflow start sw-life-cycle`, the approver's `finalize` of
    `inception.approve`, `workflow adopt` for `specification.specify`, then `delivery.plan-sprint`).
    (A) at `release-planning` of v0.3, as its first steps; (B) in this pre-step. **Recommended: A.**
15. **Future pre-steps** like this one: (A) run as `governance-evolution` (base), a known workflow;
    (B) ad-hoc plans as today (`W_INSTANCE_WORKFLOW_UNKNOWN`). **Recommended: A.**
16. **The `custom` fixture on 0.2.2.** (A) 0.2.2 imports a frozen copy of the pre-adoption
    `.wingfoil/` (`93d2933`), 0.3.1 the live one; (B) both a frozen copy; (C) no `custom` fixture on
    0.2.2. **Recommended: A**, with the test changes of §7 as a reviewed harness commit of step 3
    (as a1 … a4 in step 2), before any CLI verb (W-24).

## 10. Open risks

- A release has no gate: any member — the agent included, as tech-lead — can `memory submit` it to
  `released`; only `approve-release` and `publish` carry the approval. `release-conventions` and
  `wingfoil-cli` must say that `mark-released` follows the publication.
- `memory submit rl-vN` closes a release line with no check that its releases are `released`.
- The approver's load: every bug moves `triaged → planned → in-progress` by `memory approve`.
- The five procedures drift from the packs' phases until decision 2's (B); with `service-ingest`'s
  two, their 74 warnings hide new ones in `workflow list`.
- `base`'s weak `retrospective` evidence and bug-008 (a closed Sprint's `retrospective` › `approve`
  listed again) — stated in the base README.
- WingFoil UI itself shows this repository differently: tasks in `backlog` and releases in
  `planning` are no longer `waiting` (contract TT-ARC-06).
- `workflow list` / `workflow status` refresh `.git/index` when run without `GIT_OPTIONAL_LOCKS=0`
  (pre-existing, not of the adoption).

## 11. Risk mitigations (GA3-11)

Decided by the approver on 2026-11-01 on the risks of §10. R-1 … R-3 are deviations from the packs,
listed in `.wingfoil/README.md` *Deviations from the packs* and proposed to WingFoil-Templates (§12).

| # | Risk (§10) | Mitigation | Evidence |
|---|------------|------------|----------|
| R-1 | a release has no gate: anyone can `submit` it to `released` | `release` `states.gates.releasing: { reject: in-development }`; `release-publishing` › `mark-released` becomes the approver's `memory approve` after `publish` (directive `release-conventions` 1.1) | probe on 0.3.1 with the proposed `.wingfoil/`: `submit` `in-development → releasing` passes; `submit` from `releasing` refused ("a `gates` state — its forward edge requires `approve`"); `approve` → `released`; `workflow list` 0 errors |
| R-2 | `submit` closes a release line with no check | `release-line` `gates.active: { reject: planning }`: the approver closes the line | probe: `submit rl-v1` from `active` refused; `approve` → `done` |
| R-3 | the approver moves every bug `triaged → planned → in-progress` | keep the gate on `triaged`, remove the gate on `planned`: any team identity can move a planned bug with `memory submit` — by rule the developer, at `backlog-item` › `start` (`dev-loop` procedure header 1.6). Trade-off: `planned` loses the pack's only `planned → closed` (wontfix) exit; a bug that will not be fixed is rejected at `triaged`, and once planned only `memory deprecate` (with the approver's OK) ends it | probe: the approver's `approve` `triaged → planned`; `submit` `planned → in-progress` |
| R-4 | the procedures' 74 warnings hide new ones | `test/governance/workflow-diagnostics.test.ts` (default suite): `workflow list` of the pinned CLI on this repository equals a committed baseline per file, code and severity (`workflow-diagnostics.baseline.json`: 75 warnings in 10 rows, 0 errors); decision 2's fold of the procedures into directives is scheduled at `release-planning` of v0.3 | red first: an empty baseline fails with the 10 rows; a baseline one short (`dev-loop.yaml` `W_WORKFLOW_UNBOUND_TOKEN` 16) fails with `16 → 17`; the true baseline passes; unit cases for a new code, a new file, one more of a known code and one gone |
| R-5 | `base`'s weak `retrospective` evidence; bug-008 | this repository's practice in `release-conventions` 1.1: the friction inventory, every point citing its source, lives in the retrospective's own plan; bug-008 goes to directive `wingfoil-cli` at step 4 | — |
| R-6 | the UI shows backlog tasks with a `submit` (*Today* noise) | accepted now; a candidate for `release-planning` of v0.3 | contract TT-ARC-06 (`STANDARD_PACKS`) |
| R-7 | `workflow list` / `status` (and, per the review, `agent list`, `workflow next`, `workflow show`) rewrite `.git/index` without `GIT_OPTIONAL_LOCKS=0` | handled by task-046 D46-5 in the server; a feedback note at step 5 naming every such command | §7 probes; repeated in §13; review round 1, n1 |

**Residuals and accepted limits** (review round 1, the approver's decisions of 2026-11-02; declared in
`.wingfoil/README.md`):

| # | What remains | Rule here | Candidate |
|---|--------------|-----------|-----------|
| R-1 residual (A-1) | the console and `workflow status` offer the `releasing` gate's Approve as soon as the release enters `releasing`; a `memory approve` at `approve-release` jumped to `released` and the publication steps vanished (probe) | `approve-release` is `workflow finalize --step release-submit.approve-release@… --reason …`, never `memory approve`; the release is approved only at `mark-released`, after `publish`'s post-check (`release-conventions` 1.2) | v0.3 `release-planning`: the console offers no Approve on a `releasing` release before `publish` |
| R-2 residual (A-2) | `rl-vN` sits in the approver's queue for the whole life of the line | approve the line only at its end, every release `released` (`release-conventions` 1.2) | v0.3: no Approve on an `active` line before its releases are `released` |
| A-3 | WingFoil 0.3.1 accepts a hand-committed `status:`: its history shows `approver: null` and the engine counts the state | W-20, W-25, W-26 superseded (`wingfoil-cli` 1.13); `AGENTS.md` keeps W-04 as the only hand transition | feedback (§12) |
| A-4 | `memory deprecate` needs no approval: any git identity, team member or not, deprecated an `active` release line, an `accepted` ADR and a `released` release (probe) | only in `end-of-life` › `deprecate` or with the approver's OK in the active plan (directive `wingfoil-cli` 1.14, global, so every role loads it; `cli-only-writes` 1.8; `AGENTS.md`) | feedback (§12) |
| m4 | the `base` pack's `security-secrets` forbids personal emails in files; `dna.yaml` must hold the approver's | the one exception, declared | feedback (§12) |
| m5 | a release or task whose `sprint` names no existing Sprint is accepted at `submit` | check the id against `docs/04_memory/sprints/` before submitting | feedback (§12) |
| m1 | the composer's `AGENTS.md` region hard-codes four agent roles and the pack's `bug` gates | the hand-written *This repository* section overrides both; the region is not edited | feedback (§12) |
| n2 | a non-approver identity can start workflows, finalize non-approval steps and adopt elements; adopting one already-approved spec also closes `specification.approve`, whose `where: status [pending]` finds nothing — authority holds on every approval step | declared; the agent starts, finalizes and adopts only as its plan says | feedback (§12) |
| n3 | `workflow status` titles the gated elements "ungated elements" | declared | feedback (§12) |
| n4 | `governance-evolution` › `apply` says "AGENTS.md updated", while `AGENTS.md`'s region says "do not edit by hand: recompose" | declared: `apply` updates the hand-written section, or recomposes for the region | feedback (§12) |

Identity: the CLI authorises `memory approve` by the commit's git identity (a non-approver email gets
"user not authorized to approve", coordinator probe), but agents commit under the approver's identity
here: "no approval by an agent" is a process rule. A separate git identity for agents is a v0.3
task, not part of this step (`release-conventions`, `CLAUDE.md`).

## 12. Feedback note for WingFoil-Templates (draft, not filed)

> **Title:** A gate on `release` `releasing` and on `release-line` `active` in `software`
>
> **Pack:** `software@1.0.0` (with `base@2.0.1`, `methodology/scrum@1.0.0`), WingFoil 0.3.1.
>
> **Observed.** `release` has no gate: with no `waiting` (R-1), every edge is a `memory submit`, so
> any member — an agent acting as `tech-lead` included — can move a release `releasing → released`
> with no approval; the approval lives only in the `approve-release` and `publish` phases, which a
> project not running the engine does not see. `release-line` `active → done` is a `submit` too, with
> no check that the line's releases are `released`. Reproduced on WingFoil 0.3.1: `memory submit
> <release>` four times takes a release from `draft` to `released`; `memory submit rl-v1` moves the
> line to `done`.
>
> **Proposal.** Declare `gates: { releasing: { reject: in-development } }` on `release` (the
> approver's `approve` after the publication; `mark-released` then approves rather than
> `element.set_state(released)`), and `gates: { active: { reject: planning } }` on `release-line`.
> Adopted by WingFoil UI as local deviations (its GA3-11 R-1, R-2); on 0.3.1 `workflow list` reports no
> error with them, `submit` from the gate is refused and `approve` passes. WingFoil UI also drops the
> gate on `bug` `planned` (R-3: any team identity starts a planned fix with `submit`; the cost is
> the loss of the `planned → closed` wontfix exit), for the packs' consideration rather than as a
> proposal.
>
> **The gates are offered out of phase.** With the `releasing` gate, the console and `workflow
> status` list the release's Approve as soon as it is `releasing`, although no open step carries it
> until `mark-released`: approving at `approve-release` moves it to `released` and the publication
> steps vanish. "No open workflow carries it" is wrong for such a gate; the same holds for an
> `active` release line, listed for its whole life. A gate approval bound to the phase that owns it
> would close both.
>
> **Also seen while adopting** (WingFoil 0.3.1 and the packs):
> - the CLI accepts a hand-edited, committed `status:` with no approver (history `approver: null`),
>   and the engine counts the state;
> - `memory deprecate` needs no approval: any team identity deprecates an element in any state;
> - a `sprint` field naming a Sprint that does not exist is accepted at `submit`;
> - `base`'s `security-secrets` forbids personal emails in files, while `dna.yaml` must hold the
>   approver's email for WingFoil to grant approval — the rule could name that exception;
> - the composer's AGENTS.md region hard-codes the agent's roles (four) and the `bug` gates, so a
>   project whose DNA or `memory.yaml` differs must correct it outside the region;
> - a non-approver identity can start workflows, finalize non-approval steps and adopt elements;
>   adopting one already-approved tech-spec also closes `specification.approve`, whose
>   `where: { status: [pending] }` then selects nothing;
> - `workflow status` titles the elements waiting at a gate "ungated";
> - `governance-evolution` › `apply` asks for "AGENTS.md updated", while the region of AGENTS.md is
>   generated and not to be edited by hand.

## 13. Implementation (`design/ga3-adoption`)

Commits after `93d2933`:

| Commit | What |
|--------|------|
| `7f90e9d` | `chore(wingfoil)`: the composed `.wingfoil/` with this repository's entries (§2) |
| `5d146b4` | this document, 0.1 |
| `9127168` | `chore(wingfoil)`: R-1 … R-3 in `memory.yaml`; `release-conventions` 1.1 (R-1, R-5); README 0.5 (deviations); `dev-loop` header 1.6 |
| `52b8bb8` | `docs`: `AGENTS.md` (the composer's region, decision 11); `CLAUDE.md` 0.10 |
| `5b9e108` | `test(harness)`: decision 16 and R-4 — `customGovernance`, the frozen `custom-governance-0.2/`, `STANDARD_PACKS`, S-28.1 with `sprint` (contract, harness, e2e and the scenario's Examples row), the re-captured `custom` samples (0.3.1 changed, 0.2.2 byte-identical), the diagnostics baseline test, `test/README.md` 0.48 |
| (this commit) | this document, 0.2 |

The `.wingfoil/` change for the approver: `git diff 93d2933..design/ga3-adoption -- .wingfoil`.

**Notes on the harness change.** Nothing loosened: every changed expectation is a consequence of the
packs' machines, written by hand (`STANDARD_PACKS` from spec-003 §2 … §7); the pre-packs oracle
`STANDARD` stays and still checks 0.2.2. The `custom` fixture keeps its hand transitions
(`backlog → in-progress`, `approved → done`) on both versions: the history is the fixture's data;
on the packs' machine the same moves are also `submit` edges. `minor-v0.1` carries no `sprint`: the
live `memory.yaml` exempts it, so the fixture exercises `exempt`.

**Gates** (heavy ones through the machine-free slot; the load average at start in brackets).
`7f5a86e` is the harness commit before its last amendment (`5b9e108` adds the `custom` row of
`test/harness/fixtures.test.ts`, the only failure of the first `test:coverage` / `npm test`); the
gates the amendment can change were run again on `78da715`, this document's commit before the
gate table was added (the same tree outside this file).

| Gate | Commit | Result |
|------|--------|--------|
| `typecheck`, `lint`, `format:check` | `78da715` | exit 0 (12.2, 11.6, 15.0) |
| `docs:api` | `7f5a86e` | exit 0 (8.0) |
| `check_tasks.py v0.3` | `7f5a86e` | exit 1: 28 items listed by no task, the same on `93d2933` (v0.3 not planned) |
| `test:contract` | `7f5a86e` | 312 passed, 1 skipped (7.9) |
| `test:coverage` | `78da715` | 3342 passed, 1 skipped; 96.62 % statements, 91.52 % branches (11.4) |
| `npm test`, strict identity | `78da715` | 3342 passed, 1 skipped (11.4) |
| `test:smoke` | `7f5a86e` | 4 passed (12.0) |
| `test:e2e` (Chromium, Firefox, WebKit) | `7f5a86e` | 917 passed, **18 failed**: R-06.1, R-06.2, S-24.2, S-24.4, T-04.2, T-11.2 on each engine — the open items below (5.8) |

Probes on a clone of `7f5a86e` (`.wingfoil/` as at `78da715`), with `GIT_TRACE` and the `.git`
snapshot: `workflow list` exit 0, 7 startable, 75 warnings, 0 errors, equal to the baseline;
`memory search` 120 elements, each once; `directives list` 20 entries, the one intended override
warning; `dna show` (`methodology: scrum`, the agent's seven roles), `paths` exit 0; no transport
command; nothing written but the index refresh of R-7 on the clone's first run (none on the
second).

**Open items' decisions** (the approver, 2026-11-01): decision 1 → (A), decision 2 → (A), handled by
the coordinator (a `bug-ingest` and a separate fix task). Decision 1-A is done in `4cad9f1`:
S-24.2, S-24.4, T-04.2 and T-11.2 run on *the custom fixture with the pre-packs states* — the live
fixture whose `memory.yaml` is replaced by the frozen pre-adoption one and committed
(`usePrePacksStates` in `test/harness/fixtures/builder.ts`; the elements are unchanged and WingFoil
0.3.1 accepts the file). Their assertions are unchanged; only their `Given` lines name the variant.
`00_conventions.md` 0.11 describes the variant, the `custom` fixture's governance per CLI version and
`minor-v0.1`'s state kind under each; the frozen copy's README 1.1 names its second use. Red: the
four failed on the three engines on `7f5a86e` (the full run above); green on `4cad9f1`.

| Gate | Commit | Result |
|------|--------|--------|
| `typecheck`, `lint`, `format:check` | `4cad9f1` | exit 0 (5.3, 8.4, 9.5) |
| `test:contract` | `4cad9f1` | 312 passed, 1 skipped (9.6) |
| `npm test`, strict identity | `4cad9f1` | 3342 passed, 1 skipped (5.4) |
| `gate-footer.spec.ts`, `today.spec.ts` on Chromium, Firefox, WebKit | `4cad9f1` | 144 passed, the four scenarios on each engine among them (5.5) |

R-06.1 and R-06.2 stayed red until the coordinator's fix of the directive rows (bug-025, task-047)
was merged here (`ababf9a`, with `694a666`). Then, run by the coordinator:

| Gate | Commit | Result |
|------|--------|--------|
| `test:e2e` (Chromium, Firefox, WebKit) | `ababf9a` | 938 passed, 0 failed |
| `npm test` | `694a666` | 3353 passed |

**Open items** (as written before the decisions; 1 and 2 decided above):

- **E2E scenarios on the custom fixture whose premise the packs remove** (blocked, decision
  needed). With decision 16 the pinned CLI builds the `custom` fixture on the live `.wingfoil/`:
  - S-24.2 and T-11.2 need an engine-waiting element (`minor-v0.1` in `planning` was one; the packs
    keep `waiting` only on `plan`, `adr` `accepted`, `tech-spec` `approved`);
  - S-24.4 needs a state both gate and waiting (`bug` `triaged` was one; no composed type has one);
  - T-04.2 expects an approved task to leave *Requires you*; `approved` is now a `work` state whose
    `submit` is the approver's (last transition), so the task stays there.
  Options: (A) run these four on a variant, "the custom fixture with the pre-packs states" (a copy
  whose `memory.yaml` is the frozen one, which 0.3.1 accepts), amending their `Given` lines and
  `00_conventions.md`; (B) rewrite them on elements of the live configuration (an `adr` brought to
  `accepted` for S-24.2/T-11.2; a `gate-waiting` state declared on the copy for S-24.4; T-04.2's
  expectation to the new machine); (C) the `custom` fixture stays pre-packs for every version (decision
  16 option B). Recommended: (A) — the scenarios test the UI's handling of `waiting` and
  `gate-waiting` kinds, which other projects keep; the live configuration is checked by the contract
  tests and R-4.
- **A product defect found by R-06.1 / R-06.2**: a directive id defined by two files (the intended
  `definition-of-done` override, W-23) is rendered as two rows sharing one React `key`
  (`web/src/directives/DirectiveList.tsx`, `key={e.frontmatter.id}`): the rows repeat and the order
  breaks. Pre-existing, exposed by the adoption. Options: (A) a `bug-ingest` and a fix task before
  this branch merges; (B) the custom `definition-of-done` under another id with the pack's
  unbound (a fourth deviation); (C) accept the red R-06.1/R-06.2 until v0.3. Recommended: (A).
- `00_conventions.md` (the `custom` fixture's description, `minor-v0.1` "engine-waiting") follows
  the decision above.
- Directive `wingfoil-cli` (W-04, W-20, W-25, W-26, W-27, bug-008) — step 4; the R-7 feedback note —
  step 5; the feedback note of §12 — filing on the approver's OK.
- `minor-v0.3`'s `sprint`, the engine bootstrap (decision 14), the fold of the procedures (decision 2,
  R-4) — `release-planning` of v0.3; a separate agent git identity — a v0.3 task.
- `check_tasks.py v0.3` exits 1 with 28 backlog items listed by no task, identically on `93d2933`:
  v0.3 is not planned yet.

## 14. Review round 1

Two fresh reviewers (adversarial, correctness) on `design/ga3-adoption` at `694a666`: **FAIL**. The
approver decided every fix on 2026-11-02; the plan records them under step 3, GA3-11.

| Finding | Fix | Commit |
|---------|-----|--------|
| A-1 an early `memory approve` of a `releasing` release skips the publication | the gate kept; `approve-release` by `workflow finalize`, the release approved only at `mark-released`; residual in README R-1 and §11; v0.3 candidate; §12 | `4742863`, this commit |
| A-2 `rl-vN` in the approver's queue for the whole line | the gate kept; approved only at the line's end; residual in README R-2 and §11; v0.3 candidate; §12 | `4742863`, this commit |
| A-3 W-20, W-25, W-26 tell agents to set states by hand; 0.3.1 accepts it | supersession banner on the three entries (`wingfoil-cli` 1.13, *Checked against* unchanged: step 4); `AGENTS.md` keeps W-04 only; §12 | `4742863`, `9446f6f` |
| A-4 `memory deprecate` needs no approval | rule in `cli-only-writes` 1.7; README and §11; §12 — moved for every role in round 2 (MA-1, §15): `wingfoil-cli` 1.14, `AGENTS.md` | `4742863`, `5600c66`, `49b7027`, `2ba6ec0` |
| A-m1 / C-m3 the generated `AGENTS.md` region contradicts R-3 and names four agent roles | override lines in its hand-written section; §12 | `9446f6f` |
| A-m2 stale `bug.sync_state` texts | the task template's `bug:` comment, `release-planning` 1.6 | `4742863` |
| A-m3 the traceability chain in no role-loaded text | `traceability-chain` (custom, a new id: the pack's `traceability` is kept and asks the project to name its chain), bound with `traceability` to facilitator, reviewer, architect, product-owner | `4742863` |
| A-m4 `security-secrets` vs the approver's email in `dna.yaml` | declared exception (README, §11, §12) | `4742863`, this commit |
| A-m5 a dangling `sprint` is accepted | declared (README, §11, §12) | `4742863`, this commit |
| A-n1 more commands refresh the index | R-7 row and the step-5 note name `agent list`, `workflow next`, `workflow show` | this commit |
| A-n5 R-3 wording | "any team identity", by rule the developer (`memory.yaml`, README, §11, §12) | `4742863`, this commit |
| A-n2 … n4 | declared in §11 | this commit |
| C-M1 `release-conventions` not loaded by the facilitator (retrospective) | bound to facilitator; README tables; `directives list --role facilitator` lists it | `4742863` |
| C-m1 `initial-design` header and §3, §4, §5 say `memory submit rl-vN` / bugs by the approver | the approver's `memory approve rl-vN` at the line's end (`initial-design` 1.2); §3, §4 (W-26), §5 reconciled with §11 | `4742863`, this commit |
| C-m2 `definition-of-done` stale after R-3; `docs:api`'s source | reworded (1.1): bugs by their verbs; `docs:api` from the `dev-loop` `refactor` gate | `4742863` |
| C-m5 R-3 removes the `planned → closed` wontfix exit | the trade-off in README R-3, §11, §12 | `4742863`, this commit |
| C-m6 §13's gate table | updated (§13) | this commit |
| C-n2 `BOOTSTRAP.md` | marked historical in `CLAUDE.md` 0.11 | `9446f6f` |
| C-n3 S-28.1 Examples | a comment: `sprint` from WingFoil 0.3.0 | `9446f6f` |
| C-n4 `test/README.md` | 0.49 names `usePrePacksStates` | `9446f6f` |
| C-n5 the adopted versions | recorded in the plan at step 8 (the coordinator) | — |

The workflow files changed by these fixes changed comments, versions and, in `release-planning`, the
`description` of `build-backlog` only: the diagnostics baseline (R-4) is unchanged.

**Gates after the fixes** (on `9446f6f`, the tree of this commit outside this file; no code or test
code changed, so no heavy gate): `typecheck`, `lint`, `format:check` exit 0 (load 3.2 … 3.5);
`test/docs`, `test/governance` and `test/wingfoil-feedback.test.ts` 79 passed; `test/contracts` 312
passed, 1 skipped. Probes on a clone: `workflow list` exit 0, 75 warnings, 0 errors, equal to the
baseline; `memory search` 122 elements (task-047 and bug-025 added by the merge), each once;
`directives list` 21 entries, the one intended override warning; `directives list --role <r>` for
every role: no dangling binding, `release-conventions` and `traceability-chain` listed for the
facilitator; no transport command; the `.git` snapshot unchanged on the second run.

## 15. Review round 2

A targeted re-review at `5600c66`: **FAIL** (one major, minors and nits), all implementations of
decisions the approver had taken (A-1, A-4, R-3). The plan records GA3-11 (the coordinator, on the
pre-step branch); this document stays its detailed source.

| Finding | Fix | Commit |
|---------|-----|--------|
| MA-1 the A-4 rule lived in `cli-only-writes`, loaded by developer, reviewer and architect only (not by the tech-lead who runs `end-of-life` › `deprecate`) | the rule in the global `wingfoil-cli` 1.14 and in `AGENTS.md`'s *This repository* section; `cli-only-writes` 1.8 consistent and pointing to it; README 0.7; §11 and §14 | `49b7027`, `2ba6ec0`, this commit |
| mi-1 `dev-loop`'s header still described `bug.sync_state`, `waiting` bug states and a reject from `planned` | marked pre-packs, with what is in force (R-3); 1.7 | `49b7027` |
| mi-2 GA3-11 not in the committed plan | the coordinator commits it on the pre-step branch; n2 … n4 listed in §11 (and §12) | this commit |
| mi-3 `docs/publishing.md` stale for the approver | 0.5: `approve-release` by `workflow finalize`, never `memory approve`; the release commit and the rehearsal in `release-publishing`; `mark-released` the approver's `memory approve` after the publication; ignore the earlier Approve | `2ba6ec0` |
| nit `release-planning` build-backlog "tracks its derived task(s) automatically"; `task.set_state(backlog)` missing from the superseded tokens | both fixed (1.7) | `49b7027` |
| nit §14's last paragraph | names `release-planning`'s changed `description` | this commit |
| nit `CLAUDE.md` on W-20, W-25, W-26 | already superseded (banner), re-checked at step 4 (0.12) | `2ba6ec0` |
| nit README: "any identity, members or not" | README 0.7, `cli-only-writes` 1.8, `wingfoil-cli` 1.14, §11 | `49b7027`, this commit |

**Gates after the fixes** (on `2ba6ec0`, the tree of this commit outside this file; no code or test code
changed): `typecheck`, `lint`, `format:check` exit 0 (load 1.7 … 2.2); `test/governance`,
`test/docs` and `test/wingfoil-feedback.test.ts` 79 passed. Probes on a clone: `workflow list` exit 0,
75 warnings, 0 errors, equal to the baseline; `memory search` 122 elements, each once; `directives
list --role <r>` for every role lists `wingfoil-cli`, hence the deprecate rule, for the seven agent
roles and the approver, with no dangling binding (the only warnings: the intended
`definition-of-done` override, and "no directives assigned to role 'approver'"); no transport
command; the `.git` snapshot unchanged.
