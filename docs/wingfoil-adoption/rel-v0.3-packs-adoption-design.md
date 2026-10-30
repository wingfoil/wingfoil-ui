# Packs adoption — design (governance-alignment-rel-v0.3, step 3)

**Version:** 0.1 · **Date:** 2026-10-30 (0.1: the design of GA3-10, with the proposed `.wingfoil/`
change on `design/ga3-adoption`)

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
| `release-line-cycle.plan-next-release-line` | none — `memory submit rl-vN` (active → done), `memory add` of the next line |
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
| W-26 bug `triaged → planned`, `planned → in-progress` by hand; close note before `resolved → closed` | `triaged`, `planned` are gates, no `waiting` | both are the **approver's** `memory approve` (probe; `submit` refused); the agent no longer moves a bug at `start`; the close note stays (W-28) |

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
| `rl-v1` (`active`) | `active → done` is now `memory submit` (no `waiting`) | at the line's close |
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
