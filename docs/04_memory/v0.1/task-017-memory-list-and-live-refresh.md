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
- Coordination with task-020: the elements queries use exactly
  `queryKeys.project(pid, 'elements', { archived: false | true })`, factory `elementsQuery(pid,
  archived)` in `api/queries.ts` (next to `projectConfigQuery`), shared by both tasks;
  `title.projectView` = "{project} · {view} — WingFoil UI" (same line in both tasks).
