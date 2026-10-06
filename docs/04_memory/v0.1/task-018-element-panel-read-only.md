---
id: task-018-element-panel-read-only
type: task
title: "Element panel read-only"
status: in-progress
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
  web/src/element/summary.ts        pure helpers: summary excerpt, member name of "Name <email>",
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
