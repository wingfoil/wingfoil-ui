---
id: task-036-today-requires-you-and-waiting-on-others
type: task
title: "Today requires you and waiting on others"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-T-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit", "task-031-today-api-and-memory-updates-feed", "task-035-how-to-join-panel"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Today (T1, T4): the greeting with the count and role view, *Requires you* (type, title, reason or
rejection, state pill, age, one primary action) and *Waiting on others* (who must act, with the
basis of a member actor and "Waiting for the workflow engine" for engine-waiting states). A newly
added project opens on Today, which becomes the project's landing route (v0.1 redirects `/p/:pid`
to the Memory list). The *Approve*/*Review*/*Submit* buttons open the element panel; the gate
footer behind them is task-037-gate-footer-with-every-outcome. The progress card, *Next workflow step* and *Recent activity* of
`ux-reference.md` §4.1 are not in v0.2.

**Backlog items:** US-T-01, US-T-02, US-T-03, US-T-04, US-T-05, US-T-06, US-T-11, TT-PERF-01, TT-PERF-09

- US-T-01 — As Alex, I want a newly added project to open on Today for my role view, so that I start from what requires me
- US-T-02 — As Morgan, I want Requires you to list the items whose next move needs a role of my view — type, title, reason, age, one primary action each — so that I prioritise without navigating
- US-T-03 — As Jordan, I want my work rejected back listed first in Requires you, with the rejection reason, so that I fix it before starting anything new
- US-T-04 — As Sam, I want the reviewer view of Requires you to list the items in a review state, so that my review queue is one list
- US-T-05 — As a member, I want an element in a state the UI has no convention for listed as "Action required" with its own state name, so that projects with custom states still show what is pending
- US-T-06 — As Sam, without the `approver` role on WingFoil 0.2.2, I want a gate shown as informational ("reserved to approver", with who can act) instead of an action of mine, so that Today never promises what the CLI will refuse
- US-T-11 — As Morgan, I want Waiting on others to list the items blocked on another role, with the role and the members who hold it, so that I follow up with the right person

## Acceptance Criteria

- **US-T-01** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-01.1 Open a newly added project on Today; T-01.2 Open on Today read-only for a user who is not in the team
- **US-T-02** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-02.1 List the items requiring the approver; T-02.2 Show one primary action per row; T-02.3 Follow the role view
- **US-T-03** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-03.1 List my rejected work first, with the reason; T-03.2 Drop the rejection once the work is submitted again
- **US-T-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-04.1 List the items in a review state for a reviewer holding approver; T-04.2 Drop an item that leaves the review state
- **US-T-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-05.1 List an undeclared state as "Action required"; T-05.2 Derive the actions of a declared but unfamiliar gate
- **US-T-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-06.1 Show a gate as informational to a reviewer without approver; T-06.2 Show the same gate as informational to a product owner without approver
- **US-T-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/waiting-on-others.feature`: T-11.1 List the items blocked on another member; T-11.2 Name the workflow engine for an engine-waiting state; T-11.3 Do not repeat an item that requires me
- **TT-PERF-01** (REQ-PERF-01 — Today first render): [numeric] Navigation to Today → cards rendered: p95 ≤ 2.0 s with a warm cache; ≤ 5.0 s for the first open after the server starts. *Verified by:* e2e performance run.
  Scenarios (`@v0.2`): T-01.1, T-02.1.
  Timed: 1 warm-up + 20 runs on the large fixture in `test:timing` (Chromium only, RP-44), warm cache and first open after the start; plus the "after one commit" run of RP-9 (one commit between runs, p95 printed with the load) — if its p95 exceeds ~1 s, spec-002 §4 (incremental parse, v0.3) is reopened with the approver. `test:e2e`: 2 runs, no budget (`support/perf.ts`).
- **TT-PERF-09** (REQ-PERF-09 — Zero navigation to what requires me): [percentage] On each fixture and role view, 100 % of the items the action descriptor assigns to the view's roles are listed on Today, reached with 0 navigation steps after opening the project. *Verified by:* e2e.
  Scenarios (`@v0.2`): T-01.1, T-02.1, S-23.1.
  Here: on kanban, custom and unknown, for every role view of each member, the Today rows equal the `requiresYou` of the API (no navigation after opening the project). S-23.1 closes in task-042-notification-bell-all-roles-summary-and-empty-today.

RP-13: hand-transition states (e.g. `task` `backlog`, `plan` `active` in this repository) appear
in Waiting on others as "Waiting for the workflow engine"; Today offers no action for them.

Screen: `docs/00_reference/ux-reference.md` §4.1 (greeting, *Requires you*, *Waiting on others*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §5 (placement, Today output, button labels per `action`), §7 (tone), §8 (`actor.basis`);
  `spec-004` §3 (`today?view=`), §6 (`repo` → refetch; T-03.2 and T-04.2 within 5 s).
- Moving the landing route touches `web/src/routes/project.tsx` and the v0.1 e2e specs that assume
  the Memory list on `/p/:pid` (e.g. `no-commit.spec.ts`, `SCREENS`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-14)

Read: this task; `CLAUDE.md`; the Execution Notes of `depends_on` task-027 (D27-1…D27-4, W0-9),
task-031 (D31-1…D31-6, hand-over), task-035 (D35-1…D35-10, reviews); `release-planning-rel-v0.2-plan`
RP-9, RP-13, RP-27, RP-43, RP-44, RP-53, RP-55; `dev-loop-rel-v0.2-plan` sessions 1–2 (W0-1…W0-10,
W1-1…W1-4, hand-overs to Wave 2); spec-003 §2–§8 (with the 2026-10-12/13 Process Notes), spec-004
§3/§6, spec-008 §6 (X-09.1); `requires-you.feature`, `waiting-on-others.feature`; the descriptions of
task-037, task-038, task-042 (neighbours: gate footer, submit footer/toasts, empty state and bell);
ux-reference 1.1 §2, §3, §4.1, §5 (2-click gates); the prototype's Today (greeting, *Richiede te*,
*In attesa di altri*); code: `web/src/routes/{project,tree,nav,memory,element}.tsx|ts`,
`web/src/api/{queries,query-keys,projects}.ts`, `web/src/project/{ProjectHeader,HowToJoin,model}.tsx|ts`,
`web/src/memory/{MemoryList.tsx,model.ts}` (`ageOf`), `web/src/shell/{page-title,switch-target}.ts`,
`contracts/src/{today,descriptor,api}.ts`, `server/src/http/project-routes.ts` (Today handler);
tests: `test/e2e/support/{screens,strings,events,identity,perf,console}.ts`,
`test/e2e/{performance,add-project,memory-list,projects,documentation,no-commit}.spec.ts`,
`test/web/memory/list.test.tsx`; `lint/methodology-literals.js` (the action names `submit`,
`rework`, `review`, `approve`, `resolve` are not fixture names).

**depends_on (dl-015 hard gate).**
- task-027 / W0-9: the inner loop runs `npm run test:e2e:chromium` plus this task's own spec files
  on the three engines (`npm run test:e2e -- today.spec.ts …`); no engine branch in a spec; every
  first read waited for with `COLD_READ_MS`; lists that a second query fills asserted with retrying
  expects (bug-009); `@perf` on Chromium only (D27-2).
- task-031: `GET /api/p/:pid/today?view=` answers `Today` (`contracts/src/today.ts`); `view` is
  the header's `roleView`, omitted when `null`, so Today and the bell (task-042) share one cache
  entry `queryKeys.project(pid, 'today', { view })` (D31-6); no partial Today (D31-3): a refusal is
  shown as an error, **never** as an empty Requires you; Waiting on others comes in the Requires-you
  order (D31-4) and is rendered in the order received; an unidentified user gets `requiresYou:
  null` and a Waiting on others list (RP-27), and must not send `?view=` (D31-5: 400); a member
  holding no role gets `view: null` and their own rows; `memory search` warnings are not part of
  Today; `actor.basis` gives "Jordan (submitter) must act".
- task-035: the *How to join* panel is opened with `useHowToJoin().show()` (the provider is already
  in the project layout); it applies only to *not in team* with a readable DNA (D35-8); X-09.1
  rules of `test/e2e/support/strings.ts` (a list of names must be its own text node to pass as data,
  as the `formatList` lesson of D35-6 showed).

#### AC classification

| AC | kind | first test |
|----|------|------------|
| US-T-01 T-01.1, T-01.2 (landing on Today; not-in-team Today with *How to join*) | **red-first** | `test/web/today/today.test.tsx` (the app at `/p/<pid>` lands on Today; greeting; a not-in-team header → no Requires you card, the sentence and the *How to join* button calling the provider) and e2e `today.spec.ts` › T-01.1, T-01.2 — fail today (`/p/<pid>` redirects to the Memory list, no Today) |
| US-T-02 T-02.1…T-02.3 | **red-first** | `today-model.test.ts` (row texts per action/kind), `today.test.tsx` (one action button per row, the role view in the key), e2e |
| US-T-03 T-03.1, T-03.2 (rejection first; drop after a CLI submit) | **red-first** | component (rejection row rendering; order as received), e2e (T-03.2 `@live-refresh`) |
| US-T-04 T-04.1, T-04.2 | **red-first** | e2e on a custom copy where Sam holds `reviewer, approver` (`dna update` before the console starts); T-04.2 `@live-refresh` |
| US-T-05 T-05.1, T-05.2 | **red-first** | model (the *Action required* text, `resolve` → "Open"), e2e on unknown |
| US-T-06 T-06.1, T-06.2 | **red-first** | model (role actor text), e2e on custom (Sam, Casey) |
| US-T-11 T-11.1…T-11.3 | **red-first** | model (member/basis, engine texts), e2e |
| TT-PERF-01 | **red-first** (no Today link to time) | `performance.spec.ts` appended `@perf` describe (D36-9) |
| TT-PERF-09 | **red-first** | e2e, one test per fixture (D36-10) |
| Landing route moved (Implementation Notes) | **red-first** for the new route; the v0.1 specs that assert the Memory list on `/p/<pid>` are updated (characterization of the old behaviour, rewritten) | `test/web/memory/list.test.tsx` redirect case moves to `today.test.tsx`; e2e `add-project.spec.ts`, `memory-list.spec.ts` M-01.1, `projects.spec.ts` |
| Role view change refreshes Today | **characterization** — `useSetRoleView` already re-reads the header; the new `roleView` changes the Today key | component test: select another view → one `GET …/today?view=<new>` |
| `SCREENS` / X-06.4 / X-09.1 | **red-first** | two appended screens (Today as Morgan on kanban; Today as Riley on the not-in-team copy) |
| REQ-INT-08 | check | own specs on the three engines (W0-9) |

#### Primary action — no dependency on task-032 (coordinator's question)

Today runs no write. Each Requires you row's one primary action (*Approve*, *Review*, *Submit*,
*Open*) opens the element panel `/p/$pid/e/$eid` (task description; ux-reference §5 "Approve in
Today opens the panel …; the second click commits"). The panel today is read-only; task-037 adds the
gate footer and the "opened from Today: focus the reason" signal, task-038 the submit footer and
toasts — both on top of task-032's routes. So this task imports nothing of task-032 and touches no
server code (D36-3).

#### File layout

- `web/src/today/model.ts` (pure, new) — `todayGreeting(header, today)` (name, count, view),
  `rowReason(row)` → a tagged reason (`rejection {by, reason}` | `undeclared {state, type}` |
  `age {state, age}` | `state {state}`), `waitingWho(row)` → (`member {name, basis?}` |
  `role {role, members, fallback}` | `engine` | `none`), `actionLabel(action)`; descriptor fields
  used as data only (`kind` read only for the `undeclared` reason text, spec-003 §8 rule kept: no
  re-derivation of placement, tone, bucket or actor). Age: `ageOf` of `web/src/memory/model.ts`
  (imported, not copied) → "for 3 days" with catalogue plurals per unit (X-09.1-safe: no
  `Intl.NumberFormat` unit words).
- `web/src/today/TodayView.tsx` (new) — `<h1>` greeting (D36-4, D36-5), the identity sentence for
  unidentified users (D36-8), the *Requires you* card (`<section aria-labelledby>`, `<ul>` of rows:
  type tag, title link to the panel, reason, state pill `tone-${tone}`, one action `Button`), the
  *Waiting on others* card (rows linking to the panel, who-must-act text; members in their own
  element), loading `role="status"`, refusal `role="alert"` with `ErrorText` (never the empty
  text), the update status region (D36-11).
- `web/src/today/today.css` (new) — tokens of spec-009 only; `tones.css` classes reused for pills.
- `web/src/routes/today.tsx` (new) — `todayRoute` (`path: 'today'`, `staticData.nav`, D36-2) and
  `projectIndexRoute` (moved here from `memory.tsx`, redirect target `/p/$pid/today`, D36-1);
  the query waits for the header (`enabled` once `roleView` is known; a header error is shown as
  Today's error); `useProjectTitle(pid, "Today")`.
- `web/src/api/queries.ts` — **append** `todayQuery(pid, view)` (key fixed by D31-6).
- `web/src/routes/tree.ts` — `todayRoute,` appended to `PROJECT_ROUTES`; the import of
  `projectIndexRoute` moves from `./memory.js` to `./today.js` (one import line changed, one added).
- `web/src/routes/memory.tsx` — `projectIndexRoute` removed, file comment updated (no longer the
  landing view).
- `web/src/routes/nav.ts`, `web/src/routes/project.tsx` (`ProjectNav`) — only for D36-2 (a).
- No server, contracts, `projects.ts`, `query-keys.ts`, `page-title.ts`, `base.css` change.

#### Catalogue (new keys, inserted sorted; RP-43)

`shell.nav.today` "Today"; `today.greeting` "{name}, {count, plural, =0 {nothing requires you} one
{# thing requires you} other {# things require you}}" (=0 branch per D36-4); `today.greeting.anonymous`
"Today"; `today.roleView` "Role view: {view}" (D36-5); `today.requiresYou.title` "Requires you";
`today.requiresYou.empty` "Nothing requires you" (D36-4); `today.action` "{action, select, submit
{Submit} rework {Submit} review {Review} approve {Approve} other {Open}}" and its accessible name
`today.action.label` "{label} {id}" (visible text first, WCAG 2.5.3); `today.reason.age` "{state}
for {age}" with `today.age.*` plurals (minute, hour, day, week, month, year); `today.reason.undeclared`
"Action required — state {state} is not declared for {type}"; rejection: the element panel's
`element.rejection.withReason` / `noReason` reused; `today.waiting.title` "Waiting on others";
`today.waiting.member` "{name} ({basis, select, submitter {submitter} creator {creator} other {last
transition}}) must act", `today.waiting.memberNoBasis` "{name} must act", `today.waiting.role`
"Reserved to {role} — {members}" / `today.waiting.roleNoMember` "Reserved to {role}",
`today.waiting.engine` "Waiting for the workflow engine"; `today.notInTeam` "You are not in this
project's team —" + the existing `shell.howToJoin.open` "How to join"; `today.unidentified`
(D36-8); `today.loading` "Reading Today…"; `today.updates.label` (D36-11). Final texts follow the
decisions.

#### Test plan

- Vitest (jsdom), `test/web/today/`: `today-model.test.ts` (every reason and who-must-act
  variant, the age units, greeting count, a roleless member, unidentified identities);
  `today.test.tsx` (app at `/p/<pid>` → Today and the nav entry current; greeting and role view
  line; rows in the API order; one action button per row and its accessible name; Enter on an
  action opens `/p/$pid/e/$eid`; refusal → alert, not the empty text; header error; loading status;
  not-in-team → sentence, no Requires you card, *How to join* opens the provider's dialog;
  no-identity/ambiguous; role view change → `?view=<new>` read; a `repo` event refetches; the key
  equals `queryKeys.project(pid, 'today', { view })` and no `?view=` without a role view).
- Playwright `test/e2e/today.spec.ts` (`prebuild: ['kanban', 'custom', 'unknown']`), one test per
  scenario, axe `scanThemes` on Today in T-01.1, T-01.2, T-02.1, T-11.2, keyboard path in T-02.2
  (Tab to an action, visible focus, Enter opens the panel):

  | Scenario | spec file › test |
  |----------|------------------|
  | T-01.1 | `today.spec.ts` › "T-01.1 — Open a newly added project on Today" (Morgan adds the kanban folder through *Add project*; URL `/p/<pid>/today`; greeting and "approver") |
  | T-01.2 | › "T-01.2 — Open on Today read-only for a user who is not in the team" (Riley; no Requires you card; the sentence; *How to join* opens the panel) |
  | T-02.1 | › "T-02.1 — List the items requiring the approver" |
  | T-02.2 | › "T-02.2 — Show one primary action per row" |
  | T-02.3 | › "T-02.3 — Follow the role view" (Alex, selector → product-owner) |
  | T-03.1 | › "T-03.1 — List my rejected work first, with the reason" (Jordan) |
  | T-03.2 | › "T-03.2 — Drop the rejection once the work is submitted again" `@live-refresh` (`cli(… memory submit …)`) |
  | T-04.1 | › "T-04.1 — List the items in a review state for a reviewer holding approver" (custom; `dna update` Sam) |
  | T-04.2 | › "T-04.2 — Drop an item that leaves the review state" `@live-refresh` (`cli(… memory approve …)`) |
  | T-05.1 | › "T-05.1 — List an undeclared state as "Action required"" (unknown; selector → tech-lead) |
  | T-05.2 | › "T-05.2 — Derive the actions of a declared but unfamiliar gate" |
  | T-06.1 | › "T-06.1 — Show a gate as informational to a reviewer without approver" (custom; Sam) |
  | T-06.2 | › "T-06.2 — Show the same gate as informational to a product owner without approver" (custom; Casey) |
  | T-11.1 | › "T-11.1 — List the items blocked on another member" |
  | T-11.2 | › "T-11.2 — Name the workflow engine for an engine-waiting state" (custom) |
  | T-11.3 | › "T-11.3 — Do not repeat an item that requires me" |
  | TT-PERF-09 | › "TT-PERF-09 — every role view lists the API's Requires you (kanban / custom / unknown)" (D36-10) |
  | TT-PERF-01 | `performance.spec.ts` › Today `@perf` describe (D36-9) |
  | X-06.4 / X-09.1 | `accessibility.spec.ts` over `SCREENS` › "today", "today — not in team" |

  Updated v0.1/v0.2 specs: `add-project.spec.ts` (the added project opens on Today),
  `memory-list.spec.ts` M-01.1 (opens `/p/<pid>/memory`; the landing is Today's), `projects.spec.ts`
  (switching from the start page lands on Today); `no-commit.spec.ts` covers the new screens through
  `SCREENS`. T-07.x, S-21.x, S-23.x close in task-042.
- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own
  specs (`today.spec.ts`, `accessibility.spec.ts`, the updated specs) on the three engines,
  `check_tasks.py v0.2`, `test:timing` only at load < 12 (`performance.spec.ts` Today + the two
  `@live-refresh` scenarios).

#### Docs with the behaviour

`docs/user-guide.md` (Today, version bump), ux-reference (version bump, only for the deviations the
decisions record: §2/§4.1), `CHANGELOG.md` *Unreleased* › Added and › Changed (landing view),
`test/README.md` 0.31 (version line, layout lines).

#### Open decisions (STOP: nothing depending on them is built before the answer)

- **D36-1 — landing route.** ★ (a) a view route `/p/$pid/today`; `/p/$pid` redirects there (the
  v0.1 mechanism, new target; `projectIndexRoute` moves to `routes/today.tsx`) — the sidebar link
  is current on Today only, the project switcher keeps Today as "the same view" (`switchTarget`
  unchanged); (b) Today rendered at `/p/$pid` itself (no segment; the nav link needs exact matching,
  every child path would also match its prefix); (c) both, `/p/$pid` renders Today and `/today` is
  an alias (two URLs for one view).
- **D36-2 — Today in the sidebar** (ux-reference §2: *Today* above the three groups, no heading).
  ★ (a) a first, heading-less nav group: `NavGroupId` gains `start`, `NAV_GROUPS` gets a first entry
  without label, `NAV_ORDER.today`; `ProjectNav` renders a group heading only when it has a label
  (the list then labelled by the navigation) — Today declares its entry in `staticData.nav` like
  every view; (b) Today as the first item of *Work* (`order` 0; no shell change, a deviation from
  §2 to record); (c) a fixed Today link written in `ProjectNav` above the groups (no `staticData`;
  edits the shell layout markup).
- **D36-3 — the primary action.** ★ (a) a React Aria `Button` (one per row; visible label by
  `action`, accessible name "Approve task-001-login-form") whose press opens the element panel
  `/p/$pid/e/$eid`; the title is also a link to the panel (as the prototype and the Memory list);
  nothing of task-032; task-037 adds the "opened from Today" signal and the footer; (b) as (a), and
  this task already passes the action to the panel (history state `{ from: 'today', action }`) for
  task-037 to read — data unused until then; (c) the action as a link styled as a button (role
  `link`: T-02.2's "1 action button" asserted as a link; middle-click opens a tab).
- **D36-4 — an empty Requires you** (T-07.1/T-07.2 and their e2e closure are task-042's; T-02.3
  needs "no row"). ★ (a) build the empty state now — the greeting's `=0` branch "{name}, nothing
  requires you" and the card's "Nothing requires you" — so the card is never blank and a refusal is
  visibly different from it; task-042 keeps the T-07 scenarios, the bell and the summary;
  (b) an interim: no rows and "{name}, 0 things require you" until task-042 (its keys then change);
  (c) the card hidden when empty (task-042 brings it back).
- **D36-5 — the greeting's second line** (ux-reference §4.1 "project · view · roles"; T-01.1 "the
  greeting shows the role view"). ★ (a) "Role view: approver" (the view as data; shown whenever
  there is a view, also for a single-role member); the project name is in the switcher and the
  roles in the header's selector; (b) "project · view · roles" with the roles as chips (X-09.1-safe,
  more to read); (c) no line: the view only in the header selector (T-01.1 then asserts the
  selector, not the greeting).
- **D36-6 — who must act in Waiting on others.** ★ (a) member: "Jordan (submitter) must act" /
  "(creator)" / "(last transition)"; a member actor without `basis`: "Jordan must act"; a role actor
  (gate, undeclared, the `tech-lead` fallback): "Reserved to <role> — <members>" (members in their
  own element; "Reserved to <role>" when nobody holds it); engine: "Waiting for the workflow
  engine"; (b) as (a), but a non-gate role actor reads "<role> must act — <members>" and the
  fallback adds "Author not in the team"; (c) only the role or member name (no basis, no members).
- **D36-7 — reason text and age.** ★ (a) `rework` → the panel's "Rejected by Morgan: Missing
  acceptance criteria" in the attention tone; `resolve` (undeclared) → "Action required — state
  on-hold is not declared for note"; otherwise "<state> for <age>" with the age of
  `descriptor.since` in its largest whole unit (`ageOf`, as the Memory list), "<state>" when no
  event is known; (b) the age as the Memory list's relative "3 days ago"; (c) state only, no age
  (against T-02.1).
- **D36-8 — Today for a user who is not identified** (`requiresYou: null`). ★ (a) *not in team*
  (readable DNA): the sentence "You are not in this project's team — How to join" with the *How to
  join* button (`useHowToJoin().show()`), no Requires you card; *No identity* / *Ambiguous*: a
  sentence pointing to the read-only notice above the view, no button (D35-8); Waiting on others
  shown to all of them (RP-27); the `<h1>` is "Today" (no name); (b) the not-in-team sentence for
  every unidentified identity, the button only for *not in team*; (c) Waiting on others hidden for
  them too.
- **D36-9 — TT-PERF-01 measurement.** ★ (a) a Today `@perf` describe appended to
  `performance.spec.ts` (reuses its per-worker large fixture); `perf.ts` gains a budget parameter;
  runs start on another view and press Enter on the *Today* nav link; the warm-up run is the "first
  open after the server starts" (one sample, ≤ 5.0 s asserted under `test:timing` only), then 20
  warm runs (p95 ≤ 2.0 s), then the RP-9 "after one commit" runs (one empty commit before each,
  p95 printed with the load, not asserted; > ~1 s reported to reopen spec-002 §4); `test:e2e`: 2
  runs, no budget; (b) a new `today-performance.spec.ts` with the large fixture moved to
  `test/e2e/support/` (a shared refactor; two builds per worker when both files share one);
  (c) the "first open after the start" over 20 console restarts (20 large-fixture cold reads,
  minutes per timing run).
- **D36-10 — TT-PERF-09 coverage.** ★ (a) one e2e test per fixture (kanban, custom, unknown): one
  console holding five copies (one per member, `actAs`), each opened at `/p/<pid>` (0 navigation:
  the landing is Today), then every role view through the selector; the rows on screen (ids, in
  order) equal `requiresYou` of `GET …/today?view=` read with the page's session; (b) only the
  members and views of the named scenarios; (c) a Vitest component test over the captured samples
  (no "0 navigation" proof).
- **D36-11 — repository changes while Today is open.** ★ (a) a polite status region (as the
  Memory list's "Memory list updates") announces the new count — "Requires you updated: 1 item" —
  when a refetch changes the rows, not on the first read; (b) no announcement in this task
  (task-038 owns announcements of actions; T-03.2/T-04.2 are changes made outside the UI).

#### Shared files (Wave 2, parallel with task-032)

| File | Change | Rule |
|------|--------|------|
| `web/src/i18n/en.json` | ~25 new `today.*` keys + `shell.nav.today`, sorted in place; no existing key changed | append-only |
| `web/src/api/queries.ts` | `todayQuery(pid, view)` appended (**new shared function**, key fixed by D31-6; consumed by task-042) | append-only |
| `web/src/routes/tree.ts` (`PROJECT_ROUTES`) | `todayRoute,` appended; `projectIndexRoute` import moved to `./today.js` | append + one import line |
| `web/src/routes/nav.ts` | D36-2 (a): `NavGroupId` `start`, first `NAV_GROUPS` entry (label optional), `NAV_ORDER.today` (**new shared names**) | local edit |
| `web/src/routes/project.tsx` (shell layout, RP-55) | D36-2 (a): group heading rendered only when the group has a label (≈3 lines in `ProjectNav`) | minimal edit |
| `web/src/routes/memory.tsx` | `projectIndexRoute` moved out | local edit |
| `test/e2e/support/screens.ts` (`SCREENS`) | two screens appended | append-only |
| `test/e2e/support/perf.ts`, `test/e2e/performance.spec.ts` | D36-9 (a): budget parameter; Today describe appended | append-only |
| `test/e2e/add-project.spec.ts`, `memory-list.spec.ts`, `projects.spec.ts`; `test/web/memory/list.test.tsx` | landing assertions (D36-1) | local edits |
| `test/README.md` | version line 0.31 + layout lines | append-only |
| `CHANGELOG.md` | *Unreleased* › Added (Today) and › Changed (landing view) | append-only |
| `docs/user-guide.md`, `docs/00_reference/ux-reference.md` | Today section; recorded deviations | version bump |

Not touched: server, contracts, `api/projects.ts`, `api/query-keys.ts`, `shell/page-title.ts`,
`theme/base.css`, `test/launcher/local-security.test.ts`, `test/e2e/support/strings.ts` (the members
list rendered in its own element passes the existing `, `-split data rule).
