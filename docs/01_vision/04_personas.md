# Personas — WingFoil UI

**Version:** 0.1
**Date:** 2026-10-01
**Status:** Accepted in lean-inception session 2 (2026-10-01)
**Input:** `01_product-brief.md` §4 · `02_product-vision.md` · WingFoil `docs/01_vision/04_personas.md`
(wingfoil/wingfoil@c43221c4) · **Evidence:** `docs/00_reference/ux-reference.md` §3, §4.1, §4.10

The personas are **the same people as WingFoil's** (brief §4): they already use WingFoil through
its CLI, MCP and agents. Here each is described by what they need **from the UI**. Each persona
maps to roles declared in a project's `dna.team.roles`; the UI's role views are built from them.

AI agents are not personas of the UI: they work through the CLI and MCP and never approve
(`approval_authority: false`).

---

## Persona 1 — Morgan, the Tech Lead / Approver · **primary**

> *"Half my day is unblocking others. I want to see every gate waiting on me and pass it in seconds."*

- **Roles:** `tech-lead`, `approver` (often also `architect`, `reviewer`).
- **Uses WingFoil today:** CLI, daily; approves and rejects by typing ids and reasons.
- **Pain the UI removes:** gates are scattered across element types and releases; finding them
  takes several commands; a rejection reason is typed blind, without the element in view.
- **Needs from the UI:**
  - Today lists every gate requiring the approver role, oldest and rejected-again first;
  - all outcomes of a gate side by side, the reason field focused, the `wf(…)` commit shown;
  - who is blocked by whom (waiting-on-others), pending gates per role in Team;
  - in-app notifications for new gates.
- **Success:** a gate passed or rejected in ≤ 2 clicks from Today, with the reason recorded.

## Persona 2 — Casey, the Product Owner / Manager · **primary**

> *"I can't read YAML, but I'm the one who decides scope and answers for delivery."*

- **Roles:** `product-owner` (may also be `approver` for product items).
- **Uses WingFoil today:** not directly — through a technical intermediary.
- **Pain the UI removes:** decisions, state and bottlenecks are only in the repository; every
  question about progress goes through a developer.
- **Needs from the UI:**
  - the progress card: phase, project and phase completion, open bugs, pending gates — in plain
    words;
  - decision-logs and ADRs readable as documents, with their history;
  - the product items requiring a product-owner decision (e.g. decision-logs `in-discussion`);
  - traceability from a feature to the work delivering it.
- **Success:** follows the project without asking a developer; decides product items in the UI.

## Persona 3 — Jordan, the Team Developer

> *"Tell me what's next for me, and let my agent start with the right context."*

- **Roles:** `developer` (sometimes `qa`).
- **Uses WingFoil today:** CLI + agent daily; directives auto-loaded through MCP.
- **Pain the UI removes:** what is next, what was rejected and why, which directives and specs
  apply — each is a separate command or file.
- **Needs from the UI:**
  - next workflow step for the developer role, and the elements rejected back to them with the reason;
  - launch the agent on the next step with its context shown (role, directives, specs, branch) —
    when the project's WingFoil provides agent execution;
  - submit finished work; read the directives bound to the role.
- **Success:** starts the day from Today instead of from the terminal history.

## Persona 4 — Sam, the Reviewer

> *"Show me what's waiting for review and the standards it must meet."*

- **Roles:** `reviewer`.
- **Uses WingFoil today:** CLI for reviews, AI for assisted review.
- **Pain the UI removes:** pending reviews are found by searching states; the applicable
  directives and the element's history are elsewhere.
- **Needs from the UI:**
  - items in a review state requiring the reviewer role;
  - the element panel with its state machine, references, directives and history side by side;
  - launch an assisted review (when available) and pass or send back the item.
- **Success:** a review decision taken with everything relevant on one panel.

## Persona 5 — Alex, the Solo Maintainer

> *"On my project I'm every role at once — I just need to switch hats quickly."*

- **Roles:** all of them (as the WingFoil and WingFoil UI repositories today).
- **Uses WingFoil today:** CLI + agents, alone; approves their own and the agents' work.
- **Pain the UI removes:** with every role, "what requires me" is everything; context switches
  between roles are mental, not visible.
- **Needs from the UI:**
  - the role-view switch, with Today filtered per role and an "all roles" summary;
  - the same fast gates as Morgan;
  - several projects in the project list.
- **Success:** the first real user — the WingFoil project itself is run from the UI.

## Persona 6 — Riley, the Newcomer (not in the team yet)

> *"I cloned the repository to understand it — I'm not part of the team yet."*

- **Roles:** none — the git email is not in `dna.team.members`.
- **Uses WingFoil today:** reads the repository; may become a contributor.
- **Pain the UI removes:** no entry point into a WingFoil project's state, decisions and rules.
- **Needs from the UI:** read-only exploration of everything; a clear "not in team" badge; how to
  join (who to ask, what the team owner runs).
- **Success:** understands the project without being able to change it by mistake.

## Persona 7 — Taylor, the Architect (future)

Kept from WingFoil for reference. In the UI, Taylor's needs (ADRs, tech-specs, traceability) are
covered by Morgan's and Sam's views; no separate role view in the MVP.

---

## Role views

| Role view | Personas | Today shows first |
|-----------|----------|-------------------|
| Approver / tech lead | Morgan, Alex | gates requiring the approver role |
| Product owner | Casey, Alex | product decisions; progress card |
| Developer | Jordan, Alex | next step; work rejected back |
| Reviewer | Sam, Alex | items in review |
| QA | Jordan, Alex | items to verify |
| Not in team | Riley | progress card; read-only, how to join |

A member with several roles switches view (ux-reference §3); the views offered are the role views
intersected with the member's roles in the project's DNA.

---

## Key Decisions

Decided in session 2 (2026-10-01), all as proposed.

| Question | Decision | Rationale |
|----------|----------|-----------|
| Reuse WingFoil's personas? | **Yes**, same people, rewritten around their needs from the UI | They are WingFoil users; one cast across both projects keeps traceability simple |
| Primary personas | **Morgan** (human-on-the-loop approver) and **Casey** (excluded today) | They gain most: Morgan in speed, Casey in access at all |
| Jordan vs Alex | **Keep both**: Jordan is a developer in a team, Alex is the solo maintainer holding every role | Different needs: Alex drives the multi-role view and is the first real user |
| Agents | **Not personas** of the UI | They use CLI + MCP; the UI only launches them and shows their context |
| **Q5 — Unregistered users** | **Read-only access** with a "not in team" badge and a *How to join* panel that names the team's tech lead and the exact command they run (`wingfoil dna add team.members …`). **No** guided "add me" flow in the MVP | Joining is a governed DNA change made by the team, not by the newcomer; read-only keeps them safe and useful. New persona Riley covers the case |
