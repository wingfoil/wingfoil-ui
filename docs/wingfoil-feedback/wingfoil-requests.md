# Requests to WingFoil core — local notes

> **Local working notes, not versioned** (`.notes/` is in `.gitignore`). They track what to ask
> the WingFoil project until each item is captured there as a Memory element; from then on the
> WingFoil element is the reference. Keep in sync with the `wingfoil-cli` directive: a `W-xx`
> entry that is a WingFoil defect or gap gets a request here; once WingFoil captures it, the
> **WingFoil element id** (never an R-id: these notes are not versioned) goes in the directive's
> *Fixed upstream by* column.

Needs discovered while designing WingFoil UI that belong to **WingFoil**, not to the UI.
Each is captured in the WingFoil project through its ingestion workflows
(`decision-log-ingest`, `adr-ingest`, `bug-ingest`) — or, where WingFoil already has an element
on the subject, **as an extension of that element**, not as a duplicate.

`.wingfoil/ui.yaml` is **owned by the UI** and needs nothing from WingFoil: every 0.2.2 loader
reads only the files it names, so an extra file in `.wingfoil/` is already ignored (checked on
`dna`, `memory`, `directives`, `paths`, `workflow list`, `mcp`).

## Priority

| # | Request | When | Why | Existing WingFoil element | Action |
|---|---------|------|-----|---------------------------|--------|
| R-01 | Stable, documented JSON output for every command the UI calls | **Before v1.0** | The UI server consumes it as an API; needs a schema and a stability promise | `spec-005-cli-command-contract` (approved), task-013 (done), task-130, task-156 | Extend spec-005 |
| R-02 | JSON output of the 0.3 workflow engine (`status`, `next`, `show`) includes gates, role required, iterated elements | **Before v1.0** (0.3 scope) | Feeds Today, next step and progress | `spec-017-workflow-commands-and-state-deduction` (approved), tasks 204, 216, 217, 225, 226, 239 | Review spec-017 against the fields below |
| R-03 | A verb to update Memory element fields | **Before v1.0** | Editing title/summary/references from the UI without hand-editing files | `dl-108-amending-an-approved-element` (ready), task-127 (`memory amend`), task-163 (shared frontmatter setter) | Comment on task-127 / task-163 |
| R-04 | `--dry-run` on state verbs returning the checks that would run | Before v1.0 (nice to have) | Show why a submit would fail before trying | task-210 (`--dry-run` on every mutating verb) | Covered — follow task-210 |
| R-05 | Core settings file (auto-push, signed commits, no self-approval, check strictness, default agent, launch confirmation) | After v1.0 | Configuration page | — | New decision-log |
| R-06 | `paths.artifacts` category in DNA, with placeholders and URL entries linked to `service` elements | After v1.0 | Artifacts view; until then the UI keeps artifact paths in `ui.yaml` | — | New decision-log |
| R-07 | Notification channels for pending gates | After v1.0 | External channels; the UI shows in-app notifications meanwhile | `spec-017` §5.3 (v0.3: CLI output only; git-hook notifications moved to v0.4) | Extend spec-017 §5.3 |
| R-08 | CLI verbs to edit workflows (add/rename/reorder phases) with in-flight protection | After v1.0 | Workflow editing from the UI (journey 6) | — | New decision-log |
| R-09 | Action permissions (who may edit settings, DNA, workflows, directives, team, element content; start ingestion; launch agents; push; apply UI presets) | After v1.0 | Configuration › Permissions (UI feature L6). **The UI implements no permissions until WingFoil does** (decided 2026-10-02, specification session 3: C3 dropped, nothing stored in `ui.yaml`) | — | New decision-log |
| R-10 | `init` templates (Kanban, Scrum): the `bug-ingest`, `decision-log-ingest` and `adr-ingest` workflows have one phase `capture` with no actions | Before v1.0 (nice to have) | A UI (or the 0.3 engine) cannot tell what an ingestion creates; WingFoil UI derives an ingestion from a first phase running `memory.add`, so Kanban/Scrum projects show no ingestion (found by the specification coherence audit, 2026-10-02) | — | Bug or decision-log against the templates |
| R-11 | Read verbs for what 0.2.2 does not expose: type definitions (`memory.yaml` resolved: states, gates, waiting, required fields, id patterns), one element's full content (`memory show <id>`: frontmatter + body), directive bodies (`directives show <id>`) — all with `--format json` | **Before v1.0** | WingFoil UI reads these files directly, read-only, from an allow-list until the verbs exist (SARD REQ-ARC-04 v0.4, adr-001 D1a); found in initial-design session 5, 2026-10-02 | `spec-005` (CLI command contract) — MCP already has `memory.show` | Extend spec-005 (or new decision-log) |
| R-12 | `memory add` honours the type's first state (`sequence[0]`) instead of always writing `draft` | Before v1.0 | Types whose sequence does not start with `draft` cannot be created by the CLI (W-21, found building the `unknown` e2e fixture, dev-loop task-001, 2026-10-05) | — | Bug against `memory add` |

---

## R-01 · CLI JSON output as a contract
**Extends:** spec-005 · **Proposed:** every command's `--format json` output has a published
schema; breaking changes only in minor releases, listed in the changelog.

## R-02 · Workflow engine JSON for UIs
**Extends:** spec-017 (0.3) · **Proposed fields:** open mains, current phase path, per-element
state, pending gates with `role`, next executable step with role/directives/context.

## R-03 · Editing element fields
**Extends:** task-127 / task-163 · **Proposed:** a verb that sets frontmatter fields and replaces
the body from a file; commit `docs(<type>): edit <id>`; refused on types/states where content is
frozen (dl-108 covers approved elements through `memory amend`). In 0.2.2 `memory add --set`
only fills `id_pattern`/`path` tokens, so every other field is a hand edit.

## R-04 · Dry-run on state verbs
**Covered by:** task-210 · **UI need:** the dry-run lists the transition and the P4.12 checks
with pass/fail, no commit.

## R-05 · Core settings
**Type:** decision-log · **Proposed keys:** `git.autoPush`, `git.runBranch`,
`git.signCommits`, `approve.reasonRequired`, `approve.noSelf`, `workflow.checks`
(`block|warn`), `agent.default`, `agent.launch` (`confirm|auto`), `notify.channel`.

## R-06 · Artifact paths
**Type:** decision-log · **Proposed:** `paths.artifacts` entries `{ glob, phase }`,
placeholders `{release}` `{version}`; entries starting with `http(s)://` are URLs, linked
to the `service` element with the same host.

## R-07 · Notification channels
**Extends:** spec-017 §5.3 · **Proposed:** external channels for pending gates, beyond the CLI
output of `workflow status`/`next`.

## R-08 · Workflow editing verbs
**Type:** decision-log · **Proposed:** `workflow phase add|rename|move|remove`; phases
completed or in progress cannot be removed; changes apply to new runs only.

## R-09 · Action permissions
**Type:** decision-log · **Proposed:** a `permissions` section in the core settings mapping
each action key (`cfg.wingfoil`, `cfg.ui`, `cfg.perms`, `edit.dna`, `edit.workflow`,
`edit.directives`, `edit.artifacts`, `edit.team`, `mem.ingest`, `mem.edit`, `agent.launch`,
`git.push`, `files.edit`) to `{ roles: [...] | ['*'], people: [...] }`; the CLI refuses
forbidden actions like it refuses approvals without the approver role. Gate approvals stay
governed by `memory.yaml`. **UI need:** a read verb (e.g. `permissions list --format json`, or the
rules in the `dna`/settings output) so the UI can show the table and dim forbidden actions, and a
refusal error that names who may act. Until WingFoil implements it the UI has **no**
permissions of its own (decided 2026-10-02): every team member may run what the CLI allows; the
UI's `ui.yaml` presets are applied by any team member (the `cfg.ui` action key would move under this rule).

---

## Candidates from the `wingfoil-cli` directive

Behaviours found while bootstrapping (W-xx = entry in `.wingfoil/directives/custom/wingfoil-cli.md`)
that may be WingFoil defects or gaps. Check for an existing WingFoil element before ingesting;
when one is captured, give it an R-id above and write the WingFoil element id in the directive's *Fixed upstream by*.

| W | Candidate | Likely type | Existing element |
|---|-----------|-------------|------------------|
| W-01 | `--set` cannot write non-token frontmatter fields | — | R-03 (task-163, task-127) |
| W-03 | `plan` template has no `scope:` field, so the path token is not recorded in the element | bug | — |
| W-04 | No verb for `plan` `active → done`; WingFoil finalizes by hand | — | task-226 |
| W-07 | `release` path folder is `planning/{release-line}` = `planning/v1/`, while WingFoil's own releases sit in `planning/rl-v1/` | bug | — |
| W-08 | Kanban template declares no `facilitator` role, which WingFoil's `lean-inception` requires: copying WingFoil's workflows onto a Kanban init leaves a role gap | decision-log | — |
| W-09 | Dangling `roles.yaml` binding is only a warning | decision-log | — |
| W-12 | WingFoil's own directives carry a `scope:` field its 0.2.2 schema reports as unknown | bug | — |
| W-13 | No per-gate role: approve/reject always need `approver` (a reviewer cannot reject a task in review; a product owner cannot decide a decision-log) | decision-log | check spec-017 / workflow `approval: { by_role }` |
| — | Ingestion from a client needs every required field settable by the CLI (`memory add --set` fills only id/path tokens): bug, adr, tech-spec, service ingestion are impossible without editing the draft | — | R-03 (task-127 `memory amend`, task-163 setter) — add the ingestion use case |
| — | `memory search` reads the working tree while writes gate on HEAD, and `submit` commits the target's uncommitted edits: a client cannot tell committed from local state without git | decision-log | check dl-084 (baseline of read-only verbs) |

## R-10 · Ingestion workflows in the `init` templates
**Type:** bug / decision-log · **Observed (0.2.2):** `storage/templates.js` writes
`mainWorkflowYaml('bug-ingest', …, 'phases:\n  - name: capture\n')` (same for decision-log and
adr) — no `actions`, no `produces`. **Proposed:** give each template ingestion the same shape as
WingFoil's own (`capture`: `memory.add(type: X)` + `memory.submit`; `triage`/`approve` with
`approval: { by_role: approver }`), so a client can read what each ingestion creates.

## R-11 · Read verbs for type definitions, element content, directive bodies
**Extends:** spec-005 · **Proposed:** `memory types` (or `memory schema`), `memory show <id>`,
`directives show <id>`, each with `--format json` and a published schema. The MCP server already
reads element content (`memory.show`); the CLI should expose the same for non-MCP clients.
