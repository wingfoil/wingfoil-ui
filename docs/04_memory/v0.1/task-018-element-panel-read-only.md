---
id: task-018-element-panel-read-only
type: task
title: "Element panel read-only"
status: done
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-G-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The read-only element panel (right drawer), reachable by URL (`/p/:pid/e/:eid`) so that it is built before the Memory list: state machine with the current state, rejection banner, summary, references and history (spec-002 §2). The section of the directives that apply to the element's roles (US-G-02) is added by task-019 with the Directives view.

**Backlog items:** US-G-01

- US-G-01 — As Morgan, I want an element panel with the state machine, rejection banner, summary, references (missing required ones flagged) and history with commits, so that I see everything about an element in one place

## Acceptance Criteria

- **US-G-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/element-panel.feature`: G-01.1 Show an element with its state machine and history; G-01.2 Show the rejection banner after a reject; G-01.3 Flag a missing required field; G-01.4 Open an element panel from its URL

Screen: `docs/00_reference/ux-reference.md` §4.2 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-003`; `spec-002` §2 (history entries); `spec-004` §3 (`/elements/:eid`, `/history`); `ux-reference.md` §4.2; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-07)

- **depends_on acknowledged (dl-015):** Execution Notes of task-012 and task-013 read (reviews and
  integrations included), and of task-005, 010, 011 for the parts the panel consumes. Taken from
  them:
  - 013 — view recipe: `routes/<view>.tsx` with `createRoute({ getParentRoute: () => projectRoute,
    … })`, one line in `PROJECT_ROUTES`, the query-key factory in the route file on
    `queryKeys.project(pid, …)`, `apiGet` in query functions, `useServerEvent` (never start a
    stream; `repo` already invalidates `['p', pid]`, so an open panel refreshes by itself —
    S-26.2, task-017's scenario), ids through `defineMessages` when not literal, every key in
    `en.json` in the same commit, errors through `ErrorText`/`errorMessage`, React Aria with the
    router wired; a modal closes with Close or Escape, not a click outside (ux-reference §5, the
    library's "Dismiss" text); e2e support `consoles.start`/`openConsole`/`fixtures.get|copy`/
    `mutateAndWait`, `scanThemes`, `expectFocusVisible`.
  - 012 — `GET /api/p/:pid/elements/:eid` → `ElementDetail {element, frontmatter, body,
    descriptor?, required?, eventsError?}` (`descriptor`/`required` absent with an unreadable
    `memory.yaml`; 404 `not-found` unknown eid; 502 `read-error {file, kind}` for that element only);
    `/history` → `MemoryHistory {id, path, entries[]}` (`memory history`, memoised per state: 1 CLI
    process per opened element and state, spec-002 §2); `X-Repo-State` on both.
  - 011 — descriptor rendered, never re-derived: `tone` as data (`tone-${tone}`), `rejection {by,
    reason|null, at}` for the banner; REQ-ARC-05 on `web/**` (data keys and literals equal to a
    fixture name: `open`, `active`, `done`, `pending`, `draft`, `approved`, …).
  - 005/010 — direct reads scoped to the element; the snapshot memo makes a reopened panel cost 0
    processes.
- **Specs:** spec-003 (§2 kinds, §7 tones, §8 output), spec-002 §2 (history source; `operation:
  null` → "edited outside a WingFoil verb"), spec-004 §3 (rows `/elements/:eid`, `/history`), §5,
  spec-008 (area `element`, no type/state name in the catalogue), spec-009 (tokens, tones),
  ux-reference §2 (overlay), §4.2, §5 (modal dismissal), prototype drawer (480 px right aside,
  backdrop, header: type tag · id · close; title; state chips; banner; summary; references;
  directives; history), adr-002 (React Aria, TanStack), directives `accessibility`,
  `ux-consistency`.
- **Layout:**
  ```
  web/src/routes/element.tsx        elementRoute `/p/$pid/e/$eid` (no nav entry: an overlay),
                                    elementKeys (detail, history), the drawer page
  web/src/element/ElementPanel.tsx  the drawer (RAC Modal + Dialog, heading = title, Close)
  web/src/element/StateMachine.tsx  ordered list of state chips (past / current / future)
  web/src/element/History.tsx       history list (who, when, transition, reason, short sha)
  web/src/element/model.ts          pure helpers: summary excerpt, member name of "Name <email>",
                                    chip positions
  web/src/theme/tones.css           .tone-<tone> classes (spec-009 tone tokens), shared with 017
  ```
  The directives section (task-019, US-G-02) gets an empty, documented slot in `ElementPanel`
  between References and History.
- **Fetches:** one `GET /elements/:eid` + one `GET /elements/:eid/history`, both under
  `queryKeys.project(pid, 'element', eid, …)`; no per-reference request (TT-PERF-05 untouched).
- **Test plan:**
  - unit/component (`test/web/element/*.test.tsx`, jsdom, `render.tsx` + `stubApi`): chips
    past/current/future and the out-of-sequence cases; rejection banner with and without reason;
    missing required fields; history lines per operation (incl. `null`); read-error and not-found
    rendered from the catalogue; `typesError` degradation (no descriptor, no states: only the
    current state); Escape/Close; key-catalogue render (every string from the catalogue).
  - e2e (`test/e2e/element-panel.spec.ts`, real bin, one test per scenario, `scanThemes`):
    G-01.1 (kanban `task-001-login-form`: type, id, title, chips, "submitted by Jordan" + short
    hash + date), G-01.2 (kanban `task-002-password-reset`, already rejected by Morgan in the
    built fixture: banner text), G-01.3 (custom `adr-001-local-server`, built with an empty
    `sard_ref`: "sard_ref — required field, missing"), G-01.4 (URL copied, opened in a new page of
    the same context → the panel). Identity ("I am Morgan/Jordan") does not change a read-only
    panel: the fixture's identity (Alex) is used, noted in the closure table.
- **Decisions — reported to the coordinator, awaiting the go (recommended option first):**
  1. *State machine data.* `ElementDetail` has no type states; the chips need the resolved
     `sequence`. (a) add `states` (the resolved `StateMachine` of the type, `resolveStates`) to
     `GET /elements/:eid` (schema, type, route test; absent with `descriptor`) — one fetch
     (recommended); (b) also fetch `GET /config` and resolve in the web (a third request, spec-001
     §4.1 rule duplicated in `web/`).
  2. *Chips when the current state is not in `sequence`* (off-sequence, undeclared, archived):
     (a) the sequence chips without past/future marking, then the current state as its own chip
     (tone from the descriptor) (recommended); (b) hide the sequence, show only the current state.
  3. *Summary in v0.1* (no `summary` field; the body is Markdown; the full rendered document is
     US-G-03, v0.3): (a) the first paragraph of the body as plain text (HTML comments, headings,
     front blank lines skipped; no Markdown rendering), "No summary in the document." when none
     (recommended); (b) the whole body rendered with markdown-it + DOMPurify (a dependency task-020
     adds in parallel; overlaps G-03).
  4. *References in v0.1* (the taxonomy that gives each reference its UI category is `ui.yaml`,
     spec-005, v0.3): (a) the frontmatter fields other than `id`/`type`/`title`/`status`, each with
     its value(s), empty ones shown as "—", no category; the missing required fields flagged
     "<field> — required field, missing" next to the summary (G-01.3) (recommended); (b) only the
     required fields; (c) guess reference fields by name (`ref`, `*_ref`) — methodology words.
  5. *What is behind the drawer.* The panel is the route `/p/$pid/e/$eid` (task text, G-01.4):
     (a) the project layout with the panel as a modal drawer over an empty main area; Close/Escape
     go back in history when the panel was opened inside the application, else to `/p/$pid`
     (recommended; task-017 may later render the list behind it); (b) nest `e/$eid` under every
     view (`/p/$pid/memory/e/$eid`) — another URL than the task's.
  6. *Read-only header and footers:* (a) no Edit button and no action footer in v0.1 (edit and
     verbs are later releases, S-24 is v0.2) (recommended); (b) a disabled Edit "coming".
  7. *History wording without state names in the catalogue* (spec-008 §3: "approved" is a fixture
     state): (a) "created by", "submitted by", "signed off by", "rejected by", "deprecation by",
     and "edited outside a WingFoil verb by" (spec-002 §2) + `{name}` (the approver for
     approve/reject, else the author, without the email); the transition `{from} → {to}` as data
     (recommended); (b) the CLI's `subject` verbatim.

### red / green / refactor (2026-10-07)

- **Pending decisions:** the 7 design decisions were sent to the coordinator and got no answer
  during this run. The panel is built on the recommended option (a) of each one. Each option is
  contained so that it can change: 1 → `statesOf` in `project-routes.ts` + `states` in
  `element.schema.json`/`ElementDetail`; 2 → `stateChips`; 3 → `summaryOf`; 4 → `fieldEntries`;
  5 → `close` in `routes/element.tsx`; 6 → nothing rendered; 7 → `element.history.entry`.
- **Red / green** (`33b9e87`). **Deviation (test-after):** `web/src/element/model.ts` was written
  right after its unit test (`test/web/element/model.test.ts`), before the test was run, so the test
  passed on its first run. The component test `test/web/element/panel.test.tsx` was written after
  the components. The server half was red first: the route test "answers the resolved states of
  the element type" failed on `states` undefined, then passed with `statesOf`.
  - Server: `GET /elements/:eid` adds `states` (`resolveStates`, spec-001 §4.1). It is absent
    together with `descriptor`/`required` (unreadable `memory.yaml`, asserted) or for an
    undeclared type. Contracts: `element.schema.json` (`$ref` to
    `memory-yaml.schema.json#/definitions/states`), `ElementDetail.states?: StateMachine`.
    **Spec-004 §3 row/addendum to amend on `main`**: "one element: frontmatter, body, descriptor,
    references, type states".
  - Web: `routes/element.tsx` (`elementRoute` `e/$eid` under `projectRoute`, no `staticData.nav`;
    `elementKeys.detail/history` on `queryKeys.project(pid, 'element', eid, …)`; page title
    `title.projectElement` with the project name from the already-cached `GET /api/projects`;
    close = `history.back()` when `useCanGoBack()`, else `/p/$pid`), `element/ElementPanel.tsx`
    (RAC `ModalOverlay`/`Modal`/`Dialog`, labelled by the `<h2>` title, not dismissable by an
    outside click), `element/StateMachine.tsx` (`<ol aria-label>`, `aria-current="step"`,
    a visually hidden "(past/current/future state)" per chip, `tone-${descriptor.tone}` on the
    current chip only), `element/History.tsx` (newest first, `FormattedDate`, short sha with the
    full sha as `title`), `element/model.ts`, `element/element.css`, `theme/tones.css` (the six
    `.tone-*` classes + `.visually-hidden`, imported by `main.tsx`), 23 catalogue keys
    (`element.*`, `title.projectElement`).
  - Refreshing: both keys sit under `['p', pid]`, so the `repo` event refetches an open panel. No
    `useServerEvent` was needed.
- **e2e** (`e8b32e5`): `test/e2e/element-panel.spec.ts` was written after the code. It passed on
  its first run.
- `test/README.md` 0.14.
- **Scenario closure (US-G-01):**

  | Scenario | Proved by |
  |----------|-----------|
  | G-01.1 Show an element with its state machine and history | `test/e2e/element-panel.spec.ts` › "G-01.1 — Show an element with its state machine and history": kanban `task-001-login-form` by URL; dialog named "Login form"; type tag `task`, id, `<h2>`; chips `draft` / `pending` / `approved` with `data-position` past / current (`aria-current="step"`, class `tone-human` from the descriptor) / future and the accessible texts "draft, past state", "pending, current state", "approved, future state"; the line "submitted by Jordan" holds the 7-char sha and the date of the `memory history` submit entry, with the full sha as title; Close and the scrollable body region reached by Tab with a visible focus; axe 0 serious/critical in light and dark; Escape closes to `/p/<pid>` with the focus on `<main>` |
  | G-01.2 Show the rejection banner after a reject | same spec › "G-01.2 …": kanban `task-002-password-reset` (rejected by Morgan in the built fixture) shows "Rejected by Morgan: Missing acceptance criteria", `draft` current, the history line "rejected by Morgan" with the quoted reason; axe in both themes |
  | G-01.3 Flag a missing required field | same spec › "G-01.3 …": custom `adr-001-local-server` (built as a committed draft with an empty `sard_ref`) shows "sard_ref — required field, missing" inside the *Summary* region; axe in both themes |
  | G-01.4 Open an element panel from its URL | same spec › "G-01.4 …": the panel URL (`<origin>/p/<pid>/e/task-001-login-form`, no token) opened in a new page of the same browser context shows the panel of `task-001-login-form`, title `… · task-001-login-form — WingFoil UI` |

  The scenarios' "I am Morgan/Jordan" is not set up: the read-only panel shows the same thing to
  every identity, so the fixtures' identity (Alex) is used.
- **Checks** (load 3.8–8.5 on 12 cores): typecheck, lint (ESLint + catalogue check), format:check
  clean · `docs:api` OK · `npm run -s test:coverage` **92 files passed, 1 skipped; 1426 passed / 1
  skipped**, coverage 95.88 % statements / 89.14 % branches / 96.38 % functions / 97.88 % lines
  (`web/src/element` 100 % / 96.47 %) · `test:e2e` **18/18** · `check_tasks.py` OK ·
  `npm run test:timing` **3/3** at load 8.5 → 6.4: REQ-PERF-03 20/20, max 496 ms; TypeDoc
  3038 ms; REQ-PERF-06 276–304 ms.
- **Hand-overs:**
  - **task-017:** a list row links to `/p/$pid/e/$eid` (a React Aria `Link href` with the concrete
    path, or the router `Link to="/p/$pid/e/$eid"`). Close goes back to the list through
    `history.back()`; the list must then focus the originating row (by eid), see review round 1.
    The panel replaces the Outlet, so the list is not rendered behind the drawer
    (decision 5). To keep it visible, a later change can render the list as the panel route's
    background. Reuse `theme/tones.css` (`tone-${descriptor.tone}`) for the state pills; do not add
    tone classes to `base.css`. S-26.2 (refresh an open panel) needs no code: the panel keys sit
    under `['p', pid]`. S-28.2 (chips of an unknown type) is served by `states` +
    `StateMachine`; assert it with `chip(page, state)` as in `element-panel.spec.ts`.
  - **task-019 (US-G-02):** the *Directives* section goes at the comment slot in
    `ElementContent` (`element/ElementPanel.tsx`), between References and History, as a
    `<section aria-labelledby>` with an `h3.section-title`. Its directive links go to the
    Directives view. Fetch `GET /directives` once (no per-element request).
  - **task-020 (R-09.1):** to open a Memory file, navigate to `/p/$pid/e/<id>` (resolve the path
    against `GET /elements`).
  - **task-021:** X-10.2's title is set by the panel (`title.projectElement`, project name from
    `GET /api/projects`, the pid until it loads).
  - **Coordinator:** the decisions 1–7 above; the spec-004 §3 amendment for `states`.

### design decisions (2026-10-07)

- Decided by the user (coordinator decisions W3-14…W3-20): decisions 1–7 of the design, each
  option (a), exactly as built. Spec amendments on `main` (`10d3759`): spec-004 §3 `states`
  addendum, spec-003, spec-008, ux-reference 0.4 §4.2. W3-21 (N15): the deprecate history line
  reads "marked obsolete by {name}" (no state name).
- Process lesson: the decisions were sent and the build went on without waiting; the rule "when
  told to wait, wait" was added to the dev rules.

### review round 1 (2026-10-07)

- Independent review: **PASS with minors**. Fixed one commit per point:
  - **F1, N9** (`daec946`) each chip shows its name `aria-hidden` and gives assistive technology
    one message with the state as argument: `element.states.past|current|future|other` =
    "{state}, past state" / "current state" / "future state" / "state of the sequence". Component
    and e2e tests assert `data-position`, the accessible text and the tone class (`expectChip`).
  - **F2, F4** (`71ffa29`) after closing, the focus goes to the destination's `<main>` when it
    was lost (on `<body>`). A destination that places the focus itself keeps it (tested). Close
    after opening from `/` returns to `/` (history back), which is distinct from the `/p/$pid`
    fallback of a panel opened by URL (tested). e2e G-01.1: `<main>` is focused after Escape.
  - **F3** (`6267f51`) `overflow-wrap: anywhere` + `min-width: 0` on the title, summary, field
    values (also `max-width: 100%`) and history texts. e2e "a long unbroken value wraps inside
    the drawer" (300-char `ref` and body line on a kanban copy): no horizontal scroll. It fails
    on the previous CSS.
  - **F6** (`fb064ac`) `element.notice.eventsError` = "The repository history could not be read:
    the rejection banner may be missing."
  - **F7** (`85cb7d4`) the scrollable `.drawer-body` is `role="region"`, `tabIndex=0`, named
    "Element details" (`element.body.label`), with an inset focus ring. Tested in the component
    test and the e2e (Tab, visible focus).
  - **W3-21** (`d12e65b`) "marked obsolete by {name}", component test.
  - **N8** (`73cbbc7`) the `attention` tone on the current chip only. **N10** (`4c54fb8`)
    `.visually-hidden` moved to `base.css`.
  - **F5** (`4110223`) route tests: a type that `memory.yaml` does not declare (`bug` removed
    from the server's read) → descriptor `kind: undeclared`, `required: []`, no `states`. A
    deprecated element (`task-003-logout`, CLI `memory deprecate` on a copy) → `archived` with
    the type's `states`.
  - **N12** design layout bullet corrected (`model.ts`, not `summary.ts`).
- **Prototype deviations (directive `ux-consistency`, N13):**
  - the section headings are "Summary" and "References". The prototype has a summary paragraph
    without a heading and "References" with a UI-category caption, which v0.1 lacks (W3-17: no
    taxonomy before v0.3);
  - the missing required field is flagged in the Summary section ("<field> — required field,
    missing", G-01.3), not under the references as a missing-category note;
  - references are the frontmatter fields with their values (no category chip);
  - no Edit button and no footer (W3-19);
  - the current chip is outlined and coloured by the descriptor tone, and the past and future
    chips use text colour only;
  - the drawer is closed by Close/Escape only, not by a click on the backdrop (ux-reference §5).
- **Small choices (N14):** history newest first; the page title uses the element id
  (`title.projectElement`, X-10.2), with the pid until the project list is loaded; three notices
  (local changes, events error, unreadable type definitions); loading texts for the element and
  the history; a failed history read stays inside the History section.
- **Open point (N11, v0.2):** the full commit hash is only in the short hash's `title` tooltip,
  which is not reachable by keyboard or touch. Decide in v0.2 (copy button or expandable line).
- **Checks** (HEAD `4110223` + notes, load 8.8 → 16.6): typecheck, lint (ESLint + catalogue check),
  format:check clean · `docs:api` OK · `npm run -s test:coverage` **92 files passed, 1 skipped;
  1433 passed / 1 skipped**, coverage 95.95 % statements / 89.29 % branches / 96.5 % functions /
  97.89 % lines (`web/src/element` 100 % / 96.38 %) · `test:e2e` **19/19** · `check_tasks.py` OK
  · `npm run test:timing` **skipped** (load 16.6 > 12; it passed 3/3 before this round).
- **Hand-over 017 (updated):** after the back navigation from the panel, focus the originating row
  (by eid) on the list's mount. The panel moves the focus to `<main>` only when no element holds
  it.

### integration (2026-10-07)

- Re-verification of review round 1: **PASS** (two harmless nits, no action).
- `main` merged into the branch (`2d7df33`, authorised by the coordinator): spec amendments W3
  (`10d3759`, `3aa0433`, `b44f999` — spec-004 §3 erratum: `states` is also absent for an undeclared
  type, with the descriptor present, which is what the code and the F5 route test do) plus status
  commits. No conflict.
- Gates on the merge: typecheck, lint (ESLint + catalogue check), format:check clean · `docs:api`
  OK · `npm run -s test:coverage` **92 files passed, 1 skipped; 1433 passed / 1 skipped**, coverage
  95.95 % statements / 89.29 % branches / 96.5 % functions / 97.89 % lines · `test:e2e` **19/19**
  · `check_tasks.py` OK · `npm run test:timing` **3/3** after waiting for the load to drop below
  12 (start 8.86, 1-minute load 6.8–8.9 during the run; the 5- and 15-minute averages were still ≈ 12.6):
  REQ-PERF-03 20/20, max 1507 ms; TypeDoc 8931 ms; REQ-PERF-06 563–1485 ms.
