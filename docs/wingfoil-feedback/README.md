# WingFoil feedback inbox

Notes about WingFoil — defects, gaps and requests — found while working in this repository. WingFoil
reads this inbox at its retrospective and answers in its own repository (WingFoil dl-163); this
repository pulls the answer at its own sync.

## Rules

- One file per note, `F-<nnn>-<slug>.md`, never deleted and never renumbered; the format is WingFoil
  dl-163 R4: the frontmatter fields `id`, `title`, `kind` (`defect | gap | request`), `status`
  (`open | needs-info | captured | resolved | declined | duplicate`), `wingfoil_version` and
  `answered_by`, and a body stating what was observed and what was expected, reproducible with
  WingFoil alone (command, output, version).
- This repository writes `open`; `answered_by` and every other status are set only by the sync, from
  what WingFoil published.
- How notes are written, when the sync runs and what WingFoil cites are the rules of the
  `wingfoil-cli` directive (`.wingfoil/directives/custom/wingfoil-cli.md`).
- If WingFoil's `COLLABORATION.md` refines the format, the next sync follows it.

**Source key:** `svc-019` — WingFoil service
`svc-019-github-repository-wingfoil-ui-a-private-consumer-project-and-its-feedback-inbox`, registered
as a feedback source by WingFoil task-269, active since WingFoil `30b268a3`. WingFoil cites a note in
`reported_by:` as `<service id>/F-<nnn>@<sha>` — the full service id and the full sha of the commit
read (WingFoil `COLLABORATION.md` `## Credit`), e.g.
`svc-019-github-repository-wingfoil-ui-a-private-consumer-project-and-its-feedback-inbox/F-001@<full sha>`;
`svc-019` is the short key.

**Last sync:** none.

## Ledger

| Note | Title | Kind | Status | Answered by |
|---|---|---|---|---|
| [F-001](F-001-cli-json-output-as-a-contract.md) | Stable, documented JSON output for every command a client calls | request | open | |
| [F-002](F-002-workflow-engine-json-for-uis.md) | JSON output of the workflow engine (status, next, show) with gates, required role and iterated elements | request | open | |
| [F-003](F-003-no-verb-edits-element-fields.md) | No verb updates a Memory element's fields, so required fields cannot be set from the CLI | gap | open | |
| [F-004](F-004-no-dry-run-on-state-verbs.md) | No --dry-run on state verbs to show the checks that would run | gap | open | |
| [F-005](F-005-no-core-settings-file.md) | No core settings file (auto-push, signed commits, no self-approval, check strictness, default agent) | request | open | |
| [F-006](F-006-no-artifacts-path-category.md) | No paths.artifacts category in the DNA, with placeholders and URL entries linked to services | request | open | |
| [F-007](F-007-no-notification-channels-for-gates.md) | No notification channels for pending gates | request | open | |
| [F-008](F-008-no-verbs-edit-workflows.md) | No CLI verbs to edit workflows (add, rename, reorder phases) with in-flight protection | request | open | |
| [F-009](F-009-no-action-permissions.md) | No action permissions: who may change settings, DNA, workflows, directives, team and content | request | open | |
| [F-010](F-010-init-ingestion-workflows-have-no-actions.md) | init templates (Kanban, Scrum) write ingestion workflows with one phase and no actions | defect | open | |
| [F-011](F-011-no-read-verbs-for-types-elements-directives.md) | No read verbs for type definitions, one element's full content and directive bodies | gap | open | |
| [F-012](F-012-memory-add-always-writes-draft.md) | memory add always writes status: draft instead of the type's first state | defect | open | |
| [F-013](F-013-plan-scope-token-not-recorded.md) | A plan's scope path token is not recorded in the element, because the plan template has no scope field | defect | open | |
| [F-014](F-014-release-folder-disagrees-with-release-line-id.md) | A release's folder is named after the release-line field (v1), not the release-line id (rl-v1) | defect | open | |
| [F-015](F-015-kanban-template-has-no-facilitator-role.md) | The Kanban template declares no facilitator role, which WingFoil's lean-inception requires | gap | open | |
| [F-016](F-016-dangling-directive-binding-only-a-role-warning.md) | A roles.yaml binding to a missing directive is only a warning, and only when listing that role | gap | open | |
| [F-017](F-017-wingfoil-directives-carry-unknown-scope-field.md) | WingFoil's own directives carry a scope field that 0.2.2 reports as unknown | defect | open | |
| [F-018](F-018-no-per-gate-role.md) | No per-gate role: approve and reject always need the approver role | gap | open | |
| [F-019](F-019-search-reads-working-tree-while-writes-gate-on-head.md) | memory search reads the working tree while writes gate on HEAD, and submit commits uncommitted edits | gap | open | |

## Context

These notes were first kept in one local, git-ignored file, `.notes/wingfoil-requests.md`
(versioned unchanged as `docs/wingfoil-feedback/wingfoil-requests.md` in task-022, split in
task-023). Its requests R-01…R-12 are F-001…F-012; its candidates from the `wingfoil-cli` directive
W-03, W-07, W-08, W-09, W-12, W-13 are F-013…F-018, and the unnamed candidate "`memory search` reads
the working tree while writes gate on HEAD" is F-019; each note says so on its first line. The
unnamed candidate "ingestion from a client needs every required field settable by the CLI" is part
of F-003 (its ingestion use case). The candidates W-01 (covered by R-03, now F-003) and W-04
(covered by WingFoil task-226) had no request and have no note.

**The former header.** The needs collected here were discovered while designing WingFoil UI and
belong to **WingFoil**, not to the UI. Each was to be captured in the WingFoil project through its
ingestion workflows (`decision-log-ingest`, `adr-ingest`, `bug-ingest`) — or, where WingFoil already
had an element on the subject, **as an extension of that element**, not as a duplicate. The file was
kept in step with the `wingfoil-cli` directive: a `W-xx` entry that is a WingFoil defect or gap got a
request, and once WingFoil captured it, the WingFoil element id (never a local id) went in the
directive. Since WingFoil dl-163 the notes are versioned here, the directive names each entry's note
in its *Note* column, and WingFoil's answer comes back through the sync.

**`.wingfoil/ui.yaml` is owned by the UI** and needs nothing from WingFoil: every 0.2.2 loader
reads only the files it names, so an extra file in `.wingfoil/` is already ignored (checked on
`dna`, `memory`, `directives`, `paths`, `workflow list`, `mcp`).

**When each request was wanted** (the former *When* column) is stated in each note's Expected
section: before v1.0 for F-001, F-002, F-003, F-011, F-012; before v1.0 as a nice to have for F-004
and F-010; after v1.0 for F-005…F-009.

**What each request feeds in WingFoil UI** (the former *Why* column, for this repository's
readers): F-005 the Configuration page; F-006 the Artifacts view (artifact paths stay in `ui.yaml`
until then); F-007 external notifications (in-app ones meanwhile); F-008 workflow editing from the
UI (journey 6); F-009 Configuration › Permissions (UI feature L6) — the UI implements no
permissions until WingFoil does (decided 2026-10-02, specification session 3).
