---
id: task-042-notification-bell-all-roles-summary-and-empty-today
type: task
title: "Notification bell all-roles summary and empty Today"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-S-21"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-031-today-api-and-memory-updates-feed", "task-036-today-requires-you-and-waiting-on-others", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The notification bell (S7) with the count of items to unblock and its panel (*To unblock* = the
Requires you rows, *Updates* = the last 10 Memory events), the all-roles summary on Today (S5) for
a member holding several roles, and the explicit "Nothing requires you" state, also reached after
the last action. First candidate to defer with task-029-npm-publishing-pipeline-and-registry-setup-checklist if the
budget runs short (RP-51).

**Backlog items:** US-S-21, US-S-23, US-T-07

- US-S-21 — As Morgan, I want a bell with the count of items to unblock and a list of updates, so that I know how much is waiting before opening anything
- US-S-23 — As Alex, I want an all-roles summary on Today — for each role I hold, the count and top items requiring it — so that I know which hat to put on first
- US-T-07 — As Morgan, I want an explicit "nothing requires you" state when the list is empty, so that I know the list is current, not broken

## Acceptance Criteria

- **US-S-21** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/shell.feature`: S-21.1 Count the items to unblock; S-21.2 Show no count when nothing requires me; S-21.3 Update the count after an action
- **US-S-23** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/shell.feature`: S-23.1 Summarise what requires each of my roles; S-23.2 Switch role view from the summary; S-23.3 Show no summary to a single-role member; S-23.4 Show at most 3 items per role
- **US-T-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-07.1 Say that nothing requires me; T-07.2 Reach the empty state after the last action

Also closes S-21.1, S-23.4 of TT-PERF-11 (task-031-today-api-and-memory-updates-feed) and S-23.1 of TT-PERF-09 (task-036-today-requires-you-and-waiting-on-others).

Screen: `docs/00_reference/ux-reference.md` §3 (*Notifications*), §4.1 (greeting, *Requires you* empty state) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §5 (`summary`, bell count = `requiresYou` length); `spec-004` §3 (`events/memory`),
  §6 (`repo`/`write` → refetch: S-21.3 after an action); the "configured channel" footer of
  `ux-reference.md` §3 is not in v0.2.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-15)

Read: this task; `CLAUDE.md`; the Execution Notes of `depends_on` task-031 (D31-1 … D31-6, reviews,
hand-over), task-036 (D36-1 … D36-11, review F1, bug-011), task-037 (D37-1 … D37-13, reviews);
`dev-loop-rel-v0.2-plan` sessions 1–4 (W0-9, W1-2, W2-0 — "T-07 stays with task-042", W3-3,
hand-overs to Wave 4); `release-planning-rel-v0.2-plan` RP-9, RP-11, RP-27, RP-43, RP-51, RP-53,
RP-55; spec-003 §5 (Today output, `summary`, the bell's *To unblock* = the same rows), spec-004 §3
(`events/memory`, `limit` 1–100 default 10, `before`), §6 (`repo`/`write`, no polling); spec-002 §1
(event shape); `shell.feature` S-21.x, S-23.x; `requires-you.feature` T-07.x; backlog `v0.2.json`
US-S-21, US-S-23, US-T-07, TT-PERF-09, TT-PERF-11; `01_vision/06_features.md` S5, S7;
ux-reference 1.3 §2, §3 (*Notifications*), §4.1, §5; the prototype's bell (`toggleNotif`: badge,
*Da sbloccare* first 6 rows, *Niente da sbloccare*, *Aggiornamenti* last 3, channel footer, *Apri
Oggi*); directives (`directives list`: `accessibility`, `ux-consistency`, `documentation`,
`doc-versioning`, `claim-evidence`); code: `web/src/shell/{Shell,header-slot,ProjectSwitcher,icons}.tsx`,
`web/src/project/ProjectHeader.tsx`, `web/src/routes/{project,today,tree}.tsx|ts`,
`web/src/today/{TodayView.tsx,model.ts}`, `web/src/element/{History.tsx,model.ts}`,
`web/src/api/{queries,query-keys,projects,writes}.ts`, `contracts/src/today.ts`,
`web/scripts/catalogue.mjs` (areas `shell`, `today`); tests: `test/web/shell/render.tsx` (unknown
paths answer 404), `test/web/today/today.test.tsx`, `test/e2e/support/{screens,identity,events,strings}.ts`,
`test/e2e/{today,gate-footer}.spec.ts`; fixture tables (`02_bdd/00_conventions.md`; Morgan holds
`approver, tech-lead`, Alex seven roles, Casey `product-owner`, Jordan `developer`).

**depends_on (dl-015 hard gate).**
- task-031: the summary is **server data** (`Today.summary`: one line per role in DNA order,
  `count`, ≤ 3 `items`, `more`; absent for a single-role member or an unidentified user) — the web
  renders it, never recomputes it; the bell's *Updates* are `GET …/events/memory?limit=10` (newest
  first, `{events, more}`); keys fixed by D31-6: `todayQuery` → `queryKeys.project(pid, 'today',
  { view })` with the header's `roleView` (omitted when `null`), so the bell and Today share one
  entry; `memoryEventsQuery` → `queryKeys.project(pid, 'events', 'memory', { limit })` is this
  task's. No partial Today (D31-3): a refusal is shown as an error, never as "Nothing to unblock".
  `memory search` warnings are not part of Today. No server change is needed: both routes exist.
- task-036: the empty state (T-07) is already built (D36-4: greeting `=0` branch and "Nothing
  requires you"); T-07 is closed here as characterization. Per-project components keyed by pid and
  announcements guarded on a view change (review F1); one axe/strings test per `SCREENS` entry
  (bug-011); lists filled by a second query asserted with retrying expects and `COLD_READ_MS`
  (bug-009); names lists in their own element (X-09.1).
- task-037: S-21.3 and T-07.2 approve **from Today** through the gate footer (Today's *Approve* →
  panel with the reason focused, `gateFocus`; *Approve → approved*); `useElementWrite` invalidates
  `['p', pid]` on settle, so the bell (an observer of the Today key) refetches with no code of its
  own. A click that does not focus a button must behave as a focused one (lesson of Wave 3).

#### AC classification

| AC | kind | first test |
|----|------|------------|
| S-21.1 bell count and panel (*To unblock* = Requires you rows; *Updates* = last 10 events, newest first) | **red-first** | `test/web/shell/notification-bell.test.tsx` (no bell today); e2e `notification-bell.spec.ts` |
| S-21.2 no count; "Nothing to unblock" | **red-first** | component, e2e (Casey) |
| S-21.3 count after an action | **red-first** for the bell; the refetch path is task-037's `useElementWrite` (characterization of the plumbing) | component (invalidate `['p', pid]` → new count), e2e (approve from Today) |
| S-23.1 one line per role, items, `developer · 0` (+ TT-PERF-09's S-23.1) | **red-first** | `test/web/today/summary.test.tsx`, e2e (Alex) |
| S-23.2 switch role view from the summary | **red-first** | component (`PUT` role view with the line's role; focus), e2e |
| S-23.3 no summary for a single-role member | server part **characterization** (task-031 `today.test.ts`); web part red-first trivially (absent → nothing) | component, e2e (Jordan) |
| S-23.4 ≤ 3 items and "N more" (TT-PERF-11) | server part characterization (task-031); rendering **red-first** | component, e2e (5 `pending` elements on a copy) |
| T-07.1, T-07.2 | **characterization** (task-036 D36-4 built the empty state; task-037 the approval) | e2e only (closure) |
| `SCREENS` / X-06.4 / X-09.1 | **red-first** | appended screen (D42-8); the existing *today* screen (Morgan, two roles) now carries the summary |
| REQ-INT-08 | check | own spec on the three engines (W0-9) |

#### File layout

- `web/src/shell/NotificationBell.tsx` (new) + `web/src/shell/notification-bell.css` (new, spec-009
  tokens only) — the bell button and its panel (React Aria `DialogTrigger` + `Popover` + `Dialog`,
  the project switcher's pattern: Escape closes, focus back to the trigger, the library "Dismiss"
  already accepted by X-09.1). Props `{ pid, header: ProjectHeader }`; its Today query is
  `todayQuery(pid, header.roleView ?? null)` (the same entry as Today); *Updates* per D42-2.
- `web/src/shell/notifications.ts` (new, pure) — `updateLine(event)` → `{ sha, id, operation, name,
  from, to, timestamp }` (`memberName` of `element/model.ts` for `author`), `bellCount(today)` →
  `number | undefined` (length of `requiresYou`; `undefined` when `null`).
- `web/src/shell/icons.tsx` — a `Bell` icon appended (`aria-hidden`).
- `web/src/project/ProjectHeader.tsx` — `ProjectRoleView` renders `<NotificationBell pid header>`
  inside its `HeaderEnd`, between the role view selector and the current user (ux-reference §2
  order "role view · notifications · user"); keyed by pid with the rest of `ProjectRoleView`.
- `web/src/today/RoleSummary.tsx` (new) — the all-roles summary card (D42-5 … D42-7), its own
  `useSetRoleView()` instance (refusal shown in the card), CSS in `web/src/today/today.css`
  (task-036's file, appended rules).
- `web/src/today/TodayView.tsx` — renders `<RoleSummary>` when `data.summary` is present; the
  Requires you heading gets `tabIndex={-1}` and a ref (focus target of D42-6).
- `web/src/api/queries.ts` — **append** `memoryEventsQuery(pid, limit)` (D31-6 key).
- No server, contracts, route, `nav.ts`, `tree.ts`, `page-title.ts`, `base.css`, `app.ts` change;
  no new event-stream event.

#### Catalogue (new keys, inserted sorted; RP-43; texts follow the decisions)

`shell.bell.label` "{count, plural, =0 {Notifications} one {Notifications, # to unblock} other
{Notifications, # to unblock}}"; `shell.bell.title` "Notifications"; `shell.bell.openToday` "Open
Today"; `shell.bell.toUnblock` "To unblock"; `shell.bell.toUnblock.empty` "Nothing to unblock";
`shell.bell.toUnblock.unidentified` (points to the read-only notice); `shell.bell.updates`
"Updates"; `shell.bell.updates.empty` "No Memory event yet"; `shell.bell.updates.loading`,
`shell.bell.loading`; `shell.bell.ago` "{age} ago" (the age through `today.age`, its own element);
the update line reuses `element.history.entry` and `element.history.transition`; the action verb
reuses `today.action`. `today.summary.title` "Your roles"; `today.summary.line` "{role} · {count}";
`today.summary.lineLabel` (accessible name "Switch to the {role} view, {count} …");
`today.summary.current` (marks the current view); `today.summary.more` "{more} more";
`today.summary.none` (a role with 0 items, optional — D42-5).

#### Test plan

- Vitest (jsdom):
  - `test/web/shell/notifications.test.ts` (pure): `updateLine` for every operation (add without
    transition, submit/approve/reject with `from → to`, a `null` approver/reason), `bellCount`.
  - `test/web/shell/notification-bell.test.tsx`: no bell outside a project; count badge and
    accessible name for 2, no count for `[]`, `null` (unidentified), loading, a refusal (and no
    `role="alert"` outside the panel); on Today one `GET …/today` only (shared key); Enter opens the
    panel, Escape closes it and the focus returns to the bell; *To unblock* rows in the API order,
    links to `/p/$pid/e/$eid` with `gateFocus` for approve/review; "Nothing to unblock"; the
    unidentified sentence; *Updates*: no `events/memory` request before the panel opens (D42-2),
    then `?limit=10`, rows in the received order, empty text, refusal alert inside the panel;
    `invalidateQueries(['p', pid])` → the new count (S-21.3); another project → no stale count.
  - `test/web/today/summary.test.tsx`: absent summary → no card; lines in the received order with
    `approver · 2`, ≤ 3 item links, "2 more"; the current view's line; pressing a line or "N more"
    sends `PUT` role view with that role; focus to the Requires you heading once the new view is
    read; a refusal → alert in the card.
  - `test/web/api/queries.test.ts` (appended): `memoryEventsQuery` key and path.
- Playwright `test/e2e/notification-bell.spec.ts` (`prebuild: ['kanban']`), one test per scenario,
  each on its own copy where it writes:

  | Scenario | spec file › test |
  |----------|------------------|
  | S-21.1 (TT-PERF-11) | `notification-bell.spec.ts` › "S-21.1 — Count the items to unblock" (Morgan, view approver: bell name with 2; keyboard: Tab to the bell, Enter, the panel; *To unblock* ids; *Updates* = 10 rows in the order of `GET …/events/memory?limit=10` read with the page's session; Escape returns focus; `scanThemes` on the open panel) |
  | S-21.2 | › "S-21.2 — Show no count when nothing requires me" (Casey) |
  | S-21.3 | › "S-21.3 — Update the count after an action" (Morgan approves `task-001-login-form` from Today; bell 1) |
  | S-23.1 (TT-PERF-09) | › "S-23.1 — Summarise what requires each of my roles" (Alex: 7 lines, `approver · 2` with both ids, `developer · 0`; `scanThemes`) |
  | S-23.2 | › "S-23.2 — Switch role view from the summary" (Alex, view developer → `approver · 2` → selector and Requires you) |
  | S-23.3 | › "S-23.3 — Show no summary to a single-role member" (Jordan) |
  | S-23.4 (TT-PERF-11) | › "S-23.4 — Show at most 3 items per role" (copy: `task-002`, `task-004` submitted and one task added and submitted with the CLI before the console starts → `approver · 5`, 3 items, "2 more") |
  | T-07.1 | › "T-07.1 — Say that nothing requires me" (Casey) |
  | T-07.2 | › "T-07.2 — Reach the empty state after the last action" (`bug-001-crash-on-save` approved with the CLI first; approve `task-001-login-form` from Today; the card and the bell) |
  | X-06.4 / X-09.1 | `accessibility.spec.ts` › "…: notification panel" (D42-8) and the existing "…: today" (Morgan holds two roles: the summary is in it) |

- Risks to watch in the first full Chromium run: the bell adds a header button between the role
  view selector and the user (keyboard walks: X-06.1, project-header specs) and a `GET …/today`
  on every project view (web tests answer unknown paths with 404: the bell must stay silent).
- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own
  specs (`notification-bell.spec.ts`, `accessibility.spec.ts`, `today.spec.ts`,
  `project-header.spec.ts`, `no-commit.spec.ts`) on the three engines, `check_tasks.py v0.2`;
  `test:timing` only at load < 12 (no timed scenario of its own).

#### Spec / UX gaps

- ux-reference §4.1 has no all-roles summary (S5 is only in `06_features.md`: "in Today, per role
  held: count and top items"); §3 *Notifications* has a channel footer that v0.2 does not ship
  (task Implementation Notes). Both recorded in ux-reference 1.4 after the decisions.
- TT-PERF-11 says "with a link to the rest": the bell's *Updates* have no Timeline before v0.3,
  so no link (D42-3); the summary's "N more" is D42-7.
- The prototype limits *To unblock* to 6 rows; spec-003 §5 says "the same rows" (D42-3).

#### Docs with the behaviour

`docs/user-guide.md` (bell, summary; version bump), ux-reference 1.4 (§3, §4.1), `CHANGELOG.md`
*Unreleased* › Added, `test/README.md` (version line + the new spec line).

#### Open decisions — see the report to the coordinator (D42-1 … D42-8); nothing depending on them
is built before the answer.

#### Decisions (approver, 2026-10-15, plan W4-2)

"All as recommended": **D42-1 (a)** the bell at the right end of the global header (inside
`ProjectRoleView`'s `HeaderEnd`, between the role view selector and the current user), inside a
project, for every identity; **D42-2 (a)** *Updates* read only while the panel is open;
**D42-3 (a)** the panel lists **all** `requiresYou` rows (spec-003 §5), *Updates* the last 10
events, no "more" link and no channel footer; **D42-4 (a)** a badge only for a count > 0, the count
in the button's accessible name, no live region of its own; **D42-5 (a)** a "Your roles" card
between the greeting and Requires you; **D42-6 (a)** switching with the card's own
`useSetRoleView()`, focus to the Requires you heading once the new view is read; **D42-7 (a)**
"N more" switches to that role view; **D42-8 (a)** one appended screen, *notification panel*.
The ux-reference gaps go into ux-reference 1.4. Shared files (coordinator C1–C5): task-034 merges
first; `test/README.md` 0.36, `docs/user-guide.md` 0.11, ux-reference 1.4; this task alone touches
`web/src/api/queries.ts` (`memoryEventsQuery` as proposed) and `ProjectHeader.tsx`; `en.json` and
`CHANGELOG.md` *Unreleased*: only this task's entries, in sorted place. After task-034 every
real-bin console auto-fetches every 60 s: assertions stay on what the user sees.
