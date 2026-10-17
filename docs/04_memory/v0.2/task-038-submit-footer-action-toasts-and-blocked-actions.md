---
id: task-038-submit-footer-action-toasts-and-blocked-actions
type: task
title: "Submit footer action toasts and blocked actions"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-G-10"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-034-auto-sync-scheduler-and-auto-push", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The single-action footer *Submit* (G3), actions blocked on an element with local changes with the
reason as accessible description, and action feedback (G4): a toast with the result, the `wf(…)`
commit line with its short hash and "pushed" when auto-push pushed it; a red toast with the CLI's
own reason for a refusal, and the catalogue text of 409 `element-changed` when the element moved
in the meantime (RP-12). Toasts and refusals announced to screen readers.

**Backlog items:** US-G-10, US-G-11, US-G-13, US-G-14, US-X-07, TT-PERF-02

- US-G-10 — As Jordan, I want to submit an element from its single-action footer, so that it moves to its next state without the terminal
- US-G-11 — As a member, I want gate and submit actions blocked, with the reason, on an element with local changes, so that a UI action never commits someone's uncommitted edits
- US-G-13 — As Morgan, I want a toast with the result and the `wf(…)` commit (and "pushed" when it was pushed), so that I know the decision is recorded and shared
- US-G-14 — As Morgan, I want a refused action shown as a red toast with the CLI's own reason and the element left unchanged, so that I know what to fix (missing field, wrong role)
- US-X-07 — As a member using a screen reader, I want toasts, state changes and blocked actions announced, so that I know the outcome of what I did

## Acceptance Criteria

- **US-G-10** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/submit.feature`: G-10.1 Submit a draft; G-10.2 Submit rejected work again; G-10.3 Offer no submit on an element waiting on a gate
- **US-G-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/blocked-actions.feature`: G-11.1 Block a gate on an element with local changes; G-11.2 Block a submit on an element with local changes; G-11.3 Do not block an element when only another file has local changes
- **US-G-13** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/action-feedback.feature`: G-13.1 Show the commit and "pushed" after an approval; G-13.2 Show the commit without "pushed" when auto-push is off
- **US-G-14** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/action-feedback.feature`: G-14.1 Show the CLI's reason when a submit is refused; G-14.2 Show the refusal when the element moved in the meantime
- **US-X-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-07.1 Announce a toast; X-07.2 Announce a refusal assertively; X-07.3 Expose the reason of a blocked action
- **TT-PERF-02** (REQ-PERF-02 — Gate and submit latency): [numeric] p95 ≤ 3.0 s on the large fixture. *Verified by:* e2e performance run.
  Scenarios (`@v0.2`): G-04.1, G-10.1, G-13.2.
  Timed on the large fixture in `test:timing` (Chromium only, RP-44): click on the outcome or *Submit* → toast with the commit, p95 printed with the load; `test:e2e` behaviour only. G-04.1 is task-037-gate-footer-with-every-outcome's scenario.

RP-52: G-13.2 is proved here up to the toast (the commit line without "pushed"), also for its
TT-PERF-02 citation; its last step, the sidebar's "1 commit to push", closes in
task-040-update-and-push-from-the-sidebar, which adds that assertion to the same scenario.

Also closes G-11.1, G-11.2, G-11.3, X-07.3 of TT-STATE-03 (task-032-governed-writes-submit-approve-and-reject). RP-49: US-G-13 stays here;
G-13.1 needs the auto-push of task-034-auto-sync-scheduler-and-auto-push.

Screen: `docs/00_reference/ux-reference.md` §4.2 (*Single-action footer*), §5 (*Feedback*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-004` §5 (write response, `push` outcome, error envelope, `cli-refused` verbatim), §4 row 9
  (`element-changed`); `spec-008` §4 (texts from the server: codes rendered from the catalogue,
  CLI messages verbatim); `spec-003` §6 reason `local-changes`.
- The toast component is reused by task-040-update-and-push-from-the-sidebar (push refusals): keep it in `web/src/shell/`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-16)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (hard rules, v0.2 additions, e2e
engines W0-9, lessons of Waves 0–4, the machine-free slot for heavy gates); the Execution Notes of
the `depends_on` tasks task-034 and task-037 and of those they build on, task-032 and task-033
(design, decisions, red/green/refactor, every review round); `release-planning-rel-v0.2-plan`
RP-12, RP-43, RP-44, RP-49, RP-52, RP-55; `dev-loop-rel-v0.2-plan` Sessions 1–5 and the hand-overs
to Wave 5; the descriptions of the parallel task-039 and task-041 and of the next task-040 (it
reuses the toast for push refusals); `submit.feature`, `blocked-actions.feature` (G-11.x, and G-12.x
of task-040), `action-feedback.feature`, `accessibility.feature` X-07.x; spec-003 §3, §6, §8,
spec-004 §4–§5, spec-008 §4; `contracts/src/{descriptor,writes}.ts`; ux-reference 1.4 §3, §4.2, §5;
the prototype's single-action footer (Close · verb, primary, right-aligned) and its toast (one at a
time, bottom centre, dark or red, text + extra + monospaced commit line, removed after 4.2 s);
fixture conventions (`02_bdd/00_conventions.md`: kanban and custom standard elements, standard
team); code: `web/src/element/{footer.ts,ElementFooter.tsx,ElementPanel.tsx}`,
`web/src/api/{writes,error-message}.ts`, `web/src/shell/{Shell,ErrorText}.tsx`,
`web/src/i18n/en.json`, `server/src/descriptor/descriptor.ts` (the `local-changes` reason);
tests: `test/e2e/support/*` (console, screens, events, identity, perf), `test/e2e/gate-footer.spec.ts`,
`test/e2e/notification-bell.spec.ts`, `test/e2e/project-header.spec.ts` S-09.1,
`test/e2e/performance.spec.ts`, `playwright.timing.config.ts`, `test/harness/fixtures/{builder,large}.ts`,
`test/web/element/gate-footer.test.tsx`, `test/web/i18n/catalogue.test.ts` (unused keys fail).

**depends_on (dl-015 hard gate) — acknowledged.**

- task-037: `useElementWrite()` (`web/src/api/writes.ts`, D37-10) carries `{pid, eid, verb,
  expectedStatus, reason?}` and invalidates `['p', pid]` once settled; the six `element.reason.*`
  keys (D37-8) and `error.writeIncomplete` with the `commit` default `none` (D37-11) are reused;
  the gate footer's polite status ("<id> is now <state>") and its refusal alert
  (`element-footer-alert`, review F2/F14) are the placeholders this task replaces with toasts
  (D37-9); outcomes are native buttons with `aria-disabled` and the reason as description (D37-3),
  which already gives X-07.3 on the gate; `footerView` returns `none` for a submit-only state — this
  task's footer; the "decided" flag lives in the part keyed by id and status (F12); a refusal must
  live outside the part that follows the refetched state (F2).
- task-034: `push` = `{status: off | pushed | failed, code?, message?}`; on `failed` a `code`
  (`detached-head`, `no-upstream`, `remote-not-owned`, `remote-unreadable`, `push-timeout`,
  `internal`) rendered from the catalogue, or git's `message` (redacted) shown verbatim; a failed push
  is still a 200 of the write; the W2-5 commit (CLI failed after its commit) is not pushed. The
  catalogue already has `error.pushTimeout` ("Not pushed: …"), `error.internal`, `error.noUpstream`,
  `error.detachedHead`, `error.remoteNotOwned`, `error.remoteUnreadable`. Every real-bin console
  fetches every 60 s (`autoFetch` on); auto-push is off by default; e2e settings are seeded through
  `ConsoleOptions.stateDir` (C5).
- task-032: 200 `{result, commits: [{sha, subject}], push}` with exactly one `wf(…)` commit for a
  governed verb; 409 `local-changes` (row 7, fresh, also hidden edits), 409 `element-changed`
  (row 9, no `wingfoil` process — `element-writes.test.ts`), 422 `cli-refused` verbatim (bug-012
  redaction), 500 `write-incomplete` `{file, commit?}`; G-11.1, G-11.2, G-11.3, X-07.3 are proved
  API-side there and close here in e2e.
- task-033: 409 `stale-copy` (row 8) renders from the catalogue; the copy reasons `copy-behind`
  `{commits}`, `copy-diverged`, `copy-detached` come with the descriptor (task-040 appends
  "— Update").
- task-042: the notification bell sits in the shell header (keyboard walks and `SCREENS` count it);
  `notification-bell.spec.ts` S-21.3 asserts the inline "… is now approved" status this task removes.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| G-10.1, G-10.2 (Submit commits `wf(task): submit <id>`, state → pending, banner gone) | **red-first** | `test/web/element/submit-footer.test.tsx` (no Submit today: `footerView` → `none`); e2e |
| G-10.3 (no Submit on a gate element) | **characterization** | e2e (task-037's footer already shows the reserved line / gate for `task-001-login-form`) |
| G-11.1, G-11.3, X-07.3 on the gate (disabled with the reason as description; another file does not block) | **characterization** | e2e (task-037's outcomes and the server's descriptor already do it; task-032 proved the API side) |
| G-11.2 (Submit disabled with the reason) | **red-first** | component, e2e |
| G-13.1, G-13.2 (toast: result, commit line with short hash, "pushed" only when pushed) | **red-first** | `test/web/shell/toasts.test.tsx`, `test/web/api/writes.test.ts` (appended), e2e |
| `push: failed` codes incl. `push-timeout`, `internal`, and git's message verbatim (hand-over) | **red-first** | `writes.test.ts` / toast component |
| G-14.1, G-14.2 (red toast, CLI text verbatim; `element-changed` catalogue text, panel shows the new state) | **red-first** | component, e2e |
| X-07.1, X-07.2 (polite / assertive live regions) | **red-first** | toast component, e2e |
| TT-PERF-02 (p95 ≤ 3.0 s click → toast with the commit, large fixture, `test:timing` Chromium) | **red-first** | `@perf` test (D38-12) |
| D37-9 inline status and alert moved to toasts | **characterization, rewritten** | `gate-footer.test.tsx`, `gate-footer.spec.ts` G-04.1, `notification-bell.spec.ts` S-21.3 |
| S-09.1 (no enabled governed button on an unsupported version) | **characterization** | `project-header.spec.ts` unchanged (it opens the gate element; a Submit would be disabled with the same reason) |
| `SCREENS` / X-06.4 / X-09.1 | **red-first** | appended screen (D38-13) |
| REQ-INT-08 | check | own specs on the three engines (W0-9) |

#### What changes (pending the decisions below)

- `web/src/element/footer.ts` — a new view `{ kind: 'submit', to, enabled, reason? }` for a
  member when the descriptor's only verb is `submit` (rule 2 of D37-5 keeps `none` for an
  undeclared state); rule 1 (identity) unchanged.
- `web/src/element/ElementFooter.tsx` — the single-action footer (D38-6/D38-7): the Submit button
  (native, `aria-disabled` + described by the reason, as D37-3), Cancel; the slot's polite region
  keeps only the "in progress" text (`element.gate.pending`, a new `element.submit.pending`);
  `element.gate.done` and the `element-footer-alert` region are removed (D38-10).
- `web/src/api/writes.ts` — the toasts are raised from the mutation's own callbacks
  (D38-11), so a panel closed while the write runs still gets its result.
- `web/src/shell/toasts.ts` (new, **shared**) — the toast store (D38-1): `showToast(toast)` →
  id, `dismissToast(id)`, `useToasts()`; `web/src/shell/Toasts.tsx` (new) — the two live regions
  and the toast list; `web/src/shell/toasts.css` (new); `web/src/shell/Shell.tsx` — one appended
  `<Toasts />` line (and its import).
- `web/src/element/write-toast.tsx` (new) — the toast content of a governed write (D38-3, D38-4,
  D38-5) built from `WriteResponse` / `ApiError` with `ErrorText`.

#### Catalogue keys (new, inserted sorted; RP-43; texts follow the decisions)

`element.submit.action` "Submit → {to}"; `element.submit.pending` "Submitting…";
`element.write.done` "{verb, select, submit {Submitted} approve {Approved} other {Rejected}} {id}";
`element.write.commit` "{sha} {subject}" (`sha` the first 7 characters, in a `<code>`);
`element.write.pushed` "pushed"; `element.write.notPushed` "Not pushed — the commit stays local";
`element.write.refused` "{verb, select, submit {Submit} approve {Approve} other {Reject}} of {id}
not done"; `shell.toast.close` "Close notification"; `shell.toast.region.polite` /
`.assertive` (region labels). Removed: `element.gate.done` (unused after D38-10). Changed:
`error.pushTimeout` without its "Not pushed:" prefix (D38-4 a).

#### Test plan

- Vitest (jsdom): `test/web/element/footer.test.ts` (appended: the `submit` view, enabled and with
  each reason, identity first, gate states unchanged); `test/web/element/submit-footer.test.tsx`
  (new: offered, primary, `POST …/submit` with `{expectedStatus}`, pending text, disabled with the
  reason as description and no request, keyboard press, Cancel → `onClose`, no Submit on a gate);
  `test/web/shell/toasts.test.tsx` (new: polite vs assertive region always present, order, at most
  3, replace by key, auto-dismiss with fake timers, paused on hover and focus-within, sticky toasts,
  Close returns the focus to `#main` when the toast had it); `test/web/api/writes.test.ts`
  (appended: one toast per success with result, commit lines, `pushed` / nothing / not-pushed with
  each `push.code` and with git's message verbatim; one red toast per refusal — `cli-refused`
  verbatim, `element-changed`, `local-changes`, `stale-copy`, `write-incomplete` with and without
  `commit`, `unreachable`; raised after the caller unmounted); `test/web/element/gate-footer.test.tsx`
  (status/alert cases rewritten to toasts); `test/web/i18n/*` unchanged (they cover the new keys).
- Playwright `test/e2e/submit-footer.spec.ts` (new, `prebuild: ['kanban', 'custom']`), one test per
  scenario, each on its own fixture copy; `scanThemes` on the submit footer (G-10.1), the blocked
  footer (G-11.2), a success toast (G-13.1) and a red toast (G-14.1); a keyboard-only test (Submit
  and closing the toast, visible focus). Rewritten: `gate-footer.spec.ts` G-04.1 and
  `notification-bell.spec.ts` S-21.3 read the toast instead of the drawer's status.

e2e closure (scenario → spec file › test), planned:

| Scenario | spec file › test |
|----------|------------------|
| G-10.1, G-10.2, G-10.3 | `test/e2e/submit-footer.spec.ts` › "G-10.1 — Submit a draft", "G-10.2 — Submit rejected work again", "G-10.3 — Offer no submit on an element waiting on a gate" |
| G-11.1, G-11.2, G-11.3 (TT-STATE-03) | `submit-footer.spec.ts` › "G-11.1 — Block a gate on an element with local changes", "G-11.2 — Block a submit on an element with local changes", "G-11.3 — Do not block an element when only another file has local changes" |
| G-13.1 | `submit-footer.spec.ts` › "G-13.1 — Show the commit and \"pushed\" after an approval" |
| G-13.2 (TT-PERF-02; up to the toast, RP-52) | `submit-footer.spec.ts` › "G-13.2 — Show the commit without \"pushed\" when auto-push is off"; the sidebar step: task-040-update-and-push-from-the-sidebar |
| G-14.1, G-14.2 | `submit-footer.spec.ts` › "G-14.1 — Show the CLI's reason when a submit is refused", "G-14.2 — Show the refusal when the element moved in the meantime" |
| X-07.1, X-07.2, X-07.3 (TT-STATE-03) | `submit-footer.spec.ts` › "X-07.1 — Announce a toast", "X-07.2 — Announce a refusal assertively", "X-07.3 — Expose the reason of a blocked action" |
| TT-PERF-02 (G-04.1, G-10.1, G-13.2) | D38-12 `@perf` tests (`test:timing`, Chromium); behaviour only in `test:e2e` |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` over `SCREENS` › the appended screen (D38-13) |

- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own and
  touched specs (`submit-footer`, `gate-footer`, `notification-bell`, `accessibility`,
  `element-panel`, `project-header`) on the three engines, `check_tasks.py v0.2`, `test:timing`
  only at load < 12 (TT-PERF-02 is this task's: otherwise recorded as deferred to the wave gate).

#### Spec / UX amendments needed

- ux-reference §4.2 (*Single-action footer* in v0.2) and §5 (*Feedback*: stack, lifetime, live
  regions, the not-pushed line) — version 1.5, deviations from the prototype recorded
  (`ux-consistency`).
- `docs/user-guide.md` (*Element panel* › *Submitting*, *What the console tells you after an
  action*), `CHANGELOG.md` *Unreleased* › Added, `test/README.md` version line + the new suite lines.
- No change to `contracts/`, the schemas or the server.

#### Open decisions (STOP: nothing depending on them is built before the answer)

- **D38-1 — the toast mechanism (shared, task-040 reuses it).** ★ (a) a module store
  `web/src/shell/toasts.ts` (`showToast({key?, tone: 'success' | 'error', title, body?, sticky?})`
  → id, `dismissToast(id)`, `useToasts()` on `useSyncExternalStore`; `title`/`body` are React
  nodes, so each task composes its own content) and one `<Toasts />` rendered by `Shell` (one
  appended line): callable from a mutation's callbacks, survives the panel closing, no provider
  re-indenting the shell (RP-55); (b) a React context provider wrapping the shell tree (re-indents
  `Shell.tsx`, a conflict with task-039/041); (c) toasts inside the element panel (lost on close;
  task-040 cannot reuse them).
- **D38-2 — lifetime and stacking.** ★ (a) a stack at the bottom centre (prototype position),
  newest last, at most 3 (the oldest goes); a success toast is removed after 8 s, the timer paused
  while hovered or while the focus is inside it; a refusal toast and a success toast with a failed
  push stay until closed; every toast has a Close button; a new result for the same element
  replaces its previous toast (key `write:<pid>:<eid>`); the focus is never moved to a toast;
  (b) the prototype: one toast, 4.2 s for every toast (a CLI refusal disappears before it is read,
  WCAG 2.2.1; flaky e2e under load); (c) every toast stays until closed.
- **D38-3 — the success toast.** ★ (a) title "Approved <id>" / "Submitted <id>" / "Rejected <id>"
  (G-13.1 literal); one line per commit: the short hash (first 7 characters, monospaced) and the
  subject; "pushed" after the commit line when `push.status` is `pushed`, nothing when `off`;
  (b) as (a) with the full sha; (c) the title and the subject only (no hash; against G-13.1).
- **D38-4 — `push: failed` in the success toast** (hand-over). ★ (a) the toast stays polite (the
  write succeeded) but sticky, with an attention line "Not pushed — the commit stays local" then
  the reason: a `code` from the catalogue (`error.<code>`: `push-timeout`, `internal`,
  `detached-head`, `no-upstream`, `remote-not-owned`, `remote-unreadable`; an unknown code renders
  as `internal`), git's `message` verbatim inside the `error.gitRefused` frame; `error.pushTimeout`
  loses its own "Not pushed:" prefix (one changed value of task-034's key, used only here);
  (b) a second, red and assertive toast for the push; (c) only "not pushed" without the reason
  (the sidebar of task-039/040 shows the commit to push).
- **D38-5 — the refusal toast.** ★ (a) red, assertive, sticky: title "<Verb> of <id> not done",
  then `ErrorText` (catalogue text; `cli-refused` verbatim in its frame; `element-changed`,
  `local-changes`, `stale-copy`, `write-incomplete` with the commit, `unreachable`); the reason
  typed in the gate footer is kept; (b) `ErrorText` alone, no title (the element is not named once
  the panel is closed); (c) the alert stays in the footer and only success becomes a toast.
- **D38-6 — the single-action footer's label and layout.** ★ (a) "Submit → <to>" (primary), then
  *Cancel* (= Close, as the gate footer, D37-2), the reason under it when disabled; the e2e steps
  "click Submit" match the name by its start; (b) "Submit" only (the BDD's literal; the target
  state not shown); (c) "Submit for review" (ux-reference §4.2, the prototype; wrong where the next
  state is not a review, e.g. a custom type).
- **D38-7 — who is offered Submit.** ★ (a) every member identified in the team (spec-003 §3:
  `submit` requires no role, WingFoil accepts it from any member), enabled per descriptor;
  (b) only the member actor of the descriptor (the prototype's "assignee"), the others reading
  "<name> must act"; (c) everyone, with a note when the user is not the actor.
- **D38-8 — reproducing G-14.2 in e2e.** ★ (a) after the CLI's approve in a terminal the test
  holds the page's `GET /api/p/<pid>/…` reads (`page.route`, released after the click; the event
  stream untouched), so the footer still shows `pending`; the real server answers 409
  `element-changed`; then the reads are released and the panel shows `approved`; "no `wingfoil
  memory reject` process" is asserted as the fixture's last commit still being the approve (no
  reject commit) and cited from task-032's `element-writes.test.ts` row 9 (0 processes) — e2e does
  not count CLI processes (dev rules); (b) abort the event stream before the approve (the
  reconnect then refetches everything: a different path); (c) answer the 409 from `page.route`
  (not the real server).
- **D38-9 — auto-push on for G-13.1 (shared e2e support).** ★ (a) an appended
  `settings?: Partial<Settings>` in `ConsoleOptions` (`test/e2e/support/console.ts`) written into
  the seeded `state.json` — task-039 (`autoFetch: false`) and task-041 can reuse it; "the remote's
  branch is at that commit" read with git on the copy's bare remote (a small appended
  `remoteHead(fixture)` in `support/events.ts`); (b) `PUT /api/settings` from the test through
  the page's session before the action; (c) a hand-written `state.json` in a test-owned
  `stateDir` in this spec only (C5 literal).
- **D38-10 — the footer's inline feedback (D37-9).** ★ (a) the footer keeps only its polite "in
  progress" text while the request runs; "<id> is now <state>" and the `element-footer-alert` go
  (the toasts say it; `element.gate.done` is removed, the catalogue test fails on unused keys);
  `gate-footer.spec.ts` G-04.1, `notification-bell.spec.ts` S-21.3 and `gate-footer.test.tsx`
  read the toast instead; (b) keep both (two announcements of one result); (c) remove the
  in-progress text too.
- **D38-11 — where the toasts are raised.** ★ (a) in `useElementWrite`'s own `onSuccess` /
  `onError` (mutation-level callbacks run even when the panel unmounted, e.g. Escape while the CLI
  runs); the footers' per-call callbacks keep only focus and the "decided" flag; (b) per-call
  callbacks in the footer (the result is lost when the panel closes first); (c) a separate wrapper
  hook in `web/src/element/`.
- **D38-12 — TT-PERF-02.** ★ (a) appended to `test/e2e/performance.spec.ts` (`@perf`, it already
  builds the large fixture): Morgan, auto-push off (default), 20 approvals of distinct `pending`
  tasks and 20 submits of distinct `draft` tasks, each timed from the click to the toast showing
  its commit line; p95 ≤ 3.0 s for each series, printed with the load (`reportRuns`); `test:e2e`
  runs 2 of each without the budget (`PERF_RUNS`); (b) one mixed series of 20; (c) an API-only
  timing (not what the user sees).
- **D38-13 — `SCREENS`.** ★ (a) append "element panel — submit footer" (`pids[0]`,
  `task-004-session-timeout`, Morgan: Submit enabled); the blocked footer and the two toasts are
  scanned in G-11.2, G-13.1 and G-14.1 (`scanThemes`): a write or a local edit would change the
  shared screens console; the toasts' strings are checked by the unit tests (catalogue ids);
  (b) as (a) plus a fourth screens project with a local edit; (c) no new screen (against the AC).

#### Decisions (approver, 2026-10-16)

"All as recommended": **D38-1 (a)** … **D38-13 (a)**. Shared shapes fixed by the coordinator for
Wave 5 (C1–C10): merge order 038 → 039 → 041; this task owns `ConsoleOptions.settings?:
Partial<UiSettings>` (C2, written into the seeded `state.json`, also with a `stateDir` that holds
no `state.json` yet), `web/src/shell/toasts.ts`, `Toasts.tsx`, `toasts.css` (C4), is the only task
editing `web/src/api/writes.ts` (C5), and creates `test/e2e/support/remote.ts` with
`remoteHead(fixture)` (C8, not in `events.ts`); catalogue edits other than sorted inserts are only
the declared `error.pushTimeout` value and the removal of `element.gate.done` (C6); version lines
`test/README.md` 0.37, `docs/user-guide.md` 0.12, ux-reference 1.5 (C7); `SCREENS` appended first
(C9); no change to `contracts/` or `server/` (C10).

### red / green / refactor (2026-10-16)

- **Red (`a340422`)** — `test/web/shell/toasts.test.tsx` (new), `test/web/element/submit-footer.test.tsx`
  (new), `test/web/api/writes.test.tsx` (appended toasts), `test/web/element/footer.test.ts` (the
  `submit` view), `test/web/element/gate-footer.test.tsx` (the D37-9 status and alert cases read the
  toasts): 4 files failed to load (no `toasts.ts`), the `submit` view case failed (`none`).
- **Green (`008bf8f`)** — `web/src/shell/toasts.ts`, `Toasts.tsx`, `toasts.css` (D38-1, D38-2),
  `web/src/element/write-toast.tsx` (D38-3 … D38-5), `useElementWrite`'s own `onSuccess`/`onError`
  (D38-11), the `submit` view of `footerView` and the `SubmitFooter` in `ElementFooter.tsx` (D38-6,
  D38-7), the inline result and `element-footer-alert` removed (D38-10), one appended `<Toasts />`
  line in `Shell.tsx`; catalogue: 8 sorted inserts and the two declared edits (C6).
- **Deviation (decided within D38-1, recorded here):** the two always-present live regions carry
  `aria-live="polite"` / `"assertive"` but **no `status` / `alert` role**. With the roles, the
  empty alert region stood beside every view's own alert and 17 existing component tests
  (`findByRole('alert')`: DNA, directives, docs, Memory list, team, Today, summary, panel) found two;
  e2e locators of the same form would have broken too. Announcement is the same (the live
  politeness is what X-07.1 / X-07.2 state); `toasts.test.tsx` asserts no `status`/`alert` role.
- **e2e (`5efbd7d`, `870e362`)** — `test/e2e/submit-footer.spec.ts` (14 tests); `ConsoleOptions.settings`
  (C2), `test/e2e/support/remote.ts` `remoteHead` (C8), *element panel — submit footer* appended to
  `SCREENS` (D38-13, C9); `gate-footer.spec.ts` G-04.1 and `notification-bell.spec.ts`
  `approveFromToday` read the toast (D38-10). First Chromium run: 44 of 45 passed; G-11.2 failed in
  the test (Playwright's `click` waits for an enabled button, the button is `aria-disabled`):
  pressed with `force` and Enter, the requests recorded.
- **Fault injection (not committed):** with `<Toasts />` removed from `Shell.tsx` and the `submit`
  view disabled in `footer.ts`, `submit-footer.spec.ts` on Chromium: **10 failed, 4 passed** — the
  four passing are the characterization scenarios (G-10.3, G-11.1, G-11.3, X-07.3: task-037's gate
  footer and the server's descriptor), as classified at design.
- **TT-PERF-02 (D38-12)** — appended to `test/e2e/performance.spec.ts`: two series on a copy of
  the large fixture (approve of `pending` tasks, submit of `draft` tasks). Default run (2 runs
  each, no budget, load 15.9): approve p95 1 258 ms, submit p95 1 299 ms.
- **Docs (`92617d2`)** — `docs/user-guide.md` 0.12 (*Submitting*, *After an action*), ux-reference
  1.5 (§4.2 single-action footer, §5 *Feedback*), `CHANGELOG.md` *Unreleased* › Added, `test/README.md`
  0.37. No approved spec needed an amendment: spec-003 §3 already says `submit` requires no role,
  spec-004 §5 and spec-008 §4 already describe the push outcome and the verbatim texts.

### checks (2026-10-16, HEAD `870e362` + notes)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2` | OK | — |
| `npm run test:coverage` (includes the public-text check) | 158 files passed, 1 skipped; **2913 passed / 1 skipped**; statements 96.52 %, branches 91.06 %, functions 97.39 %, lines 98.32 % | ~5 |
| `npm run test:e2e:chromium` (whole suite) | **257 passed** (8.2 min) | 4.2 → 15.9 |
| `npm run test:e2e -- submit-footer.spec.ts gate-footer.spec.ts notification-bell.spec.ts accessibility.spec.ts element-panel.spec.ts project-header.spec.ts` (three engines) | **375 passed**, 0 failed (17.1 min) | 3.6 → 20.4 |
| `npm run test:smoke` | not run: no packaging, launcher or bin change | — |
| `npm run test:timing` (TT-PERF-02 with the 3.0 s budget) | **skipped**: load ≥ 12 after the runs (20.4); deferred to the wave gate on `main` | 20.4 |

No console left (`pgrep -af bin/wingfoil-ui.cjs`), no `wfui-*` entry in the system temporary
directory. Every heavy gate took the machine-free slot.

e2e closure (scenario → spec file › test):

| Scenario | spec file › test |
|----------|------------------|
| G-10.1, G-10.2, G-10.3 | `test/e2e/submit-footer.spec.ts` › "G-10.1 — Submit a draft", "G-10.2 — Submit rejected work again", "G-10.3 — Offer no submit on an element waiting on a gate" |
| G-11.1, G-11.2, G-11.3 (TT-STATE-03) | `submit-footer.spec.ts` › "G-11.1 — Block a gate on an element with local changes", "G-11.2 — Block a submit on an element with local changes", "G-11.3 — Do not block an element when only another file has local changes" |
| G-13.1 | `submit-footer.spec.ts` › "G-13.1 — Show the commit and \"pushed\" after an approval" |
| G-13.2 (up to the toast, RP-52) | `submit-footer.spec.ts` › "G-13.2 — Show the commit without \"pushed\" when auto-push is off"; the sidebar step: task-040-update-and-push-from-the-sidebar |
| G-14.1, G-14.2 | `submit-footer.spec.ts` › "G-14.1 — Show the CLI's reason when a submit is refused", "G-14.2 — Show the refusal when the element moved in the meantime" (no `memory reject` process: task-032 `test/server/http/element-writes.test.ts` row 9) |
| X-07.1, X-07.2, X-07.3 (TT-STATE-03) | `submit-footer.spec.ts` › "X-07.1 — Announce a toast", "X-07.2 — Announce a refusal assertively", "X-07.3 — Expose the reason of a blocked action" |
| keyboard (accessibility bar) | `submit-footer.spec.ts` › "Submit and close the toast with the keyboard only" |
| TT-PERF-02 (G-04.1, G-10.1, G-13.2) | `test/e2e/performance.spec.ts` › "TT-PERF-02 — gate and submit latency @perf" › "G-04.1, G-13.2 — approve …", "G-10.1 — submit …" (budget in `test:timing`) |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` › "X-06.4 — Pass the axe scan: element panel — submit footer", "X-09.1 — Render every string from the message catalogue: element panel — submit footer" |

### review round 1 (2026-10-16)

Independent review: **CHANGES REQUESTED** (R1, R2 major; R3–R5 minor; R6–R8 nits; the D38-1
deviation accepted with option A). Red first (`7be21e1`), fixes (`c67cfcc`).

- **R1 (major)** — at 1280×720 the bottom-centre stack covered the drawer footer's main button
  (hidden in e2e: Playwright waits until the button receives events). Change: `toastPlacement`
  (`web/src/shell/toasts.ts`) and `usePlacement` (`Toasts.tsx`, followed while toasts are shown:
  resize, DOM changes): with the drawer open the stack is centred in the area left of it, or —
  when that area is narrower than 360 px (`TOAST_MIN_ROOM`) — just above the drawer's footer;
  ux-reference 1.5 §5 and the user guide say so. Tests: `toasts.test.tsx` › placement table (4
  cases); `submit-footer.spec.ts` G-14.1 (`document.elementFromPoint` at Submit's centre is Submit,
  a second click without `force`, then at 600×720 the toast's bottom is above Submit) and G-14.2
  (Approve and Reject under the refusal). Red by fault injection (placement disabled, not
  committed): G-14.1 and G-14.2 failed on `expectOnTop`.
- **R2 (major)** — the 8 s timer raced the refetch wait (G-10.1) and the Tab walk (keyboard test).
  Change: G-10.1 (and G-13.1, G-13.2) assert and hover the toast right after the click, before any
  state or commit check; the keyboard test hovers the toast before the walk (paused, D38-2). No
  time-based branch.
- **R3 (minor)** — React Aria's popovers (`ariaHideOutside`) hide everything but its top layer, so
  a toast raised while the role-view select, the bell or the switcher was open was never
  announced. Change: `data-react-aria-top-layer` on `.toasts`. Test: `toasts.test.tsx` › R3 (a
  `Popover` open, `main` aria-hidden, `.toasts` neither aria-hidden nor inert) — red before.
- **R4 (minor)** — `ConsoleOptions.settings` was ignored with a raw `stateFile` or an
  already-seeded `stateDir`. Change: `startConsole` throws in both cases (shape of C2 unchanged;
  JSDoc and `test/README.md`). Test: `test/e2e/harness/support.spec.ts` › "startConsole({ settings
  }) …" (the settings read back through `GET /api/settings`, both refusals) — red with the checks
  removed (fault injection).
- **R5 (minor)** — the limit evicted a sticky refusal. Change: the oldest **non-sticky** toast is
  evicted; with only sticky toasts a new one is added anyway; a toast removed while it held the
  focus (closed, evicted, replaced by its key) gives the focus to `#main` (a layout cleanup, the
  node still in the document). Tests: `toasts.test.tsx` › R5 ×2 — red before. User guide and
  ux-reference §5 aligned.
- **D38-1 option A** — every `.toast` is `aria-atomic="true"`, the two regions are not. Test:
  `toasts.test.tsx` › "every toast is aria-atomic" — red before.
- **R6 (nit)** — `test/README.md`: the `settings` text in the `support/console.ts` bullet, task-038's
  e2e text on a line of its own; `playwright.timing.config.ts` header lists TT-PERF-01 and TT-PERF-02
  under `@perf`.
- **R7 (nit, kept)** — the Submit footer shows its blocked reason above the actions, as task-037's
  gate footer does (D38-6 named "the reason under it": aligned with the gate footer instead).
- **R8 (nit, kept)** — `web/src/api/writes.ts` imports the toast content from
  `web/src/element/write-toast.tsx`: the mutation raises its own toast (D38-11), so the API module
  depends on that UI piece; no cycle (`write-toast.tsx` imports only types from `writes.ts`).

Checks after review round 1 (HEAD `c67cfcc` + notes):

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run docs:api`, `check_tasks.py v0.2` | clean / OK | — |
| `npm run test:coverage` | 158 files passed, 1 skipped; **2921 passed / 1 skipped**; statements 96.54 %, branches 91.08 %, functions 97.41 %, lines 98.33 % | — |
| `npm run test:e2e:chromium` (whole suite) | **258 passed** (8.9 min) | → 16.9 |
| `npm run test:e2e -- submit-footer.spec.ts gate-footer.spec.ts notification-bell.spec.ts accessibility.spec.ts element-panel.spec.ts project-header.spec.ts harness/support.spec.ts` (three engines) | **381 passed**, 0 failed (15.0 min) | — |
| `npm run test:timing` (started at load 10.7, via the slot) | Vitest **5/5** (TT-PERF-07 10/10 at ~60.0 s), Playwright **20/20**; **TT-PERF-02** approve p95 **477 ms**, submit p95 **425 ms** (20 runs each, budget 3.0 s); TT-PERF-01 p95 114 ms; TT-PERF-04 within budget | 10.7 → 3.8 |
| `npm run test:smoke` | not run: no packaging, launcher or bin change | — |

No console left, no `wfui-*` entry in the system temporary directory.

### review round 2 (2026-10-17)

Independent review: round-1 findings verified closed (8 of 15 `toasts.test.tsx` cases fail on
`7be21e1`); **CHANGES REQUESTED** for three regressions of the R1 fix and a nit. Red first
(`67cb908`, `bc0b9b1`), fixes (`470db65`, `94ed656`, `2e80680`).

- **R2-1** — in narrow mode a drawer without `.element-footer-slot` (loading, read error) used the
  drawer's top as the footer's: the stack went off-screen. Change: `toastPlacement` takes
  `drawer.footerTop` as optional; without it the stack keeps the default bottom. Test: placement
  row "a narrow drawer with no footer yet".
- **R2-2** — the area left of the drawer included the 220 px sidebar, so the stack covered the
  sidebar foot (task-039's Git status, task-040's Update/Push). Change: the area is bounded by
  `#main`'s left edge — centre `(mainLeft + drawerLeft) / 2`, room `drawerLeft − mainLeft` (no
  `#main` → 0); ux-reference §5 and the user guide reworded. Tests: placement rows "room between the
  sidebar and it" and "less than 360 px right of the sidebar"; `submit-footer.spec.ts` G-14.1 checks
  the toast's left edge is not left of `#main`.
- **R2-3** — an all-sticky stack was unbounded. Change: `maxHeight` from the placement (the room
  between the shell header and the stack's bottom; a CSS fallback), `overflow-y: auto`; when it
  overflows the stack gets `toasts-overflow` (pointer events on, the newest toast scrolled into
  view; a DOM measure in a layout effect); its Close buttons keep it keyboard-reachable. User
  guide: "at most three toasts that close by themselves …; refusals and failed pushes stay until
  you close them". Tests: `toasts.test.tsx` › R2-3 (class only while it overflows); e2e
  `submit-footer.spec.ts` › "Refusals that overflow the window stay reachable" (400×600, three
  `cli-refused` answers of 12 lines through `page.route`, the oldest toast's Close on top and closing
  it, axe in both themes).
- **Found while making R2-3's e2e pass (fixed here, recorded):** (a) on a window this small the
  stack also covered the drawer's own header and its Close: the stack over the drawer is now bounded
  below the drawer's header too (`drawer.headerBottom`; placement rows updated; red `test(web): red —
  a narrow toast stack stays below the drawer's header`); the e2e reaches the next controls with the
  keyboard (the stack may cover the page under three tall refusals — what their Close is for) and
  checks the drawer's Close is on top. (b) axe `scrollable-region-focusable` (serious) on the
  `pre.verbatim` of a toast (its own `max-height` scroll, since round 0): the toast's verbatim text
  no longer scrolls by itself (the stack does).
- **R2-4 (nit)** — the placement observed `childList` of the whole `document.body` and missed
  non-`childList` footer moves. Change: a `ResizeObserver` on `.drawer` and `.element-footer-slot`
  (re-targeted when they change), a `childList` observer on the shell root only, both disconnected
  when no toast is left (guarded where `ResizeObserver` does not exist, e.g. jsdom).

Checks after review round 2 (HEAD `2e80680` + notes):

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run docs:api`, `check_tasks.py v0.2` | clean / OK | — |
| `npm run test:coverage` | **2924 passed / 1 skipped**; statements 96.44 %, branches 91.00 %, functions 97.29 %, lines 98.28 % | — |
| `npm run test:e2e:chromium` (whole suite) | **259 passed** (9.5 min); TT-PERF-02 default runs approve p95 1 394 ms, submit p95 1 477 ms (no budget) | 16.9 |
| `npm run test:e2e -- submit-footer.spec.ts gate-footer.spec.ts notification-bell.spec.ts accessibility.spec.ts element-panel.spec.ts project-header.spec.ts harness/support.spec.ts` (three engines) | **384 passed**, 0 failed (13.6 min) | — |
| `npm run test:timing` | not repeated (passed after round 1 at load 10.7; the placement change does not touch the write path) | — |

No console left, no `wfui-*` entry in the system temporary directory.

### review round 3 (2026-10-17)

Independent review: round-2 findings and the extras (a), (b) verified (7 of 18 `toasts.test.tsx`
cases fail on `0ada464`); **CHANGES REQUESTED** (1 minor, 3 nits). Red first (`0c6b94f`), fix
(`0740045`).

- **R3-1 (minor)** — the overflow effect scrolled to the end on every toasts or placement change:
  the user's scroll was lost on a dismiss or a re-placement, and a tall newest toast showed only its
  end. Change: the stack scrolls only when a toast was **added** (its id above the newest seen), to
  that toast's top (`offsetTop` in the stack: title and Close shown), and only once the stack has
  its overflow class. Test: `toasts.test.tsx` › R3-1 (scroll to the added toast's top; a user
  scroll kept on a dismiss and on a resize; a later toast scrolled to again).
- **R3-2 (nit)** — `overflow-y: auto` only on `.toasts-overflow` (a scroll container clips the
  shadows); `max-height` stays on `.toasts`.
- **R3-3 (nit, refines R5)** — a toast removed while it held the focus hands its position to the
  stack, which focuses the Close of the toast now at that position (the next one), else the last
  (the previous one), else `#main`. Tests: R5/R3-3 (replaced by key → the replacing toast's Close;
  evicted → the next toast's) and R3-3 (close the middle → next, the last → previous, the only one
  → `#main`). User guide and ux-reference §5 reworded.
- **R3-4 (nit)** — `toasts-overflow` is React state in `className` (the DOM measure sets the
  state), not a `classList` toggle. Test: R3-1 asserts the class string.

Checks after review round 3 (HEAD `0740045` + notes):

| Gate | Result |
|------|--------|
| `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run docs:api`, `check_tasks.py v0.2` | clean / OK |
| `npm run test:coverage` | **2926 passed / 1 skipped**; statements 96.47 %, branches 91.02 %, functions 97.30 %, lines 98.28 % |
| `npm run test:e2e:chromium` (whole suite) | **259 passed** (8.5 min) |
| `npm run test:e2e -- submit-footer.spec.ts gate-footer.spec.ts notification-bell.spec.ts accessibility.spec.ts element-panel.spec.ts project-header.spec.ts harness/support.spec.ts` (three engines) | **384 passed**, 0 failed (13.5 min) |

No console left, no `wfui-*` entry in the system temporary directory.
