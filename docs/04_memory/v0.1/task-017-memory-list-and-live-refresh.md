---
id: task-017-memory-list-and-live-refresh
type: task
title: "Memory list and live refresh"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-M-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-010-snapshot-cache-and-live-updates", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The Memory list (the v0.1 landing view): type filters from `memory.yaml` with counts, state filters and the generic buckets (*To approve*, *In progress*, *Done*, … as defined in the header of `features/m/memory-list.feature`, taken from the descriptor's `bucket` (spec-003 §8)), unknown types and states under their own names, rows opening the element panel (task-018), the local-changes marker, live refresh from the event stream, the same build on the three fixtures.

**Backlog items:** US-M-01, US-M-02, US-S-25, US-S-26, US-S-28

- US-M-01 — As a member, I want the Memory list with type filters from `memory.yaml` (with counts) and state filters (buckets for all types, real states per type), each item opening its panel, so that I find any element
- US-M-02 — As a member, on a project with types and states unknown to the UI, I want them listed under their own names and grouped in generic buckets, so that nothing is hidden because it is unfamiliar
- US-S-25 — As a member, I want the UI to show the project as the CLI reads it — the working tree — with elements that have uncommitted changes marked local changes, so that what I see is what the CLI would act on
- US-S-26 — As a member, I want the views to refresh by themselves after a new commit or a file change, so that I never act on a stale screen
- US-S-28 — As Alex, I want a Kanban project, the WingFoil (`custom`) project and a project with unknown types and states and no `ui.yaml` to render with no UI code change, the actions derived from each project's own definitions, so that the UI fits any methodology

## Acceptance Criteria

- **US-M-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/m/memory-list.feature`: M-01.1 Filter by type with counts; M-01.5 List one type with its real states; M-01.2 Filter all types by bucket; M-01.3 Open the element panel from the list; M-01.4 Show a type with no element
- **US-M-02** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/m/memory-list.feature`: M-02.1 List unknown types under their own names; M-02.3 Show the declared states of an unknown type; M-02.2 Group unknown states in generic buckets
- **US-S-25** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-25.1 Mark an element with uncommitted changes; S-25.2 Remove the marker once the change is committed; S-25.3 Show an uncommitted new element
- **US-S-26** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-26.1 Refresh after a commit made outside the UI; S-26.2 Refresh an open element panel; S-26.3 Read the CLI once per state of the repository
- **US-S-28** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/action-descriptor.feature`: S-28.1 Render each fixture with the same UI build; S-28.2 Derive the state machine of an unknown type

Screen: `docs/00_reference/ux-reference.md` §4.4 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- Buckets: header of `features/m/memory-list.feature`, taken from the descriptor's `bucket` (`spec-003` §8); state kinds and tones: `spec-003` §2, §7; `spec-004` §3, §6; `spec-009` tones; `ux-reference.md` §4.4; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-07)

- **depends_on acknowledged (dl-015):** Execution Notes of task-010, 012, 013 and 018 read (reviews
  and integrations included), and of task-001, 005 and 011 for the parts the list consumes. Taken
  from them:
  - 013 — view recipe: `routes/memory.tsx` with `createRoute({ getParentRoute: () => projectRoute,
    path: 'memory', staticData: { nav: { group: 'work', order: NAV_ORDER.memory, label } } })`, one
    line `memoryRoute,` in `PROJECT_ROUTES`, the key factory in the route file on
    `queryKeys.project(pid, …)`, `apiGet` in query functions, `useServerEvent` (never start a
    stream), ids through `defineMessages` when not literal, every key in `en.json` in the same
    commit; React Aria `RouterProvider` wired; e2e support `consoles.start` / `openConsole` /
    `fixtures.get|copy` / `mutateAndWait` / `commitFile` / `cli`, `scanThemes`, `expectFocusVisible`.
  - 018 — rows link to `/p/$pid/e/$eid`; Close goes back in history (else to `/p/$pid`) and moves
    the focus to `<main>` only when nothing holds it: the list must focus the originating row (by
    eid) when it mounts after the back navigation. The panel replaces the Outlet (W3-18). Reuse
    `theme/tones.css` (`tone-${descriptor.tone}`) for the state pills. S-26.2 needs no code (the
    panel keys sit under `['p', pid]`); S-28.2 is served by `states` + `StateMachine`.
  - 010 — `repo {pid, state}` invalidates `['p', pid]` (also with an unchanged state); reconnect
    refetches everything; `X-Repo-State` on reads; the process audits
    (`test/server/snapshot/process-audit.test.ts`) model the Memory list as `GET /api/p/:pid`,
    `GET /config` and `GET /elements` in parallel: ≤ 6 CLI cold, 0 warm (TT-PERF-05, S-26.3).
  - 011 — `bucket` (`to-approve | in-progress | waiting | done`, absent for archived) and `tone`
    are data; spec-003 §8 vocabulary note: `web/` uses the bucket codes and tones as data, never as
    literals (REQ-ARC-05: `done`, `in-progress`, `active` are fixture state names).
  - 012 — `GET /elements` → `{elements[{…MemoryMatch, localChanges, descriptor?}], warnings,
    message?, typesError?, eventsError?}`; `typesError` → no descriptors, so no buckets;
    `?archived=true` adds the two `memory search --status` reads (spec-001: lazily, "M1 state
    filter"); resolved types in `GET /config` `types.data` (`memory.yaml` order kept).
  - 005/001 — `memory search` reads the working tree (S-25.x); fixtures kanban / custom / unknown.
- **Specs:** spec-001 §2 (`memory search` excludes archived; archived calls lazy), spec-003 §2,
  §7, §8 (+ vocabulary note), spec-004 §3, §5, §6, spec-008 (area `memory`, no type/state name in
  the catalogue), spec-009 (tones), ux-reference §2, §4.4, §5, §7, the prototype Memory screen
  (header + subtitle; type pills with counts; state chips with a tone dot and counts; rows: type
  tag · title / id · badge · age · state pill), directives `accessibility`, `ux-consistency`.
- **Layout:**
  ```
  web/src/routes/memory.tsx      memoryRoute `/p/$pid/memory` (nav: work / NAV_ORDER.memory),
                                 search params {type?, state?, bucket?} (validateSearch),
                                 memoryKeys.elements(pid, archived), the page (title, queries)
  web/src/memory/MemoryList.tsx  filters (two rows of toggle links), the rows, notices, empty texts
  web/src/memory/model.ts        pure: typeFilters, stateFilters, bucketFilters, filterRows,
                                 bucketLabel (code → `memory.bucket.<lowerCamel code>`)
  web/src/memory/memory.css      layout of the view (tokens only; pills reuse tones.css)
  web/src/api/queries.ts         + projectConfigQuery(pid) — `GET /config`, shared with task-019
  ```
- **Filters in the URL** (`?type=<type>&state=<state>` or `?bucket=<code>`): a filter is a link
  (`aria-current="true"` when selected), the back navigation from the panel restores the filters
  for free, and a filtered list can be shared. Type filters: *All types* first, then the types of
  `memory.yaml` in file order, each with its count of listed elements (M-01.1, M-01.4, M-02.1,
  S-28.1). State filters: with *All types*, *All states* + the four buckets in the feature
  header's order, each with its count, an element counted under its `descriptor.bucket` (M-01.2,
  M-02.2; no bucket row with `typesError`); with a type, *All states* + the type's resolved
  `sequence` (M-01.5, M-02.3).
- **Buckets without literals:** the four labels are `defineMessages` entries in the header's
  order with ids `memory.bucket.toApprove|inProgress|waiting|done`; an element's bucket code maps to
  its id by the lowerCamel rule of task-013's `error.<code>` (data → id), so no bucket code is
  written in `web/`; a type-level check ties the ids to `contracts`' `Bucket` union and a unit test
  checks the four labels against the feature header's texts.
- **Rows:** a router `Link` to `/p/$pid/e/$eid` per element, showing the type tag, title, id, the
  *local changes* badge (`localChanges`, S-25.x), the age in the current state (descriptor
  `since`, relative, when known) and the state pill (`status` as written, class
  `tone-${descriptor.tone}`; no class without a descriptor). Empty filter: "No {type} yet" for a
  type with no element (M-01.4), "No element matches these filters." otherwise.
- **Focus after the panel:** activating a row first writes `{ focusRow: eid }` into the list's own
  history entry (`router.history.replace` with the current href), then navigates to the panel; on
  mount the list focuses the row whose eid is in its entry's state (unconditionally, as 018 asked),
  so Close → back lands on that row (a removed row: nothing focused, the panel's fallback to
  `<main>` applies).
- **Live refresh:** both reads sit under `['p', pid]`: `repo` refetches them, no extra code
  (S-26.1, S-25.2). A polite `role="status"` region announces "The list was updated." after a
  refetch that changed the data (directive `accessibility`: refresh announced).
- **Fetches:** `GET /config` + `GET /elements` (the audited Memory list; no per-row request,
  TT-PERF-05); the elements list is the only list read.
- **Catalogue (area `memory`, + `shell.nav.memory`, `title.projectView`):** headings, filter
  labels, counts as arguments, bucket labels from the feature header, empty texts, the local-changes
  badge, notices (`typesError`, `eventsError`, CLI warnings), the refresh announcement. No type or
  state name in a message: names are arguments.
- **Test plan:**
  - unit (`test/web/memory/model.test.ts`): type filters (declared order, counts, zero counts,
    undeclared types per decision 4), state filters (sequence; buckets in order with counts; none
    with `typesError`), filtering by type/state/bucket, bucket code → label id for every `Bucket`.
  - component (`test/web/memory/list.test.tsx`, jsdom, whole app with `stubApi`): route and nav
    entry, filters as links with `aria-current`, row link to the panel, focus on the originating
    row after Close, local-changes badge, tone class from the descriptor, empty texts, notices,
    every text from the catalogue (key build), refetch on an invalidation announces the update.
  - e2e (`test/e2e/memory-list.spec.ts`, real bin, one test per scenario, axe in both themes on
    the list): M-01.1, M-01.5, M-01.2, M-01.3 (+ Close back to the focused row), M-01.4 (kanban);
    M-02.1, M-02.3, M-02.2 (4 examples) (unknown); S-25.1, S-25.2, S-25.3 (kanban copies:
    uncommitted title edit, its commit with git → marker gone, uncommitted new file); S-26.1
    (CLI approve on a copy → state pill `approved` without reload), S-26.2 (panel open, CLI
    approve → the history line of the approval with its short sha), S-26.3 (list reopened with no
    change → no new `GET /elements` from the page; the CLI count stays in the process audit),
    S-28.1 (three fixtures: exact type filters, every element with its state name), S-28.2
    (unknown `story-001-onboarding` opened from its row: chips and current `shaping`).
- **Decisions — reported to the coordinator, awaiting the go (recommended option first):** see
  the numbered list sent to "main" (routes, list behind the drawer, archived elements, undeclared
  states/types in filters, ux §4.4 items outside the scenarios, bucket labels in the catalogue).

### design decisions (2026-10-07)

- Decided by the user 2026-10-07 (coordinator decisions W3-22…W3-27), every point the recommended
  option of the design:
  - **W3-22** Memory at `/p/$pid/memory` with its sidebar entry; the index `/p/$pid` redirects there
    (replace) in v0.1 (Today takes the index in v0.2). This task updates task-018's G-01.1 e2e
    assertion (close of a panel opened by URL → `/p/$pid/memory`) and any 018 test relying on the
    fallback.
  - **W3-23** W3-18 kept: the panel replaces the list; the back navigation restores the filters from
    the URL and focuses the originating row. Prototype deviation recorded.
  - **W3-24** archived elements fetched lazily (`?archived=true`) on the first type selection; the
    landing view and the type counts on non-archived elements; the cold landing stays at 5 CLI.
  - **W3-25** per-type state filters = `sequence` + the undeclared states found on its elements,
    under their own names; undeclared types appended after the declared ones.
  - **W3-26** no "+ Ingestion", no producer note, no missing-required chip/badge; the age column
    from the descriptor's `since`; deviations recorded under `ux-consistency`.
  - **W3-27** bucket labels as in the feature header ("To approve", "In progress",
    "Waiting/drafts/closed", "Done"), the UI's closed vocabulary.
- Coordination with task-020 (coordinator's instruction): the elements queries use the key
  `queryKeys.project(pid, 'elements', { archived: false | true })`, factory in `api/queries.ts`
  (next to `projectConfigQuery`); `title.projectView` = "{project} · {view} — WingFoil UI".

### red / green / refactor (2026-10-07)

- **Red** (`a1474e7`): `test/web/memory/model.test.ts` (failed on the missing module) and
  `test/web/memory/list.test.tsx` (12 of 12 failed: no route, no heading, `/p/$pid` not redirected).
- **Green** (`4df7d3e`, `00f7bf4`) as designed, with these details:
  - `routes/memory.tsx`: `memoryRoute` (`validateSearch` → `{type, state}` or `{bucket}`), and
    `projectIndexRoute` (`/p/$pid` → `redirect` to `/p/$pid/memory`, replace; W3-22). Two lines in
    `PROJECT_ROUTES`. A comment line inside the array keeps Prettier from joining the lines.
  - `api/queries.ts`: `projectConfigQuery(pid)` (`['p', pid, 'config']`) and `elementsQuery(pid,
    archived)` (`['p', pid, 'elements', { archived }]`), the shared key (settled in review round 1, F1).
  - `memory/model.ts`: `typeFilters`, `stateFilters`, `bucketFilters`, `filterRows`,
    `bucketKeyOf`, `ageOf`. The bucket labels are four `defineMessage` ids in the header's order.
    The URL key of a bucket is the last id segment (`?bucket=toApprove`), compared with
    `bucketKeyOf(descriptor.bucket)` (lowerCamel). No bucket code is written in `web/`. A
    compile-time check ties the ids to `Bucket`.
  - `memory/MemoryList.tsx`: filters are router `Link`s with `activeOptions.exact`, so the
    selected filter gets the router's `aria-current="page"`. Each filter's accessible name is
    `memory.filter.withCount` ("task, 4 elements"). The state dot and the pill take the descriptor's
    `tone` (data). The age comes from the descriptor's `since`
    (`Intl.RelativeTimeFormat`, numeric auto), against the time of the last read (React purity
    rule: no `Date.now()` during render). The originating row is a module-level `{pid, eid}`, set
    on the row's click and used once when the list of that project renders its data again (W3-23).
    The `typesError` notice shows when the list or the config's `types` section failed, and then
    no bucket row is drawn. CLI warnings are shown verbatim. A polite `role="status"` region
    announces "The list was updated." when a refetch returns new data.
  - REQ-ARC-05: the prop `archived` was renamed `withArchived` (the unknown `note` state).
  - task-018's unit test "closes with Escape to the project…" now expects `/p/$pid/memory` (W3-22).
- **e2e** (`cc58b01`), **deviation (test-after):** `test/e2e/memory-list.spec.ts` was written after
  the code. It passed on its first run (26/26 with `element-panel.spec.ts`). The G-01.1 assertion of
  `element-panel.spec.ts` now expects `/p/$pid/memory` (W3-22, owned here).
- `test/README.md` 0.15.
- **Deviations from ux-reference §4.4 and the prototype (directive `ux-consistency`, W3-23, W3-26):**
  no "+ Ingestion" (writes from v0.2), no producer note, no "Missing required references" chip and
  no "missing refs" badge (the panel flags missing fields, G-01.3), no free-text filter (the
  prototype's, not in ux-reference). The element panel replaces the list instead of drawing over
  it (W3-18/W3-23). The per-type state filters add the undeclared states after the `sequence`
  (W3-25). The *local changes* badge sits where the prototype has "missing refs".
- **Scenario closure (US-M-01, US-M-02, US-S-25, US-S-26, US-S-28 and the deferred ones of task-005,
  010, 011, 001):**

  | Scenario | Proved by |
  |----------|-----------|
  | M-01.1 Filter by type with counts (also task-005) | `test/e2e/memory-list.spec.ts` › "M-01.1 — Filter by type with counts": kanban `/p/<pid>` lands on `/p/<pid>/memory` (W3-22), filters "task, 4 elements" and "bug, 1 element", sidebar "Memory" current, title "kanban · Memory — WingFoil UI", axe 0 serious/critical in both themes |
  | M-01.5 List one type with its real states | same spec › "M-01.5 …": the "task" filter reached and followed by keyboard (visible focus) lists exactly task-001…004, the state filters are exactly draft, pending, approved, the pill "pending" has `tone-human`; axe in both themes |
  | M-01.2 Filter all types by bucket | same spec › "M-01.2 …": *All types* + *To approve* lists exactly `bug-001-crash-on-save`, `task-001-login-form` (`?bucket=toApprove`); axe |
  | M-01.3 Open the element panel from the list | same spec › "M-01.3 …": the row of `task-003-logout` focused (visible focus) + Enter → the panel "Logout" at `/p/<pid>/e/task-003-logout`. Escape → `/p/<pid>/memory?type=task`, with the focus on that row (W3-23) |
  | M-01.4 Show a type with no element | same spec › "M-01.4 …": "adr, 0 elements", selected → "No adr yet"; axe |
  | M-02.1 List unknown types under their own names (task-011) | same spec › "M-02.1 …": unknown fixture type filters exactly story, note, each "2 elements"; axe |
  | M-02.3 Show the declared states of an unknown type (task-011) | same spec › "M-02.3 …": "story" → state filters exactly idea, shaping, ready-to-build, shipped |
  | M-02.2 Group unknown states in generic buckets (task-011) | same spec › "M-02.2 … : To approve / In progress / Waiting/drafts/closed / Done" (one test per example): the exact element sets, and "No element matches these filters." for Done |
  | S-25.1 Mark an element with uncommitted changes (task-005, 010) | same spec › "S-25.1 …": a kanban copy with the uncommitted title edit → row shows "Login form v2" and "local changes" (only that row); axe |
  | S-25.2 Remove the marker once the change is committed (task-010) | same spec › "S-25.2 …": the edit committed with git while the list is open → `repo` reaches the page, the marker is gone within 5 s, no reload (a window marker survives) |
  | S-25.3 Show an uncommitted new element (task-010) | same spec › "S-25.3 …": untracked `docs/memory/task/task-009-draft-idea.md` → listed with "local changes" |
  | S-26.1 Refresh after a commit made outside the UI (task-010) | same spec › "S-26.1 …": pill "pending", `memory approve` by the CLI on the copy → pill "approved" within 5 s without reload, "The list was updated." announced |
  | S-26.2 Refresh an open element panel (task-010) | same spec › "S-26.2 …": panel of `task-001-login-form` opened from its row; CLI approve → the history line "signed off by Alex" with the short HEAD sha and "“Looks good”" within 5 s |
  | S-26.3 Read the CLI once per state of the repository (task-010) | screen: same spec › "S-26.3 …" (list → panel → Close → the same list with no new `GET /elements` from the page); CLI count: `test/server/snapshot/process-audit.test.ts` › "Memory list: ≤ 6 CLI processes on a cold cache, 0 processes when reopened unchanged" (task-010/012) |
  | S-28.1 Render each fixture with the same UI build (task-001, 011) | same spec › "S-28.1 … : kanban / custom / unknown": type filters exactly the scenario's list, every element of `memory search` listed with its own state name in its pill; axe on custom |
  | S-28.2 Derive the state machine of an unknown type (task-011) | same spec › "S-28.2 …": the row of `story-001-onboarding` opens the panel. Chips idea, shaping, ready-to-build, shipped; "shaping" `aria-current="step"`, "shaping, current state" |

- **Performance:** the landing reads `GET /config` + `GET /elements` (component test: exactly these
  two paths, nothing per row); the archived read is made once, after the first type selection
  (component test: one `?archived=true` over two type selections). TT-PERF-05 (≤ 6 CLI cold, 0
  warm) is asserted by the process audit, unchanged.
- **e2e under machine load** (`7ce46a5`, `15af3e0`): at load 25–76 (other projects' builds on the
  same 12 cores) the cold first read of a console took longer than the default 5 s expectation, and
  up to 20 of the 40 e2e tests timed out, in this spec and in `element-panel.spec.ts` alike. The
  logs showed only timeouts ("Loading the Memory list…" / "Loading the element…" still on screen),
  never a wrong value. The first-load wait of `memory-list.spec.ts` is now 30 s. Later assertions
  keep the default. At load 7–14 the whole suite passes (below).
- **Checks** (HEAD `15af3e0`): typecheck, lint (ESLint + catalogue check), format:check clean ·
  `docs:api` OK · `check_tasks.py` OK · `test:e2e` **40/40** (load 7.3 → 14.1) ·
  `npm run -s test:coverage` **94 files passed, 1 skipped; 1459 passed / 1 skipped**, coverage
  96.12 % statements / 89.72 % branches / 96.69 % functions / 97.96 % lines (`web/src/memory`
  100 % / 96.62 %) (load 14 → 18; an earlier run at load ≈ 60 failed on two timeouts: the lint
  test and the first panel component test, both green when re-run at low load) ·
  `npm run test:timing` **3/3** at load 8.7 → 7.2: REQ-PERF-03 20/20, max 728 ms (a `memory approve`
  by the CLI: 552 ms); TypeDoc 3706 ms; REQ-PERF-06 272–302 ms.
- **Hand-overs:**
  - **task-019:** `projectConfigQuery(pid)` in `api/queries.ts` (`['p', pid, 'config']`), already
    read by the Memory list (one read per repository state, shared). The DNA view shows
    `dna.error.message`. `title.projectView` with the view label for the page title.
  - **task-020:** the shared elements query is settled by the coordinator (review round 1, F1) on
    this task's version: `elementsQuery(pid, archived)` in `api/queries.ts`, key
    `queryKeys.project(pid, 'elements', { archived })`. task-020 (now
    `projectElementsQuery(pid, withArchived)` / `{ withArchived }`) adopts it. Both branches add
    `title.projectView` to `en.json` and `TITLES.projectView` to `shell/page-title.ts`, and both bump
    `test/README.md`. Whoever merges second resolves those three files.
  - **task-021:** X-10.1 title of a view = `title.projectView` (the project name from
    `GET /api/projects`, the pid until it loads). The list's live region is "Memory list updates".
  - **v0.2 Today:** replace `projectIndexRoute`'s redirect with the Today view; the panel's
    fallback (`/p/$pid`) follows.
- **Open points:**
  - The default 5 s Playwright expectations of `element-panel.spec.ts` (task-018) time out on a
    cold console when the machine is loaded. The same 30 s first-load wait could be applied there.
    Not changed here (another task's suite, except the W3-22 assertion).
  - The age of an element is computed against the time of the last read. It does not tick while the
    page stays open with no change (no timer, REQ-INT-09 no polling).

### review round 1 (2026-10-07)

- Coordinator review: **PASS with findings**. Fixed one commit per finding. Each new test was run
  against the previous `MemoryList.tsx` and failed there (F2, F3, F4):
  - **F1** (`1a8fc94`) the task-020 hand-over states the settled query
    (`elementsQuery(pid, archived)`, key `queryKeys.project(pid, 'elements', { archived })`, adopted by
    task-020). It also says that `title.projectView`, `TITLES.projectView` and `test/README.md` need
    resolution by whoever merges second.
  - **F2** (`205fb9b`) focus theft: the return row is set only by a click that this page follows
    (primary button, no modifier, not prevented). It is taken by a mount effect into a ref and
    consumed once. A refetch never moves the focus. Component test: a Ctrl-click on a row, then a
    refetch with changed data → the focus stays where it was.
  - **F4** (`a996be3`) with a type selected, the return row waits for the configuration and the
    archived read. Component test: the archived list removed from the cache while the panel is open
    → after Close the archived row `k-009-gone` gets the focus once the archived read is back.
  - **F3** (`e192a9a`) every refresh that changed the list renders a new node in the live region
    (keyed by a counter). An unchanged refetch (same data, structural sharing) announces nothing. A
    filter change clears the announcement. Component test with a `MutationObserver`: unchanged → 0,
    two changes → 2 announcements, a filter click → empty.
  - **F5** (`39da270`) a `?type=` that is neither declared nor found on an element: "No element
    matches these filters.", no state row, and no archived read. The page enables the archived query
    only for a listed type, once the configuration and the list are settled. Helpers `typesOf` and
    `isListedType` moved to `model.ts`.
  - **F6** (`f893fb7`) a failed `GET /config` shows the type-definitions notice. The buckets stay,
    since they come from the descriptors of the list. Only a list `typesError` hides them. The notice
    text now fits every case: "The type definitions could not be read: some filters, buckets or
    tones may be missing."
  - **F7** (`ed0d57f`) S-26.3 asserts the number of `GET /elements` reads at a settled point: no API
    request in flight (the event stream aside) and none for 500 ms (`trackApi` in the spec). New
    component test: back and forward across `/memory` → `?type=kind-a` → `&state=s2` restore the
    filters, the current link and the rows.
  - **F8** not changed (task-018's suite, coordinator's bug).
- **Checks** (HEAD `ed0d57f` + notes): typecheck, lint (ESLint + catalogue check), format:check clean
  · `docs:api` OK · `check_tasks.py` OK · `test:e2e` **40/40** at load 7.8 (an earlier run at load
  17–34 had 3 timeouts: G-01.3, the drawer-wrap test, S-28.1 custom) · `test:coverage` (load 7.8 →
  29.6) **1463 passed, 1 failed / 1 skipped**, coverage 96.14 % statements / 89.78 % branches /
  96.71 % functions / 97.97 % lines (`web/src/memory` 100 % / 96.52 %). The one failure is
  task-018's first component test "shows the element: …" (jsdom `findByRole`, 1 s default, the cold
  first render of the file under load: the F8 case, not changed here). It passes when its file runs
  alone (`panel.test.tsx` + `test/web/memory`: 47/47). `test:timing` not re-run (load > 12); it
  passed 3/3 before this round.

### review round 2 (2026-10-07)

- Re-verification: **PASS with 3 minors**. Fixed one commit per point. Each test was run red first:
  - **N1** (`fix(web): a filter change resets the refresh announcement`) the announcement is dropped
    when the filter changes, so returning to a filter does not show it again. The F3 test was
    extended: refresh on *All types* → `kind-a` → *All types* gives an empty region and still two
    nodes.
  - **N2** (`fix(web): the return row takes the focus only while nothing else holds it`) the
    pending return row is focused only while the focus is on `<body>` or `<main>`, and dropped
    otherwise. Test: the archived read is held back, the user focuses a filter, then the read is
    released → the focus stays on the filter.
  - **N3** (`fix(web): no verdict on a selected type before the configuration is settled`)
    `unknownType` and the empty text wait for the configuration (data or error), like the route's
    archived read. Test: `?type=kind-e` with `/config` held back → no empty text, then "No kind-e
    yet".
- Checks: typecheck, lint, format:check clean · `docs:api` OK · `check_tasks.py` OK · `test:e2e`
  **40/40** (load 7.7) · `test:coverage` **1466 passed / 1 skipped**, 96.12 % statements / 89.88 %
  branches (`web/src/memory` 100 % / 97.61 %) (load 8.0 → 14.6).

### integration (2026-10-07)

- `main` merged into the branch (`4e7eb4a`, authorised by the coordinator): task-020 (documentation
  index and links, `2d1802f`), the spec amendments W3, bug-004. Conflicts and how they were resolved:
  - `web/src/api/queries.ts`: one `elementsQuery(pid, archived)` with the key
    `queryKeys.project(pid, 'elements', { archived })` kept (this branch's body, next to
    `projectConfigQuery`), and one import line (`ElementList, ProjectConfig, ProjectListResponse,
    ServerInfo`). task-020's `web/src/docs/pages.tsx` imports the same `elementsQuery(pid, false)`,
    so the Documentation view and the Memory list share one cache entry.
  - `test/README.md`: version 0.16, both entries kept (0.15 task-020, 0.16 task-017).
  - Merged without conflict: `routes/tree.ts` (`documentationRoute,` and this task's lines, one per
    line), `en.json` (`title.projectView` once), `shell/page-title.ts` (one `projectView`).
  - `npm install` for task-020's new dependencies (markdown-it and its types): 0 vulnerabilities.
- Gates on the merge: typecheck, lint (ESLint + catalogue check), format:check clean · `docs:api` OK
  · `check_tasks.py` OK · `test:e2e` **47/47** (load 6.7), the Memory list and Documentation specs
  included · `npm run -s test:coverage` **97 files passed, 1 skipped; 1582 passed / 1 skipped**,
  coverage 96.3 % statements / 90.1 % branches / 96.86 % functions / 98.08 % lines
  (`web/src/memory` 100 % / 97.61 %, `web/src/docs` 98.06 % / 92.17 %) (load 7.2 → 14.8) ·
  task-018's `panel.test.tsx` alone 16/16 (bug-004: no timeout in the full run either) ·
  `npm run test:timing` **3/3** at load 9.5 → 7.2: REQ-PERF-03 20/20 (a CLI approve 415 ms),
  TypeDoc 2981 ms, REQ-PERF-06 269–312 ms.
