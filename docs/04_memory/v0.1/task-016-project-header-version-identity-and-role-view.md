---
id: task-016-project-header-version-identity-and-role-view
type: task
title: "Project header version identity and role view"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-006-wingfoil-version-range-and-capabilities", "task-009-identity-and-role-views", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-014-add-project-modal", "task-015-project-switcher", "task-019-dna-directives-and-team-views", "task-020-documentation-index-and-links"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project header: WingFoil version with the range state and missing capabilities, read-only notices (out of range, not in team, no identity, duplicates), the identity badge and the role view selector remembered per project.

**Backlog items:** US-S-08, US-S-09, US-S-12, US-S-13, US-S-14, US-S-15, US-S-22

- US-S-08 — As Alex, I want to see the project's WingFoil version and the capabilities it lacks when I add it, so that I know up front what I cannot do yet
- US-S-09 — As Alex, I want a project whose WingFoil version is outside the supported range opened read-only with the reason, so that I never act through a CLI the UI was not tested with
- US-S-12 — As a member, I want to be recognised from my `git config user.email` matched against `dna.team.members`, with my name and roles shown in the shell, so that I never log in
- US-S-13 — As Riley, I want a "not in team" badge and every view read-only when my git email is not in the team, so that I explore safely
- US-S-14 — As a member with no git email configured, I want the project read-only with a "no identity" notice that says how to set it, so that I know why I cannot act
- US-S-15 — As a member whose git email matches several team members, I want the project read-only with a warning naming them, so that no action is taken under the wrong identity
- US-S-22 — As Alex, I want to switch role view (e.g. approver → developer) in the shell, so that the screens show what that role needs

## Acceptance Criteria

- **US-S-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-08.1 Show the version on add, nothing missing; S-08.2 Use the CLI on the PATH when the project pins none
- **US-S-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-09.1 Open a project with a newer, untested CLI read-only; S-09.2 Open a project with an older CLI read-only
- **US-S-12** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-12.1 Recognise a single-role member; S-12.2 Match the email regardless of letter case; S-12.3 Follow a change of git email
- **US-S-13** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-13.1 Mark a user who is not in the team; S-13.3 Mark a member removed from the team
- **US-S-14** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-14.1 Open read-only when git has no email; S-14.2 Use the global git email when the repository sets none
- **US-S-15** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-15.1 Open read-only when the email matches two members; S-15.3 Recognise the member once the DNA is fixed
- **US-S-22** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-22.1 Switch role view; S-22.2 Offer only the roles the member holds; S-22.3 Keep the role view per project

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `adr-001` D3; `spec-001` §6; `spec-004` §3 (`/api/p/:pid`, `role-view`); `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
