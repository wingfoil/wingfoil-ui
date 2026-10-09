---
id: task-015-project-switcher
type: task
title: "Project switcher"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-16"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-008-project-list-api", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project switcher: list in stored order, switch project (closing the previous project's panel), remove with confirmation, unavailable entries (folder or CLI missing) with recovery, opaque ids in every URL.

**Backlog items:** US-S-16, US-S-17, US-S-18, US-S-19, US-X-05

- US-S-16 — As Alex, I want to switch project from the project switcher and see the same screens in the other project's vocabulary, with nothing of the first project left on screen, so that I work on several projects at once
- US-S-17 — As Alex, I want my project list kept across restarts of the console, so that I add each project once
- US-S-18 — As Alex, I want to remove a project from the list without touching its files, so that I keep the list tidy
- US-S-19 — As Alex, I want a project whose folder was moved or deleted shown as unavailable, with the option to remove it, so that one missing folder does not break the console
- US-X-05 — As a member, I want URLs to carry opaque project ids, never file-system paths, so that my folder layout is not exposed

## Acceptance Criteria

- **US-S-16** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-16.1 Switch to another project; S-16.2 Close the element panel of the previous project on switch
- **US-S-17** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-17.1 Keep the project list after a restart; S-17.2 Keep the list out of every project repository
- **US-S-18** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-18.1 Remove a project from the list; S-18.2 Cancel the removal
- **US-S-19** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-19.1 Show a moved project as unavailable; S-19.2 Recover when the folder comes back
- **US-X-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-05.1 Use opaque project ids in URLs; X-05.2 Refuse a project id that is not in the list

Also closes the e2e of **X-02.1** (US-X-02, task-003): the fragment is removed from the address bar and the switcher lists the fixture.

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-006` §2–3; `spec-004` §3; `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-09)

- **depends_on acknowledged (dl-015):** Execution Notes of task-008, 012, 013, 017, 018 read, plus
  the hand-overs of task-003 and task-007 to this task:
  - 008 — `GET /api/projects` → `{ projects: [{ id, name, path, remote, availability, command? }] }`
    in stored order; `availability` ∈ `ok` · `folder-not-found` · `not-wingfoil` · `cli-not-found`
    (with `command`); computed on every list read from files only (no process); a `projects` event
    after an add/remove and when a list read or the periodic check (10 s) sees a change.
    `DELETE /api/projects/:pid` → 204, 404 `not-found` for an unknown id; no file touched.
  - 007 — the list kept in `state.json` under `WINGFOIL_UI_STATE_DIR` (never in a repository);
    ids `p_` + 12 base32 characters, never derived from the path; the screens of S-17.1, S-17.2,
    X-05.1, X-05.2, X-02.1 close here; Playwright suites build the server themselves (done by the
    e2e `global-setup.ts` of task-013).
  - 003/013 — X-02.1's browser half is `session/session.ts` (fragment read, `history.replaceState`,
    `POST /api/session`); this task asserts it through the switcher listing the fixture.
  - 012 — every project read is `/api/p/:pid/…`; an unknown pid is 404 before any read (X-05.2).
  - 013 — `ProjectSwitcher` placeholder (RAC `MenuTrigger`, "Projects ▾", *Add project…* →
    `useAddProject().show()`); `projectsQuery()` refetched on `projects`; RAC `RouterProvider`
    wired, a concrete `href` such as `/p/<pid>` navigates client side (R2-1); errors through
    `errorMessage()`/`ErrorText`, no answer → `error.unreachable`; the shell e2e asserts the
    trigger as button "Projects" and *Add project…* as a `menuitem`.
  - 017/018 — the element panel is the route `/p/$pid/e/$eid` replacing the Outlet; every project
    key under `['p', pid]`; page titles take the project name from `GET /api/projects`.
- **Specs:** spec-006 §2 (order = insertion order, availability computed, name shown while
  unavailable), §3 (remove drops the entry, no file touched; unknown pid 404); spec-004 §3 (routes,
  204); ux-reference §3 (switcher: name + path, × to remove, *Add project…*); prototype (popover of
  320 px: rows name + mono path, × per row, separator, *+ Add project…*, footnote "Added projects
  stay saved in this UI"; trigger = project name + methodology ▾; a pick keeps the current view and
  drops the selection; × removes **without confirmation**; no unavailable state drawn).
- **Spec gaps / decisions for the user (W4-1 … W4-7)** — see the report; nothing below that depends
  on them is built before the answer.
  - W4-1 the widget: the prototype's row (open + ×) cannot live in an ARIA menu (no interactive
    child in a `menuitem`; axe `nested-interactive` is serious).
  - W4-2 the removal confirmation (S-18.1/S-18.2 "confirm"/"cancel"; the prototype has none) and
    what follows the removal of the open project.
  - W4-3 unavailable entries: openable or not.
  - W4-4 freshness when the switcher opens (S-19.2 "… and I open the project switcher").
  - W4-5 where a switch lands (same view vs the project's landing view).
  - W4-6 the trigger's text inside a project (the prototype's methodology is not in the list API).
  - W4-7 the start page: the comment of `routes/start.tsx` (task-013) says task-015 lists the
    projects there too; ux-reference §3 has no list on the start page.
- **Design (assuming the recommended options; adjusted to the answers):**
  - `web/src/shell/ProjectSwitcher.tsx` — trigger RAC `DialogTrigger` + `Button` (text "Projects"
    on `/`, the project name inside a project; accessible name "Projects: <name>" so the visible
    text is part of it); `Popover` › `Dialog` (aria-label "Projects") › RAC `GridList`
    (aria-label "Projects", stored order) whose rows are links (`href="/p/<pid>/<view>"`) showing
    name and path, the current project marked `aria-current` (visually: the prototype's selected
    background), and a **Remove** button per row (glyph ×, accessible name "Remove <name>");
    an unavailable row has no `href`, shows "Unavailable — <reason>" (and the install command for
    `cli-not-found`) and the Remove button; then a separator, the *Add project…* button
    (→ `useAddProject().show()`, the dialog frame of task-013 left unfilled for task-014) and the
    footnote. Loading/error of the list: a status line / `ErrorText` inside the popover.
  - `web/src/shell/RemoveProjectDialog.tsx` — modal `alertdialog`: "Remove <name> from the
    list?", "Its folder and its files are not touched.", buttons **Remove** and **Cancel**
    (Escape = Cancel, ux-reference §5); while the request runs the buttons are disabled; a refusal
    or no answer shows `ErrorText` (`error.notFound`, `error.unreachable`, …) inside the dialog.
  - **Shared mutation (checkpoint with the coordinator):** `web/src/api/projects.ts` —
    `removeProject(pid, signal?) → Promise<void>` (`DELETE /api/projects/:pid` through
    `apiRequest`) and `useRemoveProject()` (TanStack `useMutation`; on success it drops the entry
    from the `projectsQuery()` cache and removes the `['p', pid]` queries; the `projects` event
    refetches the list as usual). task-014 adds `addProject(path)` / `cloneProject(url,
    directory?)` and their hooks to the same file. No second list query.
  - Switch target (W4-5 a): `switchTarget(pid, currentPath)` in `web/src/shell/switch-target.ts` —
    the view segment of the current `/p/<old>/<view>/…` path when it is a view of the sidebar
    (`memory`, `dna`, `directives`, `team`, `docs`), else the project root (`/p/<pid>`, which
    redirects to the Memory list); search parameters, the element panel (`e/<eid>`), a document or
    a directive are dropped (S-16.2). Built from the router's view routes, not a hard-coded list.
  - Removal of the open project (W4-2): navigate to `/`; focus back to the switcher's trigger.
  - Catalogue (en.json, same commits): `projects.switcher.current`, `.listLabel`, `.loading`,
    `.empty`, `.footnote`, `.remove`, `.unavailable` (select on the availability),
    `projects.remove.title`, `.body`, `.confirm`, `.cancel` (`common.action.*` reused where they
    exist); the start page comment of `routes/start.tsx` corrected (W4-7 a).
- **Tech specs:** none missing; the ux-reference §3 needs the amendment for the decisions that
  deviate from the prototype (confirmation, unavailable mark, trigger text) — proposed with W4.
- **Test plan:**
  - Unit (`test/web/shell/project-switcher.test.tsx`, `test/web/api/projects.test.ts`,
    `test/web/shell/switch-target.test.ts`): rows in stored order with name and path; current row
    marked; hrefs `/p/<pid>[/<view>]` (never a path); unavailable rows (three reasons, command)
    without a link and with Remove; keyboard (arrows between rows, Enter opens, Remove reachable,
    Escape closes, focus back on the trigger); removal confirm → `DELETE`, list updated, open
    project removed → `/`; cancel → no request; 404/unreachable → `ErrorText`; refetch on open
    (W4-4); every string from the catalogue (key render).
  - e2e `test/e2e/projects.spec.ts` (real bin, kanban + custom fixtures, `scanThemes` both themes
    on the switcher open, the removal confirmation and the unavailable state), one test per
    scenario: S-16.1, S-16.2, S-17.1, S-17.2, S-18.1, S-18.2, S-19.1, S-19.2, X-05.1, X-05.2,
    X-02.1 — the closure table follows in the red/green notes.
