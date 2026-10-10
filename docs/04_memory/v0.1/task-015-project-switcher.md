---
id: task-015-project-switcher
type: task
title: "Project switcher"
status: approved
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

### design decisions (2026-10-09)

- Decided by the user (coordinator), each option (a) as recommended:
  - **W4-1** popover › dialog "Projects" › React Aria grid list: a row per project (name, path;
    a link `/p/<pid>[/<view>]` rendered by React Aria as `data-href`), a **Remove <name>** button
    per row (× icon; Tab moves from the row to it, `keyboardNavigationBehavior="tab"`), a
    separator, the *Add project…* **button** (opening task-013's dialog frame, left unfilled for
    task-014) and the footnote. The two task-013 shell assertions on a `menuitem` now look for the
    button inside the dialog "Projects" (`test/e2e/shell.spec.ts`, `test/web/shell/shell.test.tsx`).
  - **W4-2** modal `alertdialog` "Remove <name> from the list?" / "Its folder and its files are
    not touched." / Cancel (focused first) · Remove; Escape cancels; `ErrorText` inside the dialog
    (`error.notFound`, `error.unreachable`, …); removing the open project goes to `/`; the focus
    returns to the trigger after confirm or cancel.
  - **W4-3** unavailable rows are not links; they show name, path, "Unavailable — <reason>"
    (`folder-not-found`, `not-wingfoil`, `cli-not-found`) and, for `cli-not-found`, "Install it
    with: <command>"; Remove kept. task-014 only has to assert S-10.2.
  - **W4-4** the list is read again (`invalidateQueries(projectsQuery())`) on every opening.
  - **W4-5** a switch keeps the current sidebar view (`switch-target.ts`, from `navGroups` of the
    router); anything below it (panel, document, directive) and the search are dropped; a non-view
    path lands on `/p/<pid>` (→ Memory list).
  - **W4-6** trigger text: the project name inside a project, accessible name "Projects: <name>";
    "Projects" on `/`. The prototype's methodology is not shown.
  - **W4-7** no list on the start page; the comment of `routes/start.tsx` corrected.
  - Shared API **confirmed**: `web/src/api/projects.ts` — `removeProject(pid, signal?)`,
    `forgetProject(queryClient, pid)`, `useRemoveProject({ onRemoved? })`.
  - The coordinator amends ux-reference §3 (0.7) for W4-1/2/3/6 on `main`.
- **W4-8** (gap found in green: S-16.2 needs the switcher while the element panel is open, but
  task-018's panel was a modal drawer — header `aria-hidden`, focus trapped, backdrop over the
  page) — decided (a): the panel is a **non-modal** drawer with the same look. This supersedes the
  "modal" part of task-018's decision 5. Changes to task-018's files:
  `web/src/element/ElementPanel.tsx` (a React Aria `Dialog` in a fixed `div.drawer`, no
  `ModalOverlay`/`Modal`; Escape pressed inside the panel closes it through a native listener on
  the drawer; Close unchanged; focus moved into the dialog on open by React Aria),
  `web/src/element/element.css` (`.drawer-overlay` removed; `.drawer` fixed below the header,
  `z-index: 4`, no backdrop), `test/web/element/panel.test.tsx` ("keeps the focus there" replaced
  by "focuses inside the panel on open and leaves the header operable" and "closes with Escape only
  when pressed inside the panel"). `test/e2e/element-panel.spec.ts` needed no change (it asserts
  focus inside the panel, Close, Escape, focus on `main` after closing). The coordinator amends
  ux-reference §4.2 (0.8).

### red / green / refactor (2026-10-09)

- **Red:** `test/web/shell/project-switcher.test.tsx`, `test/web/shell/switch-target.test.ts`,
  `test/web/api/projects.test.tsx` written first: 17 failing (modules missing, the switcher still a
  menu). **Green:** `web/src/api/projects.ts`, `web/src/shell/switch-target.ts`,
  `web/src/shell/ProjectSwitcher.tsx` (rewritten), `web/src/shell/RemoveProjectDialog.tsx`,
  `en.json` (`projects.switcher.*`, `projects.remove.*`), `theme/base.css` (switcher rows,
  `.icon-button`, `.button-danger`, `.dialog-actions`, `.dialog-error`).
- **Deviations / findings:**
  - React Aria renders a link row of a grid list as a `div[role=row]` with `data-href` (no `<a>`).
    It opens on press or Enter through the `RouterProvider`. The tests assert `data-href`.
  - The popover closes on any navigation (`router.subscribe('onBeforeNavigate')`), not on the
    pathname. A pathname check would reopen it on a back navigation to the same path.
  - "current project" is a visually hidden catalogue string in the open project's row (React Aria
    passes no `aria-current` to a grid-list row).
  - W4-8 found in green (S-16.2 with a modal panel), decided and built; see "design decisions".
  - `test/e2e/support/console.ts`: new `ConsoleOptions.stateDir`, a state directory owned by the
    test that survives `stop()` (S-17.1 restarts on the same directory). It is seeded only when it
    has no `state.json`, and `pids` is then empty.
  - The X-02.1 focus-ring check needs keyboard modality: the switcher is opened with Enter, not a
    click.
- **e2e closure** (`test/e2e/projects.spec.ts`, real bin, kanban/custom fixtures; axe 0
  serious/critical in light and dark on the open switcher (X-02.1), the removal confirmation
  (S-18.1) and the unavailable state (S-19.1)):

  | Scenario | spec:test |
  |----------|-----------|
  | S-16.1 Switch to another project | `projects.spec.ts` › "S-16.1 — Switch to another project" (keyboard: trigger focus ring, Enter, ArrowDown with visible ring, Enter; custom's `decision-log` and `plan` types; no kanban id on the page; trigger "Projects: custom") |
  | S-16.2 Close the element panel on switch | `projects.spec.ts` › "S-16.2 — Close the element panel of the previous project on switch" (panel open, switcher used, panel gone, custom's Memory list, no dialog) |
  | S-17.1 Keep the list after a restart | `projects.spec.ts` › "S-17.1 — Keep the project list after a restart" (two consoles on one state directory, same order) |
  | S-17.2 Keep the list out of every repository | `projects.spec.ts` › "S-17.2 — Keep the list out of every project repository" (`git status --porcelain` empty after the stop) |
  | S-18.1 Remove a project | `projects.spec.ts` › "S-18.1 — Remove a project from the list" (Tab to Remove, confirmation, focus on Cancel, axe; empty list; files, `git log --all`, `status --ignored` unchanged) |
  | S-18.2 Cancel the removal | `projects.spec.ts` › "S-18.2 — Cancel the removal" (Cancel button and Escape) |
  | S-19.1 Show a moved project as unavailable | `projects.spec.ts` › "S-19.1 — Show a moved project as unavailable" (the `GET /api/projects` sent by the opening answers `folder-not-found`; mark, Remove, no link, axe; custom opens on the Memory list) |
  | S-19.2 Recover when the folder comes back | `projects.spec.ts` › "S-19.2 — Recover when the folder comes back" (folder moved back; the read sent by reopening the switcher answers `ok`; mark gone, link back) |
  | X-05.1 Opaque ids in URLs | `projects.spec.ts` › "X-05.1 — Use opaque project ids in URLs" (every request and navigation URL free of the folder holding the fixture — the scenario's "/home/test" — and of `<parent>/kanban`, encoded or not; the page lands on `/p/<pid>/memory`) |
  | X-05.2 Refuse an unknown id | `projects.spec.ts` › "X-05.2 — Refuse a project id that is not in the list" (`GET /api/p/..%2F..%2Fetc` with the page's session → 404; the page at that address shows "Not found") |
  | X-02.1 Browser session (task-003/007 closure) | `projects.spec.ts` › "X-02.1 — Serve the browser session opened with the token" (the URL with the fragment; the address bar is `<origin>/` without the token; the switcher lists kanban; keyboard; axe) |

- **Checks** (HEAD before this note `d3a6ab2`, load average 238–286 on 12 cores, other projects):
  `npm run -s typecheck`, `lint` (ESLint + catalogue check) clean · `format:check` clean ·
  `docs:api` OK · `check_tasks.py` OK · `npm run -s test:coverage` **109 files passed, 1
  skipped; 1682 passed / 1 skipped**, coverage 96.5 % statements / 90.51 % branches / 97.14 %
  functions / 98.2 % lines · `npm run -s test:e2e` **71/71** (4.3 min) ·
  `npm run test:timing` **not run** (load ≈ 286 > 12).
- **Hand-overs:**
  - **task-014:** add `addProject(path)` / `cloneProject(url, directory?)` and their hooks to
    `web/src/api/projects.ts` beside `removeProject`/`useRemoveProject`. After a success, put the
    new item into the `projectsQuery()` cache (`setQueryData`); the `projects` event refetches it
    anyway. The switcher's *Add project…* is a `button` inside `dialog "Projects"` and calls
    `useAddProject().show()`. Unavailable rows already render `cli-not-found` with "Install it
    with: <command>" (S-10.2: assert it in the switcher). The removal dialog
    (`RemoveProjectDialog.tsx`) is a model for an alert/modal with `ErrorText` and
    `.dialog-actions`.
  - **task-016:** the header's project name is in the switcher trigger. The header slot stays in
    `ProjectLayout`.
  - **task-021:** the switcher's popover still has React Aria's visually hidden "Dismiss" button
    (as the 013 menu had). The panel is non-modal: X-10.2's title is unchanged.
  - **Coordinator:** ux-reference §3 (W4-1/2/3/6) and §4.2 (W4-8) amendments on `main`. Run
    `npm run test:timing` on a quiet machine.

### review round 1 (2026-10-09)

- Coordinator review: **FAIL** (1 major, minors, nits). Fixed one commit per group:
  - **R1 (major)** (`21c81cd`) a grid-list row was named by its text value only, so the current
    mark, the path, the reason and the install line were lost to assistive technology. They now
    sit in a React Aria `<Text slot="description" elementType="div">`. React Aria then labels the
    row by `aria-labelledby` = the row (name) + that slot, so a screen reader hears e.g. "alpha
    current project /home/…/alpha" or "gamma /home/…/gamma Unavailable — WingFoil CLI not found
    Install it with: npm install --save-dev wingfoil". Unit tests assert the computed accessible
    name of the current row and of the unavailable rows (`getByRole('row', { name })`). React Aria
    puts the slot in the name, not in `aria-describedby`.
  - **R2** (`cda455e`) S-19.1/S-19.2: `openSwitcher` waits for the `GET /api/projects` that the
    opening sends (`requestfinished`, `COLD_READ_MS`) and returns its body. The tests assert that
    this read answers `folder-not-found` (then `ok` after the folder is back), so they prove the
    refetch on open (W4-4) rather than the 10 s periodic check. The marks are awaited with
    `COLD_READ_MS`.
  - **R3** (`cda455e`) `listedNames()` (one non-retrying read) is replaced by `expectListed()`
    (`toHaveText([...])`/`toHaveCount(0)` on the row names, `COLD_READ_MS`), after the opening's
    read completed (S-17.1, S-18.1, S-18.2, S-17.2, X-02.1).
  - **R4** (`cda455e`) X-05.1: the tautological id-format assertion is dropped. The folder holding
    the fixture (the scenario's "/home/test") is added to the forbidden substrings, encoded too.
    The closure row is reworded.
  - **R5** (`21c81cd`) `useRemoveProject`: a 404 `not-found` on `DELETE` is handled as already
    removed (`onRemoved`, then `forgetProject`). Any other failure invalidates `projectsQuery()`
    and is shown in the dialog. Unit tests cover the 404 → removed path and the 500 → error,
    list kept, query invalidated path. The switcher test of a refused removal now uses a 500. The
    pattern is documented in the header of `api/projects.ts` for task-014.
  - **R6** kept: the arrow keys move between the rows and Tab moves from a row to its Remove
    button (`keyboardNavigationBehavior="tab"`). The `ProjectSwitcher.tsx` header says so;
    ux-reference §3 wording by the coordinator.
  - **R7** nothing here (coordinator, ux-reference §4.2).
  - **R8** (`e33617b`) the panel's Escape is a React `onKeyDown` on `div.drawer` that ignores an
    event an inner handler already `preventDefault`-ed (the native listener ran before React's
    delegated handlers). New unit test: an inner control consuming Escape keeps the panel open.
    The test uses a native listener on the body region (the panel has no inner React control
    handling Escape today).
  - **R9** (`21c81cd`) the open project's own row has no `href`: pressing it only closes the
    switcher (`onAction`). The URL, its search and an open panel stay. Unit test included.
- **Checks after the fixes** (HEAD `e2566ae`; the machine rebooted between the fixes and the
  gates; load average 13.3 at the start, 39–82 during the long gates, from other projects):
  `typecheck`, `lint`, `format:check` clean · `docs:api` OK · `check_tasks.py` OK ·
  `test:coverage`, two runs: (1) load 39 → 80: 4 timeouts in `test/launcher/launcher.test.ts`
  ("no running line after 10000 ms"), 1682 passed; (2) load 68 → 78: 2 timeouts
  (`launcher.test.ts` "exits 130 on a second signal", `test/lint/no-shell.test.ts` 30 s), **1684
  passed / 1 skipped of 1687**. Those two files re-run alone: 50/50. No failure in a file this
  task touches. Before the reboot, the same code (`cda455e`) ran **1686 passed / 1 skipped**,
  coverage 96.57 % statements / 90.63 % branches / 97.14 % functions / 98.2 % lines (load ≈ 304).
  · `test:e2e`: **68/71** at load 80 → 82. The 3 failures are cold-read timeouts (60 s) in
  `memory-list.spec.ts` (S-26.2, S-28.1 kanban and custom) right after the reboot.
  `memory-list.spec.ts` re-run alone at load 75 → 69: **21/21**. `projects.spec.ts` with
  `--repeat-each=2` 22/22, plus `element-panel` and `shell` 28/28 before the reboot.
  `npm run test:timing` **not run** (load ≥ 13.3 > 12).

### review round 2 (2026-10-09)

- Coordinator re-review: round-1 findings verified fixed; two test-only items fixed (`test/e2e/projects.spec.ts`):
  - **R11** S-18.2: both reopenings also assert the body of the list read sent by the opening
    (`['kanban']`), so the screen assertion cannot pass on the cached list alone.
  - **R10** S-19.x `movedKanban`: the page's first `GET /api/projects` is awaited (and answers
    `ok`, `ok`) before the folder is renamed, so the read captured after it is the opening's.
- Checks: `typecheck`, `lint`, `format:check` clean · `projects.spec.ts --repeat-each=2`
  **22/22** (load 41 → 50). Full suites not re-run (test-only change in this spec).

### integration (2026-10-10)

- Review: round 3 **PASS** (round 1 FAIL → fixed; round 2 two test items → fixed).
- `main` merged (`a77a458`, authorised by the coordinator): the ux-reference amendments (0.7 §3
  for W4-1/2/3/6, 0.8 §4.2 for W4-8); no conflict.
- Gates on the merge (load 1.6 at the start, 12.3 before e2e, 15.9 → 8.6 during the timing run):
  `typecheck`, `lint`, `format:check` clean · `docs:api` OK · `check_tasks.py` OK ·
  `test:coverage` **109 files passed, 1 skipped; 1686 passed / 1 skipped**, coverage 96.54 %
  statements / 90.59 % branches / 97.14 % functions / 98.2 % lines · `test:e2e` **71/71** (3.0 min).
  `npm run test:timing` **3/3 Vitest + 4/4 Playwright**: REQ-PERF-03 20/20 (max 412 ms),
  TypeDoc 2425 ms, REQ-PERF-06 217–237 ms, strict live refresh 403–1105 ms. It started
  automatically after the e2e at load 15.9, above the threshold of 12; during its measurements the
  load was 12.6 → 8.6.
