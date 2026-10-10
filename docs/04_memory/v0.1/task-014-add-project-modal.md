---
id: task-014-add-project-modal
type: task
title: "Add project modal"
status: in-review
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

### design decisions (2026-10-10)

- Decided by the user (coordinator), each option (a) as recommended:
  - **W4-9** `error.cliNotFound` = "WingFoil CLI not found for this project. Install it with:
    {command}" (`{path}` dropped; the server's `message` already says "for this project").
  - **W4-10** `already-listed`: `ErrorText`, then a link "Open <name>" (new key) to
    `/p/<detail.pid>`; pressing it closes the dialog and navigates.
  - **W4-11** while a request runs: fields and the primary button disabled; a status line and an
    indeterminate React Aria `ProgressBar` (catalogue label) — "Cloning <url> into <directory>…" or
    "Adding…"; Cancel, Close and Escape abort the request (the server kills git and removes what it
    created) and close the dialog.
  - **W4-12** after a 201 the page navigates to `/p/<pid>` only when `availability` is `ok`; else
    the dialog stays with "<name> was added but is unavailable — <reason>" (install command for
    `cli-not-found`) and Close only.
  - **W4-13** field-level validation (React Aria `FieldError`, catalogue texts): path filled and
    absolute (`/`, `~`, `~/…`, a drive letter or UNC); URL filled and not starting with `-`;
    working directory filled (and required when no folder name can be derived). No scheme check.
  - **W4-14** `web/src/shell/working-directory.ts` mirrors the server's `repoName`; its unit test
    replays the server's table; the client always sends the field's value.
  - **W4-15** header Close and footer Cancel beside *Add* / *Clone and add*; the source is a React
    Aria `RadioGroup` styled as the segmented control; no toast — a polite announcement
    "<name> added".
  - Shared API **confirmed**: `addProject`, `cloneProject`, `useAddLocalProject()`,
    `useCloneProject()`, `rememberProject(queryClient, item)`; refusal → invalidate
    `projectsQuery()`; abort → nothing.
  - **S-07.3 deviation accepted:** the refused authentication is reproduced offline by a dumb-HTTP
    server with Basic auth on 127.0.0.1 inside the test, not `https://git.example.test`.
  - The coordinator amends ux-reference §3 (0.9) for W4-11/12/13/15 on `main`.

### red / green / refactor (2026-10-10)

- **Red** (`db8a8fa`): `test/web/shell/add-project.test.tsx`, `test/web/shell/working-directory.test.ts`,
  `test/web/shell/add-project-fields.test.ts` and the add/clone rows of `test/web/api/projects.test.tsx`
  — 39 failing (modules missing, the dialog an empty frame). **Green** (`5dd7b5c`, `913ee92`):
  `web/src/api/projects.ts` (`addProject`, `cloneProject`, `rememberProject`, `useAddLocalProject`,
  `useCloneProject`), `web/src/shell/add-project.tsx` (form inside the task-013 frame),
  `web/src/shell/working-directory.ts`, `web/src/shell/add-project-fields.ts`,
  `web/src/shell/availability.ts` (the availability → `reason` map, moved out of
  `ProjectSwitcher.tsx` and shared with W4-12), `en.json` (`projects.add.*`, `error.cliNotFound`
  per W4-9), `theme/base.css` (segmented control, fields, progress bar, error block).
- **Deviations / findings:**
  - The form is mounted only while the dialog is open: it starts empty at every opening, and its
    unmount aborts a running request — so Cancel, Close, Escape and any navigation (W4-10's link,
    the browser's back) abort the same way. The provider closes the dialog on `onBeforeNavigate`
    (as the switcher does).
  - Disabling the fields while a request runs drops the focus of the focused field to `body`, where
    Escape no longer reaches the dialog: the submit handler moves the focus to Cancel (the action
    left). Done in the handler, not in an effect: a focus change inside a React effect during a
    user-event dispatch threw React's "Should not already be working" in jsdom.
  - Field checks use React Aria's native validation with a `validate` function returning the
    catalogue text; `isRequired` is not used (its message would be the browser's own text, outside
    the catalogue).
  - The key build substitutes the arguments into the key text (`projects.add.cloning file:///x.git
    ~/projects/x`); the key-catalogue test asserts that form.
  - `test/e2e/support/switcher.ts`: the switcher helpers of `projects.spec.ts` (task-015) moved to
    the shared support, unchanged, and used by both specs; `test/e2e/support/git-http.ts`: a
    dumb-HTTP remote (Basic auth, held answers) and `bareRepository()`.
  - The e2e consoles of the clone tests get an explicit `PATH`: no `wingfoil` (`envWithoutWingfoil`)
    plus, for S-04.x, the pinned CLI linked as `wingfoil` (a fresh clone has no `node_modules`; npm's
    own `.bin` on the test's PATH would otherwise decide the availability).
- **e2e closure** (`test/e2e/add-project.spec.ts`, real bin, kanban fixture and remotes made by the
  tests, offline; axe 0 serious/critical in light and dark on the dialog in local mode (S-03.1), in
  remote mode (S-04.1), in an error state (S-03.2, S-07.1 with git's output), during a clone
  (W4-11), with an unavailable new project (W4-12), and on the switcher's unavailable row (S-10.2)):

  | Scenario | spec:test |
  |----------|-----------|
  | S-03.1 Add a local WingFoil folder | `add-project.spec.ts` › "S-03.1 — Add a local WingFoil folder" (empty list read first; keyboard only: start page *Add project…* with focus ring, Tab to the source and the field, typing, Enter; 201 with an opaque id; the page at `/p/<pid>/memory` with the Memory heading; "kanban added" announced; trigger "Projects: kanban"; the switcher's list read holds `kanban`) |
  | S-03.2 Refuse a path that does not exist | same spec › "S-03.2 …" (422; the alert reads "Folder not found: /tmp/does-not-exist"; axe; the switcher's list read is empty) |
  | S-04.1 Auto-fill the working directory | same spec › "S-04.1 …" (ArrowRight chooses *Remote git repository*; the fixture's `file://` remote typed; the field holds `~/projects/kanban`, its description the hint; axe) |
  | S-04.3 Clone the remote on confirm | same spec › "S-04.3 …" (201; Memory list of the new pid; `~/projects/kanban` has the remote as `origin` and the remote's HEAD; listed). REQ-SEC-05 probe at API level in task-008 |
  | S-04.2 Use a working directory I typed | same spec › "S-04.2 …" (`~/work/kanban-copy` is the clone; `~/projects/kanban` does not exist; listed as `kanban-copy`) |
  | S-05.1 Refuse a folder without .wingfoil/ | same spec › "S-05.1 …" (a `git init` folder; "Not a WingFoil project: no .wingfoil/ folder in <path>"; nothing listed) |
  | S-05.2 Refuse a remote whose clone has no .wingfoil/ | same spec › "S-05.2 …" (a bare `plain.git` as `file://`; "… in the cloned repository"; `~/projects/plain` does not exist; nothing listed) |
  | S-06.1 Refuse the same local folder twice | same spec › "S-06.1 …" ("Already in the list: kanban", no "same remote"; link "Open kanban" to `/p/<pid>` with a focus ring; Enter closes the dialog and opens its Memory list; one project listed) |
  | S-06.2 Refuse a second working copy of a known remote | same spec › "S-06.2 …" (kanban added through the dialog so the list holds its origin; a second `git clone` of the remote added from the switcher's *Add project…*; "Already in the list: kanban (same remote)" with the link; one project listed) |
  | S-07.1 Report an unreachable remote | same spec › "S-07.1 …" (`https://git.invalid/team/project.git` — `.invalid` never resolves, no network; "Git refused the action:" + git's output verbatim in `pre` naming `git.invalid`; axe; `~/projects/project` does not exist; nothing listed) |
  | S-07.2 Refuse a working directory that is not empty | same spec › "S-07.2 …" ("The working directory is not empty: ~/projects/kanban"; the folder holds only `notes.txt`; nothing listed) |
  | S-07.3 Report a refused authentication | same spec › "S-07.3 …" — **deviation accepted by the user**: a dumb-HTTP remote on 127.0.0.1 inside the test refusing `alex:wrong` (401), not `https://git.example.test` (unreachable offline); git's "Authentication failed" verbatim, without the password; nothing cloned, nothing listed |
  | S-10.1 Do not open a project with no CLI | same spec › "S-10.1 …" (copy without `node_modules/wingfoil`, console PATH without `wingfoil`; "WingFoil CLI not found for this project. Install it with: npm install --save-dev wingfoil" (W4-9); nothing listed) |
  | S-10.2 Mark a listed project whose CLI disappeared | same spec › "S-10.2 …" (listed `ok`, CLI removed, the read sent by reopening the switcher answers `cli-not-found` with the command; the row's accessible name "kanban <path> Unavailable — WingFoil CLI not found Install it with: npm install --save-dev wingfoil"; axe; Enter on the row opens nothing) |

  Mechanisms (same spec): "W4-11 — a clone in progress …" (held HTTP remote: progress bar named
  "Cloning <url> into ~/projects/held… This can take a while.", fields and *Clone and add* disabled,
  focus ring on Cancel, axe, Enter on Cancel closes; the server removes `~/projects/held`; nothing
  listed) and "W4-12 — a clone with no CLI …" (201 `cli-not-found`; the dialog keeps "kanban was
  added but is unavailable — WingFoil CLI not found" and the install command, no field, focus on
  Close; axe; the switcher lists it unavailable).
- **Checks** (HEAD `16c2b20` + README, load average 20 → 14 on 12 cores, other projects):
  `npm run -s typecheck`, `lint` (ESLint + catalogue check) clean · `format:check` clean ·
  `docs:api` OK · `check_tasks.py` OK · `npm run -s test:coverage` **112 files passed, 1
  skipped; 1778 passed / 1 skipped** (load 20.1 → 20.8), coverage 96.58 % statements / 90.74 %
  branches / 97.23 % functions / 98.26 % lines (`web/src/shell` 98.2 % / 93.86 %) ·
  `npm run -s test:e2e` **87/87** (3.6 min, load 19.2 → 15.8) · `add-project.spec.ts` +
  `projects.spec.ts` with `--repeat-each=2` **54/54** (load 14.6 → 14.4) ·
  `npm run test:timing` **not run** (load ≥ 14 > 12).
- **Hand-overs:**
  - **task-016:** the dialog closes on any navigation (`onBeforeNavigate` in `AddProjectProvider`);
    the shared availability → reason map is `web/src/shell/availability.ts`.
  - **task-021:** the dialog's status region (progress, W4-12) and the provider's polite live region
    ("<name> added") are `role="status"`; the switcher popover's React Aria "Dismiss" remains (015).
  - **Coordinator:** ux-reference §3 (0.9) for W4-11/12/13/15 on `main`; run `npm run test:timing`
    on a quiet machine. Known and deferred (task-008): a SIGKILLed console leaves a clone folder and
    the retry shows "The working directory is not empty".

### review round 1 (2026-10-10)

- Coordinator review: **FAIL** on minors only (no blocker or major). Fixed in `5a572a0`:
  - **R1** (security, a11y) the progress line showed and announced the URL as typed, password
    included (`http://alex:wrong@…`). `displayUrl()` (`web/src/shell/working-directory.ts`) strips
    the userinfo of a URL form before the URL is formatted; the scp-like `user@host:` holds no
    password and is kept. Nothing else echoes the raw URL: the refusals render `detail` (paths, the
    entry's name) and git's message (git leaves the credentials out); W4-12 and the announcement
    use the project's name. Tests: unit rows for `displayUrl`; the dialog's status text and the
    progress bar's name without the password (component); e2e W4-11 with `alex:s3cret@` in the URL
    (status text, progress name, no `s3cret` on the page) and S-07.3 (no `alex:wrong` on the page).
  - **R2** `useAddHandlers.onError` no longer awaits the list read it starts (TanStack awaited it,
    so the refusal waited for `GET /api/projects`). Unit test: a list read that never answers after
    a refusal — the error shows at once (red on the old code, checked). S-03.2's alert, the W4-12
    message and S-10.2's settle wait with `COLD_READ_MS`.
  - **R3** (a) S-10.2: the row has no `data-href`; after Enter on it the test closes and reopens
    the switcher, waiting for that opening's completed list read, then asserts the URL `<origin>/`,
    no `/api/p/…` request since the Enter and the row still marked unavailable. (b) W4-11: the
    test polls until `~/projects/held` exists while git waits, then asserts it is removed after
    Cancel.
  - **R4** (W4-13, ux-reference §3 0.9) `directoryProblem(value, url)`: an empty working directory
    is refused only when the URL gives no folder name; a filled one must be absolute. An empty field
    with a derivable name sends no `directory` (the server's default `~/projects/<repo>`, shown in
    the progress line). Unit rows for both branches; component test of the request body.
  - **R5** (a11y) one persistent `role="status"` region, mounted with the dialog, holds the progress
    and then the W4-12 message (the form unmounts below it); the component test asserts the same
    element before the submit and after, with the message in it.
  - **R6** (accepted behaviour) "Cancel aborts the request": an abort that lands after the server
    has committed the add or the clone closes the dialog as cancelled, while the project still
    appears in the switcher through the `projects` event. Hand-over below.
  - **R7** (no change) a relative local clone URL (`kanban.git`, `./x`) gets the server's 400,
    rendered as the generic "The console refused an invalid request": consistent with W4-13 (no
    scheme or URL-form check in the dialog).
- Out of scope, reported: `useRemoveProject` (task-015) still returns the invalidation promise
  from `onError`, so a refused removal also waits for the list read (same pattern as R2).
- **Checks** (HEAD `5a572a0`): `typecheck`, `lint`, `format:check` clean · `docs:api` OK ·
  `check_tasks.py` OK · `test:coverage` **112 files passed, 1 skipped; 1791 passed / 1 skipped**
  (load 8.5 → 14.2), coverage 96.58 % statements / 90.81 % branches / 97.23 % functions /
  98.26 % lines · `add-project.spec.ts` + `projects.spec.ts` `--repeat-each=2` **54/54** (load 2.3 →
  12.9) · `test:e2e` **87/87** (3.2 min, load 13.1 → 16.3) · `npm run test:timing` **not run**
  (load 16.3 > 12).
- **Hand-over addition (R6):** a cancel racing the server's commit leaves the project listed
  (shown by the `projects` event) though the dialog closed as cancelled; the user removes it from
  the switcher if unwanted.

### review round 2 (2026-10-10)

- Coordinator re-review: R1–R7 verified. Fixed in `0f7d0ff`:
  - **R8** (security) `displayUrl()` stopped at the first `@`: `https://u:p@ss@host/r.git` showed
    `https://ss@host/r.git` (part of the password). The userinfo is now removed up to the last `@`
    of the authority (`/^([a-z][a-z0-9+.-]*:\/\/)[^/?#]*@/i`, as the server's `split`); an `@` in
    the query or fragment is never read as userinfo. Unit rows: `https://u:p@ss@host/r.git` →
    `https://host/r.git`, `https://host?x=a@b` and `https://host#a@b` unchanged; the earlier rows
    still pass.
  - **R9** the header of `working-directory.ts` said the dialog always sends the field's value.
    Since R4 it sends the value when filled; an empty field with a derivable folder name sends no
    `directory`. **W4-13 takes precedence over that part of W4-14** ("sends the field's value when
    filled").
- Recorded, no code change: task-015's `useRemoveProject` returns (so TanStack awaits) the list
  invalidation on a non-404 refusal — the same delay as R2. Left as is; a backlog nit for the
  coordinator.
- Checks: `test/web/shell` + `test/web/api` **252/252**; `typecheck`, `lint`, `format:check`
  clean.
- **Hand-over addition (coordinator):** the `useRemoveProject` nit above.

### integration (2026-10-10)

- Review: round 3 **PASS** (round 1 FAIL on minors R1–R7 → fixed; round 2 R8, R9 → fixed).
- `main` merged (`f4069a9`, authorised by the coordinator): ux-reference 0.9 §3 (W4-11/12/13/15),
  bug-005 and bug-006 files, task-016's `bug:` list; docs only, no conflict.
- Gates on the merge: `typecheck`, `lint` (ESLint + catalogue check), `format:check` clean ·
  `docs:api` OK · `check_tasks.py` OK · `test:coverage` **112 files passed, 1 skipped; 1794 passed /
  1 skipped** (load 6.7 → 18.0), coverage 96.58 % statements / 90.81 % branches / 97.23 % functions /
  98.26 % lines (bug-005's flaky fingerprint test passed) · `test:e2e` **87/87** (3.5 min, load
  16.7 → 16.3) · `npm run test:timing` **not run** (load ≈ 16 > 12).
