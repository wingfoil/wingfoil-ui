---
id: task-021-accessibility-page-title-and-performance-pass
type: task
title: "Accessibility page title and performance pass"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-X-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-006-clone-keeps-url-credentials-in-the-clone-git-config"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-014-add-project-modal", "task-015-project-switcher", "task-016-project-header-version-identity-and-role-view", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only", "task-019-dna-directives-and-team-views", "task-020-documentation-index-and-links"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The closing pass over every v0.1 screen: keyboard reachability with visible focus, the browser tab title, light and dark themes with AA contrast (system preference), every string from the catalogue on the key-rendering build, axe-core with 0 serious/critical violations in both themes, and the p95 ≤ 1.0 s measurement of the views with a warm cache (closing the TT-PERF-04 dependency of US-M-01, US-G-01, US-R-05…R-08).

**Backlog items:** US-X-06, US-X-10, TT-ARC-10, TT-PERF-04, US-X-08, US-X-09, TT-ARC-09, TT-ARC-11

- US-X-06 — As a member who uses only the keyboard, I want every MVP screen and action reachable and operable from the keyboard with a visible focus, so that I can use the console without a mouse
- US-X-10 — As Alex, I want the browser tab title to name the project, its state (phase or completion, when the release shows it) and the current view or element, before "WingFoil UI", so that I tell my projects and views apart among my tabs
- US-X-08 — As a member, I want light and dark themes with AA contrast in each, following my system by default (a choice in the UI settings from v0.2), so that the console is readable in any setting
- US-X-09 — As Alex, I want every UI string externalised (English only in the MVP), so that a second language can be added without touching the screens

## Acceptance Criteria

- **US-X-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-06.1 Reach every v0.1 screen with the keyboard; X-06.3 Close the element panel with Escape; X-06.4 Pass the axe scan
- **US-X-10** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-10.1 Name the project and the view in the tab title; X-10.2 Name the open element in the tab title; X-10.3 Title the project list when no project is open
- **TT-ARC-10** (REQ-ARC-10 — Accessibility WCAG 2.1 AA): [numeric] axe-core reports 0 violations of impact serious or critical on every screen of the release in both themes; focus indicators have a contrast ratio ≥ 3:1; every gate action is completed with the keyboard alone; scenarios X-07.1, X-07.2, X-07.3 (live regions, accessible descriptions) and X-10.1 … X-10.5 (page title) pass. v0.1 (no gate action): axe and focus contrast on the v0.1 screens, X-06.1, X-06.3, X-06.4 and X-10.1 … X-10.3 pass. *Verified by:* e2e-smoke `accessibility`.
  Scenarios (`@v0.1`): X-06.1, X-06.3, X-06.4, X-10.1, X-10.2, X-10.3.
- **TT-PERF-04** (REQ-PERF-04 — Other views): [numeric] p95 ≤ 1.0 s with a warm cache. *Verified by:* e2e performance run.
  Scenarios (`@v0.1`): M-01.1, G-01.1, R-05.1, R-06.1, R-07.1, R-08.1.
- **US-X-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-08.1 Follow the system's dark preference; X-08.2 Follow a change of the system preference
- **US-X-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-09.1 Render every string from the message catalogue; X-09.2 Keep project data untranslated
- **TT-ARC-09** (REQ-ARC-09 — Externalised strings): [percentage] With a build that renders catalogue keys instead of messages, 100 % of the visible non-project text on every screen of the release is a catalogue key. *Verified by:* e2e (key-rendering build).
  Scenarios (`@v0.1`): X-09.1, X-09.2.
- **TT-ARC-11** (REQ-ARC-11 — Light and dark themes): [numeric] In each theme every text has a contrast ratio ≥ 4.5:1 (≥ 3:1 for large text) against its background, measured by axe-core on every screen of the release. *Verified by:* e2e-smoke `accessibility`.
  Scenarios (`@v0.1`): X-08.1, X-08.2.

- **bug-006-clone-keeps-url-credentials-in-the-clone-git-config** (absorbed, dl-045; decided by the user 2026-10-10, option c): `POST /api/projects/clone` refuses a URL whose userinfo holds a password with a new spec-006 §3 refusal code (spec amended at this task's design, decided by the user) rendered from the catalogue with a hint to use SSH or a git credential helper; nothing is cloned and no credential reaches a command line, a file or the state; API + e2e tests.

Screen: `docs/00_reference/ux-reference.md` every v0.1 screen and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- Directive `accessibility`; `spec-008` §3 (page title keys), §6 (key-rendering build); `spec-009` §1, §3, §5.
- Depends on every v0.1 screen task: run last.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-10)

- **Read:** this task, the Execution Notes of 013 (key build, Dismiss, N8), 014, 015, 016 (R6, R8,
  R9), 017, 018, 019, 020; `accessibility.feature`, `themes-and-strings.feature`, the six
  TT-PERF-04 scenarios; SARD REQ-PERF-04 and the *Reference environment* (`00_sard.md`: large
  fixture = custom + 500 generated elements + 2 000 commits, p95 over 20 runs after 1 warm-up);
  REQ-ARC-09/10/11; spec-006 §3, spec-008 §1/§3/§6, spec-009 §1/§3/§5; ux-reference 1.0 §3–§5;
  directives `accessibility`, `ux-consistency`, `security-secrets`; bug-006. Code: `web/index.html`,
  `shell/page-title.ts` and its seven callers, `ProjectHeader.tsx`, `routes/project.tsx`,
  `api/projects.ts`, React Aria's `DismissButton`, `server/src/projects/{remote,project-list,
  clone}.ts`, `git/git.ts` `cloneArgs`, `state/store.ts` `stripUserinfo`, the e2e support and the
  timing configs.
- **Findings that shape the design:**
  - React Aria's `Popover` (switcher, role-view `Select`) renders a visually hidden `<button
    tabindex="-1" aria-label="Dismiss">`; the string comes from React Aria's own dictionary for the
    *browser* locale (no React Aria `I18nProvider` today, so a German browser gets "Schließen").
    Its global-dictionary override (`Symbol.for('react-aria.i18n.strings')`) throws for every
    package not listed: not usable. The add-project dialog avoids it (not dismissable by an
    outside click, 013/014). The existing key-build e2e walks text nodes only, so it never sees an
    `aria-label`.
  - Page titles: `memory.tsx`/`element.tsx` compute the project name inline, `routes/dna.tsx`
    exports `useProjectName`, `docs/pages.tsx` has a private copy. A document uses
    `title.projectView` with the path, a directive page with the directive id (spec-008 §3 names
    neither). `index.html`'s static `<title>WingFoil UI</title>` is outside the catalogue.
  - Role-dependent data (item 6): the server uses `roleView` in the header and in `GET /directives`
    (`mine`); `descriptor/placement.ts` uses it too but is called by no route in v0.1 (Today,
    v0.2). The element panel's Directives section reads the same `['p', pid, 'directives']` query.
    `useSetRoleView`'s two invalidations are complete for v0.1 — confirmed.
  - Performance: no large fixture exists. The query client uses `staleTime: Infinity`, so a view
    visited before in the same page renders from memory: a meaningful "warm cache" measurement is
    a warm *server* snapshot cache with a cold client cache. `vite.config.ts` already sets
    `chunkSizeWarningLimit: 1024`: today's 708.6 kB entry chunk raises no warning. With in-app
    navigation, the entry chunk's size does not enter the measured time (it is loaded with the
    page); a route split would add a chunk fetch to the first navigation.
  - bug-006: S-07.3 (`http://alex:wrong@…`) and W4-11 (`http://alex:s3cret@…`) of
    `add-project.spec.ts` type passwords in the URL; both must change with the refusal.
- **Decisions — reported to the coordinator, awaiting the go:** W5-1 … W5-17 (report of this
  phase). Nothing below that depends on them is implemented before the answer.
- **Planned changes (recommended options):**
  - *Titles:* `useProjectTitle(pid, view)` in `shell/page-title.ts` (project name from
    `projectsQuery()`, the pid until it loads) used by Memory, DNA, Directives (list and page),
    Team, Documentation (index and document); the element panel keeps `title.projectElement` with
    the same name helper. `title.app` ("WingFoil UI") written into `index.html` at build time by a
    Vite `transformIndexHtml` hook from the catalogue (key build: `title.app`) and used at run time
    by the root route as the title while no page has set one.
  - *Library strings:* React Aria `I18nProvider locale="en"` (the catalogue's locale) around the
    app; X-09.1 also checks accessible names (`aria-label`, `alt`, `title`, `placeholder`,
    `aria-description`), with React Aria's `DismissButton` label as the one documented library
    exception.
  - *Header:* the polite `.project-notices` region moves to an unkeyed `ProjectNotices pid` in
    `ProjectLayout` (right after the keyed header), so notices are announced after a project
    switch; a failed header re-read with cached data shows the `ErrorText` alert above the kept
    header until the next successful read (no new key).
  - *`useRemoveProject`:* `onError` starts the list read without returning it.
  - *bug-006:* `credentialsInUrl(url)` in `server/src/projects/remote.ts`; `ProjectList.clone()`
    refuses right after `cloneSourceProblem` (before any file-system, state or git work) with
    `ProjectRefusal('credentials-in-url', <message without the URL>)`, no `detail`; the refusal
    schema gains the code; `error.credentialsInUrl` in `en.json`; the dialog renders it through
    `ErrorText` like every refusal (no client pre-check: W4-10's checks are fixed). Spec-006 §3
    row added by the coordinator on `main`.
  - *Performance:* nothing in the product unless a view misses 1.0 s (W5-8).
- **File layout:**
  - web: `index.html`, `vite.config.ts` (title hook), `src/app.tsx` (React Aria `I18nProvider`),
    `src/shell/page-title.ts`, `src/routes/{root,memory,dna,team,directives,element,project}.tsx`,
    `src/directives/pages.tsx`, `src/docs/pages.tsx`, `src/project/ProjectHeader.tsx`,
    `src/api/projects.ts`, `src/i18n/en.json` (`title.app`, `error.credentialsInUrl`).
  - server/contracts: `server/src/projects/{remote,project-list}.ts`,
    `contracts/api/projects.refusal.schema.json`.
  - tests: `test/web/shell/page-title.test.tsx`, `test/web/project/project-header.test.tsx`,
    `test/web/api/projects.test.ts`, `test/web/api/error-message.test.ts` (per-code args),
    `test/web/i18n/key-rendering.test.tsx` (title.app), `test/server/projects/remote.test.ts`,
    `test/server/http/projects.test.ts`, `test/contracts/api-projects-schema.test.ts`;
    e2e `test/e2e/accessibility.spec.ts` (new), `test/e2e/performance.spec.ts` (new, `@perf`),
    `test/e2e/add-project.spec.ts` (bug-006, S-07.3 and W4-11 reworked), support
    `test/e2e/support/screens.ts` (the v0.1 screen catalogue: name, how to reach it, ready
    marker), `keyboard.ts` (`tabUntil`, `focusRingContrast`), `strings.ts` (key-build text and
    name check, project data from the API responses), `perf.ts` (runs, p95, report), the large
    fixture `test/harness/fixtures/large.ts` (its own builder and worker fixture, **not** a new
    `FixtureKind`: suites iterate `FIXTURE_KINDS`); `playwright.timing.config.ts` grep
    `/@live-refresh|@perf/`; `test/README.md` 0.23.
- **Missing / needing revision tech specs (coordinator, on `main`, after the answers):** spec-006
  §3 refusal row `credentials-in-url` (W5-14/15); spec-008 §3 titles of a document and a directive
  page (W5-5) and `title.app`; spec-008 §6 the library-string exception of X-09.1 (W5-1).
- **Test plan (scenario → spec file):**
  - `accessibility.spec.ts` (kanban as Morgan unless stated):
    - X-06.1 — one keyboard-only walk from the project's first view: sidebar links (Tab, Enter) to
      Memory, a row (arrow keys/Tab, Enter) to its panel and Escape, DNA, Directives and a
      directive page, Team, Documentation and a document, the switcher and back; every focused
      control checked: visible ring (solid ≥ 2 px) and ring/backdrop contrast ≥ 3:1, walked in
      both themes (TT-ARC-10 focus contrast).
    - X-06.3 — panel of `task-001-login-form` opened from its row, Escape → closed, focus on that
      row (visible ring).
    - X-06.4 — every screen of `screens.ts` scanned with `scanThemes` (0 serious/critical), plus
      the mapping table below for state variants scanned in the per-task specs.
    - X-08.1 — `prefers-color-scheme: dark` before load, Memory list: `data-theme="dark"`, axe
      `color-contrast` clean in dark. X-08.2 — light → dark on the open Memory list without a
      reload (a window marker survives).
    - X-09.1 — the key build (`openConsole(…, { build: 'keys' })`) on every screen of
      `screens.ts`: each visible text and each accessible name is a key-catalogue text (arguments
      filled) or project data (a string of the API responses the page read, or its `en`
      Intl rendering — dates, relative ages, lists); React Aria's Dismiss is the only exception;
      `document.title` is a key. X-09.2 — key build, panel of `task-001-login-form`: title, id,
      state names as written in the project (compared with `GET /elements/:id`).
    - X-10.1 / X-10.2 / X-10.3 — exact tab titles "kanban · Memory — WingFoil UI",
      "kanban · task-001-login-form — WingFoil UI", "Projects — WingFoil UI" (back through the
      switcher).
  - `performance.spec.ts` `@perf` — TT-PERF-04 on the large fixture: per view (Memory list, an
    element panel, DNA, Directives *only mine*, Team, Documentation) 1 warm-up + N runs, each in a
    fresh page opened on another view; t0 = the activation (Enter on the sidebar link / row), t1 =
    the view's content visible with no loading status; p95 reported with the load average; under
    `npm run test:timing` N = 20 and p95 ≤ 1 000 ms asserted; in `npm run test:e2e` N = 2 and no
    budget (W5-9).
  - `add-project.spec.ts` — "bug-006 — Refuse a clone URL holding credentials":
    `http://alex:s3cret@127.0.0.1:<port>/x.git` → the alert with `error.credentialsInUrl`'s text,
    no `s3cret` on the page, no request reached the remote, no folder, the switcher empty, no
    `s3cret` in the state directory (secret scan); S-07.3 reworked: the URL holds no credential,
    a git credential helper in the console's isolated global config supplies the wrong password;
    W4-11 without userinfo (W5-15).
  - API `test/server/http/projects.test.ts`: 422 `credentials-in-url` (schema-valid, no `detail`,
    body and logs without the password), no process started (fake runner), state and file system
    unchanged; `test/server/projects/remote.test.ts`: rows for `credentialsInUrl` (password,
    empty password, token as user, `@` in the password, percent-encoded `:`, `ssh://git@`,
    scp-like `git@host:`, `@` in query/fragment, local paths).
- **e2e closure (draft):**

  | Scenario | Spec › test |
  |----------|-------------|
  | X-06.1 | `test/e2e/accessibility.spec.ts` › "X-06.1 — Reach every v0.1 screen with the keyboard" |
  | X-06.3 | same spec › "X-06.3 — Close the element panel with Escape" |
  | X-06.4 (also task-001) | same spec › "X-06.4 — Pass the axe scan" (every screen of `screens.ts`, both themes) + state variants: `add-project.spec.ts`, `projects.spec.ts`, `project-header.spec.ts`, `shell.spec.ts` (unreachable banner, warnings, lost session) |
  | X-08.1, X-08.2 | same spec › "X-08.1 …", "X-08.2 …" |
  | X-09.1, X-09.2 | same spec › "X-09.1 …", "X-09.2 …" (key build) |
  | X-10.1, X-10.2, X-10.3 | same spec › "X-10.1 …", "X-10.2 …", "X-10.3 …" |
  | M-01.1, G-01.1, R-05.1, R-06.1, R-07.1, R-08.1 (TT-PERF-04) | `test/e2e/performance.spec.ts` › "TT-PERF-04 — <view> renders within 1.0 s (p95, warm cache)" `@perf`; their functional assertions stay closed in 017/018/019/020 |
  | bug-006 | `test/e2e/add-project.spec.ts` › "bug-006 — Refuse a clone URL holding credentials" |

### design decisions (2026-10-10)

- Decided by the user 2026-10-10 (coordinator decisions W5-1…W5-17), every point option (a) of the
  design list:
  - **W5-1** React Aria `I18nProvider locale="en"` (the catalogue's locale); X-09.1 also checks
    accessible names; React Aria's `DismissButton` label is the one documented library exception
    (spec-008 §6 note by the coordinator).
  - **W5-2** `title.app` written into `index.html` by a Vite `transformIndexHtml` hook from the
    catalogue, and used by the root route as the fallback title.
  - **W5-3** X-09.1 recognises project data from the API responses the page read (and their `en`
    Intl renderings).
  - **W5-4** new shared `useProjectTitle(pid, view)` in `web/src/shell/page-title.ts` replacing
    the three name helpers (approved shared API).
  - **W5-5** `title.projectView` with the document path / directive id (spec-008 §3 amended by the
    coordinator).
  - **W5-6** in-app navigation, warm server cache, cold client cache; p95 over 20 runs after
    1 warm-up; the first load reported, not asserted.
  - **W5-7** the SARD large fixture (custom + 500 elements + 2 000 commits via `git fast-import`),
    a perf-only builder and worker fixture.
  - **W5-8** no code split unless a view misses 1.0 s.
  - **W5-9** tag `@perf`: `test:e2e` runs 1 warm-up + 2 runs without a budget; `test:timing` runs
    20 and asserts p95 ≤ 1 000 ms.
  - **W5-10** `accessibility.spec.ts` + `performance.spec.ts`; the bug-006 test in
    `add-project.spec.ts`.
  - **W5-11** aggregate axe scan over `test/e2e/support/screens.ts` + mapping table.
  - **W5-12** computed-style focus-ring contrast on every control of the X-06.1 walk, both themes.
  - **W5-13** unkeyed `ProjectNotices` in `ProjectLayout`.
  - **W5-14** refusal `credentials-in-url`, no `detail`, key `error.credentialsInUrl`, checked
    right after `cloneSourceProblem` before any file-system/state/git work, 422, no client
    pre-check.
  - **W5-15** (explicitly confirmed by the user) any userinfo in an http(s)/ftp(s) URL is refused;
    `ssh://user@` and the scp-like form stay allowed; S-07.3 reworked with a credential helper in
    the console's isolated global git config, W4-11 without userinfo.
  - **W5-16** the `ErrorText` alert above the kept header on a failed re-read with cached data;
    R9 accepted for v0.1.
  - **W5-17** `useRemoveProject` does not await the list read on a refusal; unit test.
- Spec amendments (spec-006 §3, spec-008 §3/§6) are applied by the coordinator on `main`, not on
  this branch.
