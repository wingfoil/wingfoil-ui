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
- The body's first line says what the note reports, in one of these forms, which
  `test/wingfoil-feedback.test.ts` checks:
  - the `wingfoil-cli` entries it reports: `Reports W-28.`, `Reports W-25 and W-26.`,
    `Reports W-36, W-37.` or `Reports W-36, W-37 and W-38.`;
  - for a note that reports no CLI behaviour, its area: `Not a CLI behaviour: <area>.` (e.g.
    `Not a CLI behaviour: publish pipeline.`; the area starts with a character that is neither
    blank nor a dot);
  - for the notes migrated by task-023, their former id: `Formerly R-01.`,
    `Formerly W-03 candidate.` or `Formerly an unnamed W-xx candidate.`
- This repository writes `open`; `answered_by` and every other status are set only by the sync, from
  what WingFoil published. `answered_by` holds WingFoil's element ids in the short form WingFoil's
  retrospective table writes them (`dl-108`, `bug-400`), not the full slugged ids.
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

**Last sync:** 2026-11-02 (the second, at `release-planning` of `minor-v0.3`, below); the first (`governance-alignment-rel-v0.3-plan` step 5, after the pin
moved to `wingfoil@0.3.1`; rule 7 of `wingfoil-cli`), run by WingFoil's `COLLABORATION.md`
*The sync procedure* (read at WingFoil `origin/main` `7efff2a02886454cecb2da839f3777535a2c9e49`):

- *Step 2 — what was read:* the `## Consumer feedback` table of `retro-v0.3`
  (`docs/04_memory/design/dls/retro-v0.3.md`, the approver's ruling of 2026-10-21), its read record
  `docs/09_retrospectives/rl-v1/rel-v0.3-feedback-triage.md`, which read this inbox at
  `8e448e2a449a21fa7942ed9e3a050a5fc9e434f5` (F-001 … F-026, all `open`), and the patch released
  since, `patch-v0.3.1` (`docs/04_memory/planning/rl-v1/patch-v0.3.1.md`, `released`): its
  *Scope changes* lists no note of this inbox.
- *Step 3:* `git grep -n "<service id>/F-" origin/main -- docs/04_memory` finds `reported_by:`
  cites of F-010 (bug-400), F-011 (dl-200), F-016 (bug-411), F-022 (bug-412) and F-024 (dl-199), as
  the table says.
- *Step 4 — the mapping:* `covered`, `element` or `restated` with an element → `captured`, the
  element in `answered_by`; `restated` with none → stays `open` (F-005, F-006, F-008, F-009, F-013,
  F-023, F-026); `superseded` → `resolved` (F-002, F-004, F-012, F-014, F-017, F-021); `needs-info`
  → `needs-info` (F-018). No note was `declined`. Then, as the same step says, "A `captured` note
  becomes `resolved` once every element in its `answered_by` has shipped in a release tag the
  consumer reads"; the procedure makes no exception for a decision-log or a spec. Read at the tags
  `v0.3.0` (commit `cc31d7a8`) and `v0.3.1` (commit `870bd440`), with `minor-v0.3` `released` and
  `patch-v0.3.1` `released` at `origin/main`: F-003 (dl-108, `release: "v0.3"`, its task-127
  `done` v0.3), F-007 (spec-017, `release: "v0.3"`), F-019 (dl-084, `release: "v0.3"`, its
  task-161 `done` v0.3), F-020 (task-226 `done`, v0.3) and F-025 (bug-217 `closed`, v0.3) at
  `v0.3.0` and `v0.3.1`, and F-010 (bug-400 `closed`, `release: "v0.3.1"`) at `v0.3.1` → `resolved`.
  Still `captured` at `7efff2a0`: F-001 (spec-005, no release) and F-011, F-015, F-016, F-022,
  F-024 (elements of v0.4; F-016 resolved at the `v0.3.2` re-read below).
- *Answers:* F-018 (`needs-info`) now holds the reproduction WingFoil's read record lacked (a
  reviewer-only member and a pending element, on 0.3.1); it stays `needs-info`, which WingFoil's
  dl-163 lists at the next retrospective as "`needs-info` notes the consumer has since answered".
- F-027 … F-035 were written after WingFoil's read and stay `open`. F-035 reports, on 0.3.1, the
  late refusal that leaves its commit — the second failure window of F-025, which bug-217 (about
  `memory add`) does not name; F-025's first window (a failing commit) is atomic on 0.3.1.
- *Re-read at the `v0.3.2` tag* (2026-11-02, commit `6de2e13c004bbf419acfa7dc4d98d5a7468cd693`,
  published on npm as `latest`; the tag is on WingFoil's patch line, not on `main`, which is still
  `7efff2a0`), by the same steps of `COLLABORATION.md`, whose text at the tag is the same blob as at
  `7efff2a0`. Step 2: `retro-v0.3.md` and its read record are unchanged (the same blobs), and
  `patch-v0.3.2` (`docs/04_memory/planning/rl-v1/patch-v0.3.2.md`, `releasing` at its own tag and
  absent from `main`; the tag and npm `0.3.2` are the release this repository reads) lists no note
  of this inbox in its *Scope changes* (`task-331`, `task-332` only). Step 3: the `reported_by:`
  cites at the tag are the same five, all `@8e448e2a…`; none cites F-027 … F-035. Step 4, for the
  `captured` notes: F-016 → `resolved` — bug-411 is `closed` with `release: "v0.3.2"` at the tag
  (named in `patch-v0.3.2`; fixed by task-310, `done`, `release: "v0.3.2"`). Unchanged and still
  `captured`: F-001 (spec-005 `approved`, no release), F-011 (dl-200 `in-discussion`, v0.4), F-015
  (dl-138 `ready`, v0.4), F-022 (bug-412 `triaged`, v0.4), F-024 (dl-199 `in-discussion`, v0.4).
  This repository's pin stays `wingfoil@0.3.1`.
- *Second sync* (2026-11-02, `release-planning-rel-v0.3-plan` step 1, `advance-pinned-build`; rule
  7), by the same steps, at WingFoil `origin/main` `60fc3eeaff366335d48f6d4d6539ee7f6baec5cd` (the
  merge forward of `patch-v0.3.2`, now `released` on `main`). Step 2: `COLLABORATION.md`,
  `retro-v0.3.md` and its read record unchanged since `7efff2a0`; `patch-v0.3.2`'s *Scope changes*
  still lists no note of this inbox. Step 3: the same five `reported_by:` cites, none of F-027 …
  F-035. Step 4: the `captured` notes' elements unchanged — F-001 (spec-005 `approved`, no release),
  F-011 (dl-200 `in-discussion`, v0.4), F-015 (dl-138 `ready`, v0.4), F-022 (bug-412 `triaged`,
  v0.4), F-024 (dl-199 `in-discussion`, v0.4). **No status changes.** The pin stays
  `wingfoil@0.3.1`: the packs' range is `>=0.3.0 <=0.3.1`.

The sync due at `release-planning` of `minor-v0.2` was skipped on 2026-10-12, when WingFoil had not
defined the procedure (`governance-alignment-rel-v0.2-plan` GA-5).

## Ledger

| Note | Title | Kind | Status | Answered by |
|---|---|---|---|---|
| [F-001](F-001-cli-json-output-as-a-contract.md) | Stable, documented JSON output for every command a client calls | request | captured | spec-005 |
| [F-002](F-002-workflow-engine-json-for-uis.md) | JSON output of the workflow engine (status, next, show) with gates, required role and iterated elements | request | resolved |  |
| [F-003](F-003-no-verb-edits-element-fields.md) | No verb updates a Memory element's fields, so required fields cannot be set from the CLI | gap | resolved | dl-108 |
| [F-004](F-004-no-dry-run-on-state-verbs.md) | No --dry-run on state verbs to show the checks that would run | gap | resolved |  |
| [F-005](F-005-no-core-settings-file.md) | No core settings file (auto-push, signed commits, no self-approval, check strictness, default agent) | request | open |  |
| [F-006](F-006-no-artifacts-path-category.md) | No paths.artifacts category in the DNA, with placeholders and URL entries linked to services | request | open |  |
| [F-007](F-007-no-notification-channels-for-gates.md) | No notification channels for pending gates | request | resolved | spec-017 |
| [F-008](F-008-no-verbs-edit-workflows.md) | No CLI verbs to edit workflows (add, rename, reorder phases) with in-flight protection | request | open |  |
| [F-009](F-009-no-action-permissions.md) | No action permissions: who may change settings, DNA, workflows, directives, team and content | request | open |  |
| [F-010](F-010-init-ingestion-workflows-have-no-actions.md) | init templates (Kanban, Scrum) write ingestion workflows with one phase and no actions | defect | resolved | bug-400 |
| [F-011](F-011-no-read-verbs-for-types-elements-directives.md) | No read verbs for type definitions, one element's full content and directive bodies | gap | captured | dl-200 |
| [F-012](F-012-memory-add-always-writes-draft.md) | memory add always writes status: draft instead of the type's first state | defect | resolved |  |
| [F-013](F-013-plan-scope-token-not-recorded.md) | A plan's scope path token is not recorded in the element, because the plan template has no scope field | defect | open |  |
| [F-014](F-014-release-folder-disagrees-with-release-line-id.md) | A release's folder is named after the release-line field (v1), not the release-line id (rl-v1) | defect | resolved |  |
| [F-015](F-015-kanban-template-has-no-facilitator-role.md) | The Kanban template declares no facilitator role, which WingFoil's lean-inception requires | gap | captured | dl-138 |
| [F-016](F-016-dangling-directive-binding-only-a-role-warning.md) | A roles.yaml binding to a missing directive is only a warning, and only when listing that role | gap | resolved | bug-411 |
| [F-017](F-017-wingfoil-directives-carry-unknown-scope-field.md) | WingFoil's own directives carry a scope field that 0.2.2 reports as unknown | defect | resolved |  |
| [F-018](F-018-no-per-gate-role.md) | No per-gate role: approve and reject always need the approver role | request | needs-info |  |
| [F-019](F-019-search-reads-working-tree-while-writes-gate-on-head.md) | memory search reads the working tree while writes gate on HEAD, and submit commits uncommitted edits | gap | resolved | dl-084 |
| [F-020](F-020-release-and-bug-waiting-states-have-no-verb.md) | Release and bug waiting states have no verb, and approve-release has no gate | gap | resolved | task-226 |
| [F-021](F-021-usage-errors-mix-json-and-plain-text.md) | With --format json, usage errors (exit 2) are JSON or plain text depending on the error | defect | resolved |  |
| [F-022](F-022-duplicate-directive-ids-listed-twice.md) | directives list returns both files of a duplicated directive id, and only a warning names the one in force | gap | captured | bug-412 |
| [F-023](F-023-transitions-commit-edits-hidden-from-git-status.md) | A transition commits an edit of the element that git status does not show (assume-unchanged, core.ignoreStat) | defect | open |  |
| [F-024](F-024-reason-defects-are-usage-errors.md) | A --reason WingFoil will not record is a usage error (exit 2), not a refusal (exit 1) | defect | captured | dl-199 |
| [F-025](F-025-transitions-are-not-atomic.md) | A transition is not atomic: a failed commit leaves the element file rewritten, and a late failure leaves the commit | defect | resolved | bug-217 |
| [F-026](F-026-governed-verbs-cannot-be-bound-to-a-path.md) | Governed verbs pick the file of an id themselves: a duplicated id is not refused and no expected path can be given | gap | open |  |
| [F-027](F-027-staging-smoke-installs-unpinned-verdaccio-proxies-npmjs-fixed-port.md) | The publish pipeline's staging smoke installs an unpinned Verdaccio at run time, proxies npmjs and uses a fixed port | request | open |  |
| [F-028](F-028-read-verbs-run-git-without-protection.md) | Read verbs run git unprotected: they rewrite .git/index, run core.fsmonitor, lazy-fetch on a partial clone and take git from PATH | defect | open |  |
| [F-029](F-029-a-0-2-project-fails-every-workflow-command-until-hand-edited.md) | A project initialised by 0.2.2 fails every workflow command of 0.3.1 until hand-edited: no verb checks or migrates it | gap | open |  |
| [F-030](F-030-a-hand-committed-status-is-accepted-and-history-trusts-commit-text.md) | A hand-committed status: change is accepted, and memory history records a forged approval as an approve | gap | open |  |
| [F-031](F-031-approvals-are-authorised-by-the-commit-author-only.md) | An approval is authorised by git's author identity only, which any process can set: no signed approval commits | request | open |  |
| [F-032](F-032-an-active-ad-hoc-plan-becomes-the-active-workflow.md) | An active plan naming no loaded workflow (an ad-hoc plan) becomes the active workflow instance and masks the real one | gap | open |  |
| [F-033](F-033-a-filled-required-list-is-reported-missing.md) | A filled required list field is refused as "missing" at submit unless the type declares it in lists | defect | open |  |
| [F-034](F-034-memory-deprecate-needs-no-approval.md) | memory deprecate needs no approval: any git identity retires any element in any state | request | open |  |
| [F-035](F-035-a-transition-refused-after-its-commit-leaves-the-commit.md) | A transition refused by its post-commit scope check still leaves its commit on the branch | defect | open |  |
| [F-036](F-036-a-project-s-traceability-chain-is-prose-only.md) | A project's traceability chain is prose only: no client can read which references a type requires | request | open |  |

## Context

These notes were first kept in one local, git-ignored file, `.notes/wingfoil-requests.md`
(versioned unchanged as `docs/wingfoil-feedback/wingfoil-requests.md` in task-022, split in
task-023). Its requests R-01…R-12 are F-001…F-012; its candidates from the `wingfoil-cli` directive
W-03, W-07, W-08, W-09, W-12, W-13 are F-013…F-018, and the unnamed candidate "`memory search` reads
the working tree while writes gate on HEAD" is F-019; each note says so on its first line. The
unnamed candidate "ingestion from a client needs every required field settable by the CLI" is part
of F-003 (its ingestion use case). The candidates W-01 (covered by R-03, now F-003) and W-04
(covered by WingFoil task-226) had no request and have no note. F-020…F-022 were added after
the migration, by dl-007: F-020 reports W-25 and W-26, F-021 W-22 and F-022 W-23. F-027 … F-035
were added at `governance-alignment-rel-v0.3-plan` step 5 (dl-010): F-027 reports no CLI behaviour
(WingFoil's publish pipeline), F-028 W-36 and W-37, F-029 W-32, F-030 W-34, F-031 W-39, F-032 W-38,
F-033 W-33, F-034 W-44 (the `memory deprecate` entry, `wingfoil-cli` 1.19) and F-035 W-30. F-036 (no CLI behaviour: the traceability chain) was added at the `release-planning` of
`minor-v0.3` (its decision D9).

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
