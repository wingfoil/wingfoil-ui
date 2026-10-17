# User Story Map — Stories

**Version:** 0.6
**Date:** 2026-10-17 (0.2: US-S-11, US-X-07 moved to v0.2 — session 2; 0.3: US-C-05, US-C-06 dropped with C3 — session 3; 0.4: input versions — session 6; 0.5: US-X-10 page title — initial-design session 2; 0.6: *Update* is `git pull --ff-only`, the automatic update a fast-forward `merge --ff-only` of the fetched upstream — dev-loop task-040, D40-8)
**Status:** Draft — specification-downcast session 1 (`user-story-mapping`, phases
`vertical-explosion` and `mvp-cut`)
**Input:** `01_backbone.md` · `docs/01_vision/05_journeys.md` (v0.3) · `06_features.md` (v0.6) ·
`07_sequencer.md` (v0.5) · `04_personas.md`

Under each task of the backbone, the stories that explode it, written as
*As <persona>, I want <action> so that <benefit>*.

- **ID** `US-<area>-<nn>`: `<area>` is the area of the story's main feature in `06_features.md`
  (S, T, G, M, R, A, C, Y, X — the release `pillar` values; W1/W2 belong to area M, the user guide
  to X), `L` for future stories; `<nn>` follows the order of the map within the area. The id does
  not depend on the backbone, so activities can be added or reordered without renumbering.
  Backlog ids, not Memory ids: they become backlog records in `backlog-export`.
- **Features** the `06_features.md` ids the story delivers (first id = the main one).
- **Journey** `J<n>.<step>`; `—` when the story comes from a feature or a rule, not a step.
- **Release** `[MVP · vX.Y]` from `07_sequencer.md`, or `[Future · Ln]`. A story tagged with a
  release is complete in it; a later upgrade of the same feature is a separate story.
- **Kind** **N** nominal · **E** edge case or error path (from the journeys' common rules,
  obstacles and the features' refusal cases).

Personas: Morgan (approver / tech lead), Casey (product owner), Jordan (developer), Sam
(reviewer), Alex (solo maintainer, every role), Riley (newcomer, not in the team); "a member"
means any of them.

---

## 1. Launch the console

### 1.1 Start the console

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-01 | As Alex, I want to start the console with `npx wingfoil-ui` and have the browser open on it, so that I use it without installing anything beyond Node 22 | S1 | — | [MVP · v0.1] | N |
| US-S-02 | As Alex, I want a stable `wingfoil-ui` 1.0 with a published support matrix of WingFoil versions, so that I know which of my projects it can open | S3, S1 | — | [MVP · v1.0] | N |
| US-X-01 | As Riley, I want a user guide with screenshots of every MVP screen, so that I learn the console without asking the team | — (v1.0 scope: user guide) | — | [MVP · v1.0] | N |

### 1.2 Reach it safely

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-X-02 | As a member, I want the console to accept only my browser session, through a token given at launch, so that nobody else on my machine drives my projects through it | X4 | — | [MVP · v0.1] | N |
| US-X-03 | As a member, I want requests from other machines refused (loopback only), so that nobody on my network reads or acts on my projects | X4 | — | [MVP · v0.1] | E |
| US-X-04 | As a member, I want requests from another web page (foreign Origin or Host, DNS rebinding) or without the session token refused, writes included, so that a malicious site cannot run my CLI | X4 | — | [MVP · v0.1] | E |
| US-X-05 | As a member, I want URLs to carry opaque project ids, never file-system paths, so that my folder layout is not exposed | X4 | — | [MVP · v0.1] | E |

## 2. Open a project

### 2.1 Add a project

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-03 | As Alex, I want to add a local folder holding a WingFoil project, so that I can browse it (in v0.1 it opens on the Memory list) | S2 | J0.1–2 | [MVP · v0.1] | N |
| US-S-04 | As Alex, I want to add a project from a remote git URL, with the working directory auto-filled and the clone made for me, so that I do not clone it by hand | S2 | J0.2 | [MVP · v0.1] | N |
| US-S-05 | As Alex, I want a folder that is not a WingFoil project (no `.wingfoil/`) refused with the reason, so that the list holds only projects the UI can read | S2, S3 | J0.3 | [MVP · v0.1] | E |
| US-S-06 | As Alex, I want a second add of a repository already in the list (same remote, or a working copy of it) refused with a pointer to the existing entry, so that one project never shows twice | S2 | J0 rules | [MVP · v0.1] | E |
| US-S-07 | As Alex, I want a failed clone (unreachable URL, authentication refused, target folder not empty) reported with git's reason and nothing added, so that I know what to fix | S2 | J0.2 | [MVP · v0.1] | E |
| US-T-01 | As Alex, I want a newly added project to open on Today for my role view, so that I start from what requires me | T1, S4 | J0.4 | [MVP · v0.2] | N |

### 2.2 Learn what it supports

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-08 | As Alex, I want to see the project's WingFoil version and the capabilities it lacks when I add it, so that I know up front what I cannot do yet | S3 | J0.3 | [MVP · v0.1] | N |
| US-S-09 | As Alex, I want a project whose WingFoil version is outside the supported range opened read-only with the reason, so that I never act through a CLI the UI was not tested with | S3 | J0 rules | [MVP · v0.1] | E |
| US-S-10 | As Alex, I want a project with no `wingfoil` CLI (neither in its `node_modules` nor on the PATH) not opened, with install instructions, so that I know how to make it readable | S3, S1 | J0 rules | [MVP · v0.1] | E |
| US-S-11 | As a member, I want a capability that applies to the project but that its WingFoil version or my role lacks shown read-only with the reason, and one that does not apply hidden, so that I can tell "not now" from "not here" | S3 | common rules | [MVP · v0.2] | E |

### 2.3 Be recognised

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-12 | As a member, I want to be recognised from my `git config user.email` matched against `dna.team.members`, with my name and roles shown in the shell, so that I never log in | S4 | J0.4 | [MVP · v0.1] | N |
| US-S-13 | As Riley, I want a "not in team" badge and every view read-only when my git email is not in the team, so that I explore safely | S4 | J6.1 | [MVP · v0.1] | E |
| US-S-14 | As a member with no git email configured, I want the project read-only with a "no identity" notice that says how to set it, so that I know why I cannot act | S4 | — | [MVP · v0.1] | E |
| US-S-15 | As a member whose git email matches several team members, I want the project read-only with a warning naming them, so that no action is taken under the wrong identity | S4 | — | [MVP · v0.1] | E |

### 2.4 Switch and remove projects

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-16 | As Alex, I want to switch project from the project switcher and see the same screens in the other project's vocabulary, with nothing of the first project left on screen, so that I work on several projects at once | S2 | J5.3 | [MVP · v0.1] | N |
| US-S-17 | As Alex, I want my project list kept across restarts of the console, so that I add each project once | S2 | — | [MVP · v0.1] | N |
| US-S-18 | As Alex, I want to remove a project from the list without touching its files, so that I keep the list tidy | S2 | — | [MVP · v0.1] | N |
| US-S-19 | As Alex, I want a project whose folder was moved or deleted shown as unavailable, with the option to remove it, so that one missing folder does not break the console | S2 | — | [MVP · v0.1] | E |
| US-S-20 | As Alex, I want to switch project, open any element and navigate from the command palette (⌘K), so that everything is one shortcut away | S6 | J5.3 | [MVP · v0.3] | N |

## 3. See what requires me

### 3.1 Know how much is waiting

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-21 | As Morgan, I want a bell with the count of items to unblock and a list of updates, so that I know how much is waiting before opening anything | S7 | J1.1 | [MVP · v0.2] | N |

### 3.2 Read what requires my roles

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-T-02 | As Morgan, I want *Requires you* to list the items whose next move needs a role of my view — type, title, reason, age, one primary action each — so that I prioritise without navigating | T1, S9 | J1.2 | [MVP · v0.2] | N |
| US-T-03 | As Jordan, I want my work rejected back listed first in *Requires you*, with the rejection reason, so that I fix it before starting anything new | T1 | J3.1 | [MVP · v0.2] | N |
| US-T-04 | As Sam, I want the reviewer view of *Requires you* to list the items in a review state, so that my review queue is one list | T1, M1 | J4.1 | [MVP · v0.2] | N |
| US-T-05 | As a member, I want an element in a state the UI has no convention for listed as "Action required" with its own state name, so that projects with custom states still show what is pending | T1, S9 | — | [MVP · v0.2] | E |
| US-T-06 | As Sam, without the `approver` role on WingFoil 0.2.2, I want a gate shown as informational ("reserved to approver", with who can act) instead of an action of mine, so that Today never promises what the CLI will refuse | T1, S9 | J4 obstacle | [MVP · v0.2] | E |
| US-T-07 | As Morgan, I want an explicit "nothing requires you" state when the list is empty, so that I know the list is current, not broken | T1 | — | [MVP · v0.2] | E |
| US-T-08 | As Casey, I want the recent Memory activity on Today with a link to the Timeline, so that I see what moved since I last looked | T5 | J2.1 | [MVP · v0.3] | N |
| US-T-09 | As Jordan, I want the next workflow step for my role in *Requires you*, so that I know what to do after my rejected work | T3 | J3.1 | [MVP · v0.4] | N |
| US-T-10 | As Jordan, on a project whose WingFoil is older than 0.3, I want the next-step area shown read-only with the reason, so that I know why it is empty | T3, S3 | J3 obstacle | [MVP · v0.4] | E |

### 3.3 See who else must act

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-T-11 | As Morgan, I want *Waiting on others* to list the items blocked on another role, with the role and the members who hold it, so that I follow up with the right person | T4, R3 | J1.5 | [MVP · v0.2] | N |

### 3.4 Switch hats

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-22 | As Alex, I want to switch role view (e.g. approver → developer) in the shell, so that the screens show what that role needs | S4 | J5.2 | [MVP · v0.1] | N |
| US-S-23 | As Alex, I want an all-roles summary on Today — for each role I hold, the count and top items requiring it — so that I know which hat to put on first | S5 | J5.1 | [MVP · v0.2] | N |

## 4. Decide and act

### 4.1 Inspect an element

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-G-01 | As Morgan, I want an element panel with the state machine, rejection banner, summary, references (missing required ones flagged) and history with commits, so that I see everything about an element in one place | G1 | J1.3 | [MVP · v0.1] | N |
| US-G-02 | As Sam, I want the element panel to show the directives that apply to the element's roles, so that I review against the standards that apply | G1, R2 | J4.2 | [MVP · v0.1] | N |
| US-G-03 | As Casey, I want to read a decision-log as a rendered document in the element panel, with its history, so that I understand the decision before taking it | G1, R4 | J2.3 | [MVP · v0.3] | N |

### 4.2 Decide a gate

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-G-04 | As Morgan, I want *Approve* on a Today item to open the element panel with the gate footer and the reason field focused, so that a gate takes at most two clicks from Today | G2, T1 | J1.3 | [MVP · v0.2] | N |
| US-G-05 | As Morgan, I want every outcome of the gate side by side — approve and each reject target — so that I choose the outcome, not a verb | G2, S9 | J1.4 | [MVP · v0.2] | N |
| US-G-06 | As Morgan, I want the reason required for approve too, pre-filled with an editable default, so that the CLI (which requires `--reason`) never refuses my approval | G2 | J1.4 | [MVP · v0.2] | N |
| US-G-07 | As Morgan, I want the outcome buttons disabled while the reason is empty, so that no CLI call is made that would be refused | G2 | — | [MVP · v0.2] | E |
| US-G-08 | As Casey, holding `approver`, I want to approve or reject a decision-log `in-discussion` from its panel, so that I take product decisions without a developer | G2 | J2.4 | [MVP · v0.3] | N |
| US-G-09 | As Sam, without `approver` on WingFoil 0.2.2, I want the gate footer to be informational — "reserved to approver" and the members who can act — so that I know whom to ask | G2, S9 | J4 obstacle | [MVP · v0.2] | E |

### 4.3 Submit my work

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-G-10 | As Jordan, I want to submit an element from its single-action footer, so that it moves to its next state without the terminal | G3 | J3.5 | [MVP · v0.2] | N |
| US-G-11 | As a member, I want gate and submit actions blocked, with the reason, on an element with local changes, so that a UI action never commits someone's uncommitted edits | G2, G3, S8 | common rules | [MVP · v0.2] | E |
| US-G-12 | As a member, I want governed actions blocked while my copy is behind the remote, with a link to *Update*, so that I never act on a stale copy | G2, G3, Y4 | common rules | [MVP · v0.2] | E |
| US-S-24 | As a member, I want no action footer on an element in a terminal state, and a "waiting for the workflow engine" note on one in an engine-waiting state, so that I am never offered an impossible move | S9, G1 | — | [MVP · v0.2] | E |

### 4.4 Know the outcome

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-G-13 | As Morgan, I want a toast with the result and the `wf(…)` commit (and "pushed" when it was pushed), so that I know the decision is recorded and shared | G4 | J1.4 | [MVP · v0.2] | N |
| US-G-14 | As Morgan, I want a refused action shown as a red toast with the CLI's own reason and the element left unchanged, so that I know what to fix (missing field, wrong role) | G4 | J1 obstacle | [MVP · v0.2] | E |

## 5. Understand the project

### 5.1 Follow progress

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-T-12 | As Casey, I want a progress card with scope, completion, iterated x/y, open bugs and pending gates, so that I understand progress in plain words | T2 | J2.1 | [MVP · v0.3] | N |
| US-T-13 | As Casey, I want each figure of the progress card to open the Memory list filtered on the items behind it, so that I see what the number means | T2, M1 | J2.2 | [MVP · v0.3] | N |
| US-T-14 | As Casey, I want the definition of completion (unweighted mean of per-reference completion) shown on hover, so that I can explain the figure | T2, R5 | — | [MVP · v0.3] | N |
| US-T-15 | As Casey, on a project whose WingFoil is older than 0.3, I want the phase figure shown read-only with the reason and the other figures shown, so that I still get Memory progress | T2, S3 | J2 obstacle | [MVP · v0.3] | E |
| US-T-16 | As Casey, I want the progress card to show phase X of Y of the current workflow, so that I know where the project is in its life cycle | T2 | J2.1 | [MVP · v0.4] | N |

### 5.2 Browse Memory

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-M-01 | As a member, I want the Memory list with type filters from `memory.yaml` (with counts) and state filters (buckets for all types, real states per type), each item opening its panel, so that I find any element | M1 | J2.2, J4.1 | [MVP · v0.1] | N |
| US-M-02 | As a member, on a project with types and states unknown to the UI, I want them listed under their own names and grouped in generic buckets, so that nothing is hidden because it is unfamiliar | M1, S9 | — | [MVP · v0.1] | E |
| US-M-03 | As Morgan, I want a filter and a badge for elements missing a reference their type requires, so that I catch incomplete work before it reaches a gate | M2 | J2.2 | [MVP · v0.3] | N |
| US-M-04 | As Morgan, on a project that declares no required references (no `ui.yaml`, none inferred), I want the missing-references filter hidden, so that an empty filter does not look like good news | M2, S3 | — | [MVP · v0.3] | E |

### 5.3 Trace features to work

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-R-01 | As Casey, I want a traceability view from each reference to its linked elements, with completion, coverage and missing references, so that I see what is done, open and missing for a feature | R5 | J2.5 | [MVP · v0.3] | N |

### 5.4 Read the history

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-R-02 | As Casey, I want a time axis of Memory creations and state changes per day, parsed from `wf(…)` commits, so that I see the project's pace | R6 | J2.2 | [MVP · v0.3] | N |
| US-R-03 | As Casey, I want commits that are not `wf(…)` commits left out of the time axis (and kept in the git tree), so that the axis shows governed events only | R6 | — | [MVP · v0.3] | E |
| US-R-04 | As Morgan, I want a git tree with lanes and filters, Memory commits marked, each commit opening its files and element, so that I relate history to governed state | R7 | J8 | [MVP · v0.3] | N |

### 5.5 Read rules and team

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-R-05 | As Riley, I want a DNA view (modules, stacks, methodologies, team and roles, paths), so that I understand how the project is set up | R1 | J6.2 | [MVP · v0.1] | N |
| US-R-06 | As Jordan, I want the directives with their bound roles, filterable "only mine / all", with the body rendered, so that I know the standards I work under | R2 | J4.2, J6.2 | [MVP · v0.1] | N |
| US-R-07 | As Morgan, I want a team view with member cards, roles and pending gates per member, agents marked "never approve", so that I know who can act on what | R3 | J1.5, J6.2 | [MVP · v0.1] | N |

### 5.6 Read documents and files

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-R-08 | As Riley, I want an index of the documents under `paths.docs`, without the Memory and plan files, rendered as Markdown with links that stay in the UI, so that I read the project's documentation in one place | R4 | J2.3, J6.2 | [MVP · v0.1] | N |
| US-R-09 | As Riley, I want a document link to a Memory file to open its element panel, and a link that leaves the repository or points nowhere marked as such, so that every link is safe to follow | R4, G1 | — | [MVP · v0.1] | E |
| US-R-10 | As a member, I want a read-only file tree and viewer of the working tree, files differing from HEAD marked, with highlighting and Markdown preview, so that I read any file without leaving the UI | R8 | J6.2 | [MVP · v0.3] | N |
| US-R-11 | As a member, I want any path outside the repository (`..`, a symlink that escapes it) refused by the file browser, so that the UI never reads beyond the project | R8, X4 | — | [MVP · v0.3] | E |

### 5.7 See the workflows

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-M-05 | As a member, I want the main workflow tree drawn from the project's definitions, with the elements each phase iterates, so that I understand the process the project follows | W1 | J6.2 | [MVP · v0.3] | N |
| US-M-06 | As Jordan, I want the workflow tree to show the current position and who must act, so that I see where the process stands | W1 | J3.2 | [MVP · v0.4] | N |

## 6. Capture new elements

### 6.1 Find the ingestion

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-M-07 | As a member, I want one card per ingestion workflow with its steps, open runs and a *Start* button, so that I see how each kind of element enters the project | W2 | J7.1 | [MVP · v0.3] | N |

### 6.2 Run the ingestion

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-G-15 | As Jordan, I want to start a decision-log ingestion from Memory, Workflow or ⌘K, give its title and submit it, so that a decision enters the project through its workflow | G5, S6 | J7.1–3 | [MVP · v0.3] | N |
| US-G-16 | As Jordan, I want the ingestion of a type whose required fields the CLI cannot set (bug, adr, tech-spec, service on WingFoil 0.2.2) shown read-only with the reason, so that the UI never edits a draft file | G5, S3 | J7 rule | [MVP · v0.3] | E |
| US-G-17 | As Jordan, I want an ingestion step the CLI refuses reported as a red toast with the CLI's reason, nothing created or a created draft named, so that I know the project's state after the failure | G5, G4 | — | [MVP · v0.3] | E |
| US-G-18 | As Jordan, I want to report a bug through its ingestion with its required fields set by the CLI, when the project's WingFoil sets them (field setter or `workflow start`), so that defects are captured in the UI too | G5 | J7.1–2 | [MVP · v0.4] | N |

## 7. Work with agents

### 7.1 Prepare the step

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-T-17 | As Jordan, I want the next step's context — role, directives, DNA modules, specs, branch — shown before launch, so that I know what the agent will receive | T3 | J3.2 | [MVP · v0.4] | N |

### 7.2 Launch the agent

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-A-01 | As Jordan, I want to launch the agent on the next step or an element, with a confirmation when my settings ask for it, so that the agent starts with the right context | A1, C4 | J3.3 | [MVP · v0.4] | N |
| US-A-02 | As Sam, I want to launch an assisted review on an element, so that an agent supports my review | A1 | J4.3 | [MVP · v0.4] | N |
| US-A-03 | As Jordan, on a project whose WingFoil cannot execute agents, I want *Launch agent* shown read-only with the reason, so that I know to run the agent outside the UI | A1, S3 | J3 obstacle | [MVP · v0.4] | E |

### 7.3 Follow the run

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-A-04 | As Jordan, I want *Launch agent* to become *View agent's logs* and show the run's output live, so that I follow it inside the UI | A2 | J3.4, J4.3 | [MVP · v0.4] | N |
| US-A-05 | As Jordan, I want a failed run (non-zero exit) shown in the logs with its exit status and the button back to *Launch agent*, so that I can retry | A2 | — | [MVP · v0.4] | E |

## 8. Stay in sync

### 8.1 Know the copy's state

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-Y-01 | As a member, I want the branch, ahead/behind counts and local changes in the sidebar, so that I know whether my copy is current | Y1 | J8.1 | [MVP · v0.2] | N |
| US-Y-02 | As a member, I want the remote fetched automatically (on by default) and on demand, so that ahead/behind is always fresh | Y2, C4 | J8.1 | [MVP · v0.2] | N |
| US-Y-03 | As a member, I want a failed fetch (offline, authentication) shown with the time of the last successful fetch, without blocking reading, so that I know how fresh the status is | Y2 | — | [MVP · v0.2] | E |
| US-Y-04 | As a member of a repository with no remote, I want the sync controls hidden, so that the UI does not offer what cannot apply | Y1, S3 | — | [MVP · v0.2] | E |

### 8.2 Bring the copy up to date

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-Y-05 | As a member, I want *Update* to fast-forward my copy (`git pull --ff-only`), and an automatic fast-forward (`git merge --ff-only` of the fetched upstream) when my settings say so, so that governed actions are unblocked | Y4, C4 | J8.2 | [MVP · v0.2] | N |
| US-Y-06 | As a member, I want an update that cannot fast-forward (diverged history, local changes in the way) to leave actions blocked and tell me what to run in the terminal, so that the UI never merges or rebases | Y4 | J8.3 | [MVP · v0.2] | E |

### 8.3 Share what was committed

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-Y-07 | As a member, I want UI commits pushed automatically when my settings say so (off by default), or with *Push*, so that nothing committed from the UI stays unshared by accident | Y3, C4 | J8.5 | [MVP · v0.2] | N |
| US-Y-08 | As a member, I want a rejected push (remote moved, no permission) shown as a red toast with git's reason, the commit kept local and counted as ahead, so that I know it is not shared yet | Y3, G4 | — | [MVP · v0.2] | E |

## 9. Configure the UI

### 9.1 Make the project's conventions explicit

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-C-01 | As Alex, I want Taxonomy and Progress tabs that explain each `ui.yaml` key and its current value (declared or inferred), so that I understand how the UI reads my project | C1 | J2.1 | [MVP · v0.3] | N |
| US-C-02 | As Alex, on a project without `ui.yaml`, I want to apply a preset (Kanban, Scrum, WingFoil `sw-life-cycle`) as one `chore(ui)` commit touching only `.wingfoil/ui.yaml`, so that the conventions become explicit and versioned | C1 | J0.3 | [MVP · v0.3] | N |
| US-C-03 | As Alex, I want `ui.yaml` content that fails its schema refused before anything is written, so that the UI never commits an invalid configuration | C1 | — | [MVP · v0.3] | E |
| US-C-04 | As Alex, I want an existing `ui.yaml` that fails its schema ignored in favour of inferred defaults, with a warning naming the error, so that a bad hand edit does not break the console | C1 | — | [MVP · v0.3] | E |

### 9.3 Set my own preferences

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-C-07 | As a member, I want local, per-user settings — auto-fetch, auto-update, auto-push, theme, agent launch confirmation — kept on my machine and never committed, so that my preferences do not change the project | C4 | J8.1 | [MVP · v0.2] | N |

### 9.4 Learn how to join

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-C-08 | As Riley, I want a *How to join* panel naming the tech lead and the exact `wingfoil dna add team.members …` command for my email, so that I know the next step to become a member | C2 | J6.3 | [MVP · v0.2] | N |
| US-C-09 | As Riley, on a project whose DNA declares no tech lead, I want *How to join* to say so and still give the command, so that I can ask any member to run it | C2 | — | [MVP · v0.2] | E |

## Across every activity

### X.1 See the project as the CLI reads it

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-25 | As a member, I want the UI to show the project as the CLI reads it — the working tree — with elements that have uncommitted changes marked *local changes*, so that what I see is what the CLI would act on | S8 | common rules | [MVP · v0.1] | N |
| US-S-26 | As a member, I want the views to refresh by themselves after a new commit or a file change, so that I never act on a stale screen | S8 | — | [MVP · v0.1] | N |
| US-S-27 | As a member, I want a CLI read that fails (e.g. a malformed governance file) shown as an error with the CLI's message on the affected view, the rest of the UI usable, so that one broken file does not hide the project | S1 | — | [MVP · v0.1] | E |

### X.2 Work with any methodology

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-S-28 | As Alex, I want a Kanban project, the WingFoil (`custom`) project and a project with unknown types and states and no `ui.yaml` to render with no UI code change, the actions derived from each project's own definitions, so that the UI fits any methodology | S9, M1 | — | [MVP · v0.1] | N |

### X.3 Use it with any ability and setting

| ID | Story | Features | Journey | Release | Kind |
|----|-------|----------|---------|---------|------|
| US-X-06 | As a member who uses only the keyboard, I want every MVP screen and action reachable and operable from the keyboard with a visible focus, so that I can use the console without a mouse | X1 | — | [MVP · v0.1] | N |
| US-X-07 | As a member using a screen reader, I want toasts, state changes and blocked actions announced, so that I know the outcome of what I did | X1 | — | [MVP · v0.2] | E |
| US-X-08 | As a member, I want light and dark themes with AA contrast in each, following my system by default (a choice in the UI settings from v0.2), so that the console is readable in any setting | X3 | — | [MVP · v0.1] | N |
| US-X-09 | As Alex, I want every UI string externalised (English only in the MVP), so that a second language can be added without touching the screens | X2 | — | [MVP · v0.1] | N |
| US-X-10 | As Alex, I want the browser tab title to name the project, its state (phase or completion, when the release shows it) and the current view or element, before "WingFoil UI", so that I tell my projects and views apart among my tabs | X1 | J5 | [MVP · v0.1] | N |

---

## Future stories (outside the MVP cut)

One story per later feature of `06_features.md`; specified when their dependency exists.

| ID | Story | Features | Release |
|----|-------|----------|---------|
| US-L-01 | As Morgan, I want to edit an element's title, summary and references from its panel, so that I fix them without the terminal | L1 | [Future · L1] |
| US-L-02 | As Alex, I want to edit DNA, directives and workflows in the UI, so that I configure the project in one place | L2 | [Future · L2] |
| US-L-03 | As Casey, I want artifacts listed by phase, with URLs linked to `service` elements, so that I find what each phase produced | L3 | [Future · L3] |
| US-L-04 | As Jordan, I want to edit a repository file and commit it, WingFoil's files only with a specific permission reconciled with `cli-only-writes`, so that small fixes need no editor | L4 | [Future · L4] |
| US-L-05 | As Morgan, I want email or chat notifications for pending gates, so that I learn of them away from the console | L5 | [Future · L5] |
| US-L-06 | As Morgan, I want the UI to show the action permissions WingFoil defines and dim the actions they forbid, once WingFoil implements them, so that the UI follows the team's rules without keeping its own | L6 | [Future · L6] |
| US-L-07 | As Alex, I want a page for WingFoil's core settings, taking precedence over my UI settings where they overlap (e.g. `git.autoPush`), so that team-wide rules win over personal ones | L7 | [Future · L7] |
| US-L-08 | As Riley, I want the UI in a second language, so that I use it in my own | L8 | [Future · L8] |
| US-L-09 | As Morgan, I want a multi-user or remote deployment of the console, so that the team shares one instance | L9 | [Future · L9] |
| US-L-10 | As Jordan, I want several working copies (worktrees, parallel branches) of one repository in the list, so that I follow parallel work | L10 | [Future · L10] |
