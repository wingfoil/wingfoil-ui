# Bootstrap steps — wingfoil-ui

Initialise `wingfoil-ui` as a project **governed by the WingFoil tool**, with the same structure
as the WingFoil repository (`sw-life-cycle`), except that `init` runs **before** inception.

> WingFoil 0.2.2 has no workflow engine (`workflow start/next/status/finalize` do not exist yet):
> each phase is run **by hand against its `plan` element** (as WingFoil does, `dl-019`), using
> the Memory verbs for every state change. Every command below was checked against the
> `wingfoil@0.2.2` CLI.

### CLI facts that shape every step (0.2.2)

These are also the first entries of the `wingfoil-cli` directive (step 2.3), which keeps them
current as WingFoil fixes them.

- `memory add --set name=value` only fills **tokens of the type's `id_pattern` or `path`**
  (e.g. `workflow`, `phase`, `scope` for `plan`; `kind`, `version`, `release-line` for
  `release`; `version` for `release-line`; `release` for `task`). Any other field (`sard_ref`,
  `scope` of a tech-spec, `pillar`, `features`, …) is refused by `--set`: **edit the draft file,
  then `memory submit`** — the submit commit includes the edit and checks the required fields.
- `plan` follows `draft → active → done`: `memory submit` activates it; there is **no gate**
  (`approve` is illegal) and **no verb for `active → done`**. Close a plan like WingFoil does:
  set `status: done` and commit `wf(plan): finalize <id> [active → done]`.
- `plan` requires `--set scope=<folder>` (its path is `docs/05_plans/{scope}/{id}.md`).
- `memory approve` / `reject` need `--reason`; `submit` takes none.
- `workflow list` exists; `workflow list --all` does not.
- `.wingfoil/ui.yaml` is already ignored by every loader: no upstream change is needed.

---

## 0. Prerequisites

- Node.js **22.12+**, git with `user.name` / `user.email` configured.
- npm access to install `wingfoil@0.2.2` (pinned per project — see step 1; a global install is
  only a convenience).
- This bootstrap package (`export/wingfoil-ui/`).

## 1. Create the repository and pin the CLI

```bash
mkdir wingfoil-ui && cd wingfoil-ui
git init -b main
# add LICENSE (MIT), a placeholder README, and .gitignore (node_modules/, .notes/)
npm init -y
npm install --save-dev --save-exact wingfoil@0.2.2
npm pkg set scripts.wingfoil="wingfoil"     # then: npm run -s wingfoil -- <command>
gh repo create wingfoil/wingfoil-ui --public --source . --remote origin   # optional
```

Pinning mirrors WingFoil (`wingfoil-released`, `dl-095`): the governance CLI is the one in
`package.json`, and it is also the version whose JSON output the UI consumes. In the rest of this
file `wingfoil …` means `npm run -s wingfoil -- …`.

Copy the package content:

```
docs/01_vision/01_product-brief.md
docs/00_reference/ux-reference.md
docs/00_reference/adr-draft-local-server.md
.notes/wingfoil-requests.md        # local notes, ignored by git
docs/00_reference/open-questions.md
docs/00_reference/prototype/wingfoil-ui-prototype.html
```

```bash
git add . && git commit -m "chore: bootstrap package and pinned wingfoil CLI"
```

## 2. Initialise WingFoil (before inception)

WingFoil's own `sw-life-cycle` runs `init` **after** specification, because the tool did not
exist yet. Here the tool exists: initialise first, so inception and specification are tracked
as Memory `plan` elements from day one. Record this deviation in step 4.

```bash
wingfoil init --template Kanban      # scaffolds .wingfoil/ and commits it
```

### 2.1 Memory schema and templates

Copy from `wingfoil/wingfoil@main`: `.wingfoil/memory.yaml` and `.wingfoil/memory/templates/*`
(Kanban lacks the `plan` and `service` types and ships older templates). Then:

- rewrite the WingFoil-specific header comments of `memory.yaml` (task-111, `docs/self`, …);
- adapt the templates as in the table below (fields added here are filled by editing the draft,
  since `--set` cannot write them).

| Template | Adaptation for a web dashboard |
|----------|-------------------------------|
| `plan` | add `scope: ""` (otherwise the path token is not recorded in the frontmatter); reword the `dl-095` note to `npm run -s wingfoil -- --version` = the version pinned in `package.json` |
| `task` | add `module: ""` (`server` \| `web` \| `contracts`); in *Acceptance Criteria* also point to the screen in `ux-reference.md` / the prototype; UI examples |
| `bug` | add `module`, `wingfoil_version` (CLI version of the observed project), `browser` (name + version, for `web`); add an *Evidence* section (screenshot, console/server log); *Steps to Reproduce* starts from the observed project's state |
| `release` | keep `pillar` (required by `memory.yaml` and the workflow checks) but redefine it as the primary feature area of `06_features.md`; add `wingfoil_min` (minimum WingFoil CLI the release needs); *Success Criteria* include prototype parity and the accessibility bar |
| `tech-spec` | `scope` examples: server HTTP API, CLI JSON contract (per command), `.wingfoil/ui.yaml`; add `wingfoil_version` (CLI version a contract was captured from) |
| `service` | drop the reference to WingFoil's code (`spec-007`, `src/validation/secret-scan.ts`) and to `docs(self)`; point to the `security-secrets` directive; examples: npm package `wingfoil-ui`, GitHub repository |
| `decision-log` | drop the `CLAUDE.md §5.1` reference, keep the rule (no "not yet ratified" preamble) |
| `adr`, `release-line` | UI examples only |

### 2.2 Workflows

Copy `.wingfoil/workflows.yaml` and `.wingfoil/workflows/custom/*.yaml`, delete the Kanban
leftover `workflows/custom/kanban-delivery.yaml`, and replace "WingFoil" headers/descriptions.

| Workflow | Adaptation |
|----------|------------|
| `sw-life-cycle` | move the `init` phase **before** `inception` (the order the future engine will read) |
| `e2e-smoke` | replace entirely: start the server on a temporary `wingfoil init` project, drive the browser (Playwright), accessibility scan (axe), launch smoke of the packaged app |
| `user-docs` | user guide with screenshots instead of `cli-reference.md`; drop the `CORE_MODULES` check |
| `release-planning` | `advance-pinned-build` → advance the supported WingFoil version, re-run the CLI contract tests and **re-check the `wingfoil-cli` directive** (drop fixed entries, bump its version); drop `check:lockfile` / `check:mcp` |
| `dev-loop`, `release-submit` | add component, browser e2e and accessibility checks; keep lint/coverage; TypeDoc only for `server`/`contracts` |
| `release-publishing` | packaging per the inception decision (open question 1); drop Verdaccio/OIDC/`adr-011`/`dl-087` specifics |
| `e2e-smoke`, `service-ingest`, `initial-design`, `release-planning` | remove checks bound to WingFoil elements (`spec-005`, `spec-007`, `spec-review.passed` from `dl-022`) or re-create the element they rely on |

Known inconsistencies of the WingFoil originals to fix while copying: `initial-design/seed-releases`
does not check `kind`; `release-submit` selects bugs by tags (bugs carry `release:`);
`retrospective` produces `retro-{version}`, which is not a `dl-{n}-{slug}` id.

### 2.3 Directives and roles

`init` already provides generic directives (`built-in/`: architecture, code-quality, code-review,
documentation, security, testing; `custom/`: determinism, doc-versioning, security-secrets,
traceability). **Keep them**; WingFoil's copies are rewritten for WingFoil (TSDoc, Jest, dl-xxx).

- do **not** copy `command-baseline` (WingFoil-only);
- copy and rewrite `claim-evidence` (a claim names the test or command that proves it:
  unit, contract, Playwright);
- add `wingfoil-cli` (`wingfoil directive create --name wingfoil-cli`, then write its content —
  now at `.wingfoil/directives/custom/wingfoil-cli.md`) and bind it
  **globally**: it lists the wrong or surprising behaviours of the pinned CLI (W-01…W-12) and how
  to work with each; entries are removed when WingFoil fixes them (see 2.2, `release-planning`);
- remove the `scope:` frontmatter field from any directive copied from WingFoil (W-12);
- add web-dashboard directives with `wingfoil directive create --name <name>`:
  `cli-only-writes` (every change goes through the CLI; git is read-only; never write
  `.wingfoil/` or Memory files), `accessibility` (WCAG 2.1 AA, keyboard, axe clean),
  `ux-consistency` (`ux-reference.md` and the prototype are the reference);
- bind them with `wingfoil directive assign` — e.g. developer: `cli-only-writes, accessibility`;
  reviewer: `cli-only-writes, accessibility, ux-consistency`; qa: `accessibility`;
  architect: `cli-only-writes`; global: `claim-evidence`, `wingfoil-cli` (edit `roles.yaml`:
  `directive assign` binds to one role).

A binding to a missing directive file is only a warning in `directives list`: check it is empty.

### 2.4 DNA

```bash
wingfoil dna set project.name --value "WingFoil UI"
wingfoil dna set project.description --value "Local web UI for WingFoil-governed projects, served by a local server that drives the wingfoil CLI."
wingfoil dna set project.methodology --value custom
wingfoil dna set project.license --value MIT
wingfoil dna set project.repository --value wingfoil-ui

wingfoil dna add team.roles --value facilitator --entry-description "Drives discovery/inception sessions (Lean Inception)."
wingfoil dna add team.members --value "<Your Name>" --entry-email <you@example.com> \
  --entry-roles tech-lead,architect,developer,reviewer,product-owner,approver,facilitator,qa
wingfoil dna add team.agents --value "AI agent (Claude/Cursor/etc.)" \
  --entry-executes_as developer,reviewer,qa,architect --entry-approval_authority false
```

The Kanban template has no `facilitator` role: without the first `team.roles` line the member
is refused (`E_VALIDATION … undefined role "facilitator"`).

Modules, stacks and paths (placeholders until `initial-design` confirms them):

| DNA section | Initial value |
|-------------|---------------|
| `modules` (`--entry-description`, `--entry-path`) | `server` (local HTTP server + CLI adapter, `server/`), `web` (browser UI, `web/`), `contracts` (JSON schemas of the consumed CLI output, `contracts/`) |
| `stacks.technologies` (`--entry-category`, `--entry-version`) | TypeScript, Node.js 22.12+, npm, WingFoil CLI 0.2.2, git, test runner, Playwright, axe-core; frontend framework and bundler added by `initial-design` |
| `stacks.methodologies` (`--entry-phase`) | remove Kanban/BDD/TDD (no phase), add Lean Inception/inception, User Story Mapping/specification, Specification by Example (BDD)/specification, SARD/specification, TDD/delivery |
| `paths` | `sources: server/ web/ contracts/` · `tests: test/` · `docs: docs/` · `config: package.json tsconfig.json` (remove `.wingfoil`) · `governance: .wingfoil/` |

### 2.5 Agent access and sanity check

```bash
cat > .mcp.json <<'EOF'
{ "mcpServers": { "wingfoil": { "command": "node", "args": ["node_modules/wingfoil/dist/cli.js", "mcp"] } } }
EOF
git add . && git commit -m "chore(wingfoil): align configuration with the WingFoil repository"
wingfoil dna show && wingfoil workflow list && wingfoil directives list   # no warnings
```

`.wingfoil/ui.yaml` is added when the UI implements it (its tech-spec is seeded in step 7); the
draft stays in `docs/00_reference/ux-reference.md` §6.

## 3. Requests to WingFoil (in parallel)

The requests are tracked in the **local, git-ignored** notes `.notes/wingfoil-requests.md`
(they are working notes, not project history, so versioned documents never cite their ids).
The ones needed before v1.0 go **against the WingFoil element that already covers them** (extend
or comment it, do not duplicate); the others become new elements after WingFoil v1.0. The notes
also collect the `wingfoil-cli` directive entries that are WingFoil defects.

In the **wingfoil** repository a new request follows its ingest main (`decision-log-ingest`):

```bash
npm run -s wingfoil -- memory add --type decision-log --title "<title>"
# fill the body, then:
npm run -s wingfoil -- memory submit <dl-id>      # draft → in-discussion; approval is the approver's gate
```

## 4. Record the bootstrap decision

```bash
wingfoil memory add --type decision-log --title "Initialise WingFoil before inception"
# body: tool available; inception/specification tracked as plans; sw-life-cycle's init phase moved first
wingfoil memory submit dl-001-initialise-wingfoil-before-inception
wingfoil memory approve dl-001-initialise-wingfoil-before-inception --reason "Bootstrap order agreed."
```

Pre-release phases use the plan scope `sw-life-cycle` (WingFoil has no convention for them: it
used ad-hoc `X_*-plan.md` files).

## 5. Phase `inception` → `lean-inception`

```bash
wingfoil memory add --type plan --title "Lean inception" \
  --set workflow=lean-inception --set phase=inception --set scope=sw-life-cycle
# → docs/05_plans/sw-life-cycle/lean-inception-inception-plan.md; fill Context/Steps/Handoff, then:
wingfoil memory submit lean-inception-inception-plan         # draft → active
```

Run the workshop (human + agent) with **input** `docs/01_vision/01_product-brief.md` and
**evidence** `docs/00_reference/*`. Produce, mirroring WingFoil:

```
docs/01_vision/00_index.md            02_product-vision.md   03_is-isnot.md
04_personas.md  05_journeys.md        06_features.md         07_sequencer.md
08_mvp-canvas.md  X_coherence-audit.md
```

The plan element replaces WingFoil's `X_lean-inception-plan.md`. Resolve `open-questions.md`
along the way. **Stop-check:** coherence audit passed (an addition of ours: WingFoil's
`lean-inception` declares no checks). Then finalize the plan:

```bash
sed -i 's/^status: active/status: done/' docs/05_plans/sw-life-cycle/lean-inception-inception-plan.md
git commit -am "wf(plan): finalize lean-inception-inception-plan [active → done]"
```

## 6. Phase `specification` → `specification-downcast`

```bash
wingfoil memory add --type plan --title "Specification downcast" \
  --set workflow=specification-downcast --set phase=specification --set scope=sw-life-cycle
wingfoil memory submit specification-downcast-specification-plan
```

| Module | Output | Stop-check |
|--------|--------|------------|
| user-story-mapping | `docs/02_requirements/01_user_story_map/` | 100 % of MVP Canvas features covered; edge-case stories present |
| specification-by-examples | `docs/02_requirements/02_bdd/features/**/*.feature` | ≥ 1 nominal + ≥ 1 error/edge per story; scenarios atomic, testable, no ambiguous adjectives/adverbs |
| volere-requirements | `docs/02_requirements/03_sard/` | every `REQ-*` has a numeric/percentage/boolean fit criterion |
| backlog-export | `docs/03_backlog/04_backlog/backlog.json` + `schema.json` + `by-release/` | valid JSON, no duplicate ids, no cycles |

Make sure the SARD covers: CLI contract (JSON schemas, pinned version), latency of
Today/gate actions, cache invalidation on git HEAD, identity from git, no direct writes,
accessibility (WCAG 2.1 AA), supported browsers. Finalize the plan as in step 5.

## 7. Release line and initial design

```bash
wingfoil memory add --type release-line --title "WingFoil UI v1" --set version=v1
# fill Scope / Success Criteria, then:
wingfoil memory submit rl-v1                                   # draft → planning
wingfoil memory approve rl-v1 --reason "First release line."   # planning → active
wingfoil memory add --type plan --title "Initial design — rl-v1" \
  --set workflow=initial-design --set phase=rl-v1 --set scope=rl-v1
wingfoil memory submit initial-design-rl-v1-plan
```

`initial-design` for `rl-v1`:

- seed the releases from `07_sequencer.md`, e.g.
  `wingfoil memory add --type release --title "WingFoil UI v0.1 — …" --set kind=minor --set version=v0.1 --set release-line=v1`
  → `minor-v0.1`; fill `pillar`, `features`, `requirements`, `wingfoil_min` in the file;
- record **`adr-001` — Local server driving the WingFoil CLI** from `adr-draft-local-server.md`:
  `memory add --type adr --title "…"`, fill `sard_ref` in the file, `submit`, `approve --reason`;
- tech-specs (`memory add --type tech-spec`, fill `scope` in the file): server API, CLI JSON
  contracts consumed, `ui.yaml` schema.

The release waves are **decided by the sequencer** (`07_sequencer.md`). A starting hypothesis
for the workshop:

| Release | Focus | Needs WingFoil |
|---------|-------|----------------|
| v0.1 | Server + CLI adapter; read-only Today, Memory, DNA, Directives, Team, Docs, Files | 0.2.2 |
| v0.2 | Gate actions (all options, reason), project list | 0.2.2 |
| v0.3 | Workflow views, next step, ingestion start, agent launch | 0.3 (`workflow start/next/status`, `agent execute`) |
| v0.4 | Traceability, Timeline, `ui.yaml` configuration, permissions (UI-side), element editing | element editing needs a field-editing verb (task-127 / task-163) |
| v1.0 | Polish, packaging | 1.0 |

## 8. Delivery

For each release: `release-cycle` (release-planning → dev-loop → user-docs → e2e-smoke →
release-submit → release-publishing → retrospective), with the adaptations of step 2.2; each
phase gets its plan (`--set scope=rl-v1/rel-vX.Y`, `--set phase=rel-vX.Y`).
