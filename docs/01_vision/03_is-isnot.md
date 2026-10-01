# Is / Is Not / Does / Does Not — WingFoil UI

**Version:** 0.4
**Date:** 2026-10-01 (0.2: git sync rule from session 3, Q4; 0.3: local settings — coherence audit;
0.4: external review — session 7)
**Status:** Accepted in lean-inception session 1 (2026-10-01)
**Input:** `01_product-brief.md` §6–8 · `02_product-vision.md` (Key Decisions)

Every item of brief §7 is placed here (marked *brief §7*); the others come from the brief's scope
(§6), constraints (§8), the UX reference principles and the session 1 decisions.

---

## IS

- A local web interface over WingFoil and git, for the human members of a WingFoil-governed
  project *(brief §7)*.
- A **client of the WingFoil CLI**: a local server that runs **the observed project's own**
  `wingfoil` (its pinned one, else the one on the PATH) and serves the UI on `localhost`.
- A **local-only** server: it listens on the loopback interface only and refuses requests from
  other web pages (session token, Origin/Host checks — X4).
- **Methodology-agnostic**: it renders whatever the project declares — Memory types, states,
  gates, roles, workflows *(brief §7)*.
- **Role-aware**: the same screens, filled by what each role must do or unblock *(brief §7)*.
- A **multi-project** console: one UI for every WingFoil project the user adds (local folder or
  cloned remote); the project list is the UI's own local state, outside any repository.
- Accessible (**WCAG 2.1 AA**), English-only in the MVP.

## IS NOT

- A second source of truth, database or cache that can diverge from the repository *(brief §7)*.
  Its only persistent state is its own local project list and per-user settings, and each
  project's `.wingfoil/ui.yaml`.
- A way to bypass WingFoil: no element is created outside a workflow (ingestion or main), no state
  changes outside the type's state machine *(brief §7)*.
- An IDE, a code editor, a code reviewer or an agent *(brief §7)*.
- A hosted or multi-tenant service, in the MVP *(brief §7)*.
- A **security boundary between team members**: its action permissions are advisory; only the
  checks WingFoil's CLI enforces (e.g. the approver role on gates) protect the project. This is
  distinct from the protection of the local server itself (X4), which is mandatory.
- A part of WingFoil core: it requires no WingFoil change to exist, and it does not extend
  WingFoil's schema beyond its own `ui.yaml`.
- A git client: it fetches, updates **fast-forward only** (`pull --ff-only`) and pushes what WingFoil
  committed (automatically when the options are on, `05_journeys.md` Journey 8); it does not
  merge, rebase or resolve conflicts — a diverged copy is updated from the terminal.

## DOES

- Identifies the current user from `git config user.email`, matched to `dna.team.members`, and
  offers a view per role the member holds.
- Shows on one screen (**Today**) what requires the user, what waits on others, the next workflow
  step and the project's progress.
- Turns every gate into **all its outcomes side by side** with a reason field, executed as the
  CLI verb, and shows the resulting `wf(…)` commit.
- Starts ingestion workflows and, when the project's WingFoil provides them, main workflow steps
  and agent launches.
- Shows the whole project read-only: workflows and current position, Memory with filters and each
  element's state machine and history, DNA, directives, team, documentation (rendered Markdown),
  traceability, timeline, repository files.
- Detects the project's WingFoil version and shows capabilities it lacks **read-only or hidden,
  with the reason**.
- Keeps its own per-project conventions (taxonomy, reference patterns, progress card) in
  `.wingfoil/ui.yaml`, with explanations in the Configuration page.
- Shows the project **as the CLI reads it — the working tree** — and marks elements with
  uncommitted changes; governed actions on those elements are blocked (the CLI would commit the
  local edits with them).
- Blocks governed actions while the copy is **behind** the remote, until it is updated.
- Refreshes when the repository changes (git HEAD, working-tree status, file watch).
- Writes only within its **write classes** (`02_product-vision.md`): governed changes through the
  CLI, its own `ui.yaml`, git transport.

## DOES NOT

- Write `.wingfoil/` or Memory files directly (its own `ui.yaml` excepted) — every governed change
  is a WingFoil CLI call; operations without a CLI verb stay read-only until WingFoil provides one.
- Edit DNA, directives, workflows or element content in the MVP (later, as CLI verbs appear).
- Create, edit or delete repository files in the MVP (Files is read-only).
- Re-implement WingFoil rules: state machines, gates, role checks, id allocation, validation.
- Send external notifications (email, chat) — in-app notifications only.
- Require an account or login: identity is the git identity.
- Run the agents' work: it starts `agent execute` (when available) and shows where its output
  goes; it does not inspect or judge the agent's result.

