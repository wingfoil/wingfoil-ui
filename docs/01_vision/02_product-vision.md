# Product Vision — WingFoil UI

**Version:** 0.1
**Date:** 2026-10-01
**Status:** Accepted in lean-inception session 1 (2026-10-01)
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
project's WingFoil configuration, and every change it makes is the same `wf(…)` commit the CLI
would make.

**In one line:** *the human-on-the-loop console for WingFoil projects.*

---

## What the product stands on

| Pillar | Meaning | Consequence for every feature |
|--------|---------|-------------------------------|
| **What requires me, first** | The first screen answers "what must I do or unblock?" for the current user and role | Every feature says which role it serves and where it surfaces in Today |
| **WingFoil is the only writer** | Every change is a WingFoil CLI call and a commit; git is only read | A feature without a CLI verb ships read-only (`cli-only-writes`) |
| **Project-agnostic** | Types, states, gates, roles and workflows come from the project | Zero hard-coded vocabularies; the UI's own conventions live in `ui.yaml` |
| **Few clicks** | Governed actions in 1–2 clicks, everything reachable from ⌘K | Gate actions show every outcome side by side, with the reason field focused |
| **Everything visible** | DNA, workflows, Memory, directives, docs, traceability one click away | Read views come before edit views |
| **Local and repo-native** | Runs on the user's machine, identity from git, state from the repository | No accounts, no server-side database, no hosted service in v1 |

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
- a second project with a different methodology (e.g. a Kanban one) renders **without UI changes**;
- the `wf(…)` history of a project shows **no difference** between changes made from the UI and
  from the CLI.

These become measurable fit criteria in the SARD (`specification-downcast`).

---

## Key Decisions

Decided in session 1 (2026-10-01), all as proposed.

| Question | Decision | Rationale |
|----------|----------|-----------|
| One vision or one per role? | **One** vision, role-aware | Same screens for everyone, filled by what each role must do (brief §7) |
| Primary target | **Teams already running WingFoil** (starting with the WingFoil project itself), human members first | Agents already have CLI + MCP; the gap is on the human side of the loop |
| Positioning vs WingFoil | A **client** of WingFoil, not part of it: no core change required to exist, every capability bounded by the CLI | Keeps one writer and one set of rules; the UI grows as the CLI grows |
| **Q2 — WingFoil version floor** | **0.2.2 for the first waves, 1.0 for UI v1.0.** Each feature declares the WingFoil version it needs; the UI detects the version of the project's CLI and shows unavailable capabilities read-only or hidden, with the reason | The read views and gate actions already work on 0.2.2; waiting for 0.3 would delay all value. Supersedes brief §8 ("depends on ≥ 0.3"), which then applies only to the workflow features |
| **Q10 — Accessibility and i18n** | **WCAG 2.1 AA** from the first release (directive `accessibility`); **English-only** UI in the MVP, with every string externalised so a second language is a later feature | Accessibility is cheap early and expensive to retrofit; WingFoil, its docs and its vocabulary are in English |
| **Q11 — Permissions before WingFoil enforces them** | **Acceptable in the MVP as advisory**: the UI hides or disables actions per its Permissions table and says so ("not a security boundary"); gate authority stays enforced by the CLI (approver role) | Real enforcement belongs to WingFoil core; a UI-only check that claimed to protect would mislead |
| Core value word | **"Unblock"** — what requires me, what I can unblock now | It is what Today, notifications and the gate actions all serve |

---

## Open points carried to later sessions

- Personas and the unregistered-user case (Q5) — session 2.
- Packaging (Q1) and the per-wave WingFoil floor (Q2 confirmation) — session 5.
- Which CLI the server runs for an observed project (that project's own pinned `wingfoil`, or the
  one WingFoil UI pins) and how its version is detected — `adr-001`, `initial-design`.
