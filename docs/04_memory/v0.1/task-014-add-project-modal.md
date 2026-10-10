---
id: task-014-add-project-modal
type: task
title: "Add project modal"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-03"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-008-project-list-api", "task-013-web-shell-themes-and-message-catalogue", "task-015-project-switcher", "task-017-memory-list-and-live-refresh"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The *Add project* modal: local folder or remote git URL with the auto-filled working directory, every refusal of spec-006 §3 rendered from the catalogue, the clone progress, and the *WingFoil CLI not found* case with the install command.

**Backlog items:** US-S-03, US-S-04, US-S-05, US-S-06, US-S-07, US-S-10

- US-S-03 — As Alex, I want to add a local folder holding a WingFoil project, so that I can browse it (in v0.1 it opens on the Memory list)
- US-S-04 — As Alex, I want to add a project from a remote git URL, with the working directory auto-filled and the clone made for me, so that I do not clone it by hand
- US-S-05 — As Alex, I want a folder that is not a WingFoil project (no `.wingfoil/`) refused with the reason, so that the list holds only projects the UI can read
- US-S-06 — As Alex, I want a second add of a repository already in the list (same remote, or a working copy of it) refused with a pointer to the existing entry, so that one project never shows twice
- US-S-07 — As Alex, I want a failed clone (unreachable URL, authentication refused, target folder not empty) reported with git's reason and nothing added, so that I know what to fix
- US-S-10 — As Alex, I want a project with no `wingfoil` CLI (neither in its `node_modules` nor on the PATH) not opened, with install instructions, so that I know how to make it readable

## Acceptance Criteria

- **US-S-03** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-03.1 Add a local WingFoil folder; S-03.2 Refuse a path that does not exist
- **US-S-04** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-04.1 Auto-fill the working directory of a remote; S-04.3 Clone the remote on confirm; S-04.2 Use a working directory I typed instead of the auto-filled one
- **US-S-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-05.1 Refuse a folder without .wingfoil/; S-05.2 Refuse a remote whose clone has no .wingfoil/
- **US-S-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-06.1 Refuse the same local folder twice; S-06.2 Refuse a second working copy of a known remote
- **US-S-07** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-07.1 Report an unreachable remote; S-07.2 Refuse a working directory that is not empty; S-07.3 Report a refused authentication
- **US-S-10** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-10.1 Do not open a project with no CLI; S-10.2 Mark a listed project whose CLI disappeared

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-006` §3 (codes), `spec-008` §4 (errors from codes; tool output verbatim); `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-10)

- **depends_on acknowledged (dl-015):** Execution Notes of task-008, 013, 015, 017 read (reviews and
  integrations included), plus the hand-overs of task-001 and task-004 to this task. Taken:
  - 008 — `POST /api/projects {path}` and `POST /api/projects/clone {url, directory?}` → 201 with a
    `projects.item`; 422 `projects.refusal` (`contracts/api/projects.refusal.schema.json`) with the
    codes of spec-006 §3; 400 `invalid-request` for a relative path, a relative local URL, a URL
    starting with `-` or a URL without a folder name and no `directory`; `detail.path` is the path
    as typed (`~` kept); `not-wingfoil` of a clone has `{ source: "clone" }`; `git-refused` has no
    `detail` (git's message in `message`); `already-listed` has `{ pid, name, sameRemote }`. A clone
    has no timeout: closing the request is the cancel (the server kills git and removes what it
    created). Clones queue on the lock key `clone`. A clone with no CLI is **kept** and listed
    `cli-not-found` (decision 21); no CLI of a cloned repository runs at clone time, its name is the
    folder name (28). A SIGKILLed clone leaves its folder: the retry gets `directory-not-empty`
    (known, deferred — rendered as is). Offline remotes: bare repositories as `file://`, a dumb-HTTP
    server answering 401 (route tests of 008).
  - 013 — the dialog frame `shell/add-project.tsx` (RAC `ModalOverlay`/`Modal`/`Dialog`, heading,
    Close; Escape and Close only, no outside click — ux-reference §5); every `error.*` key exists;
    `errorMessage()`/`ErrorText`; an unanswered request is `error.unreachable`; strings only from
    `en.json` (`defineMessages` for computed ids, no `defaultMessage`); e2e support
    (`startConsole`/`openConsole`, `scanThemes`, `keyboard.ts`, `COLD_READ_MS`).
  - 015 — mutations in `web/src/api/projects.ts` beside `removeProject`/`useRemoveProject` (header
    pattern: success → update the `projectsQuery()` cache; refusal → `invalidateQueries`); the
    switcher's *Add project…* is a `button` in `dialog "Projects"` calling `useAddProject().show()`;
    unavailable rows (`cli-not-found` + "Install it with: <command>") already render — S-10.2 only
    asserted there; `RemoveProjectDialog.tsx` is the model (`role="alert"` `.dialog-error`,
    `.dialog-actions`); `openSwitcher`-style waits on the opening's `GET /api/projects`.
  - 017 — `/p/<pid>` redirects to `/p/<pid>/memory` (W3-22): "opens on the Memory list" (US-S-03)
    is a navigation to `/p/<pid>` by opaque id.
  - 001 — S-04.3 closes here with the REQ-SEC-05 probe already proved at API level (task-008); the
    screen test clones a `file://` bare repository. 004 — S-10.1/S-10.2 adapter side done;
    `removeCli(fixture)` + `envWithoutWingfoil(env, binDir)` give the no-CLI variant.
- **Specs:** spec-006 §3 (operations, paths as typed, default `~/projects/<repo>`, clone without a
  CLI kept, refusal table), spec-004 §3 (routes, 201), §5 (envelope), spec-008 §4 (errors from
  codes, tool output verbatim in a catalogue frame), `contracts/api/projects.*.schema.json`,
  ux-reference §3 (0.8: modal *Local folder* / *Remote git repository*, URL + working directory
  auto-filled `~/projects/<repo>`, validates path/URL and duplicates) and §5 (Close/Escape only),
  prototype (modal 520 px: title "Add project", subtitle "A git repository with a .wingfoil/ folder
  at its root.", a two-option segmented control, fields *Folder path* (placeholder
  `~/projects/my-app`), *Repository URL* (placeholder `https://github.com/org/repo.git ·
  git@github.com:org/repo.git`), *Local working directory* (placeholder `~/projects/repo`, hint "The
  repository is cloned here; WingFoil works on this copy."); the working directory follows the URL
  until the user edits it; client checks: absolute path, URL scheme `https://`/`ssh://`/`git@`,
  working directory required; one error line; Cancel + *Add* / *Clone and add*; on success a toast
  "<name> added · .wingfoil/ found" and the project opens), directives `accessibility`,
  `ux-consistency`, `security-secrets` (no credential shown: the server already strips userinfo).
- **Spec gaps / decisions for the user (W4-9 … W4-15)** — see the report; nothing that depends on
  them is built before the answer.
  - W4-9 S-10.1's text ("WingFoil CLI not found for this project") vs `error.cliNotFound`
    ("WingFoil CLI not found for {path}. Install it with: {command}").
  - W4-10 S-06.x "with a link to that entry": the catalogue message has no link.
  - W4-11 the clone progress (no progress from the server: one request, `git clone --quiet`) and
    what Close/Escape/Cancel do while a request runs.
  - W4-12 a successful clone whose item is not `ok` (a fresh clone has no `node_modules`: listed
    `cli-not-found`, decision 21), while "open the new project" applies to available projects only
    (W4-3: unavailable rows are not links).
  - W4-13 client-side validation ("validates path/URL"): the server's 400 renders only the generic
    `error.invalidRequest`; the prototype's scheme check would refuse the `file://` URLs of the
    scenarios.
  - W4-14 where the auto-fill rule `~/projects/<repo>` lives (the server's `repoName` is in
    `server/src/projects/remote.ts`; `contracts/` holds no runtime code today).
  - W4-15 prototype deviations: footer Cancel beside the frame's Close; no toast system in v0.1.
- **Design (assuming the recommended options; adjusted to the answers):**
  - `web/src/api/projects.ts` (shared API fixed by the coordinator): `addProject(path, signal?)` →
    `POST /api/projects` → `ProjectListItem`; `cloneProject(url, directory?, signal?)` →
    `POST /api/projects/clone` (`directory` omitted when empty); `rememberProject(queryClient,
    item)` (append to the cached list unless that id is there; a list not read yet stays unread);
    `useAddProject…` hooks: `useAddLocalProject()` / `useCloneProject()` (`useMutation`, variables
    `{ path, signal? }` / `{ url, directory?, signal? }`; success → `rememberProject`; failure other
    than an abort → `invalidateQueries(projectsQuery())`). Names to be confirmed with the
    coordinator (the existing `useAddProject` is the shell action of `add-project.tsx`).
  - `web/src/shell/add-project.tsx` (frame kept: heading, Close, focus trap/restore, Escape, no
    outside click): subtitle; a RAC `RadioGroup` "Source" styled as the prototype's segmented control
    (*Local folder* · *Remote git repository*, arrow keys); RAC `TextField`s with `Label`,
    `Input` (mono), `Text slot="description"` (the hint) and `FieldError` (W4-13); the working
    directory follows the URL (`defaultWorkingDirectory(url)`, W4-14) until the user types in it;
    the refusal in `div.dialog-error[role=alert]` with `ErrorText` (plus W4-10's link for
    `already-listed`); `.dialog-actions` with Cancel and the primary *Add* / *Clone and add*
    (`type=submit` of a `Form`, Enter submits); the form state is reset at every opening. During a
    request: inputs and primary disabled; a clone shows W4-11's progress. On success: the dialog
    closes and the page navigates to `/p/<pid>` (→ Memory list) — or W4-12's case.
  - `web/src/shell/working-directory.ts` (W4-14 a): `defaultWorkingDirectory(url)` =
    `~/projects/<repo>` with the server's `repoName` rule, `''` when no name.
  - Catalogue (`en.json`, same commits): `projects.add.subtitle`, `.source`, `.sourceLocal`,
    `.sourceRemote`, `.path`, `.pathPlaceholder`, `.url`, `.urlPlaceholder`, `.directory`,
    `.directoryPlaceholder`, `.directoryHint`, `.submitLocal`, `.submitClone`, `.cancel`,
    `.cloning`, `.adding`, plus the keys of W4-9/10/12/13/15.
  - CSS in `theme/base.css` (tokens only): segmented radio group, fields, progress bar,
    `pre.verbatim` wrapping/scroll inside the dialog.
- **Tech specs:** none missing; ux-reference §3 needs the amendment for the decisions that deviate
  from the prototype (W4-11, 12, 13, 15) — proposed with W4.
- **Test plan:**
  - Unit (jsdom, `stubApi` extended to record method/body/abort): `test/web/api/projects.test.tsx`
    (add/clone bodies, `directory` omitted when empty, cache append without duplicate, refusal →
    invalidate, abort → no invalidate, no answer → `unreachable`);
    `test/web/shell/working-directory.test.ts` (the `repoName` table of
    `test/server/projects/remote.test.ts` replayed against the web function, W4-14);
    `test/web/shell/add-project.test.tsx` (both entry points; source radio by keyboard; auto-fill
    and its stop after an edit; client checks; every refusal code of spec-006 §3 rendered from the
    catalogue with its detail, `git-refused` verbatim in `pre`, `invalid-request`, `unreachable`;
    W4-10 link navigates and closes; pending state; W4-11 cancel aborts the request; success →
    `/p/<pid>/memory`, list cache updated; W4-12; focus given back; key-catalogue render).
  - e2e `test/e2e/add-project.spec.ts` (real bin, `test.use({ prebuild: ['kanban'] })`, copies of
    kanban; remotes are bare repositories made in the console root and given as `file://` URLs;
    `~` is the console's isolated `HOME`; the CLI's presence on the PATH is set explicitly per
    test — `envWithoutWingfoil` or a bin dir linking the pinned CLI — never inherited from npm's
    PATH), one test per scenario: S-03.1, S-03.2, S-04.1, S-04.2, S-04.3, S-05.1, S-05.2, S-06.1,
    S-06.2, S-07.1, S-07.2, S-07.3, S-10.1, S-10.2. Offline reproduction: S-07.1 uses
    `https://git.invalid/team/project.git` (`.invalid` never resolves, RFC 6761: git fails at
    once without network); S-07.3 a dumb-HTTP server in the test process (`http.createServer` on
    127.0.0.1, Basic auth, 401 otherwise) cloned as `http://alex:wrong@127.0.0.1:<port>/private.git`
    → git's "Authentication failed …" (the scenario's `https://git.example.test` is not reachable
    offline: recorded as a deviation); the clone progress uses the same server holding its answers
    until the test releases them. Every refusal also asserts the file system (no folder created,
    `notes.txt` alone) and the switcher's list read after it (the opening's `GET /api/projects`
    body, then retrying expects). axe 0 serious/critical in light and dark on the dialog (local
    mode, remote mode, an error state, the clone progress). Keyboard: the dialog driven with Tab,
    arrows, typing and Enter, visible focus. The closure table follows in the red/green notes.
