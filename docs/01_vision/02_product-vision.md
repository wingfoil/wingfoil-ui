# Product Vision — WingFoil UI

**Version:** 0.5
**Date:** 2026-10-06 (0.2: external review — session 7; 0.3: permissions left to WingFoil — specification session 3; 0.4: clone and local state in the write classes — coherence audit of the specification — session 6; 0.5: supported range rule — dev-loop task-006)
**Status:** Accepted in lean-inception session 1 (2026-10-01); revised in session 7
**Input:** `01_product-brief.md` §1–5, §8 · **Evidence:** `docs/00_reference/ux-reference.md` §1,
`docs/00_reference/adr-draft-local-server.md`

---

## Vision Statement

**For** the people who work on a WingFoil-governed project — developers, reviewers, tech leads,
approvers and product owners — and who are not all fluent in its CLI
**who** need to know, at any moment, what requires them, what blocks the team and where the project
stands, and to act on it without composing commands by hand
**WingFoil UI is** a local, repo-native web interface over WingFoil and git
**that** shows each person their pending work and the whole project state on one screen, and turns
every governed operation — submit, approve, reject, triage, start an ingestion, launch an agent —
into one or two clicks that WingFoil itself executes
**unlike** chaining CLI commands, reading YAML and Markdown by hand, or tracking the work in a
separate tool that drifts from the repository
**our product** adds no source of truth and no rules of its own: it renders any project from that
project's WingFoil configuration, and every governed change it makes is the same `wf(…)` commit
the CLI would make — its only other write is its own configuration file.

**In one line:** *the human-on-the-loop console for WingFoil projects.*

---

## What the product stands on

| Pillar | Meaning | Consequence for every feature |
|--------|---------|-------------------------------|
| **What requires me, first** | The first screen answers "what must I do or unblock?" for the current user and role | Every feature says which role it serves and where it surfaces in Today |
| **WingFoil is the only writer of governed state** | Governed changes are WingFoil CLI calls (`wf(…)` commits); the UI's only own write is `.wingfoil/ui.yaml`; git is read and only moved (fetch, fast-forward update, push) — see *Write classes* | A feature without a CLI verb ships read-only (`cli-only-writes`) |
| **Project-agnostic** | Types, states, gates, roles and workflows come from the project; the actions possible on each element are derived from them and from the CLI version (action descriptor, S9) | Zero hard-coded vocabularies; unknown states fall back to a generic "Action required"; the UI's own conventions live in `ui.yaml` |
| **Few clicks** | Governed actions in 1–2 clicks, everything reachable from ⌘K | Gate actions show every outcome side by side, with the reason field focused |
| **Everything visible** | DNA, workflows, Memory, directives, docs, traceability one click away | Read views come before edit views |
| **Local and repo-native** | Runs on the user's machine, identity from git, state from the repository as the CLI reads it | No accounts, no server-side database, no hosted service in v1; the local server is reachable only from the user's machine and protected from other web pages (X4) |

---

## Who it serves (preview of session 2)

The brief takes the role views from WingFoil's personas: tech lead/approver (Morgan), developer
(Jordan, Alex), reviewer (Sam), product owner/manager (Casey). Session 2 confirms, merges or
replaces them for WingFoil UI. The vision deliberately names **roles, not technical skill**: the
value for a developer is speed; for an approver or product owner it is access at all.

---

## Success signals

The product succeeds when, on a real WingFoil project (the WingFoil repository itself is the first):

- a team member opens the UI and sees everything that requires them **without navigating**;
- an approver passes or rejects a gate in **≤ 2 clicks** from that screen, with the reason recorded;
- a product owner follows phase, progress, open bugs and pending gates **without a developer
  translating** the repository;
- a second project with a different methodology (e.g. a Kanban one), and one with types and states
  the UI has never seen and no `ui.yaml`, render **without UI changes**;
- the `wf(…)` history of a project shows **no difference** between governed changes made from the
  UI and from the CLI.

These become measurable fit criteria in the SARD (`specification-downcast`).

---

## Key Decisions

Decided in session 1 (2026-10-01), all as proposed.

| Question | Decision | Rationale |
|----------|----------|-----------|
| One vision or one per role? | **One** vision, role-aware | Same screens for everyone, filled by what each role must do (brief §7) |
| Primary target | **Teams already running WingFoil** (starting with the WingFoil project itself), human members first | Agents already have CLI + MCP; the gap is on the human side of the loop |
| Positioning vs WingFoil | A **client** of WingFoil, not part of it: no core change required to exist, every capability bounded by the CLI | Keeps one writer and one set of rules; the UI grows as the CLI grows |
| **Q2 — WingFoil version floor** | **0.2.2 for the first waves, 1.0 for UI v1.0.** Each feature declares the WingFoil version it needs; the UI detects the version of the project's CLI and shows an unavailable capability **read-only with the reason** when it applies to the project but the WingFoil version or the user's role lacks it, and **hides** it when it does not apply to the project (e.g. no ingestion workflow declared) | The read views and gate actions already work on 0.2.2; waiting for 0.3 would delay all value. Supersedes brief §8 ("depends on ≥ 0.3"), which then applies only to the workflow features |
| **Q10 — Accessibility and i18n** | **WCAG 2.1 AA** from the first release (directive `accessibility`); **English-only** UI in the MVP, with every string externalised so a second language is a later feature | Accessibility is cheap early and expensive to retrofit; WingFoil, its docs and its vocabulary are in English |
| **Q11 — Permissions before WingFoil enforces them** | ~~Acceptable in the MVP as advisory~~ **Superseded (specification session 3): permissions are WingFoil's.** The UI keeps no permissions table and stores none in `ui.yaml`; every team member may run what the CLI allows (gate authority: the `approver` role). The UI shows WingFoil's action permissions once WingFoil implements them (L6) | One owner for the rules: a UI-side table would be a second source of truth that WingFoil does not know |
| Core value word | **"Unblock"** — what requires me, what I can unblock now | It is what Today, notifications and the gate actions all serve |
| **Which CLI runs** *(session 7)* | The UI runs **the observed project's own `wingfoil`** — the one its `package.json` pins (`node_modules`), else `wingfoil` on the PATH — never a copy of its own. Supported range: from a declared minimum (0.2.2) to the caret line of the latest contract-tested version (e.g. 0.2.2 to 0.2.x); outside it the project opens **read-only** with the reason; with no CLI found it **does not open**, and says how to install it. Binary discovery and the contract matrix are specified in `adr-001` | Commits identical to the team's; one behaviour per project version; contract tests bound what the UI claims to support |
| **Write classes** *(session 7)* | (a) **governed** changes: only through the CLI, `wf(…)` commits; (b) **UI configuration**: only `.wingfoil/ui.yaml`, schema-validated before writing, by any team member, one `chore(ui): …` commit touching only that file; (c) **git transport**: `clone` into a new, empty folder, fetch, `pull --ff-only`, push — no new commits; (d) **repository files** (L4, after v1.0): plain commits, specified then. Nothing else is written in a repository; the UI's local state (project list, settings, action log) lives outside every repository | Makes the single exception to "WingFoil is the only writer" explicit and testable |

---

## Open points carried to later sessions

- Personas and the unregistered-user case (Q5) — session 2.
- Packaging (Q1) and the per-wave WingFoil floor (Q2 confirmation) — session 5.
- Binary discovery, version detection and the JSON contract matrix for the decided CLI rule —
  `adr-001`, `initial-design`.
