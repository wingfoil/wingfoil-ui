---
id: task-019-dna-directives-and-team-views
type: task
title: "DNA directives and team views"
status: in-progress
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
