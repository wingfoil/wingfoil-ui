---
id: wingfoil-cli
name: "Using the pinned WingFoil CLI"
type: directive
kind: custom
title: "Using the pinned WingFoil CLI"
tags: [custom, wingfoil, cli, governance]
---

# Directive — Using the pinned WingFoil CLI

**Version:** 1.4 · **Date:** 2026-10-05 (1.1: W-13; 1.2: W-14…W-20 — initial-design rl-v1; 1.3: W-20 task hand transitions, W-21 — dev-loop task-001; 1.4: W-22 — dev-loop task-004) · **Checked against:** `wingfoil@0.2.2`

Global. Applies to every role, human or agent, that changes this project's governance state
(DNA, Memory, directives, plans) — and to the UI code that drives the CLI for other projects.

It lists the CLI behaviours that are wrong, missing or surprising **in the pinned version**, and
the way to work with each. It is a living list:

- when the WingFoil pin advances (`release-planning`), re-check every entry against the new
  version: remove the ones fixed upstream, update the ones that changed, bump this directive's
  version and `Checked against:`;
- when a new surprise is found, add an entry here (and, if it is a WingFoil defect, ingest it in
  the WingFoil project and track the request in the local, git-ignored notes
  `.notes/wingfoil-requests.md`).

## General

- Run the **pinned** CLI: `npm run -s wingfoil -- <command>` (`-s` keeps `--format json`
  parseable). Never rely on a global `wingfoil` of another version.
- Every governance change goes through a CLI verb when one exists. Hand edits are allowed only
  where an entry below says so.

## Known behaviours (0.2.2)

| # | Behaviour | How to work with it | Fixed upstream by (WingFoil element) |
|---|-----------|---------------------|-------------------|
| W-01 | `memory add --set name=value` only accepts tokens of the type's `id_pattern` or `path` (plan: `workflow`, `phase`, `scope`; release: `kind`, `version`, `release-line`; release-line: `version`; task: `release`). Any other field is refused: `has no token {x} in its id_pattern or path` | Create with `memory add`, fill the other fields by editing the draft file, then `memory submit`: the submit commit includes the edit and checks the required fields | task-163, task-127 (field-editing verb) |
| W-02 | No way to check a submit before trying it (`--dry-run` does not exist) | Before `submit`, check the type's `template.frontmatter.required` in `memory.yaml` against the draft | task-210 |
| W-03 | `plan` needs `--set scope=<folder>` (path `docs/05_plans/{scope}/{id}.md`); without it: `E_MISSING_PATH_VALUE … scope`. The value is written to the frontmatter only if the template declares `scope:` | Always pass `scope` (`sw-life-cycle` before the first release-line, `rl-vN`, `rl-vN/rel-vX.Y`); keep `scope:` in the plan template | — |
| W-04 | `plan` is `draft → active → done` with no gate: `approve` fails (`illegal transition active -> (none)`), and no verb moves `active → done` | `submit` activates the plan. To close it: set `status: done` in the file and commit `wf(plan): finalize <id> [active → done]` | task-226 (`workflow finalize`) |
| W-05 | `memory approve` / `reject` require `--reason`; `memory submit` accepts none | Put the submit rationale in the element body | — |
| W-06 | No workflow engine: only `workflow list` (no `--all`, no `start`/`next`/`status`/`show`) | Run each phase by hand against its plan; read phase order from `workflow list` | spec-017 · tasks 204, 216, 217, 225 |
| W-07 | `release` files go under `docs/04_memory/planning/{release-line}/`, and `release-line` holds the version (`v1`), so the folder is `planning/v1/`, not `planning/rl-v1/` | Pass `--set release-line=v1` and expect `planning/v1/minor-vX.Y.md` | — |
| W-08 | `dna add team.members` refuses a role not declared in `team.roles` (`E_VALIDATION … undefined role`); the Kanban template has no `facilitator` | Add the role first: `dna add team.roles --value <role> --entry-description "…"` | — |
| W-09 | A `roles.yaml` binding to a directive with no file is only a **warning** of `directives list`, not an error | After editing `roles.yaml` or removing a directive, check `directives list` reports `"warnings": []` | — |
| W-10 | Any `.md` under `.wingfoil/directives/` without frontmatter breaks loading (`E_MISSING_FRONTMATTER`) | Create directives with `wingfoil directive create --name <id>`; never drop notes there | — |
| W-11 | Files the CLI does not own in `.wingfoil/` (e.g. `ui.yaml`) are ignored by every loader, but the secret scan would include them | Keep `ui.yaml` free of secrets | — |
| W-12 | Unknown frontmatter fields (in directives, Memory elements, YAML config) are only a **warning on stderr** (`unknown field(s) ignored`), so a misspelt field is silently dropped. WingFoil's own directives carry a `scope:` field, and WingFoil's `main` `memory.yaml` an `amendable` key, that 0.2.2 reports this way | Read stderr after every command; remove fields the pinned version does not know | — |
| W-13 | `memory approve` and `memory reject` both require the `approver` role, whatever the type and gate: there is no per-gate role (a reviewer or product owner without `approver` cannot pass or send back anything) | Give `approver` to whoever must decide gates; in the UI, gates show "reserved to approver" for other roles | — |
| W-14 | Numeric id tokens are zero-padded to at least 3 digits (`task-001-login-form`, `dl-002-…`) | Write ids, fixtures and expected values padded; never build an id by hand — read it from the `memory add` output | — |
| W-15 | `memory add` and `memory submit` commit subjects carry no transition (`wf(task): submit task-001-…`); only `approve`, `reject` and `deprecate` carry `[from → to]` | Read a submit's transition from `memory history` or from the `status:` diff of the element file (spec-002) | — |
| W-16 | `wingfoil init --template Kanban` and `--template Scrum` write `bug-ingest`, `decision-log-ingest` and `adr-ingest` with one phase `capture` and no `actions`; Scrum declares the same 7 types as Kanban | Such workflows are not ingestions for the UI (no `memory.add` in the first phase): Kanban/Scrum projects show none until their workflows declare actions | — |
| W-17 | The id slug keeps dots and turns an apostrophe into a separate `-s` (`"Permissions are WingFoil's"` → `…-wingfoil-s`, `"ui.yaml"` → `ui.yaml` in the id) | Choose titles with the id in mind: no dots, no apostrophes | — |
| W-18 | No read verb for type definitions (`memory.yaml` resolved), one element's full content (frontmatter + body) or a directive's body: `memory search` returns `id`, `title`, `type`, `status`, `tags`, `path` only; `directives list` frontmatter and roles only | Read those files directly, read-only, from the allow-list of SARD REQ-ARC-04 (`adr-001` D1a, spec-001 §4) | — |
| W-19 | `memory search` excludes archived elements (`deprecated`, `superseded`) unless `--status` names them; with no match it adds a `message` field; `--version` prints plain text even with `--format json` | List archived elements with `--status deprecated` / `--status superseded` when needed; accept `message`; parse `--version` as text | — |
| W-20 | The refusal of `submit` from a waiting state names a wrong target (custom `task` in `backlog`: `illegal transition backlog -> pending`) | Treat the message as "not allowed from this state"; the UI never offers `submit` from a waiting state (spec-003). For this project's tasks, `backlog → in-progress` and `approved → done` have no verb: set `status:` by hand and commit `wf(task): <id> [<from> → <to>]` (dev-loop `start` and `done`) | — |
| W-21 | `memory add` always writes `status: draft`, even when the type's `sequence` starts with another state (`story` `idea → …`): the new element is in an undeclared state and `submit` fails (`invalid state 'draft' for type 'story'`) | Declare `draft` as the first state of every type; the e2e `unknown` fixture amends the add commit to the first declared state (test harness `addInState`). `memory search` does list elements in an undeclared state (with their `status`) | — |
| W-22 | Exit status 2 is not always plain text: a missing required argument answers JSON on stderr even before `--format json` applies (`memory approve <id>` → `{"error":"missing required argument: --reason"}`, same for `memory add` without `--title`); an unknown option is plain text (`error: unknown option '--bogus'`). Positionals after `--` are taken literally (`memory history -- --version` → `document not found: --version`) | Treat exit 2 as an adapter defect whatever the stderr format (spec-001 §2); pass user positionals after `--`; log stderr truncated (it may quote a value) | — |
