# Product Brief — WingFoil UI

**Version:** 0.2
**Date:** 2026-10-01 (0.1: 2026-09-30; 0.2: §8 WingFoil version floor, from lean-inception session 1)
**Status:** Draft (input to `lean-inception`)
**Reference:** `docs/00_reference/ux-reference.md` (UX concept + interactive prototype)

---

## 1. Summary

WingFoil UI is a local graphical interface for projects governed by WingFoil. It gives every
team member — whatever their role — a single place to see **what they must do or unblock**,
to act on it **in a few clicks**, and to consult **all project information** (DNA, workflows,
Memory elements, directives, documentation, artifacts, traceability).

It runs on the developer's machine as a **local server that drives the `wingfoil` CLI** and
serves a web UI. It adds no new source of truth: every read and every change goes through
WingFoil and git.

## 2. Problem

WingFoil today is CLI + MCP. That fits developers and agents, but:

- **Discoverability is low.** Knowing what is pending, blocked or next requires several
  commands (`workflow status`, `memory search`, `memory history`…) and knowing their names.
- **Human-on-the-loop work is slow.** Approvals, rejections and triage are the main human
  job in an agent-driven flow; each needs an id, a verb and a reason typed by hand.
- **Non-technical roles are excluded.** A product owner or manager (Casey) cannot follow
  decisions, state and bottlenecks without a technical intermediary.
- **Project state is invisible as a whole.** Phase, progress, open bugs, pending gates and
  traceability coverage exist in the repository but are never shown together.

## 3. Vision

**For** people working on WingFoil-governed projects (developers, reviewers, tech leads,
product owners, managers)
**who** need to know what requires them and to act on it without learning the CLI,
**WingFoil UI is** a local, repo-native interface
**that** shows each person their pending work and the whole project state, and turns every
governed operation into one or two clicks,
**unlike** reading YAML/Markdown files or chaining CLI commands,
**our product** stays methodology-agnostic: it renders any project from its own WingFoil
configuration, never from assumptions about types, states or workflows.

## 4. Target users

Personas are the WingFoil ones (see WingFoil `docs/01_vision/04_personas.md`); the UI
serves them through **role-based views**:

| Role view      | Persona | Primary need in the UI |
|----------------|---------|------------------------|
| Tech lead / approver | Morgan | Approve, reject, triage; see gates blocking the team |
| Developer      | Jordan, Alex | Next step, launch agent with context, submit, fix rejections |
| Reviewer       | Sam     | Launch assisted review, validate, pass to the gate |
| Product owner / manager | Casey | Decide product items, follow progress and decisions |

The current user is **identified from `git config user.email`** matched against
`dna.team.members[].email`. A member with several roles switches between role views.

## 5. Goals and success criteria

| Goal | Measure (to be refined into SARD fit criteria) |
|------|-----------------------------------------------|
| Pending work is visible at a glance | Everything that requires the user is on the first screen ("Today"), no navigation needed |
| Governed actions are fast | Approve/reject/triage in ≤ 2 clicks from Today; start an agent on the next step in 1 click |
| Any WingFoil project renders correctly | Types, states, gates, workflows and roles are read from the project config; zero hard-coded vocabularies |
| Project state is understandable by non-developers | Progress (phase, completion %, open bugs, pending gates) shown on one card |
| No divergence from WingFoil | Every write is a WingFoil CLI call producing the usual `wf(…)` commit |

## 6. Scope

### MVP

- Local server wrapping the `wingfoil` CLI; web UI served on localhost.
- Project list (local folder or cloned remote), persisted by the UI.
- **Today**: progress card, "Requires you" inbox, next workflow step, waiting-on-others,
  notification count.
- **Gate actions** in the element panel: all options of the gate (e.g. approve / reject /
  duplicate) side by side, reason field, commit feedback.
- **Workflow**: main workflow tree with current position, iterated elements, ingestion
  workflows (start them).
- **Memory**: list with type and state filters, element panel (state machine, references,
  directives, history).
- **DNA, Directives, Team, Documentation** (Markdown rendered in the UI), read views.
- **Traceability**: requirement/feature → Memory elements, completion, missing references.
- **Timeline**: time axis of Memory creations / state changes, and the git tree with filters.
- **Files**: read-only repository browser with syntax highlighting and Markdown preview.
- **Configuration** in sub-tabs: WingFoil settings, action permissions, and the UI's own
  `ui.yaml` (taxonomy, reference patterns, progress card), each with explanations.

### Later

- Editing DNA, directives and workflows from the UI (depends on CLI verbs, see upstream
  requests).
- Artifacts view backed by core support for artifact paths.
- WingFoil core settings page (auto-push, signed commits, no self-approval…).
- External notification channels (email, Slack).
- Creating, editing and deleting repository files from Files, with commits.
- Permissions enforced by WingFoil core instead of the UI (a request to WingFoil).
- Multi-user/remote deployment.

## 7. Is / Is not

**Is**
- A local interface over WingFoil and git.
- Methodology-agnostic: it renders whatever the project declares.
- Role-aware: the same screens, filled by what each role must do.

**Is not**
- A second source of truth, database or cache that can diverge from the repository.
- A way to bypass WingFoil: no element is created outside a workflow (ingestion or main),
  no state changes outside the type's state machine.
- An IDE, code reviewer or agent.
- A hosted/multi-tenant service (MVP).

## 8. Constraints and dependencies

- **Depends on WingFoil ≥ 0.2.2** for the first waves and on **WingFoil 1.0 for UI v1.0**; the
  workflow features need WingFoil ≥ 0.3 (workflow engine: `workflow start|next|status|show|end`).
  Each feature declares the WingFoil version it needs; capabilities missing from the project's
  CLI are shown read-only or hidden (decided in `02_product-vision.md`, Key Decisions). Stable
  `--format json` output is needed for every command the UI calls.
- All writes go through the CLI; the UI server never edits `.wingfoil/` or Memory files
  directly, except its own `ui.yaml`.
- Runs where git and `wingfoil` are installed and a git identity is configured.
- Same license and repository conventions as WingFoil (MIT, git-backed, dogfooded with
  WingFoil).

## 9. Assumptions and risks

| Assumption / risk | Mitigation |
|-------------------|------------|
| CLI JSON output changes between releases | Pin a WingFoil version; contract tests on the JSON the server consumes |
| Some operations have no CLI verb yet (content edits, workflow edits) | Ship them read-only in the MVP; track as upstream requests |
| Traceability conventions differ per project | UI-owned taxonomy in `ui.yaml`; missing references shown, not guessed |
| Performance on large Memory | Server-side caching invalidated by git HEAD / file watch |

## 10. Inputs for the inception workshop

- UX reference and prototype: `docs/00_reference/ux-reference.md`
- Architecture decision draft: `docs/00_reference/adr-draft-local-server.md`
- Requests to WingFoil core: local notes `.notes/wingfoil-requests.md` (not versioned)
- Open questions: `docs/00_reference/open-questions.md`
