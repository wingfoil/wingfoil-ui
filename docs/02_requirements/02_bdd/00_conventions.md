# BDD Scenarios — Conventions

**Version:** 0.4
**Date:** 2026-10-02 (0.2: v0.3–v1.0 conventions — session 3; 0.3: coherence audit fixes — session 6; 0.4: US-X-10 page title — initial-design session 2)
**Status:** Draft — specification-downcast sessions 2–3 (`specification-by-examples`)
**Input:** `../01_user_story_map/02_story-map.md` · `03_mvp-cut.md` · `docs/01_vision/` ·
directives `wingfoil-cli` (v1.1), `cli-only-writes` (v1.3), `accessibility`

The scenarios turn each MVP story into examples in Gherkin (Given–When–Then). They are the
acceptance criteria of the backlog records (`backlog-export`) and the source of the e2e suite
(`e2e-smoke`, Playwright). This file fixes the vocabulary every `.feature` file relies on.

---

## Layout and tags

- `features/<area>/<topic>.feature`, one folder per feature area (`s`, `t`, `g`, `m`, `r`, `c`,
  `y`, `x`; `a` arrives with v0.4).
- Every scenario carries:
  - the story tag `@US-<area>-<nn>` (one story per scenario);
  - the release tag `@v0.1` … `@v1.0` (the story's release);
  - the kind tag `@nominal` or `@edge` — every story has ≥ 1 of each. For a story that is itself
    an edge case, `@nominal` is the story's main protective behaviour and `@edge` a variant of it;
  - the fixture tag `@fx-kanban`, `@fx-custom`, `@fx-unknown` or `@fx-any` (runs on each of the
    three).
- Scenario titles start with the scenario id `<area>-<nn>.<k>` (e.g. `S-03.1`): the SARD and the
  backlog cite scenarios by this id.

## Fixtures

Each fixture is a throwaway git repository built by the e2e suite with the **pinned** CLI
(`e2e-smoke`, phase `fixture-project`), with a bare remote next to it unless a scenario says
otherwise. The builder sets `dna.project.name` to the fixture's name (`kanban`, `custom`,
`unknown`). Element ids are the CLI's: numeric tokens are zero-padded to 3 digits
(`task-001-login-form`); the `unknown` fixture's id patterns are `story-{n}-{slug}` and
`note-{n}-{slug}`.

**Variants:** *the custom fixture with the sw-life-cycle preset* (below); *the kanban fixture's
timeline variant* — after `wingfoil init` and the standard team, the Memory history is only the
commits listed in `features/r/timeline.feature` (the standard elements are replaced); *the CLI
stub* — the project's `node_modules/.bin/wingfoil` is a wrapper that delegates to the pinned CLI
except for the commands a scenario makes fail (its exit status and message are set by the
scenario).

**Test clock and paths:** times and dates in scenarios come from the e2e suite's controlled clock;
the default working directory for a cloned remote is `~/projects/<repository name>`.

| Tag | Project | Memory schema | `ui.yaml` |
|-----|---------|---------------|-----------|
| `@fx-kanban` | `wingfoil init --template Kanban` | every type uses the default states `draft → pending → approved`, gate `pending` (reject → `draft`) | none |
| `@fx-custom` | this repository's `.wingfoil/` (`memory.yaml`, `workflows.yaml`, directives, `roles.yaml`, DNA with the team replaced by the standard team) and `docs/01_vision/`; Memory elements created by the builder | WingFoil-style types: `task` (`… in-review …`), `bug`, `decision-log` (`draft → in-discussion → ready`), `plan`, … | none (presets arrive in v0.3) |
| `@fx-unknown` | hand-written `.wingfoil/memory.yaml` | one type `story`, states `idea → shaping → ready-to-build → shipped`, gate `shaping` (reject → `idea`), `waiting: [ready-to-build]`; one type `note`, states `open → archived`, no gate | none |

**Standard team** (`dna.team.members`, same in every fixture unless a scenario overrides it):

| Member | Email | Roles |
|--------|-------|-------|
| Morgan | `morgan@example.test` | approver, tech-lead |
| Casey | `casey@example.test` | product-owner |
| Jordan | `jordan@example.test` | developer |
| Sam | `sam@example.test` | reviewer |
| Alex | `alex@example.test` | tech-lead, architect, developer, reviewer, product-owner, approver, qa |

Riley (`riley@example.test`) is **not** in the team. `dna.team.agents` declares one agent,
"Build agent", executing as developer, `approval_authority: false`. Rule 6 of the sequencer: a
scenario about a gate states explicitly whether Sam or Casey also holds `approver` (step
*"the DNA gives Sam the roles reviewer, approver"*).

**Standard elements** (created through the CLI, so every transition is a `wf(…)` commit):

| Fixture | Element | State | History |
|---------|---------|-------|---------|
| kanban | `task-001-login-form` | `pending` | submitted by Jordan |
| kanban | `task-002-password-reset` | `draft` | submitted by Jordan, rejected by Morgan with reason "Missing acceptance criteria" |
| kanban | `task-003-logout` | `approved` | approved by Morgan |
| kanban | `task-004-session-timeout` | `draft` | created by Jordan, never submitted |
| kanban | `bug-001-crash-on-save` | `pending` | submitted by Sam |
| custom | `task-001-cli-adapter` | `in-review` | submitted by Jordan |
| custom | `dl-001-initialise-wingfoil-before-inception` | `ready` | approved by Morgan |
| custom | `dl-002-use-fastify` | `in-discussion` | submitted by Casey |
| custom | `bug-001-toast-overlap` | `open` | submitted by Sam |
| custom | `adr-001-local-server` | `draft` | created by Alex, required field `sard_ref` left empty (`memory add` cannot set it, W-01) |
| custom | `minor-v0.1` (release) | `planning` | submitted by Alex (engine-waiting state) |
| unknown | `story-001-onboarding` | `shaping` | submitted by Jordan |
| unknown | `story-002-billing` | `ready-to-build` | approved by Morgan |
| unknown | `note-001-kickoff` | `open` | created by Casey |
| unknown | `note-002-retro` | `on-hold` | status written by hand and committed — a state not declared for `note` |

**Progress elements** (custom fixture, from session 3 — used by the v0.3+ scenarios). Written by
the fixture builder as files and committed with `wf(…)`-formatted messages where 0.2.2 has no verb
for the transition (states after a `waiting:` state):

| Element | State | Fields |
|---------|-------|--------|
| `minor-v0.1` (release) | `planning` | `features: [S1, M1]` |
| `task-001-cli-adapter` | `in-review` | `release: v0.1`, `ref: US-S-01` |
| `task-002-memory-list` | `done` | `release: v0.1`, `ref: US-M-01` |
| `task-003-element-panel` | `backlog` | `release: v0.1`, `ref: US-M-01` |
| `task-004-themes` | `backlog` | `release: v0.1`, no `ref` |

**Preset variant** — *"the custom fixture with the sw-life-cycle preset"* is the custom fixture
after the commit `chore(ui): apply the WingFoil sw-life-cycle preset`, which writes
`.wingfoil/ui.yaml` as in `ux-reference.md` §6 but with `progress.scope: { type: release }` (the
type only, no id — session 3) and `taxonomy.patterns` matching `^(REQ|US)-` as `requirement`. The **current** element of the scope type is derived:
with WingFoil 0.3, the one `workflow status` reports; before it, among the elements of that type
not in the first or last state of their `sequence`, the one in the most advanced state (ties: the
lowest version) — on the custom fixture `minor-v0.1`; none → "No current release" and
whole-project figures. With it, the custom fixture's figures are: reference `US-M-01` 1/2 done (50 %), `US-S-01` 0/1 (0 %), project
completion 25 %, iterated tasks 1/4, open bugs 1, pending gates 3 (`task-001-cli-adapter`,
`dl-002-use-fastify`, `bug-001-toast-overlap`), reference coverage 3/5 (project-wide:
`task-004-themes` and `adr-001-local-server` lack a requirement — the preset's `requires` covers
`task`, `adr` and `tech-spec`).

## Identity and roles in steps

- *"I am <Member>"* means the fixture's `git config user.email` is that member's email, and the
  role view is the member's first role unless a step selects another.
- The **action descriptor** (S9) decides who an item requires. The scenarios assume its 0.2.2
  rules: every gate (approve/reject) requires `approver` (W-13); an element in the first state of
  its `sequence` requires the member who created it — when its last transition was a reject, the
  member who submitted it, listed first with the reason; a `waiting:` state requires the workflow
  engine (no member); the last state of `sequence` requires no one; a state not declared for the
  type requires the `tech-lead` role and is shown as **"Action required"**. A state that is both a
  gate and a `waiting:` state (custom `bug` `triaged`) is advanced by the workflow engine: it is not
  a pending gate and is not in *Requires you*, and members holding `approver` see only its reject
  outcome in the gate footer, with "Waiting for the workflow engine to advance". For members holding
  `approver`, *Requires you* lists the gate states in both the `reviewer` and the `approver` role
  views (action *Review* in the reviewer view, *Approve* in the approver view); members without
  `approver` see the gate states only in *Waiting on others*, "reserved to approver". The exact
  derivation is a tech-spec of `initial-design`.
- **Inferred taxonomy** (no `ui.yaml`): a type whose name is `task`, `bug`, `adr`, `decision-log`,
  `tech-spec`, `release`, `release-line` or `service` gets the category `work`, `defect`,
  `decision`, `decision`, `spec`, `release`, `release` or `external`; any other type has none.
- **Workflows:** an *ingestion* workflow is a `kind: main` workflow whose first phase runs
  `memory.add`; the *main workflow* is the first `kind: main` workflow included in
  `workflows.yaml` that is not an ingestion (both fixtures: `sw-life-cycle`). An ingestion is
  offered only when every required field of its type is set by the CLI (on 0.2.2: `title` and
  id/path tokens): on the custom fixture only `decision-log-ingest`. The Kanban template's
  `bug-ingest`, `decision-log-ingest` and `adr-ingest` have one phase with no action, so they are
  not ingestions and the kanban fixture offers none (hidden: not applicable). An ingestion's
  *open runs* on 0.2.2 are the elements of its type not in the last state of their `sequence` nor
  in a reject target with no way out.
- **Permissions:** the UI keeps none (they are WingFoil's, L6, and are not stored in `ui.yaml`):
  every team member may run every action the CLI allows; users not in the team, or with no or an
  ambiguous identity, are read-only (S4).
- **WingFoil 0.3 verbs** (v0.4 scenarios): `workflow start/next/status` and `agent execute`, as
  named in the Vision Package. Their exact options and output are confirmed against WingFoil 0.3
  by v0.4's `release-planning`; the scenarios describe the UI behaviour, not the CLI syntax.
- Commit dates of the standard elements are set by the fixture builder: every element's last
  transition is 3 days before the test date, unless a scenario says otherwise.

## Writing rules (stop-check)

- **Atomic:** one behaviour per scenario, one `When`.
- **Testable:** every `Then` is observable in the browser, in the fixture's git history or on the
  server's HTTP responses.
- **No ambiguous adjectives or adverbs:** no "quickly", "clearly", "user-friendly", "recent",
  "appropriate". Counts, names, states, texts and time limits are concrete.
- **UI texts** in quotes are the English strings of the MVP (X2). Their final wording may change
  in delivery only together with the scenario.
- **Time limits** written in scenarios (e.g. "within 5 seconds") are the values proposed for the
  SARD (session 4); the SARD is the authority and the scenarios follow it.
- **Release tags:** a scenario carries its story's release, or a later one when it needs a screen
  of that release (e.g. S-08.3 needs a UI release that knows WingFoil 0.3 capabilities); it then
  runs from that release. Every story has ≥ 1 nominal and ≥ 1 edge scenario tagged with its own
  release.
- **Commits** are written as the CLI writes them: `wf(<type>): add <id>` and `wf(<type>): submit
  <id>` carry no transition; `wf(<type>): approve|reject <id> [<from> → <to>]` do. A submit's
  `from → to` is read from the element file's `status` before and after the commit.

## Coverage

Checked by `../X_checks/check_bdd.py <releases>` (tags, ids, one `When`, ambiguous words, ≥ 1
nominal and ≥ 1 edge scenario per story of the releases in scope).

| Session | Releases | Stories | Scenarios | Nominal | Edge |
|---------|----------|---------|-----------|---------|------|
| 2 | v0.1, v0.2 | 72 | 189 | 77 | 112 |
| 3 | v0.3, v0.4, v1.0 | 38 | 103 | 39 | 64 |
| 6 (audit) | v0.2 | — | +2 (G-06.4, S-24.4) | 0 | +2 |
| initial-design 2 | v0.1 (+ v0.3, v0.4 variants) | +1 (US-X-10) | +5 (X-10.1 … X-10.5) | +1 | +4 |
| **Total** | v0.1 → v1.0 | **111** | **299** | **117** | **182** |
