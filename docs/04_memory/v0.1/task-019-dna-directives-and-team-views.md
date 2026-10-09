---
id: task-019-dna-directives-and-team-views
type: task
title: "DNA directives and team views"
status: done
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-R-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-004-tests-time-out-under-extreme-machine-load"] # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-009-identity-and-role-views", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The DNA view (modules, stacks, methodologies, team and roles, paths), the Directives view (bound roles, *only mine / all*, body), the Team view (member cards, roles, pending gates, agents marked), the element panel's *Directives* section linking to the Directives view (US-G-02), and a failed CLI read confined to its view with the CLI's message and automatic recovery.

**Backlog items:** US-R-05, US-R-06, US-R-07, US-S-27, US-G-02

- US-R-05 — As Riley, I want a DNA view (modules, stacks, methodologies, team and roles, paths), so that I understand how the project is set up
- US-R-06 — As Jordan, I want the directives with their bound roles, filterable "only mine / all", with the body rendered, so that I know the standards I work under
- US-R-07 — As Morgan, I want a team view with member cards, roles and pending gates per member, agents marked "never approve", so that I know who can act on what
- US-S-27 — As a member, I want a CLI read that fails (e.g. a malformed governance file) shown as an error with the CLI's message on the affected view, the rest of the UI usable, so that one broken file does not hide the project
- US-G-02 — As Sam, I want the element panel to show the directives that apply to the element's roles, so that I review against the standards that apply

## Acceptance Criteria

- **US-R-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/dna.feature`: R-05.1 Show the project's DNA; R-05.2 Show an empty DNA section as empty
- **US-R-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/directives.feature`: R-06.1 Filter the directives bound to my role; R-06.2 Show every directive with "all"; R-06.3 Render a directive body; R-06.4 Show "only mine" empty for a user who is not in the team
- **US-R-07** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/team.feature`: R-07.1 Show members with their roles and pending gates; R-07.2 Mark agents as never approving; R-07.3 Filter members with pending gates
- **US-S-27** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-27.1 Confine a failed DNA read to the DNA view; S-27.2 Recover when the file is fixed
- **US-G-02** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/element-panel.feature`: G-02.1 Show the directives that apply to the element's roles; G-02.2 Open a directive from the panel

- **bug-004-tests-time-out-under-extreme-machine-load** (absorbed, dl-045) — the default gates fail only on wrong values, not on external load: one shared cold-read timeout in `test/e2e/support/` used by every e2e spec's first load (element panel, Memory list, documentation, this task's views); a longer async default for the web component tests; `test/lint/lint-clean.test.ts` and the process-spawning tests sized or isolated for the measured worst case; evidence recorded at integration (a full `test:coverage` + `test:e2e` run at load ≥ 30 with no timeout).

Screen: `docs/00_reference/ux-reference.md` §4.5, §4.6, §4.10 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-004` §3 (`/config`, `/directives`); `ux-reference.md` §4.2 (panel directives), §4.5, §4.6, §4.10; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-07)

- **depends_on acknowledged (dl-015):** Execution Notes of task-009, 012, 013, 017 and 018 read
  (reviews and integrations included), and of task-004, 005, 010, 011 and 020 for the parts used
  here. Taken from them:
  - 013 — view recipe: `routes/<view>.tsx` with `createRoute({ getParentRoute: () => projectRoute,
    path, staticData: { nav: { group: 'rules', order: NAV_ORDER.<view>, label } } })`, one line in
    `PROJECT_ROUTES`, the query-key factory in the route file on `queryKeys.project(pid, …)`,
    `apiGet` in query functions, `useServerEvent` only for events other than `repo` (never start a
    stream), ids through `defineMessages` when not literal, keys in `en.json` in the same commit,
    errors through `ErrorText`; e2e support `consoles.start` / `openConsole` / `fixtures.get|copy` /
    `mutateAndWait` / `commitFile`, `scanThemes`, `expectFocusVisible`.
  - 017 — `projectConfigQuery(pid)` (`['p', pid, 'config']`) and `elementsQuery(pid, archived)` in
    `api/queries.ts`, shared caches (one read per repository state); `TITLES.projectView` =
    "{project} · {view} — WingFoil UI"; tones in `theme/tones.css`; filters in the URL.
  - 018 — the Directives section goes at the slot of `ElementContent`, between References and
    History, a `<section aria-labelledby>` with an `h3.section-title`; `GET /directives` fetched once,
    not per element; Close/Escape go back in history and focus `<main>` when the focus was lost.
  - 020 — `markdownToSafeHtml` + `finishDocument` (`docs/render.ts`, DOMPurify last, `html: false`)
    for a directive body with a classification of its own; `replaceContent`-style focus keeping
    (`DocumentView.tsx`); pages behind `lazyRouteComponent` so that the renderer stays out of the
    entry chunk; the open point of bug-004 (worker fixtures built inside the test body).
  - 009 — "only mine" = `directivesForRoleView(entries, roleView)`: bound to the role view or
    global, `[]` without a role view (R-06.4); served as `entries[].mine` by `GET /directives`.
    Identity kinds `member` / `not-in-team` / `no-identity` / `ambiguous`, `roleViews`, `roleView`
    from `GET /api/p/:pid`.
  - 012 — `GET /config` sections each `{data, warnings?}` or `{error}`: a failed `dna show` stays in
    the `dna` section (S-27.1) and the header still answers with `dnaError`; `GET /directives` →
    `{entries (+ mine), warnings}` (tolerates a failed DNA: no role view → `mine` false);
    `/directives/:did` → `{entry, frontmatter, body}`, 404 unknown id, 502 `read-error` for that
    directive only.
  - 010 — `repo {pid}` invalidates `['p', pid]` (S-27.2: the fixed file refreshes the DNA view with
    no code); 011 — descriptor `kind`, `actor {kind: role, role, members}` for a `gate` (spec-003 §4),
    `gate-waiting` is not a pending gate (§5); data rendered, never re-derived.
  - 005/004 — the DNA view must render without `project` fields, stack lists, member `email`,
    agent `approval_authority` (0.2.2 optional fields); a CLI failure renders the CLI's message
    (`cli-refused` verbatim, spec-008 §4).
- **Specs:** spec-004 §3 (`/config`, `/directives`, `/directives/:did`, `GET /api/p/:pid`), §5,
  §6; spec-003 §4, §5, §8; spec-008 (areas `dna`, `directives`, `team`; role, member, module and
  directive names are data, never in the catalogue); spec-009 (tokens, tones); ux-reference §2
  (*Rules and context*: DNA · Directives · Team · Documentation), §4.2, §4.5, §4.6, §4.10, §5; the
  prototype (DNA: Modules · Stack/Methodologies · Team and roles · Paths, Edit button; Directives:
  title + subtitle, toggle "only mine / all", rows name · description · role chips with the view's
  roles highlighted, Edit; Team: subtitle, search, "with pending gates" chip, role chips, cards
  initials · name · "you" · email · role chips · "N pending gates on their roles" / agents
  "executes as a role, never approves"; panel "Applied directives" chips); directives
  `accessibility`, `ux-consistency`, `testing`, `code-quality`.
- **Layout (`web/`):**
  ```
  web/src/api/queries.ts            + projectHeaderQuery(pid) — GET /api/p/:pid (['p', pid, 'header'],
                                      shared with task-016), directivesQuery(pid) (['p', pid, 'directives'],
                                      shared by the Directives view and the element panel)
  web/src/routes/dna.tsx            dnaRoute /p/$pid/dna (nav rules / NAV_ORDER.dna), the page
  web/src/routes/directives.tsx     /p/$pid/directives (list, ?show=all) and /p/$pid/directives/$did
                                      (lazy page: the body renderer), directiveKeys, directiveQuery
  web/src/routes/team.tsx           teamRoute /p/$pid/team (?q=&role=&gates=1), the page
  web/src/dna/DnaView.tsx           sections, empty texts, the confined error (S-27.1)
  web/src/directives/DirectiveList.tsx, DirectivePage.tsx (lazy), model.ts (filter, roles
                                      highlighted, body link classification)
  web/src/team/TeamView.tsx, model.ts (pending gates per member from the descriptors, filters,
                                      initials)
  web/src/element/Directives.tsx    the panel section (G-02.1/G-02.2)
  web/src/{dna,directives,team}/*.css   tokens only; role chips reuse one class
  ```
  No server or contract change is planned.
- **Fetches:** DNA view `GET /config` (cached with the Memory list); Directives view
  `GET /directives` + `GET /api/p/:pid`; a directive `GET /directives/:did`; Team view `GET /config`
  + `GET /elements` (non-archived, the Memory list's cache) + `GET /api/p/:pid`; element panel + one
  `GET /directives` per project and repository state (not per element). Nothing per row or per
  directive (TT-PERF-05; the process audits are unchanged).
- **bug-004 (absorbed):**
  - `test/e2e/support/cold-read.ts`: `COLD_READ_MS` (60 s, the measured worst case of task-017's
    runs at load 76 was ≈ 25 s, doubled) and `expectFirstLoad(locator)` (= `toBeVisible({ timeout:
    COLD_READ_MS })`) used by the first cold read of every spec (shell, element panel incl. G-01.3,
    Memory list — its inline 30 s waits —, documentation, this task's specs); later assertions keep
    Playwright's default.
  - `test/e2e/support/fixtures.ts`: a worker fixture option `prebuild: FixtureKind[]` with an
    automatic worker fixture that builds those kinds before the first test body (300 s worker
    timeout), generalising task-020's `beforeAll`; each spec declares the kinds it uses.
  - Web component tests: `test/web/setup.ts` (Vitest `setupFiles` for `test/web/**`) sets Testing
    Library `configure({ asyncUtilTimeout: 10_000 })`; `panel.test.tsx` "shows the element…" stops
    depending on a 1 s wait.
  - `test/lint/lint-clean.test.ts`: timeout 600 s (the whole-repository ESLint was 34 s at load 30
    and failed 120 s at load 57–99); `test/launcher/local-security.test.ts`: the bin start
    `startLauncher(…, 60_000)` and its `beforeAll` hooks sized to it; `test/harness/fixtures.test.ts`
    `beforeAll` 600 s.
  - Evidence at the end of red/green: a full `test:coverage` + `test:e2e` at load ≥ 30 (synthetic
    CPU burners started and stopped by this task if the machine does not get there).
- **Test plan (red first: none of these screens exists):**
  - unit `test/web/team/model.test.ts` (pending gates per member: `gate` elements whose
    `actor.members` lists the member; `gate-waiting`, other kinds and elements without descriptor
    not counted; filters role / text / with pending gates; initials), `test/web/directives/model.test.ts`
    (filter mine/all, non-member → all, link classification of a body).
  - component (jsdom, `stubApi`): `test/web/dna/dna.test.tsx` (sections from the custom DNA, empty
    sections, optional fields absent, the `dna` section error with the CLI message while the
    sidebar stays), `test/web/directives/directives.test.tsx` (only mine/all from the URL, disabled
    "only mine" with its reason for a non-member, roles highlighted, the body page with a table,
    links, back link), `test/web/team/team.test.tsx` (cards, "you", pending gates, agents, filters),
    `test/web/element/directives.test.tsx` (panel section: the role view's directives as links, one
    `GET /directives` for two panels, non-member note, error confined to the section); every string
    from the catalogue (key build).
  - e2e (real bin, one test per scenario, axe 0 serious/critical in both themes on each screen):
    `test/e2e/dna.spec.ts` R-05.1 (custom, Riley), R-05.2 (kanban), S-27.1 (kanban copy, invalid
    `dna.yaml` committed: the DNA view shows the CLI's message, the Memory list lists the elements),
    S-27.2 (the file restored and committed → the DNA sections within 5 s, no reload);
    `test/e2e/directives.spec.ts` R-06.1 (custom copy, Jordan: exactly the developer-bound and
    global directives, each with its roles), R-06.2 (all = every directive of `directives list`),
    R-06.3 (`wingfoil-cli` body with its table), R-06.4 (Riley: "only mine" disabled with the
    reason, "all" selected); `test/e2e/team.spec.ts` R-07.1 (kanban copy, Morgan: 5 member cards,
    Morgan "approver", "tech-lead", "you", "2 pending gates"; Jordan "developer", no pending gate),
    R-07.2 ("Build agent" "executes as developer · never approves"), R-07.3 (with pending gates →
    exactly Morgan and Alex); `test/e2e/element-panel.spec.ts` + G-02.1 (custom copy, Sam,
    `task-001-cli-adapter`: the reviewer-bound directives incl. accessibility, ux-consistency, and
    the globals claim-evidence, wingfoil-cli), G-02.2 (kanban: a directive of the panel → the
    Directives view on it with the body rendered). Identity by `git config user.email` on a copy.
- **Decisions — reported to the coordinator, waiting (recommended option first):** see the
  numbered list sent to "main" (panel directives source, pending gates, header query, directive
  page, directive links, filter control, Team filters, DNA content, S-27.2 on kanban).

### design decisions (2026-10-07)

- Decided by the user 2026-10-07 (coordinator decisions W3-38…W3-46), every point the recommended
  option of the design:
  - **W3-38** the panel's Directives section = the directives of the current role view
    (`entries[].mine`: bound to it or global); a user outside the team sees the global ones with
    "You hold no role in this project"; each links to `/p/$pid/directives/$did`.
  - **W3-39** pending gates per member counted in `web/` from the `GET /elements` descriptors:
    `kind` `gate` with `actor.members` listing the member (`gate-waiting` excluded); no server change.
  - **W3-40** `projectHeaderQuery(pid)` in `api/queries.ts`, key `['p', pid, 'header']`, for task-016.
  - **W3-41** a list and a page per directive at `/p/$pid/directives/$did` (lazy), body through
    `markdownToSafeHtml` + `finishDocument`.
  - **W3-42** directive body links: `http(s)` in a new tab, in-page anchors, another directive → its
    page, any other repository path "not shown in the UI" with no request.
  - **W3-43** a `ToggleButtonGroup` *only mine / all*, state in the URL (`?show=all`); a member
    defaults to *only mine*; outside the team *all* is selected and *only mine* disabled with the
    visible reason.
  - **W3-44** Team filters search, role and *with pending gates* in the URL (`?q=&role=&gates=1`);
    agents in their own section, "executes as {roles} · never approves".
  - **W3-45** DNA view sections Project, Modules, Stack (technologies + methodologies), Team and
    roles, Paths; "No … declared" for an empty list; absent optional fields omitted; read-only.
  - **W3-46** S-27.2: the original `dna.yaml` restored and committed, recovery asserted within 5 s
    without reload.
- bug-004 scope added by the coordinator: the shared e2e support guarantees the teardown of every
  console it starts (process group killed at test end, on failure and at worker exit), and a
  global teardown checks that no console started by the run survives it (kills it and fails
  loudly). Cause: three `wingfoil-ui --no-open` consoles of task-017's e2e were still running
  about 10 h after its worktree was removed.

### red / green / refactor (2026-10-07)

- **Red** (`1137450`): `test/web/team/model.test.ts`, `test/web/directives/model.test.ts` (failed on
  the missing modules), `test/web/dna/dna.test.tsx`, `test/web/directives/directives.test.tsx`,
  `test/web/team/team.test.tsx`, `test/web/element/directives.test.tsx` and two rows of
  `test/web/api/queries.test.ts`: 28 failed (no route, no query, no section).
- **Green** (`67d5d98`) as designed (W3-38…W3-45), with these details:
  - `api/queries.ts`: `projectHeaderQuery(pid)` (`['p', pid, 'header']`, W3-40) and
    `directivesQuery(pid)` (`['p', pid, 'directives']`, shared by the view and the panel).
  - `routes/dna.tsx`, `routes/directives.tsx` (layout + list `/` with `validateSearch` → `{show?:
    'all'}` + `$did` lazy), `routes/team.tsx` (`validateSearch` → `{q?, role?, gates?: 1}`); three
    lines in `PROJECT_ROUTES`; nav entries *Rules and context* by `NAV_ORDER`.
  - `dna/DnaView.tsx` also exports the parts the other two views share (`Section`, `RoleChips`,
    `AgentLine`, `RulesError`); styles in `dna/rules.css` (tokens only, role chips on the tone
    tokens; the current view's role `data-current`).
  - `team/model.ts`: `pendingGates` counts descriptors of `kind` `gate` whose `actor.members` lists
    the member (W3-39); with `typesError` or a failed `GET /elements` the cards show no gate line and
    a notice. "you" = `identity.kind === 'member'` and its name.
  - `directives/model.ts`: `effectiveShow` (member → "only mine" by default; otherwise "all"),
    `shownDirectives`/`panelDirectives` on the server's `mine`/`global` (never recomputed from the
    roles), `classifyDirectiveLink` (W3-42) on `docs/links.ts`' `resolveLink`.
  - The directive page renders the body with `markdownToSafeHtml` + `finishDocument` (DOMPurify
    last) and a new `FinishOptions.hrefOf` (in-UI URL of a path + fragment; default the
    Documentation view's, unchanged). **Refactor (shared code of task-020):** the article part of
    `DocumentView.tsx` (content set outside React with the focus kept, fragment focus, click
    routing) moved to `docs/RenderedArticle.tsx` (`RenderedArticle`, `useRenderTexts`), used by both
    views; task-020's tests unchanged and green. A body starting with its own `# title` keeps the
    page's only level-1 heading (the page does not add a second one).
  - Element panel (W3-38): `element/Directives.tsx` at the slot between References and History;
    `ElementPanel` takes `pid`, `directives`, `header`. task-018's component test "shows the
    element…" now expects the two project reads besides the element and its history (no
    per-reference read), and its fake API answers them.
  - Catalogue: `shell.nav.dna|directives|team`, areas `dna`, `directives`, `team`,
    `element.directives.*`; no role, member or directive name in a message (all arguments).
  - Bundle: the Markdown renderer stays in the lazy chunk; the entry (index + shared chunk) is
    617.5 kB (190 kB gzip), +54 kB (+14 kB gzip) over task-020's 563 kB (the three views and React
    Aria's `ToggleButtonGroup`, `Checkbox`, `SearchField`).
- **e2e** (`bab9bd8`) — **deviation (test-after):** `test/e2e/dna.spec.ts`, `directives.spec.ts`,
  `team.spec.ts` and the G-02 tests of `element-panel.spec.ts` were written after the code (the
  component tests were red first). 17 of 18 passed on their first run; R-06.3's focus check was
  rewritten to reach the table by Tab (a programmatic focus after a mouse click shows no ring).
  `support/identity.ts` `actAs(fixture, name)` sets the scenario's user.
- **bug-004** (`bab9bd8`, `8c35bd6`, `4b0bc30`, `4b5c874`):
  - `support/cold-read.ts`: `COLD_READ_MS` (60 s), `expectFirstLoad(locator)`, `expectLoaded(scope)`;
    `openConsole` waits for the shell with it; every spec's first cold read uses it (shell — its
    first loads also through `expectFirstLoad` since review round 1, F8 —, element panel incl. G-01.3 and every panel opened from the Memory list or a
    document, Memory list — its inline 30 s waits replaced —, documentation, this task's specs).
  - `REFRESH_MS` (superseded by W3-47, below): the scenarios' "within 5 seconds" (S-25.2, S-26.1, S-26.2, S-27.2) is asserted as
    5 s when the worker starts below load 12 (the `test:timing` threshold) and as a cold read above
    it — a budget is a timing check, which the default gates do not make under external load
    (bug-001). **Reported to the coordinator** (it softens other tasks' 5 s assertions under load).
  - `playwright.config.ts` `timeout` 60 → 180 s (a test may wait for several cold reads and two axe
    scans); R-08.2 timed out on the whole-test budget at load ≈ 85.
  - `fixtures.ts` worker option `prebuild` + automatic `prebuilt` (300 s): every spec declares its
    kinds (`test.use({ prebuild: [...] })`); task-020's `beforeAll` replaced.
  - Teardown (coordinator's addition): `support/reaper.ts` — the bin runs `detached` (own process
    group, `startLauncher(…, { detached })`), each console is recorded in the run's directory
    (`WFUI_E2E_RUN_DIR`, made by the global setup) and in the worker; it is killed (group, SIGKILL)
    by the test's `consoles` teardown (`Promise.allSettled`, also on failure), by the worker reaper
    fixture, on the worker's `exit`/SIGTERM/SIGINT, and by `support/global-teardown.ts`, which
    fails the run naming any survivor. Unit test `test/harness/e2e-reaper.test.ts` (record/forget,
    worker reap, a survivor killed and reported, a recycled non-console pid left alone). After
    every run of this task: `pgrep -af wingfoil-ui.cjs` empty.
  - `test/web/setup.ts` (Vitest `setupFiles`): Testing Library `asyncUtilTimeout` 10 s in jsdom
    (test `test/web/setup.test.tsx`).
  - `test/harness/load.ts`: `BIN_START_MS` 60 s (`local-security` bin starts, its tests 120 s),
    `HEAVY_MS` 600 s (`lint-clean`, the `beforeAll` of `fixtures.test.ts`).
  - **Evidence** (12 cores; 24 CPU burners `yes > /dev/null` started and stopped by this task, on top
    of other projects' load; 1-minute load sampled every 10 s): `npm run -s test:coverage` **105
    files passed, 1 skipped; 1632 passed / 1 skipped** at load **31–63** (21:12–21:20);
    `npm run -s test:e2e` **60/60** at load **71–98** (21:42–22:02). The run before the
    `REFRESH_MS`/180 s fixes, at load 51–89, had 4 failures, all timeouts (R-08.2 whole-test
    budget, M-01.3 return focus waiting for the archived read, S-26.1 and S-26.2 5 s budgets), never
    a wrong value.
- `test/README.md` 0.17.
- **Scenario closure (US-R-05, US-R-06, US-R-07, US-S-27, US-G-02 and the deferred ones of task-004,
  005, 010):**

  | Scenario | Proved by |
  |----------|-----------|
  | R-05.1 Show the project's DNA (also task-005) | `test/e2e/dna.spec.ts` › "R-05.1 — Show the project's DNA": custom copy as Riley; the sidebar entry *DNA* reached by keyboard (visible focus, Enter) → `/p/<pid>/dna`, title "custom · DNA — WingFoil UI"; modules `server`, `web`, `contracts` each with its description and path, every technology, every methodology with its phase, every member with exactly its roles, every path category with its values — all compared with `dna show` of the same copy; axe 0 serious/critical in light and dark |
  | R-05.2 Show an empty DNA section as empty | same spec › "R-05.2 …": kanban (`dna show` modules `[]`) → the Modules section shows "No module declared"; axe in both themes |
  | S-27.1 Confine a failed DNA read to the DNA view (also task-004, task-005) | same spec › "S-27.1 …": kanban copy with an unparsable `.wingfoil/dna.yaml` committed; the DNA view shows "The DNA could not be read." with the CLI's own message (the stderr of `dna show` on that copy, verbatim), no section; axe in both themes; the sidebar *Memory* opens the list with exactly the five kanban elements |
  | S-27.2 Recover when the file is fixed (task-010) | behaviour: same spec › "S-27.2 …" in `npm run test:e2e`: the same broken copy, DNA view on the error; the original `dna.yaml` restored and committed (W3-46) → `repo` reaches the page → the Modules section ("No module declared") and the methodology "Kanban" replace the error by themselves, no reload (a `window` marker survives); **5 s**: the same test in `npm run test:timing` (`playwright.timing.config.ts`, W3-47), measured from the file write |
  | R-06.1 Filter the directives bound to my role | `test/e2e/directives.spec.ts` › "R-06.1 …": custom copy as Jordan; "Only mine" selected by default; the rows are exactly the global and developer-bound entries of `directives list` in its order (equal to `directives list --role developer`); each row's role chips equal the entry's roles ("All roles" for a global one), `developer` highlighted; visible focus on the toggle; axe in both themes |
  | R-06.2 Show every directive with "all" | same spec › "R-06.2 …": Jordan; "All" chosen by keyboard (arrow, Enter) → `?show=all`, the rows are every entry of `directives list` (all under `directives/`); axe in both themes |
  | R-06.3 Render a directive body | same spec › "R-06.3 …": the row "Using the pinned WingFoil CLI" → `/p/<pid>/directives/wingfoil-cli`, title "custom · wingfoil-cli — WingFoil UI"; the article's h1, the h2 "Known behaviours (0.2.2)" and the table with the column "Behaviour" and the cell "W-01", no Markdown source; the table region reached by Tab with a visible focus; axe in both themes; "← Directives" back to the list |
  | R-06.4 Show "only mine" empty for a user who is not in the team | same spec › "R-06.4 …": custom copy as Riley; "Only mine" disabled, the visible "You hold no role in this project" is the group's accessible description, "All" checked, every directive listed; axe in both themes |
  | R-07.1 Show members with their roles and pending gates | `test/e2e/team.spec.ts` › "R-07.1 …": kanban copy as Morgan; exactly 5 member cards Morgan, Casey, Jordan, Sam, Alex; Morgan: roles approver, tech-lead, "you", morgan@example.test, "2 pending gates"; Jordan: role developer, "No pending gate", no "you"; title "kanban · Team — WingFoil UI"; axe in both themes |
  | R-07.2 Mark agents as never approving | same spec › "R-07.2 …": the *Agents* section lists "Build agent" with "executes as developer · never approves"; no member card for it |
  | R-07.3 Filter members with pending gates | same spec › "R-07.3 …": the checkbox "With pending gates" reached by Tab (visible focus on its label) and Space → `?gates=1`, exactly the cards of Morgan and Alex; axe in both themes |
  | G-02.1 Show the directives that apply to the element's roles | `test/e2e/element-panel.spec.ts` › "G-02.1 …": custom copy as Sam, panel of `task-001-cli-adapter`; the Directives section lists exactly `directives list --role reviewer` (incl. accessibility, ux-consistency, claim-evidence, wingfoil-cli), each a link to `/p/<pid>/directives/<id>`; axe in both themes |
  | G-02.2 Open a directive from the panel | same spec › "G-02.2 …": kanban, panel of `task-001-login-form`; its first directive link focused (visible focus) and Enter → `/p/<pid>/directives/<id>`, the panel closed, the article named after the directive with its body rendered, *Directives* current in the sidebar |

  Unit/component: `test/web/team/model.test.ts`, `test/web/directives/model.test.ts`,
  `test/web/dna/dna.test.tsx`, `test/web/directives/directives.test.tsx`,
  `test/web/team/team.test.tsx`, `test/web/element/directives.test.tsx` (one `GET /directives` for
  two panels; a failed read stays in the section).
- **Performance:** no per-element or per-directive request: component tests assert the exact
  reads of each view (DNA: `/config`; Directives: the header and `/directives`; Team: the header,
  `/config`, `/elements`) and one `/directives` for two panels. The process audits
  (`test/server/snapshot/process-audit.test.ts`) are unchanged and green.
- **Prototype deviations (directive `ux-consistency`):** no Edit (v0.1, read-only); directives show
  the title and id (no description field in a directive's frontmatter) and get a page with the
  rendered body (R-06.3; the prototype has none); "only mine / all" is a two-option toggle with the
  disabled reason; agents are a section of their own, not member cards; the panel's directives are
  the role view's (W3-38), not per type; the DNA view adds a Project line (description, methodology)
  and role descriptions.
- **Checks** (see the evidence above for the load): typecheck, lint (ESLint + catalogue check),
  format:check clean · `docs:api` OK · `check_tasks.py` OK · `test:coverage` **1632 passed / 1
  skipped**, coverage 96.46 % statements / 90.39 % branches / 96.96 % functions / 98.13 % lines
  (`DnaView.tsx` 100 / 90.9, `TeamView.tsx` 100 / 89.58, `element/Directives.tsx` 100 / 81.25,
  `directives/pages.tsx` 100 / 97.22) · `test:e2e` **60/60** (also 60/60 at load 22–28 before the
  synthetic load) · `npm run test:timing` **skipped** (load > 12 throughout: 16–98).

### review round 1 (2026-10-08)

- Coordinator review: **PASS, no blockers**. Fixed one commit per finding (F1 and F2/F5 share the
  reaper's test file; F8 has a web and an e2e commit). F4 (the adaptive "within 5 s",
  `REFRESH_MS`) is **pending the user**: unchanged.
  - **F1** (`d16df67`) `startLauncher(…, { onSpawn })` gives the pid right after the spawn: the
    e2e console is recorded (worker set + run directory) before its running line; on the start's
    timeout a detached bin's whole group is killed (`process.kill(-pid)`), and `startConsole` kills
    and forgets a console whose start failed. Test: a bin with a 1 ms start budget is recorded at
    spawn, rejected, and gone.
  - **F2, F5** (`2d98107`) a run directory names its owner (the Playwright runner's pid, file
    `owner`); the global setup first reaps every `wfui-e2e-run-*` directory whose owner is gone (a
    run killed before its teardown) — a concurrent run's directory (owner alive) is left alone.
    `killGroup` kills the group only (no fallback to the pid). A recorded pid whose command line
    cannot be read is not killed but reported (`unverified`, a warning of the teardown). Tests:
    stale directory reaped with its console, live run untouched, unreadable command line left
    alone; the test's temporary directories are removed after each test.
  - **F3** (`5192aa3`) on a directive page, a repository link waits (`unresolved`) while
    `GET /directives` is pending, instead of a passing "not shown in the UI"; a failed list leaves
    no directive to open. Model test and component test with the list held back (fails on the
    previous code).
  - **F6** (`a03637a`) component test: a directive body with `<script>`, `javascript:`/`data:`/
    `vbscript:`/`file:` links and image, `<img onerror>`, `<iframe>`, an `onclick` attribute and an
    escaping path renders inert (raw HTML as text, no element of those tags, no `on*` attribute,
    only `http(s)` or `/p/` hrefs, nothing set on `window` after a click, images as marked text).
  - **F7** (`9efc915`) a member card is named by its name element (`aria-labelledby`), not an
    `aria-label` on the `<li>`.
  - **F8** (`5524385`, `27d95a9`) the Team search field follows the URL on back, forward and links
    (its own pushes are queued so that typing never jumps back; component test fails on the
    previous code); the shell spec's first loads go through `expectFirstLoad`.
- Checks (load 4–20): typecheck, lint (ESLint + catalogue check), format:check clean · `docs:api`
  OK · `check_tasks.py` OK · `test:coverage` **105 files passed, 1 skipped; 1638 passed / 1
  skipped**, coverage 96.48 % statements / 90.37 % branches / 97.05 % functions / 98.17 % lines ·
  `test:e2e` **60/60** (load 16–18; no console and no run directory left afterwards) ·
  `npm run test:timing` **skipped** (load > 12).

### W3-47 — live refresh: behaviour in the default gate, 5 s in the timing gate (2026-10-09)

- Decided by the user (W3-47, option a): the load-adaptive `REFRESH_MS` is removed. In
  `npm run test:e2e` the four live-refresh scenarios assert the behaviour only (the screen changes
  by itself, without a reload) with the cold-read budget, at any load. `npm run test:timing` gains a
  Playwright part, `playwright.timing.config.ts` (tag `@live-refresh`, one worker,
  `WFUI_STRICT_REFRESH=1`): the same tests check that the screen changed within 5 s **of the
  mutation** (`refreshClock().start()` right before the commit, the file write or the CLI verb that
  commits), so the budget covers watcher → event stream → refetch → render; each time is printed
  with the load. First run (load 8.5–9): S-27.2 495 ms, S-25.2 956 ms, S-26.1 1407 ms, S-26.2
  1312 ms. `test/README.md` 0.18.
- W3-47 supersedes the "within 5 s" wording of task-017's closure rows S-25.2, S-26.1 and S-26.2
  (task-017's notes are left as historical): the table below is their current proof.
- Closure of the live-refresh scenarios (S-25.2, S-26.1, S-26.2 close in task-017's table; their
  proof is now split as follows):

  | Scenario | Behaviour (`npm run test:e2e`) | 5 s (`npm run test:timing`) |
  |----------|--------------------------------|-----------------------------|
  | S-25.2 Remove the marker once the change is committed | `test/e2e/memory-list.spec.ts` › "S-25.2 …": the marker disappears by itself after the commit, no reload | same test, strict: ≤ 5 s from the commit |
  | S-26.1 Refresh after a commit made outside the UI | same spec › "S-26.1 …": the pill turns "approved" by itself, announced, no reload | same test, strict: ≤ 5 s from the start of `memory approve` |
  | S-26.2 Refresh an open element panel | same spec › "S-26.2 …": the open panel shows "signed off by Alex" with the new HEAD | same test, strict: ≤ 5 s from the start of `memory approve` |
  | S-27.2 Recover when the file is fixed | `test/e2e/dna.spec.ts` › "S-27.2 …": the DNA sections replace the error by themselves, no reload | same test, strict: ≤ 5 s from the file write |

### integration (2026-10-09)

- W3-47 implemented first (`b2fd447`, section above).
- `main` merged into the branch (`bb58a25`, authorised by the coordinator): the spec amendments W3 of
  `05d8876` (ux-reference 0.6 §4.2, §4.5, §4.6, §4.10; spec-003 W3-39 note) — they describe what was
  built; task-017 (`90b03ce`) was already in the branch's base. No conflict (`test/README.md`,
  `api/queries.ts` and the e2e specs untouched by `main` since the branch point).
- Gates on the merge: typecheck, lint (ESLint + catalogue check), format:check clean · `docs:api`
  OK · `check_tasks.py` OK · `npm run -s test:coverage` **105 files passed, 1 skipped; 1638 passed / 1
  skipped**, coverage 96.48 % statements / 90.37 % branches / 97.05 % functions / 98.17 % lines (load
  7.1 → 24) · `test:e2e` **60/60** (load 21–22; no console and no run directory left) ·
  `npm run test:timing` **pass** at load 6.7–8.0: REQ-PERF-03 20/20 (max 874 ms), TypeDoc 4900 ms,
  REQ-PERF-06 311–521 ms, and its Playwright part 4/4 — S-27.2 487 ms, S-25.2 971 ms, S-26.1
  1225 ms, S-26.2 1377 ms from the mutation (budget 5 s).
- **bug-004 evidence (summary):** default gates load-independent — `test:coverage` passed at load
  31–63 and `test:e2e` 60/60 at load 71–98 (24 CPU burners of this task plus other projects' load,
  2026-10-07); every remaining time budget lives in `npm run test:timing` (quiet machine). The
  e2e support tears down every console (process group, worker, run teardown, stale runs of a
  killed run reaped by the next setup).
