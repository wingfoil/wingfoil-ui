---
id: dl-005-public-repository-cites-no-private-material-or-internal-session-names
type: decision-log
title: "Public repository cites no private material or internal session names"
status: ready
context: "ad-hoc"      # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: "v0.1"        # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

The repository `github.com/wingfoil/wingfoil-ui` is public. After the tag `v0.1.0` (2026-10-11),
a cross-project request relayed an approver's ruling: some committed files point at material that
is not public — a local filesystem path outside this repository, cited as background in two
governance tasks — and name internal coordination sessions of the approver's working setup in the
phase plans. The feedback inbox README also cites notes in a short form that differs from the
`reported_by:` form of WingFoil `COLLABORATION.md` `## Credit`.

## Decision

**Committed files cite only public sources and name no internal session.**

- A Memory element, plan or document cites a source by a public reference (a WingFoil element id,
  a file in a public repository, a commit) — never a local path outside this repository, a private
  folder, or a description of where private text lives.
- Agent and coordination sessions are not named: the text says who decided or asked in neutral
  terms ("the approver", "a cross-project request", "the previous session's handoff").
- The feedback inbox README cites a note in WingFoil's `reported_by:` form,
  `<service id>/F-<nnn>@<sha>` with the full service id and the full sha of the commit read;
  `svc-019` stays the short key. This replaces the short form `svc-019/F-<nnn>@<sha>` kept by
  task-024 (its acceptance and notes stay as the record of that time).
- Applied now to every occurrence found by `git grep` on `main`; files already in the history and
  in the tag `v0.1.0` keep their old text — rewriting history is a separate decision of the
  approver.

## Rationale

- **Public repository:** a reader cannot follow a private path, and naming it or the internal
  sessions discloses the approver's working setup without adding evidence.
- **Claims stay checkable:** the public sources (WingFoil dl-163, `COLLABORATION.md` `## Credit`)
  carry the same authority the private background did (directive `claim-evidence`).
- **One citation form with WingFoil:** the inbox README now matches what WingFoil writes in
  `reported_by:`, so a citation can be matched both ways.
- Trade-off: the old text remains reachable in the git history and the `v0.1.0` tag until the
  approver decides otherwise.

## Actions

- Rewrite the two background citations of task-022 and task-023 to WingFoil dl-163 and
  `COLLABORATION.md` `## Credit` (tech-lead, now).
- Replace the internal session names, and descriptions of the coordinating session, in the
  `rel-v0.1` plans and the Memory elements with neutral wording; drop the folder names of another
  local project from bug-001, task-004 and task-005 (tech-lead, now). Check, on `main` after the
  change: a case-insensitive `git grep` of the tracked tree (excluding `export*` and this
  decision-log) for the private path and its segments, quoted session titles, session ids, the
  session nicknames, "coordinating" and the other project's worktree folder → no hit, 2026-10-11.
  The patterns are not written here, so this record does not repeat them.
- Align the citation form in `docs/wingfoil-feedback/README.md` (tech-lead, now).
- Retrospective of `minor-v0.1`: consider a check (lint or review rule) for local paths and
  session names in committed text (approver).
