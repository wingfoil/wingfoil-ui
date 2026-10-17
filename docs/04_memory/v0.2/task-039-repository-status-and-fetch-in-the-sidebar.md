---
id: task-039-repository-status-and-fetch-in-the-sidebar
type: task
title: "Repository status and fetch in the sidebar"
status: in-review
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-Y-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-033-git-copy-state-repository-status-and-transport-routes", "task-034-auto-sync-scheduler-and-auto-push", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The repository status in the sidebar (Y1, Y2): branch, ahead/behind, local changes, detached
HEAD, *Fetch* with *Cancel*, the time of the last successful fetch and the last fetch error; the
sync controls and counts hidden without a remote (`has-remote`) and shown again once one is added;
a capability that does not apply hidden, one my role lacks read-only with the reason (S3).

**Backlog items:** US-Y-01, US-Y-02, US-Y-03, US-Y-04, US-S-11

- US-Y-01 — As a member, I want the branch, ahead/behind counts and local changes in the sidebar, so that I know whether my copy is current
- US-Y-02 — As a member, I want the remote fetched automatically (on by default) and on demand, so that ahead/behind is always fresh
- US-Y-03 — As a member, I want a failed fetch (offline, authentication) shown with the time of the last successful fetch, without blocking reading, so that I know how fresh the status is
- US-Y-04 — As a member of a repository with no remote, I want the sync controls hidden, so that the UI does not offer what cannot apply
- US-S-11 — As a member, I want a capability that applies to the project but that its WingFoil version or my role lacks shown read-only with the reason, and one that does not apply hidden, so that I can tell "not now" from "not here"

## Acceptance Criteria

- **US-Y-01** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-01.1 Show branch, ahead/behind and local changes; Y-01.2 Show an up-to-date copy; Y-01.3 Show a detached HEAD
- **US-Y-02** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-02.1 Fetch automatically; Y-02.2 Fetch on demand; Y-02.3 Do not fetch when auto-fetch is off
- **US-Y-03** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-03.1 Report a failed fetch with the last successful time; Y-03.2 Report a fetch refused for authentication
- **US-Y-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-04.1 Hide sync controls without a remote; Y-04.2 Show the controls once a remote is added
- **US-S-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-11.1 Show a capability my role lacks as read-only with the reason; S-11.2 Hide a capability that does not apply to the project

Also closes Y-01.3 of TT-STATE-04 (task-033-git-copy-state-repository-status-and-transport-routes) and Y-02.1 of TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push).
RP-53: Y-02.1, Y-02.3 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44). S-11.1 uses the informational footer of
task-037-gate-footer-with-every-outcome.

Screen: `docs/00_reference/ux-reference.md` §3 (*Git status* in the sidebar, *Sidebar*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-010` §3 (`repository`, `sync.fetch`), §5 (`no-remote`, `no-fetch-target`), §7
  (`has-remote` hides the controls, branch and local changes always shown); `spec-004` §3
  (`conditions`), §6 (`repo`); `spec-001` §6.

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
the three `depends_on` tasks (task-033, task-034, task-037: design, decisions, red/green/refactor,
every review round); `dev-loop-rel-v0.2-plan` Sessions 1–5 and the hand-overs to Wave 5;
`release-planning-rel-v0.2-plan` RP-14, RP-19, RP-25, RP-36, RP-37, RP-40, RP-43, RP-44, RP-52,
RP-53, RP-55; spec-010 (all, with its Process Notes), spec-003 §6, spec-004 §3/§6, spec-008 §4/§6;
`repository-status.feature` (Y-01.x, Y-04.x), `fetch.feature` (Y-02.x, Y-03.x),
`capabilities.feature` S-11.1/S-11.2, `update.feature` and `push.feature` (task-040's wording on
the same sidebar); the task descriptions of task-038, task-040, task-041 (parallel and next
neighbours); ux-reference 1.4 §2, §3 (*Git status*, *Sidebar*); the prototype's sidebar foot (a
block under a divider: status dot + "In sync with git" or "N commits to push" + *Push*, then
`main @ <hash>` in mono; no fetch control in the prototype); code: `web/src/routes/project.tsx`
(`ProjectNav`, layout), `routes/nav.ts`, `web/src/api/{queries,query-keys,writes,client,events,
error-message}.ts`, `web/src/project/ProjectHeader.tsx`, `web/src/element/ElementFooter.tsx`,
`web/src/shell/ErrorText.tsx`, `web/src/theme/base.css` (`.project-nav` is the sticky sidebar),
`contracts/src/git.ts`, `contracts/src/state.ts` (`UiSettings`); tests `test/e2e/support/*`
(`console.ts` seeds `settings: {}`, `git-http.ts` with `credentials` and `hold`, `screens.ts`,
`strings.ts` date renderings, `cold-read.ts` `refreshClock`), `test/e2e/gate-footer.spec.ts`,
`test/server/http/git-console.ts` (`remoteCommit`), `test/timing/auto-sync.timing.test.ts`
(`GIT_TRACE` count).

**depends_on (dl-015 hard gate) — task-033, task-034, task-037, acknowledged.**

- task-033: `GET /api/p/:pid` carries `repository` (`branch`, `copy`, `ahead`, `behind`,
  `upstream`, `localChanges`, `head`, `sync`) and top-level `conditions` (`has-remote`), both
  required (D33-14); the sync controls are hidden by `has-remote`, never by `copy`, and the branch
  and local changes always shown (spec-010 §7). `POST …/git/fetch` takes no body or `{}`; 200
  `{ repository }`; 409 refusals `no-remote`, `no-fetch-target`, `refspec-outside-remotes`,
  `remote-not-owned`, `remote-unreadable` are **not** recorded in `sync.fetch.lastError` (only git
  failures are: 422 `git-refused`, message redacted, ≤ 4 000 characters); a fetch is allowed to an
  unidentified user (RP-14). Cancel: the page aborts the request, the server kills the process
  group; open point still standing — the aborted request answers 500 `internal` to a client that
  has left and nothing is recorded, so the page must treat its own abort as "cancelled", never as
  an error. `repo` is sent when the copy state or a last error changes (RP-40), never for a new
  `lastSuccessAt` alone (read by the next `GET`). Catalogue `error.*` keys of every transport code
  already exist (D33-13, D34-9/10, W4-9, W4-14); `errorMessage` renders `detail.files` as a list.
- task-034: every real-bin console fetches every 60 s (`autoFetch` on by default); a test that
  counts git processes or wants a stable copy seeds `autoFetch: false` through the state file; the
  e2e settings seed helper was left to tasks 039–041 (C5); `fetchIntervalSeconds` minimum 15 (RP-19,
  RP-53); a change of `autoFetch`/interval re-arms the timer with an immediate tick; codes recorded:
  `sync.fetch.lastError.code` `fetch-timeout` / `config-in-worktree` (empty message),
  `sync.update.lastError.code` incl. `merge-not-fast-forward`, `config-in-worktree`, `diverged`,
  `local-changes-in-the-way` (`detail.files`); the 0-fetch count uses the bin's `GIT_TRACE` file,
  which must also hold a `git status` line (not vacuous).
- task-037: the gate footer shows disabled outcomes with the descriptor's reason as visible line and
  accessible description (`element.reason.*`, D37-8); a member without the gate's role gets "Reserved
  to {role} — {members} can act" (G-09.x) — S-11.1 runs on it here; `element.reason.copyDetached`
  reads "Blocked: your copy is on a detached HEAD" while Y-01.3 expects "Blocked: no branch checked
  out" (D39-11); task-040 appends "— Update" to `copyBehind`.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| Y-01.1, Y-01.2 (branch, "1 ahead", "2 behind", "3 local changes"; "In sync with git") | **red-first** | `test/web/repository/model.test.ts` (pure view of every `copy`), `test/web/repository/git-status.test.tsx`; e2e |
| Y-01.3 sidebar part ("Detached HEAD" + short hash) | **red-first** | same; e2e |
| Y-01.3 "governed actions are blocked with 'Blocked: no branch checked out'" | **characterization** of task-033 row 8 / task-037 footer; **red-first** for the text if D39-11 (a) | e2e on `task-001-login-form` |
| Y-02.1 (auto-fetch → "1 behind" by itself; interval 15 s, RP-53) | **red-first** (UI); the scheduler is **characterization** (task-034) | e2e; timing per D39-10 |
| Y-02.2 (Fetch on demand) | **red-first** | component (request, pending, Cancel), `test/web/api/git.test.ts`; e2e |
| Y-02.3 (auto-fetch off → 0 `git fetch`) | **characterization** (server, task-034) + **red-first** UI part (the sidebar still reads "In sync with git" after a remote commit) | e2e (D39-9) |
| Y-03.1, Y-03.2 (failed fetch with last successful time; git's message) | **red-first** | model + component (time selection, message reachable on hover and focus); e2e (unreachable remote; git-http `credentials`) |
| Y-04.1 (no remote: branch + local changes, no Fetch/Update/Push) | **red-first** with a positive control (a guard-removal check, since nothing renders today) | component; e2e |
| Y-04.2 (Fetch shown once a remote is added, 5 s) | **red-first** UI; refresh path **characterization** (task-033 watcher, `repo`) | e2e `@live-refresh` + `refreshClock` (5 s only in `test:timing`) |
| S-11.1 (Jordan, `dl-002-use-fastify`: "Reserved to approver — Morgan, Alex can act") | **characterization** (task-037 footer) | e2e |
| S-11.2 (no Push/Fetch/Update on Today without a remote) | **red-first** with guard removal | e2e |
| Fetch *Cancel* (description, RP-37) | **red-first** | component (abort → no error shown); e2e with git-http `hold` |
| fetch refusals 409 (not recorded) shown | **red-first** | component |
| `sync.update.lastError` rendered (hand-over) per D39-6 | **red-first** | model + component |
| SCREENS / X-06.4 / X-09.1 (D39-12) | **red-first** | appended screen; own-spec `scanThemes` on the states |
| REQ-INT-08 | check | own spec on the three engines (W0-9) |

e2e closure (planned):

| Scenario | spec file › test |
|----------|------------------|
| Y-01.1, Y-01.2, Y-01.3 (TT-STATE-04 Y-01.3 of task-033) | `test/e2e/git-status.spec.ts` › "Y-01.1 — …", "Y-01.2 — …", "Y-01.3 — …" |
| Y-02.1 (TT-PERF-07 Y-02.1 of task-034), Y-02.2, Y-02.3 | `git-status.spec.ts` › "Y-02.1 — …", "Y-02.2 — …", "Y-02.3 — …" |
| Y-03.1, Y-03.2 | `git-status.spec.ts` › "Y-03.1 — …", "Y-03.2 — …" |
| Y-04.1, Y-04.2 | `git-status.spec.ts` › "Y-04.1 — …", "Y-04.2 — …" (`@live-refresh`) |
| S-11.1, S-11.2 | `git-status.spec.ts` › "S-11.1 — …", "S-11.2 — …" |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` over `SCREENS` › the appended screen (D39-12) |

#### What the sidebar shows (pure, `web/src/repository/model.ts`)

`gitStatusView(repository, conditions)` → `{ head: {branch} | {detached, commit}, commit (7 chars,
none before the first commit), localChanges, sync?: { copy line, fetch: { failed?, lastSuccessAt },
update?: lastError } }` — `sync` absent unless `has-remote` holds (spec-010 §7). Copy line per
`copy` (D39-7): `in-sync` "In sync with git"; `ahead` "{n} ahead"; `behind` "{n} behind";
`diverged` "{a} ahead · {b} behind"; `no-upstream` (upstream named or not); `detached` no counts;
`no-remote` never (has-remote false). Local changes "{n, plural, …} local changes" whenever > 0,
with or without a remote. No methodology literal (REQ-ARC-05): the copy values are compared through
a table keyed by the contract type, not as bare literals where the lint applies.

#### Component and file layout (planned, pending D39-1 … D39-13)

- `web/src/repository/model.ts` (new, pure), `web/src/repository/GitStatus.tsx` (new),
  `web/src/repository/git-status.css` (new; spec-009 tokens only). task-040 extends these with
  *Update* and *Push*.
- `web/src/api/git.ts` (new, **shared** with task-040, D39-2): `postGitOperation(pid, op, signal?)`
  and `useGitOperation()`.
- `web/src/routes/project.tsx` (shell layout, RP-55 append-only): the sidebar foot (D39-1).
- `web/src/theme/base.css`: only if D39-1 (a) (the sticky rule moves to the wrapper).
- `web/src/i18n/en.json`: `shell.git.*` keys inserted sorted; `element.reason.copyDetached` text if
  D39-11 (a).
- `test/e2e/support/console.ts`: `ConsoleOptions.settings` (D39-3, **shared**);
  `test/e2e/support/remote.ts` (new, **shared** with task-040): `remoteCommit(fixture, file,
  content)` (another clone pushing to the copy's bare `origin`), `setRemoteUrl(fixture, url)`;
  `test/e2e/support/screens.ts` (D39-12, append-only); `test/e2e/support/strings.ts` (one appended
  rendering if D39-8 (a)).
- Docs: `docs/user-guide.md` (*Git status in the sidebar*: what is shown, Fetch and Cancel, the
  failure line; the transport statement of spec-010 §4 that task-033 left to the sidebar tasks),
  `docs/00_reference/ux-reference.md` §3 *Git status* v0.2 bullet (`ux-consistency`), `CHANGELOG.md`
  *Unreleased* › Added, `test/README.md` version line + layout lines — version numbers from the
  coordinator.

#### Test plan

- Vitest (jsdom): `test/web/repository/model.test.ts` (every `copy`, has-remote on/off, detached,
  initial commit, local changes 0/1/n, fetch error with and without `code`, `lastSuccessAt` null /
  today / earlier, update error codes); `test/web/repository/git-status.test.tsx` (rendering per
  state; Fetch → `POST …/git/fetch` with no body; pending: Fetch aria-disabled "Fetching…", Cancel
  shown, status region; Cancel aborts and shows no error; 200 → header data updated from the
  response; 409 refusal → alert with the catalogue text, cleared on the next fetch; 422 → header
  re-read; git's message reachable on hover and on keyboard focus and as accessible description;
  keyed by pid: a running fetch of project A never shows in B); `test/web/api/git.test.ts` (path,
  method, signal, cache update / invalidation); `test/web/routes/*` only where the layout test
  needs the foot.
- Playwright `test/e2e/git-status.spec.ts` (`prebuild: ['kanban', 'custom']`), one test per
  scenario, each on its own fixture copy, settings seeded `autoFetch: false` except Y-02.1
  (interval 15 s); `scanThemes` on the sidebar in Y-01.1, Y-01.3, Y-03.1 (tooltip open), Y-04.1;
  the cancel test with `startGitHttpRemote(…, { hold: true })`; Y-03.1 with an `http://127.0.0.1`
  port nothing listens on (git-refused, not `remote-unreadable`); Y-03.2 with git-http
  `credentials` (git: "could not read Username … terminal prompts disabled"); expected times
  computed in the page with the same Intl options from the API's `lastSuccessAt`.
- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own
  specs (`git-status.spec.ts`, `accessibility.spec.ts`, and any spec whose sidebar assertions move)
  on the three engines, `check_tasks.py v0.2`; `test:timing` only at load < 12 — every heavy gate
  through the machine-free slot.

#### Open decisions (STOP: reported to the coordinator as D39-1 … D39-13; nothing depending on
them is built before the answer)

- **D39-1 — sidebar structure (shell layout, shared with task-041's *Configuration*).** ★ (a) a
  wrapper `<div class="project-sidebar">` in `ProjectLayout` holds `<ProjectNav>` (unchanged
  markup, landmark "Project views") and a `<div class="sidebar-foot">` pinned at the bottom
  (ux-reference §2) holding `<GitStatus pid>` as a labelled region "Git status"; the sticky/size/
  border rule moves from `.project-nav` to `.project-sidebar` (one rule of `base.css` and its
  narrow-screen variant); task-041 adds its entry as one line in `sidebar-foot` above
  `<GitStatus>`; (b) `<GitStatus>` appended as the last child inside `<nav>` (append-only, no
  `base.css` edit; a region with a button inside the navigation landmark); (c) a sibling
  `<aside>` positioned fixed at the bottom of the sidebar column (fragile with the sticky nav and
  the narrow layout).
- **D39-2 — the transport mutation (shared with task-040).** ★ (a) `web/src/api/git.ts`:
  `postGitOperation(pid, op: GitOperation, signal?)` and `useGitOperation()` =
  `useMutation<GitResponse, ApiError, { pid, op, signal? }>` — the caller owns the
  `AbortController` (Cancel for fetch and push, RP-37); on 200 the header's `repository` is set from
  the response (`setQueryData` on `projectHeaderQuery(pid)`: no extra read; a moved state also
  sends `repo`); on an error other than the page's own abort the header key is invalidated (a 422
  records `lastError`); an abort is reported as `cancelled`, never as an error; (b) one hook per
  operation (`useGitFetch`, task-040 adds `useGitUpdate`, `useGitPush`); (c) in
  `web/src/api/projects.ts` (merge hot spot).
- **D39-3 — e2e settings seed (shared with task-038, task-040, task-041; C5).** ★ (a)
  `ConsoleOptions.settings?: Partial<UiSettings>` written into the seeded `state.json`'s
  `settings` (also with `stateDir` when not yet seeded); owned by the first task to merge (task-038)
  or, if 038 does not need it, by this task — one identical shape either way; (b) each spec writes
  `state.json` itself through `stateFile`; (c) a separate `seedSettings(stateDir, settings)` helper.
- **D39-4 — git's message (Y-03.1 "on hover", Y-03.2).** ★ (a) the failure line ends with a small
  focusable info button whose React Aria `Tooltip` shows git's message on hover **and** on keyboard
  focus (Escape closes it), the message also the button's accessible description (WCAG 1.4.13,
  2.1.1); long messages wrap (`pre-wrap`, max height with scroll); (b) a `<details>` disclosure
  "Git's message" under the line (keyboard and touch friendly, no hover); (c) a native `title`
  attribute (hover only: not reachable by keyboard or touch).
- **D39-5 — refusals of a manual fetch (409, not recorded).** ★ (a) an alert inside the git status
  block (`ErrorText`, catalogue text), outside the parts that re-render on refetch, cleared when the
  next fetch starts or a later fetch succeeds (`lastSuccessAt` moves); (b) task-038's toast (a
  dependency on its toast API, being built in parallel); (c) both.
- **D39-6 — `sync.update.lastError` (hand-over says 039; task-040 lists "the last update error").**
  ★ (a) this task renders it — the catalogue text of its code (`errorMessage`, `{files}` list;
  `git-refused`: "Update failed" + git's message as in D39-4) under the copy line, so the automatic
  update's errors (`autoUpdate` exists since task-034) are visible now; task-040 adds the *Update*
  and *Push* buttons next to it and its scenarios assert the texts; (b) fetch errors only, the update
  error line is task-040's.
- **D39-7 — copy-line texts (new keys `shell.git.*`, ux-reference §3 v0.2 bullet).** ★ (a) `in-sync`
  "In sync with git"; `ahead` "{count} ahead"; `behind` "{count} behind"; `diverged` "{ahead} ahead ·
  {behind} behind"; `no-upstream` "No upstream branch on the remote" or, when `upstream` is named,
  "{upstream} is not on the remote yet — Fetch reads it"; `detached` "Detached HEAD at {commit}";
  the head line `main` and `41c0e2a` in mono (prototype's `main @ <hash>`); local changes "{count,
  plural, one {# local change} other {# local changes}}" when > 0. The "N commits to push" line
  with *Push* stays task-040's (Y-07.2/G-13.2 next to Y-08.1's "1 ahead"); (b) as (a) but
  `no-upstream` one text without the name; (c) the prototype only ("In sync with git" or counts), no
  `no-upstream` / detached wording beyond the scenarios.
- **D39-8 — time of the last successful fetch.** ★ (a) `timeStyle: 'short'` when the fetch was
  today ("Fetch failed — last fetched at 10:02 AM"), `dateStyle: 'medium', timeStyle: 'short'`
  otherwise (as the element history), "not fetched since the console started" when `null`; one
  appended `timeStyle`-only rendering in the X-09.1 checker (`strings.ts`); (b) always date and time
  (no checker change; longer in a 220 px sidebar); (c) 24-hour `10:02` (`hourCycle: 'h23'`, the
  scenario's literal, not the locale's).
- **D39-9 — where `lastSuccessAt` shows.** ★ (a) only in the failure line: a successful automatic
  fetch that moves nothing sends no `repo` (RP-40), so a permanent "Last fetched at …" would go
  stale; (b) always ("Last fetched at …" under the copy line), stale until the next refetch; (c)
  always, amending spec-010 §2 so a new `lastSuccessAt` sends `repo` (one event and header read per
  project per tick, against RP-40).
- **D39-10 — elapsed-time scenarios.** ★ (a) Y-02.1 in `test:e2e` with `fetchIntervalSeconds` 15
  (RP-53), the "1 behind" waited for with interval + `COLD_READ_MS`; the same test tagged
  `@live-refresh` runs in `test:timing` with the default 60 s and asserts ≤ 65 s from the remote
  commit, once (the 10-of-10 stays in task-034's API timing test); Y-02.3 in `test:e2e`: autoFetch
  off, interval 15 s, a remote commit, then two intervals plus 5 s (a stated, justified fixed wait:
  the scenario is about time passing) → the sidebar still reads "In sync with git" and the bin's
  `GIT_TRACE` file holds 0 `git fetch` and ≥ 1 `git status`; Y-04.2 `@live-refresh` with
  `refreshClock` (5 s only in `test:timing`); (b) as (a) without the Y-02.1 timing run (its budget
  proved API-side by task-034 only); (c) Y-02.3 only API-side (task-034), no e2e (against RP-53).
- **D39-11 — Y-01.3's "Blocked: no branch checked out" vs `element.reason.copyDetached`
  ("Blocked: your copy is on a detached HEAD", task-037 D37-8).** ★ (a) change the catalogue value
  of `element.reason.copyDetached` to "Blocked: no branch checked out" (the scenario's and
  `error.detachedHead`'s text; one value edit, no key change); (b) keep task-037's text and amend
  Y-01.3 in `repository-status.feature` (BDD version bump); (c) keep both and assert only that the
  footer is blocked (scenario text not met).
- **D39-12 — SCREENS.** ★ (a) the default git status is already on every project screen; append one
  entry "git status — fetch failed" on a fourth project of `startScreensConsole` (a kanban copy whose
  `origin` points to an unused `127.0.0.1` port; its `open` clicks *Fetch*, waits for the failure
  and opens the tooltip) — one more project in the switcher screen; the detached / no-remote /
  fetching states scanned in the own spec; (b) no SCREENS change, every state scanned in the own
  spec (`scanThemes` + strings check); (c) one entry per state (four consoles' worth of projects).
- **D39-13 — fetch while pending and focus.** ★ (a) *Fetch* stays in place, `aria-disabled` with
  the text "Fetching…" (focus kept, D37-3 pattern), *Cancel* appears after it; a polite status
  region says "Fetching…" and then nothing (the copy line and the failure line are the outcome, in a
  polite region); after Cancel the focus returns to *Fetch*; (b) the *Fetch* button turns into
  *Cancel* (one button; a double click cancels); (c) *Fetch* hidden while pending, focus moved to
  *Cancel*, back to *Fetch* at the end.

Accepted / stated (not decided): the sidebar shows the header's data, so a header read error is
shown only by the project header (the sidebar renders nothing then); *Fetch* is shown to every
identity and on an unsupported WingFoil version (RP-14; transport runs no CLI); a cancelled fetch
leaves whatever git wrote (the next status read shows it).

#### Decisions (approver, 2026-10-16)

"All as recommended": D39-1 (a) … D39-13 (a). Coordinator's shared shapes of Wave 5 (C1–C10):

- **C1** merge order 038 → 039 → 041.
- **C2** `ConsoleOptions.settings?: Partial<UiSettings>` is owned by task-038; this branch carries an
  identical copy (same place in `test/e2e/support/console.ts`) until 038 merges.
- **C3** this task owns `<div class="project-sidebar">` and `<div class="sidebar-foot">` in
  `web/src/routes/project.tsx` and the move of the sticky rule in `base.css`; task-041 puts
  *Configuration* as a pinned group inside the nav (`routes/nav.ts`), not in `sidebar-foot`.
- **C4** toasts are task-038's; fetch refusals stay in this task's own alert (D39-5).
- **C5** this task adds `web/src/api/git.ts` (`useGitOperation`) and uses `projectHeaderQuery`.
- **C6** the one declared catalogue value edit of this task: `element.reason.copyDetached` →
  "Blocked: no branch checked out" (D39-11); otherwise sorted inserts only.
- **C7** `test/README.md` 0.38, `docs/user-guide.md` 0.13, ux-reference 1.6; one *Unreleased* ›
  Added entry in `CHANGELOG.md`.
- **C8** `test/e2e/support/remote.ts` is created by task-038 (`remoteHead`); this task appends
  `remoteCommit` and `setRemoteUrl` (the file holds only them on this branch until 038 merges);
  `strings.ts` time-only rendering is this task's only.
- **C9** SCREENS appended in merge order; this task adds the fourth project of
  `startScreensConsole`.
- **C10** no change to `contracts/` or `server/`.

Spec amendments: none needed — spec-010 §3/§7 already describe what the sidebar reads, and the
copy-reason texts are the catalogue's (spec-003 §6 names codes, not this text). ux-reference §3
*Git status* gains the v0.2 bullet (1.6).

### red / green / refactor (2026-10-16)

- **Red (web)** — `31ba227`: `test/web/repository/model.test.ts`, `git-status.test.tsx`,
  `sidebar.test.tsx`, `test/web/api/git.test.tsx` (4 files failed: the modules did not exist; the
  layout test found no "Git status" region).
- **Green** — `0e87c39`: `web/src/api/git.ts` (`postGitOperation`, `useGitOperation`, `CANCELLED`),
  `web/src/repository/{model.ts,GitStatus.tsx,git-status.css}`, the sidebar wrapper
  `.project-sidebar` / `.sidebar-foot` in `routes/project.tsx` with the sticky rule moved in
  `base.css` (C3), `InfoSign` appended to `shell/icons.tsx`, 14 `shell.git.*` keys inserted in
  sorted place and the C6 value edit of `element.reason.copyDetached` (its row in
  `test/web/element/gate-footer.test.tsx` updated with the reason). Two test corrections on the
  first green run, not guards: the detached sentence holds the hash in its own `<code>` (asserted on
  the line's text), and the key build names the region by its key.
- **Deviation found on the first full web run:** an always-present empty `role="alert"` in the
  sidebar made the existing `getByRole('alert')` assertions of the gate footer, Today and the
  summary ambiguous (9 failures). The alert is now inserted with its content (announced on
  insertion), still outside the parts that change with the header's data (D39-5 unchanged).
- **Guard removal (web, each restored):** the `has-remote` guard (3 failures: model ×2, Y-04.1 /
  S-11.2 component), the ignored second press while pending (1), the refusal cleared when
  `lastSuccessAt` moves (1), `git-refused` kept out of the alert (1), the abort mapped to
  `cancelled` (2).
- **e2e** — `613f701`: `test/e2e/git-status.spec.ts` (13 tests), `ConsoleOptions.settings` (C2, an
  identical copy of task-038's shape), `support/remote.ts` (`remoteCommit`, `setRemoteUrl`; C8),
  the time-only rendering of the X-09.1 checker (D39-8), the fourth `SCREENS` project
  (`offlineCopy`, also in `no-commit.spec.ts`) and *git status — fetch failed* (D39-12). Written
  after the web code (the web unit tests were the red ones), so all passed on their first run
  (13/13 Chromium); guard removal on the bin: with the `has-remote` guard removed and the old
  `copyDetached` text back, Y-01.3, Y-04.1, Y-04.2 and S-11.2 failed (4/4), then restored. S-11.1
  is characterization of task-037's footer (passed as expected).
- Docs — `a4bb0fa`: `docs/user-guide.md` 0.13 (*Git status in the sidebar*),
  `docs/00_reference/ux-reference.md` 1.6 (§3 *Git status* and *Sidebar* v0.2 bullets),
  `test/README.md` 0.38 (layout, *Timing suite*), `CHANGELOG.md` *Unreleased* › Added.

#### e2e closure

| Scenario | spec file › test |
|----------|------------------|
| Y-01.1, Y-01.2 | `test/e2e/git-status.spec.ts` › "Y-01.1 — Show branch, ahead/behind and local changes", "Y-01.2 — Show an up-to-date copy" |
| Y-01.3 (TT-STATE-04 of task-033) | `git-status.spec.ts` › "Y-01.3 — Show a detached HEAD" (sidebar line; `task-001-login-form` outcomes aria-disabled, described "Blocked: no branch checked out") |
| Y-02.1 (TT-PERF-07 of task-034) | `git-status.spec.ts` › "Y-02.1 — Fetch automatically" (`@live-refresh`: 15 s in `test:e2e`, 60 s / ≤ 65 s under `test:timing`) |
| Y-02.2, Y-02.3 | `git-status.spec.ts` › "Y-02.2 — Fetch on demand", "Y-02.3 — Do not fetch when auto-fetch is off" |
| Y-03.1, Y-03.2 | `git-status.spec.ts` › "Y-03.1 — Report a failed fetch with the last successful time", "Y-03.2 — Report a fetch refused for authentication" |
| Y-04.1, Y-04.2 | `git-status.spec.ts` › "Y-04.1 — Hide sync controls without a remote", "Y-04.2 — Show the controls once a remote is added" (`@live-refresh`) |
| S-11.1, S-11.2 | `git-status.spec.ts` › "S-11.1 — Show a capability my role lacks as read-only with the reason", "S-11.2 — Hide a capability that does not apply to the project" |
| Cancel (RP-37) | `git-status.spec.ts` › "Fetch can be cancelled while it runs (RP-37, D39-13)" |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` › *git status — fetch failed* (and every project screen, which now shows the default git status) |

### checks (2026-10-16, HEAD before this note `a4bb0fa`)

Every heavy gate through the machine-free slot (`waitslot.sh`), load printed at its start.

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2` | OK (0 warnings) | — |
| `npm run test:coverage` (includes the public-text check) | 160 files passed, 1 skipped; **2930 passed / 1 skipped**; statements 96.55 %, branches 91.22 %, functions 97.32 %, lines 98.33 % (`web/src/repository` 98.7 %) | 3.0 |
| `npm run test:e2e:chromium` | **254 passed** (9.0 min) | 9.9 |
| `npm run test:e2e -- git-status accessibility no-commit gate-footer` (three engines) | **276 passed** (9.9 min) | 3.6 |
| `npm run test:timing` | **passed**: Vitest 5/5, Playwright 20/20 — Y-02.1 59.2 s from the remote commit to "1 behind" (budget 65 s, default 60 s interval), Y-04.2 227 ms (budget 5 s) | 3.4 |
| `npm run test:smoke` | not run: no packaging, launcher or bin change | — |

No console of this worktree left running; no `wfui-*` entry in the system temporary directory.

### review round 1 (2026-10-16)

Independent review **CHANGES REQUESTED** (no blocker, no major; R1–R9). Red tests first: `ee3cf9c`
(`test/web/repository/git-status.test.tsx` › review round 1: R3, R6, R7 ×2, R8 failed; R2 passed —
the key already held — and was checked by guard removal).

| Id | Change | Test |
|----|--------|------|
| R1 | the "Fetch failed …" expects of Y-03.1 / Y-03.2 (shown after a header re-read) and Y-02.2's "1 behind" wait with `COLD_READ_MS` | `git-status.spec.ts` |
| R2 | — (`key={pid}` already there) | component › R2: another pid → Fetch enabled, no Cancel, no alert, the first signal aborted; fails with the key removed (checked, restored) |
| R3 | a fetch that settles while *Cancel* holds the focus moves it to *Fetch* | component › R3 (red) |
| R4 | `scanThemes` on the "Fetching…" state, before Cancel | `git-status.spec.ts` › Cancel test |
| R5 | `.sidebar-foot { max-height: 50%; overflow-y: auto }` (`base.css`, the C3 rule): a tall git status scrolls, the views stay | `git-status.spec.ts` › "a tall git status never pushes the views out (review R5)" at 1280×700 — red with the two lines removed (see below), nav 32 px tall without them (Chromium), green with them |
| R6 | the ⓘ button also opens git's message on press, in a non-modal React Aria `Popover` with a `Dialog` named "Git's message" (`shell.git.message`); the tooltip stays for hover and keyboard focus (disabled while the popover is open), the description too. D39-4 now reads: tooltip on hover and focus, popover on press (a tap shows no tooltip). User guide "hover, focus or tap it"; ux-reference §3 bullet (versions kept at 0.13 / 1.6, the numbers assigned for this task) | component › R6 (red); `git-status.spec.ts` › Y-03.2 clicks the button and reads the dialog |
| R7 | the refusal alert also clears when `repository.state` moves or the sync part goes (`has-remote` false) | component › R7 ×2 (red) |
| R8 | the description span is `hidden` (`aria-describedby` still resolves), so the polite live region no longer announces git's message | component › R8 (red); with `visually-hidden` instead of `hidden` it fails (checked, restored) |
| R9 | the dead `.git-alert:empty` rule removed | — |

Checks after review round 1 (HEAD before this note `11ea0dd`, via the machine-free slot):
typecheck, lint, format:check clean; web suite 810 passed; `test:coverage` 160 files passed, 1
skipped, **2936 passed / 1 skipped** (statements 96.55 %, branches 91.26 %; load 11.6);
`test:e2e:chromium` **255 passed** (load 3.6); own specs (git-status, accessibility, no-commit,
gate-footer) on the three engines **279 passed** (load 10.2). No console left running.

### review round 2 (2026-10-17)

Independent review round 2: R1–R9 verified, **CHANGES REQUESTED** on the R6 fix (the reviewer's
probes: a non-modal popover reopened by a second press, never closed by a press outside — on a touch
screen it could not be closed). Red tests first, `604b5d0`: `git-status.spec.ts` › *git's message on
press (review round 2)* — both tests failed on Chromium (the second press left the dialog open);
the component tests of round 2 (focus into the dialog and back after Escape; a press outside) —
the press-outside case failed, the focus case passed in jsdom (the browser case is the e2e one).

| Id | Change | Test |
|----|--------|------|
| R2-1 | React Aria's own pattern: `DialogTrigger` (controlled, the tooltip disabled while open) around the `TooltipTrigger` + `Button`, and a dismissable `Popover` (no `isNonModal`) with the `Dialog` "Git's message"; the hidden description stays. Probed first in a scratch page on the three engines (second press, press outside, Escape, touch taps: all closed; WebKit touch only on a tap that lands on an element, as in the app). D39-4 now reads: tooltip on hover and keyboard focus while closed, a dismissable popover dialog on press | e2e › "a press without hover … closes it" (second press at the button's centre — the underlay covers the page —, outside on the view heading, Escape) and "on a touch screen …" (`hasTouch` context: tap, tap again, tap outside); component › press outside |
| R2-2 | — (the press no longer races the tooltip: `DialogTrigger` owns the press) | e2e › the first `info.click()` has no hover before it |
| R2-3 | the dialog takes the focus on open and gives it back to ⓘ after Escape; `aria-expanded` from `DialogTrigger` | e2e (`toBeFocused`), component R2-1/R2-3 |
| R2-4 | `scanThemes` while the dialog is open | `git-status.spec.ts` › Y-03.2 |

Docs: user guide (how to open and close the message) and ux-reference §3 bullet, versions kept at
0.13 / 1.6 (C7, the coordinator's rule for round fixes).

Checks after review round 2 (HEAD before this note `f76b8d7`, via the machine-free slot):
typecheck, lint, format:check clean; web suite 812 passed; own specs (git-status, accessibility,
no-commit, gate-footer) on the three engines **285 passed** (load 12.7 at the grant, rising from
the slot's ≤ 14 check); `test:coverage` 160 files passed, 1 skipped, **2938 passed / 1 skipped**
(statements 96.55 %, branches 91.26 %; load 10.5); `test:e2e:chromium` **257 passed** (load 3.6).
No console left running.

### before submit (2026-10-17, coordinator)

- Review round 3: **PASS** (no new finding).
- `main` (`a930ae3`, with task-038 merged) merged into the branch (`ae45c2b`, C1). Conflicts on append-only
  lines and version lines only: CHANGELOG (task-038's entry first), `test/README.md` 0.38 (0.37 kept in the
  history line), `docs/user-guide.md` 0.13 (0.12 kept), ux-reference 1.6 (1.5 kept), `SCREENS` (task-038's
  entry first), `test/e2e/support/remote.ts` (task-038's header and `remoteHead`, then `remoteCommit`,
  `setRemoteUrl`), `test/e2e/support/console.ts` (task-038's `ConsoleOptions.settings`, which throws for a
  `stateFile` or an already seeded `stateDir`; same seeding logic as this branch's copy).
- Checks after the merge (each heavy gate through the machine-free slot): typecheck, lint, format:check
  clean; `test:coverage` **2982 passed / 1 skipped** (statements 96.49 %, branches 91.11 %);
  `test:e2e:chromium` **277 passed** (9.5 min); `npm run test:e2e -- git-status.spec.ts accessibility.spec.ts
  no-commit.spec.ts gate-footer.spec.ts submit-footer.spec.ts` (three engines) **336 passed** (10.7 min).
  No console left, no `wfui-*` entry.
