---
id: task-037-gate-footer-with-every-outcome
type: task
title: "Gate footer with every outcome"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-G-04"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-032-governed-writes-submit-approve-and-reject", "task-035-how-to-join-panel", "task-036-today-requires-you-and-waiting-on-others"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The gate footer of the element panel (G2): reason field focused when opened from Today, every
outcome side by side (approve and each reject target, also for unknown types), the reason required
for approve too with an editable default, outcomes disabled while the reason is empty, and the
informational footer ("Reserved to approver — <members> can act") for a member without
`approver`; no footer on a terminal state and a "Waiting for the workflow engine" note on an
engine-waiting state. Two clicks from Today to the `wf(…)` commit.

**Backlog items:** US-G-04, US-G-05, US-G-06, US-G-07, US-G-09, US-S-24, TT-SEC-07, TT-PERF-10

- US-G-04 — As Morgan, I want Approve on a Today item to open the element panel with the gate footer and the reason field focused, so that a gate takes at most two clicks from Today
- US-G-05 — As Morgan, I want every outcome of the gate side by side — approve and each reject target — so that I choose the outcome, not a verb
- US-G-06 — As Morgan, I want the reason required for approve too, pre-filled with an editable default, so that the CLI (which requires `--reason`) never refuses my approval
- US-G-07 — As Morgan, I want the outcome buttons disabled while the reason is empty, so that no CLI call is made that would be refused
- US-G-09 — As Sam, without `approver` on WingFoil 0.2.2, I want the gate footer to be informational — "reserved to approver" and the members who can act — so that I know whom to ask
- US-S-24 — As a member, I want no action footer on an element in a terminal state, and a "waiting for the workflow engine" note on one in an engine-waiting state, so that I am never offered an impossible move

## Acceptance Criteria

- **US-G-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-04.1 Approve a gate in two clicks from Today; G-04.3 Open the gate footer with the reason focused; G-04.2 Cancel without running the CLI
- **US-G-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-05.1 Show approve and the reject target of a bug gate; G-05.2 Reject to the gate's target; G-05.3 Derive the outcomes of an unknown type's gate
- **US-G-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-06.1 Pre-fill the reason for approve; G-06.2 Use the reason I typed; G-06.3 Clear an untouched default when a reject is chosen; G-06.4 Keep a reason I typed when a reject is chosen
- **US-G-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-07.1 Disable the outcomes while the reason is empty; G-07.2 Treat a reason of only spaces as empty
- **US-G-09** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-09.1 Show an informational footer to a reviewer without approver; G-09.2 Show the outcomes to the same reviewer once they hold approver; G-09.3 Show an informational footer to a product owner without approver
- **US-S-24** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/action-descriptor.feature`: S-24.1 Offer no action on a terminal state; S-24.2 Show an engine-waiting state as waiting; S-24.3 Treat a declared waiting state of an unknown type the same way; S-24.4 Offer only the reject of a state that is both a gate and a waiting state
- **TT-SEC-07** (REQ-SEC-07 — Gate authority stays with WingFoil): [boolean] On the fixtures with Sam and Casey with and without `approver`, the outcomes are offered if and only if the member holds `approver`; `ui.yaml` and the server configuration contain 0 permission rules. *Verified by:* e2e.
  Scenarios (`@v0.2`): T-06.1, T-06.2, G-09.1, G-09.2, G-09.3, S-11.1.
  S-11.1 runs in task-039-repository-status-and-fetch-in-the-sidebar (US-S-11) on the footer built here; the "0 permission rules" part: no role rule in the server configuration or code (dl-002); `ui.yaml` is read only from v0.3.
- **TT-PERF-10** (REQ-PERF-10 — Two clicks per gate): [numeric] ≤ 2 clicks from Today to the `wf(…)` commit with the pre-filled reason. *Verified by:* e2e click count.
  Scenarios (`@v0.2`): G-04.1, G-04.3, X-06.2.
  Click count asserted in G-04.1; X-06.2 decides a gate with the keyboard only.

Also closes S-13.2 and S-15.2 (TT-SEC-08, task-033-git-copy-state-repository-status-and-transport-routes): no governed action offered to a user not in
the team or under an ambiguous identity. RP-13: a hand-transition state shows the waiting note,
never an action.

Screen: `docs/00_reference/ux-reference.md` §4.2 (*Gate footer*, *Single-action footer*), §5 (2-click gates, all gate options visible) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §3 (verbs per kind), §6 (enablement, reason codes rendered from the catalogue), §8;
  `spec-004` §3 (`approve`/`reject` with `expectedStatus` and `reason`), §5.
- The result toast is task-038-submit-footer-action-toasts-and-blocked-actions: here the panel shows the new state after the write (refetch on
  `write`/`repo`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-15)

Read: this task; `CLAUDE.md`; the Execution Notes of `depends_on` task-032 (D32-1 … D32-10, W2-1,
W2-4, W2-5, reviews, hand-overs), task-035 (D35-1 … D35-10, reviews), task-036 (D36-1 … D36-11,
review F1, bug-011); `release-planning-rel-v0.2-plan` RP-11, RP-12, RP-13, RP-43, RP-47, RP-48,
RP-55 and the session-3 note on S-11.1; `dev-loop-rel-v0.2-plan` sessions 1–3 (W0-9, W1-3, W2-0,
W2-1, W2-4, W2-5, hand-overs to Wave 3); task-033 and task-038 descriptions (parallel and next
neighbours); `gate-footer.feature`, `action-descriptor.feature` S-24.x, `identity.feature` S-13.2,
S-15.2, `accessibility.feature` X-06.2, `capabilities.feature` S-11.1, `blocked-actions.feature`,
`action-feedback.feature` G-14.2; spec-003 §2–§8, spec-004 §3–§5 (with the 2026-10-14 Process
Notes), spec-008 §2, §4, §6; `contracts/src/{descriptor,writes,api,events}.ts`,
`contracts/api/write.refusal.schema.json`; ux-reference 1.2 §4.2, §5, §7; the prototype's drawer
footer (gate label, 2-row reason, Cancel · rejects · approve); directives (`directives list`:
`accessibility`, `ux-consistency`, `cli-only-writes`, `documentation`, `doc-versioning`,
`claim-evidence`); code: `web/src/element/*`, `web/src/routes/element.tsx`, `web/src/today/TodayView.tsx`,
`web/src/api/{client,error-message,queries,query-keys,projects,events}.ts`, `web/src/shell/ErrorText.tsx`,
`web/src/project/HowToJoin.tsx`, `server/src/descriptor/descriptor.ts` (verbs carry `role`
whatever the user), `server/src/http/element-writes.ts`; tests: `test/e2e/support/*`,
`test/e2e/{element-panel,today,accessibility,no-commit}.spec.ts`, `test/web/element/panel.test.tsx`;
fixture conventions (`02_bdd/00_conventions.md`).

**depends_on (dl-015 hard gate).**
- task-032: the routes `POST /api/p/:pid/elements/:eid/{approve,reject}` take
  `{expectedStatus, reason}` (`ElementDecisionRequest`; reason ≥ 1 non-whitespace character, no
  NUL, ≤ 10 000 characters → else 400); 200 `WriteResponse {result, commits, push}`; refusals of
  `write.refusal.schema.json`: 403 `not-in-team`, 409 `local-changes` / `element-changed` (row 9,
  RP-12), 422 `cli-refused` verbatim (also a reason refused by the CLI's usage check, W-29/D32-5,
  and approve without `approver`, W-13), 500 `write-incomplete` `{file, commit?}` (W2-1, W2-4,
  W2-5, a fixed message, never the CLI's text), 502/504 CLI envelope; one `write` event and the
  snapshot already moved when the 200 arrives (so a refetch after it sees the new state). The role
  is not checked by the server (dl-002): the footer's "offered iff the member holds the role" is
  the only place the role shows (TT-SEC-07). Hand-over: G-04.1 closes here; G-11.x / X-07.3 in
  task-038; the catalogue text of `write-incomplete` was handed to task-038 — the Session 3 hand-over
  names both tasks (D37-11).
- task-035: How to join is opened with `useHowToJoin().show()` (provider in the project layout);
  it applies only to *not in team* with a readable DNA (D35-8); the panel records the opener and
  gives the focus to `#main` when the opener is gone.
- task-036: Today's action is a `Button` that navigates to `/p/$pid/e/$eid` (D36-3) — "task-037
  adds the 'opened from Today' signal"; lists filled by two queries are asserted with retrying
  expects and `COLD_READ_MS`; names lists in their own element for X-09.1; per-project components
  keyed by pid, announcements guarded on a view change (review F1); one axe/strings test per
  `SCREENS` entry (bug-011).
- v0.1 task-018 / task-015 (cited by the panel): the drawer is non-modal, focus moves into it on
  open, Escape and Close go back in history (`onClose`), focus to `#main` when lost.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| US-G-04 G-04.1 (two clicks, `wf(task): approve … [pending → approved]`), G-04.3 (reason focused from Today), G-04.2 (Cancel closes, no commit) | **red-first** | `test/web/element/gate-footer.test.tsx` (footer absent today); e2e `gate-footer.spec.ts` |
| US-G-05 G-05.1 … G-05.3 (every outcome side by side, approve primary, unknown type) | **red-first** | `test/web/element/footer.test.ts` (pure view), component, e2e |
| US-G-06 G-06.1 … G-06.4 (default selected, typed reason used, untouched default cleared on a reject, typed reason kept) | **red-first** | component (focus/selection), e2e (history lists the reason) |
| US-G-07 G-07.1, G-07.2 (disabled while empty / only spaces, "A reason is required") | **red-first** | component (no request sent), e2e (no `POST …/approve` request seen; server side already 400 by task-032) |
| US-G-09 G-09.1 … G-09.3 (informational footer without `approver`) | **red-first** | pure view + component, e2e on custom (Sam, Casey; `dna update` before the console starts) |
| US-S-24 S-24.1 … S-24.4 (no footer on a final state, engine-waiting notes, reject-only gate-waiting) | **red-first** | pure view + component, e2e (custom, unknown; S-24.4 approved with `cli(…)` first); S-24.4's "Requires you does not list it" is **characterization** (server rule of spec-003 §5, task-031/036) |
| S-13.2, S-15.2 (no governed action for not-in-team / ambiguous; the read-only line with *How to join*) | **red-first** | component, e2e (Riley; a copy whose email matches Jordan and Sam) |
| TT-PERF-10 (≤ 2 clicks, G-04.1 / G-04.3 / X-06.2) | **red-first** | e2e click counter in G-04.1; X-06.2 keyboard only |
| TT-SEC-07 — offered iff the member holds `approver` | **red-first** (web) | G-09.1 … G-09.3 here; T-06.1, T-06.2 already closed by task-036 (`today.spec.ts`, **characterization**); S-11.1 runs in task-039 |
| TT-SEC-07 — 0 permission rules in the server | **characterization** | task-032 `test/server/http/element-writes.test.ts` (approve without `approver` reaches the CLI → 422 `cli-refused`, W-13); no `ui.yaml` read in v0.2 |
| RP-13 hand-transition states show the waiting note | **red-first** | S-24.2 (custom `release` `planning`) + component |
| v0.1 "read-only panel: only Close" (`test/web/element/panel.test.tsx`) | **characterization**, rewritten | the case keeps "no Edit"; the footer cases move to `gate-footer.test.tsx` |
| SCREENS / X-06.4 / X-09.1 | **red-first** | appended screens (D37-12) |
| REQ-INT-08 | check | own specs on the three engines (W0-9) |

#### What the footer shows (pure, `web/src/element/footer.ts`)

`footerView(descriptor, header)` → one tagged value, from the descriptor's data (`verbs`,
`actor.kind`, `actor.role/members`) and the header's identity — no type, state or kind name in
code (REQ-ARC-05; spec-003 §8: rendered, not re-derived). Order of the rules (D37-5):

1. identity not `member` → `readOnly` (`notInTeam {email}` with *How to join* when the DNA is
   readable, else `other`): no outcome (S-13.2, S-15.2);
2. no `approve`/`reject` verb: actor `engine` → `waiting {state}` (S-24.2, S-24.3, RP-13); no verb
   and actor `none` → `final` (S-24.1, D37-7); otherwise (only `submit`: task-038's single-action
   footer; *undeclared*: the state chip already says it) → `none`;
3. a gate verb whose `role` the member does not hold → `reserved {role, members}` (G-09.x;
   members from `actor.members`, D37-6 for the engine actor of a gate-waiting state);
4. otherwise `gate {outcomes: [{verb, to, enabled, reason?}], approve?: boolean, engineAdvance:
   actor.kind === 'engine'}` in the order of D37-2.

#### Component and file layout

- `web/src/element/footer.ts` (new, pure) — `footerView`, `isBlank(reason)` (`/^\s*$/`),
  `outcomeOrder` (D37-2).
- `web/src/element/GateFooter.tsx` (new) — `<section aria-labelledby>` at the bottom of the drawer
  (outside the scrolling body, as the prototype): heading, labelled `<textarea rows=2>`
  (placeholder "Reason (required)"), the hint "A reason is required" (`id`, referenced by every
  outcome's `aria-describedby` while blank), the outcome buttons (D37-3), *Cancel* (= `onClose`),
  the engine note, the blocked-reason line (D37-8), an always-present polite status region and a
  `role="alert"` region for a refusal (D37-9). Default and clear/restore of D37-4. While the
  request runs: outcomes aria-disabled, the status says "Recording the decision…".
- `web/src/element/ElementPanel.tsx` — renders `<ElementFooter>` (gate footer, read-only line,
  reserved line, waiting note or final note) after the body; props gain `focusReason: boolean`.
- `web/src/element/StateMachine.tsx` — the current chip of a `final` view reads
  "<state>, final state" (`element.states.final`, D37-7); a `final?: boolean` prop.
- `web/src/element/element.css` — footer styles (tokens of spec-009 only; `.button-primary`,
  `.button-danger` if absent from `base.css` they are declared here, not in `base.css`).
- `web/src/routes/element.tsx` — reads the history state `gateFocus` once (D37-1) and passes
  `focusReason`; its own `declare module '@tanstack/react-router' { interface HistoryState {
  gateFocus?: boolean } }` (no shared file).
- `web/src/today/TodayView.tsx` (task-036's) — the action button's `navigate` gains
  `state: { gateFocus: true }` for the `approve` and `review` actions (one line).
- `web/src/api/writes.ts` (new, **shared**, D37-10) — the write mutation.
- `web/src/api/error-message.ts` — one appended entry `'write-incomplete'` and its `commit`
  default (D37-11).

#### Catalogue keys (new, inserted sorted; RP-43; texts follow the decisions)

`common.action.cancel` "Cancel"; `element.gate.title` "Decision";
`element.gate.reason.label` "Reason, recorded in the commit"; `element.gate.reason.placeholder`
"Reason (required)"; `element.gate.reason.default` "Approved via WingFoil UI" (D37-4);
`element.gate.reason.required` "A reason is required"; `element.gate.outcome` "{verb, select,
approve {Approve} other {Reject}} → {to}"; `element.gate.engineAdvance` "Waiting for the workflow
engine to advance"; `element.gate.reserved` "Reserved to {role} — {members} can act" (members in
their own element) and `element.gate.reservedNoMember` "Reserved to {role}"; `element.gate.pending`
"Recording the decision…"; `element.gate.done` "{id} is now {state}" (D37-9);
`element.waiting.engine` "Waiting for the workflow engine (state: {state})";
`element.final` "Final state: no action is possible"; `element.states.final` "{state}, final
state"; `element.readOnly.notInTeam` "Read-only: {email} is not in the team —" + the existing
`shell.howToJoin.open` button; `element.readOnly.other` "Read-only: see the notice above the
view"; `element.reason.notInTeam`, `.versionUnsupported` {range}, `.localChanges`,
`.copyBehind` {commits}, `.copyDiverged`, `.copyDetached` (D37-8); `error.writeIncomplete`
(D37-11).

#### Test plan

- Vitest (jsdom): `test/web/element/footer.test.ts` (every rule of `footerView` on descriptors of
  the three fixtures' shapes: kanban gate, custom bug gate, unknown story gate, gate-waiting,
  last-gate reject-only, waiting, final, undeclared, submit-only; each identity kind; role held /
  not held; `isBlank`); `test/web/element/gate-footer.test.tsx` (default selected and replaced by
  typing; clear on a reject's focus and restore on Approve's; typed reason kept; blank and spaces →
  aria-disabled, hint described, no request; pressing an outcome sends `POST …/approve|reject` with
  `{expectedStatus, reason}`; pending state; success → the project's queries invalidated, status
  "… is now …", focus to the panel heading; refusal → alert with `ErrorText` (`cli-refused`
  verbatim, `element-changed`, `write-incomplete` with and without `commit`), reason kept; Cancel →
  `onClose`; focus on the reason only with `focusReason`; read-only lines and the *How to join*
  button calling the provider; reserved line; notes; final chip text; keyed by pid);
  `test/web/api/writes.test.ts` (path, method, body; invalidation of `['p', pid]` on success and on
  refusal); `test/web/api/error-message.test.ts` (appended: `write-incomplete`);
  `test/web/today/today.test.tsx` (appended: the Approve/Review action navigates with the state);
  `test/web/element/panel.test.tsx` (read-only case rewritten).
- Playwright `test/e2e/gate-footer.spec.ts` (`prebuild: ['kanban', 'custom', 'unknown']`), one test
  per scenario, each on its own fixture copy (writes), `scanThemes` on the open footer in G-04.3,
  G-05.1, G-07.1, G-09.1, S-24.2, S-13.2; commit subjects read with git on the copy (a small
  appended helper `lastCommitSubject(fixture)` in `test/e2e/support/events.ts`).

e2e closure (scenario → spec file › test):

| Scenario | spec file › test |
|----------|------------------|
| G-04.1 (+ TT-PERF-10 click count, TT-SEC-10 G-04.1) | `test/e2e/gate-footer.spec.ts` › "G-04.1 — Approve a gate in two clicks from Today" |
| G-04.3 | `gate-footer.spec.ts` › "G-04.3 — Open the gate footer with the reason focused" |
| G-04.2 | `gate-footer.spec.ts` › "G-04.2 — Cancel without running the CLI" |
| G-05.1 | `gate-footer.spec.ts` › "G-05.1 — Show approve and the reject target of a bug gate" |
| G-05.2 | `gate-footer.spec.ts` › "G-05.2 — Reject to the gate's target" |
| G-05.3 | `gate-footer.spec.ts` › "G-05.3 — Derive the outcomes of an unknown type's gate" |
| G-06.1 … G-06.4 | `gate-footer.spec.ts` › "G-06.1 — …", "G-06.2 — …", "G-06.3 — …", "G-06.4 — …" |
| G-07.1, G-07.2 | `gate-footer.spec.ts` › "G-07.1 — …", "G-07.2 — …" |
| G-09.1 … G-09.3 (TT-SEC-07) | `gate-footer.spec.ts` › "G-09.1 — …", "G-09.2 — …", "G-09.3 — …" |
| S-24.1 … S-24.4 | `gate-footer.spec.ts` › "S-24.1 — …" … "S-24.4 — …" |
| S-13.2, S-15.2 (TT-SEC-08 UI side) | `gate-footer.spec.ts` › "S-13.2 — …", "S-15.2 — …" |
| X-06.2 (TT-PERF-10) | `gate-footer.spec.ts` › "X-06.2 — Decide a gate with the keyboard only" |
| T-06.1, T-06.2 (TT-SEC-07) | closed by task-036: `test/e2e/today.spec.ts` |
| S-11.1 (TT-SEC-07) | task-039-repository-status-and-fetch-in-the-sidebar, on this footer |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` over `SCREENS` › the appended screens (D37-12) |

- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own
  specs (`gate-footer.spec.ts`, `accessibility.spec.ts`, `element-panel.spec.ts`, `today.spec.ts`,
  `no-commit.spec.ts`) on the three engines, `check_tasks.py v0.2`; `test:timing` only at load < 12
  (no timed scenario of its own: TT-PERF-02 is task-038's).

#### Spec / UX amendments needed

- spec-003 §6 (Process Note): an unidentified user gets no outcome, only the read-only line
  (S-13.2, S-15.2) — rule 1 is applied as "no footer", not as disabled outcomes; the informational
  footer of a gate-waiting state (D37-6).
- ux-reference §4.2 (version bump, `ux-consistency`): reason required for approve with an editable
  default (US-G-06, the BDD over the reference's "optional to approve"); the outcome order (D37-2);
  the read-only, reserved, waiting and final footers.
- `docs/user-guide.md` (*Element panel* › *Deciding a gate*), `CHANGELOG.md` *Unreleased* › Added,
  `test/README.md` version line + layout lines.

#### Open decisions (STOP: nothing depending on them is built before the answer)

- **D37-1 — the "opened from Today" signal (G-04.3).** ★ (a) router history state
  `{ gateFocus: true }` set by Today's *Approve*/*Review* button, read once by the panel (no URL
  change; a reload or a Memory-list open does not move the focus); (b) a search parameter
  `?focus=reason` (visible, survives a reload and a copied link); (c) always focus the reason when a
  gate footer is shown (every opener; the selected default would be replaced by the first key typed).
- **D37-2 — order of the footer.** ★ (a) reason, then *Approve → x* (primary), each *Reject → y*
  (danger), then *Cancel* last — Tab from the reason reaches Approve before any reject, so X-06.2
  never crosses a reject (which would clear the default by G-06.3); deviation from the prototype
  (Cancel · rejects · Approve) recorded in the UX reference; (b) the prototype's order (X-06.2 then
  crosses *Reject → draft*, the default is cleared and Approve is disabled); (c) the prototype's
  visual order with CSS `order` over an approve-first DOM (focus order ≠ visual order, WCAG 2.4.3).
- **D37-3 — disabled outcomes.** ★ (a) focusable: `aria-disabled="true"`, press ignored,
  `aria-describedby` → the hint or the blocked reason (G-06.3 focuses a reject that becomes
  disabled when the default clears: a `disabled` button drops the focus to `<body>`; X-07.3 needs
  the description reachable); a small `OutcomeButton` on a native `<button>` (React Aria's `Button`
  has no focusable-disabled mode); (b) native `disabled` (React Aria `isDisabled`); (c) never
  disabled: a press with a blank reason focuses the field and shows the hint (against G-07.1).
- **D37-4 — the default reason.** ★ (a) catalogue text `element.gate.reason.default`, only when the
  footer offers an approve, selected when the field takes the focus; cleared when the focus moves
  to a reject while untouched (G-06.3), **restored** when the focus moves to Approve while the
  field is still empty from that automatic clear (keyboard users who passed a reject); a
  reject-only footer starts empty; (b) as (a) without the restore; (c) as (a) but the default is a
  code constant (always English: it lands in the repository's commit).
- **D37-5 — what the footer shows, in this order.** ★ (a) identity not `member` → only a read-only
  line (`not-in-team` with readable DNA: "Read-only: <email> is not in the team — *How to join*"
  via `useHowToJoin().show()`; other kinds: "Read-only: see the notice above the view") — S-13.2,
  S-15.2, amending spec-003 §6 rule 1 (no disabled outcomes for them); then no gate verb → waiting
  note (actor `engine`), final note (actor `none`), nothing otherwise (submit-only: task-038;
  undeclared); then a gate verb whose role the member lacks → reserved line; else the gate footer
  (enablement per verb from the descriptor, engine note for gate-waiting); (b) as (a) but the
  unidentified users see the reserved line too (more text, S-13.2's line still needed);
  (c) unidentified users see the outcomes disabled with "Read-only: not in the team" (spec-003 §6
  literal; against S-13.2/S-15.2 "no action footer").
- **D37-6 — a gate-waiting state for a member without `approver`** (actor = engine: no member
  names in the descriptor). ★ (a) the engine note "Waiting for the workflow engine to advance" plus
  "Reserved to approver" without names (no new read); (b) names from `projectConfigQuery` (the DNA:
  a cold panel adds the config reads); (c) the engine note only.
- **D37-7 — "marked as the final state" (S-24.1).** ★ (a) no verb and actor `none`: the current
  chip reads "<state>, final state" and the footer slot shows "Final state: no action is possible"
  (no button); (b) the chip's accessible text only; (c) the note only.
- **D37-8 — disabled reasons (spec-003 §6 codes) in this footer.** ★ (a) all six now,
  `element.reason.*` (spec-003 §6 English; `copy-behind` "Blocked: your copy is {commits} commit(s)
  behind the remote" — task-040 appends "— Update"), shown under the outcomes and as their
  description; task-038 reuses them for *Submit* and closes G-11.x / X-07.3 e2e on this footer;
  (b) only `local-changes` and `version-unsupported`, a generic text for the others; (c) none here:
  disabled outcomes without a reason until task-038 (fails REQ-ARC-10 in between).
- **D37-9 — feedback before task-038's toasts.** ★ (a) success: invalidate `['p', pid]` (the
  `repo` event would too) so the panel shows the new state; the panel stays open; focus to the
  panel heading (the focused outcome is gone); polite status "<id> is now <state>" (no commit
  line: task-038's toast); refusal: `role="alert"` in the footer with `ErrorText` (codes from the
  catalogue, `cli-refused` verbatim), the reason kept, `['p', pid]` invalidated (RP-12: the panel
  shows the new state after `element-changed`); task-038 moves both to its toasts; (b) success
  goes back to Today (history back); (c) no message, only the refreshed state.
- **D37-10 — the write mutation (shared).** ★ (a) `web/src/api/writes.ts`: `postElementWrite(pid,
  eid, verb, body, signal?)` and `useElementWrite()` = `useMutation<WriteResponse, ApiError,
  ElementWriteVariables>`, `ElementWriteVariables = { pid, eid, verb: 'submit' | 'approve' |
  'reject', expectedStatus, reason? }`, `onSettled` invalidates `queryKeys.project(pid)`; task-038
  calls it for *Submit* and reads `data`/`error` for its toasts; (b) approve/reject only
  (`useDecideElement`), task-038 adds submit; (c) in `web/src/api/projects.ts` (a merge hot spot).
- **D37-11 — `write-incomplete` catalogue text.** ★ (a) added here (approve/reject can answer it;
  until then it renders as `internal`, "see its log", while nothing is logged): `error.writeIncomplete`
  "WingFoil did not finish the action: check {file} with git before trying again{commit, select,
  none {} other { — WingFoil made the commit {commit}}}", `errorMessage` defaulting `commit` to
  `none`; task-032's hand-over to task-038 amended (task-038 reuses it); (b) left to task-038 as
  task-032 handed it over.
- **D37-12 — SCREENS.** ★ (a) the existing *element panel* screen now shows the gate footer with
  the default; append "element panel — gate footer, reason empty" (`pids[0]`, field cleared:
  disabled outcomes and the hint), "element panel — waiting for the workflow engine" (`pids[1]`
  `minor-v0.1`), "element panel — read-only, not in team" (`pids[2]`); the reserved line is scanned
  in G-09.1's `scanThemes` (no Sam project in the screens console); (b) as (a) plus a fourth
  screens project (Sam) for the reserved line; (c) no new screen.
